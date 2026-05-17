import { useState } from "react";
import { entities } from "@/api/dalClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABEL = {
  PENDING: "Bekliyor",
  EDUCATOR_APPROVED: "Onaylandı",
  EDUCATOR_REJECTED: "Reddedildi",
  APPEAL_PENDING: "İtiraz",
  ESCALATED: "Escalated",
  APPROVED: "İade Yapıldı",
  REJECTED: "Sonuçlandı",
};

const STATUS_COLOR = {
  PENDING: "bg-amber-100 text-amber-700",
  EDUCATOR_APPROVED: "bg-blue-100 text-blue-700",
  EDUCATOR_REJECTED: "bg-rose-100 text-rose-700",
  APPEAL_PENDING: "bg-purple-100 text-purple-700",
  ESCALATED: "bg-orange-100 text-orange-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-slate-100 text-slate-600",
};

const REASON_LABEL = {
  wrong_content: "İçerik beklentiyi karşılamadı",
  defective_questions: "Hatalı soru var",
  not_working: "Teknik sorun",
  quality_issue: "Kalite problemi",
  other: "Diğer",
};

function safeFormatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: tr });
  } catch {
    return dateStr;
  }
}

function EducatorRefunds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["educator-refunds"],
    queryFn: () => entities.RefundRequest.listForEducator(),
    enabled: ["EDUCATOR", "ADMIN"].includes((user?.role || "").toUpperCase()),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => entities.RefundRequest.educatorApprove(id),
    onSuccess: () => {
      toast.success("İade talebi onaylandı. Admin incelemesine iletildi.");
      queryClient.invalidateQueries({ queryKey: ["educator-refunds"] });
      setSelected(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "İşlem başarısız"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => entities.RefundRequest.educatorReject(id, reason),
    onSuccess: () => {
      toast.success("İade talebi reddedildi.");
      queryClient.invalidateQueries({ queryKey: ["educator-refunds"] });
      setSelected(null);
      setRejectReason("");
      setShowRejectInput(false);
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "İşlem başarısız"),
  });

  const pending = refunds.filter((r) => r.status === "PENDING");
  const reviewed = refunds.filter((r) => r.status !== "PENDING");

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  if (!["EDUCATOR", "ADMIN"].includes((user?.role || "").toUpperCase())) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-slate-900">Erişim Engellendi</h2>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">İade Talepleri</h1>
        <p className="text-slate-500 mt-2">
          Testlerinize gelen iade taleplerini inceleyin. Onayladığınız talepler admin onayına iletilir.
        </p>
      </div>

      {/* Deadline uyarısı */}
      {pending.some((r) => r.educator_deadline && new Date(r.educator_deadline) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Bazı taleplerin inceleme süresi dolmak üzere. 7 gün içinde yanıtlanmayan talepler doğrudan admin'e iletilir.
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            Bekleyen
            {pending.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">İncelenenler ({reviewed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-500">Bekleyen iade talebi yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pending.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                          <RefreshCw className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{r.test_package_title || "Test"}</p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {REASON_LABEL[r.reason] ?? r.reason ?? "Sebep belirtilmedi"}
                          </p>
                          {r.description && (
                            <p className="text-sm text-slate-600 mt-1 italic">"{r.description}"</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {safeFormatDate(r.created_date)}
                            </span>
                            {r.educator_deadline && (
                              <span className={`font-medium ${new Date(r.educator_deadline) < new Date() ? "text-rose-500" : "text-amber-600"}`}>
                                Son: {safeFormatDate(r.educator_deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => { setSelected(r); setShowRejectInput(false); setRejectReason(""); }}>
                        İncele
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed">
          {reviewed.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-slate-500">Henüz incelenmiş talep yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviewed.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-900">{r.test_package_title || "Test"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{safeFormatDate(r.created_date)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* İnceleme dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setShowRejectInput(false); setRejectReason(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>İade Talebini İncele</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                <p><span className="text-slate-500">Test:</span> <span className="font-medium">{selected.test_package_title}</span></p>
                <p><span className="text-slate-500">Sebep:</span> {REASON_LABEL[selected.reason] ?? selected.reason ?? "-"}</p>
                {selected.description && (
                  <p><span className="text-slate-500">Açıklama:</span> {selected.description}</p>
                )}
                {selected.educator_deadline && (
                  <p>
                    <span className="text-slate-500">Son inceleme:</span>{" "}
                    <span className={new Date(selected.educator_deadline) < new Date() ? "text-rose-600 font-medium" : "text-amber-700"}>
                      {safeFormatDate(selected.educator_deadline)}
                    </span>
                  </p>
                )}
              </div>

              {showRejectInput ? (
                <div className="space-y-3">
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Red gerekçesi (opsiyonel, min 5 karakter)..."
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>
                      Geri
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isMutating || (rejectReason.trim().length > 0 && rejectReason.trim().length < 5)}
                      onClick={() => rejectMutation.mutate({ id: selected.id, reason: rejectReason.trim() || undefined })}
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reddet
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    disabled={isMutating}
                    onClick={() => setShowRejectInput(true)}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reddet
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={isMutating}
                    onClick={() => approveMutation.mutate(selected.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Onayla → Admin'e İlet
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EducatorRefunds;
