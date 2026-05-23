import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Pagination } from "@/components/ui/Pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";

const statusConfig = {
  OPEN:      { labelKey: "pages:myObjections.status.OPEN",      color: "bg-amber-100 text-amber-700",     icon: Clock },
  ANSWERED:  { labelKey: "pages:myObjections.status.ANSWERED",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  ESCALATED: { labelKey: "pages:myObjections.status.ESCALATED", color: "bg-violet-100 text-violet-700",   icon: AlertTriangle },
};

export default function MyObjections() {
  const { t } = useTranslation(["pages"]);
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [testFilter, setTestFilter] = useState("ALL");
  const [reasonSearch, setReasonSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["myObjections"],
    queryFn: async () => {
      const { data } = await api.get("/me/objections");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const uniqueTests = useMemo(() => {
    const m = new Map();
    const fallback = t("pages:myObjections.filterBar.unnamed");
    for (const o of all) if (o.testId) m.set(o.testId, { id: o.testId, title: o.testTitle || fallback });
    return [...m.values()].sort((a, b) => a.title.localeCompare(b.title, "tr"));
  }, [all, t]);

  const filtered = useMemo(() => {
    const q = reasonSearch.trim().toLowerCase();
    return all.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (testFilter !== "ALL" && o.testId !== testFilter) return false;
      if (q) {
        const hay = `${o.reason ?? ""} ${o.questionContent ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, statusFilter, testFilter, reasonSearch]);

  const hasActiveFilter =
    statusFilter !== "ALL" ||
    testFilter !== "ALL" ||
    reasonSearch.trim().length > 0;

  const clearFilters = () => {
    setStatusFilter("ALL");
    setTestFilter("ALL");
    setReasonSearch("");
    setPage(1);
  };

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = useMemo(() => {
    const c = { OPEN: 0, ANSWERED: 0, ESCALATED: 0 };
    for (const o of all) if (c[o.status] != null) c[o.status]++;
    return c;
  }, [all]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{t("pages:titles.myObjections")}</h1>
        <p className="text-slate-500 mt-2">
          {t("pages:titles.myObjectionsDesc")}
        </p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { key: "total",     label: t("pages:myObjections.stats.total"),     value: all.length,       bg: "bg-slate-50",   color: "text-slate-800" },
          { key: "pending",   label: t("pages:myObjections.stats.pending"),   value: counts.OPEN,      bg: "bg-amber-50",   color: "text-amber-700" },
          { key: "answered",  label: t("pages:myObjections.stats.answered"),  value: counts.ANSWERED,  bg: "bg-emerald-50", color: "text-emerald-700" },
          { key: "escalated", label: t("pages:myObjections.stats.escalated"), value: counts.ESCALATED, bg: "bg-violet-50",  color: "text-violet-700" },
        ].map(({ key, label, value, bg, color }) => (
          <Card key={key} className={`${bg} border-0`}>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtre çubuğu */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages:myObjections.filterBar.statusLabel")}</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("pages:myObjections.filterBar.allStatuses")}</SelectItem>
                  <SelectItem value="OPEN">{t("pages:myObjections.status.OPEN")}</SelectItem>
                  <SelectItem value="ANSWERED">{t("pages:myObjections.status.ANSWERED")}</SelectItem>
                  <SelectItem value="ESCALATED">{t("pages:myObjections.stats.escalated")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages:myObjections.filterBar.testLabel")}</label>
              <SearchableSelect
                value={testFilter}
                onChange={(v) => { setTestFilter(v); setPage(1); }}
                options={uniqueTests.map((opt) => ({ value: opt.id, label: opt.title }))}
                allLabel={t("pages:myObjections.filterBar.allTests")}
                placeholder={t("pages:myObjections.filterBar.selectTest")}
                searchPlaceholder={t("pages:myObjections.filterBar.searchTest")}
                emptyText={t("pages:myObjections.filterBar.noResult")}
                ariaLabel={t("pages:myObjections.filterBar.testFilterAria")}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages:myObjections.filterBar.reasonLabel")}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                <Input
                  type="text"
                  placeholder={t("pages:myObjections.filterBar.reasonPlaceholder")}
                  value={reasonSearch}
                  onChange={(e) => { setReasonSearch(e.target.value); setPage(1); }}
                  className="h-9 pl-8"
                  aria-label={t("pages:myObjections.filterBar.reasonAria")}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-sm text-slate-500">{t("pages:myObjections.filterBar.count", { filtered: filtered.length, total: all.length })}</span>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                {t("pages:myObjections.filterBar.clear")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            {all.length === 0 ? (
              <>
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                <p className="text-slate-500">{t("pages:myObjections.empty.noneYet")}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t("pages:myObjections.empty.hint")}
                </p>
              </>
            ) : (
              <p className="text-slate-400">{t("pages:myObjections.empty.noResults")}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((obj) => {
              const daysLeft = obj.deadlineAt
                ? differenceInDays(new Date(obj.deadlineAt), new Date())
                : null;
              return (
                <Card key={obj.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className={statusConfig[obj.status]?.color ?? "bg-slate-100 text-slate-700"}>
                        {statusConfig[obj.status] ? t(statusConfig[obj.status].labelKey) : obj.status}
                      </Badge>
                      {/* obj.testTitle user-generated — çevrilmez */}
                      <span className="text-sm font-semibold text-slate-800 truncate max-w-[260px]" title={obj.testTitle}>
                        {obj.testTitle}
                      </span>
                      {obj.educatorName && (
                        <span className="text-xs text-slate-500">
                          <span className="text-slate-400">{t("pages:myObjections.card.educator")}</span> {obj.educatorName}
                        </span>
                      )}

                      {/* Yanıt göstergeleri */}
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                          obj.answerText
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                        title={obj.answerText ? t("pages:myObjections.card.educatorYes") : t("pages:myObjections.card.educatorNo")}
                      >
                        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("pages:myObjections.card.educatorChip")} {obj.answerText ? "✓" : "—"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                          obj.adminAnswerText
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                        title={obj.adminAnswerText ? t("pages:myObjections.card.adminYes") : t("pages:myObjections.card.adminNo")}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        {t("pages:myObjections.card.adminChip")} {obj.adminAnswerText ? "✓" : "—"}
                      </span>

                      <span className="flex-1" />
                      <span className="text-xs text-slate-400">
                        {format(new Date(obj.createdAt), "d MMM yyyy", { locale: tr })}
                      </span>
                      {obj.status === "OPEN" && daysLeft != null && (
                        <span className={`text-xs ${daysLeft <= 2 ? "text-rose-500" : "text-slate-400"}`}>
                          {daysLeft > 0 ? t("pages:myObjections.card.daysLeft", { count: daysLeft }) : t("pages:myObjections.card.deadlineExpired")}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(obj)}
                        className="shrink-0 h-8 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        {t("pages:myObjections.card.viewDetails")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      )}

      {/* Detay dialog'u (salt-okunur) */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
              {t("pages:myObjections.dialog.title")}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={statusConfig[selected.status]?.color ?? "bg-slate-100 text-slate-700"}>
                  {statusConfig[selected.status] ? t(statusConfig[selected.status].labelKey) : selected.status}
                </Badge>
                <span className="text-xs text-slate-500">
                  {t("pages:myObjections.dialog.reportedAt")}&nbsp;
                  {format(new Date(selected.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                </span>
                {selected.deadlineAt && (
                  <span className="text-xs text-slate-500">
                    {t("pages:myObjections.dialog.slaEnd")}&nbsp;
                    {format(new Date(selected.deadlineAt), "d MMM yyyy", { locale: tr })}
                  </span>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">{t("pages:myObjections.dialog.testLabel")}</p>
                  {/* selected.testTitle user-generated — çevrilmez */}
                  <p className="text-sm font-semibold text-slate-800">{selected.testTitle}</p>
                </div>
                {selected.educatorName && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{t("pages:myObjections.dialog.educatorLabel")}</p>
                    {/* educatorName user-generated — çevrilmez */}
                    <p className="text-sm text-slate-700">{selected.educatorName}</p>
                  </div>
                )}
                {selected.questionContent && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{t("pages:myObjections.dialog.questionLabel")}</p>
                    {/* questionContent user-generated — çevrilmez */}
                    <p className="text-sm text-slate-600 italic">"{selected.questionContent}"</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 font-medium">{t("pages:myObjections.dialog.reasonLabel")}</p>
                  {/* selected.reason user-generated — çevrilmez */}
                  <p className="text-sm text-slate-700">{selected.reason}</p>
                </div>
              </div>

              {/* Eğitici yanıtı */}
              {selected.answerText ? (
                <div className="p-3 bg-emerald-50 rounded border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-semibold mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    {t("pages:myObjections.dialog.educatorReply")}
                  </p>
                  {/* answerText user-generated — çevrilmez */}
                  <p className="text-sm text-slate-700">{selected.answerText}</p>
                  {selected.answeredAt && (
                    <p className="text-xs text-emerald-500 mt-1">
                      {format(new Date(selected.answeredAt), "d MMM yyyy HH:mm", { locale: tr })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-500">{t("pages:myObjections.dialog.educatorNoReply")}</p>
                </div>
              )}

              {/* Admin yanıtı */}
              {selected.adminAnswerText ? (
                <div className="p-3 bg-indigo-50 rounded border border-indigo-100">
                  <p className="text-xs text-indigo-700 font-semibold mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    {t("pages:myObjections.dialog.adminNote")}{selected.adminAnswererName ? ` (${selected.adminAnswererName})` : ""}:
                  </p>
                  {/* adminAnswerText user-generated — çevrilmez */}
                  <p className="text-sm text-slate-700">{selected.adminAnswerText}</p>
                  {selected.adminAnsweredAt && (
                    <p className="text-xs text-indigo-500 mt-1">
                      {format(new Date(selected.adminAnsweredAt), "d MMM yyyy HH:mm", { locale: tr })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-500">{t("pages:myObjections.dialog.adminNoNote")}</p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setSelected(null)}>{t("pages:myObjections.dialog.close")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
