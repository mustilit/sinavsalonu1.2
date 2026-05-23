/**
 * MyTopicReport — Adayın konu bazlı performans raporu sayfası.
 *
 * Farklı test paketlerindeki aynı konuya ait soruları sınav türüne göre
 * gruplandırarak her grubun zaman serisi grafiğini gösterir.
 * Yalnızca SUBMITTED / TIMEOUT durumundaki denemeler dahil edilir.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import api from "@/lib/api/apiClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  BookOpen,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

/**
 * Doğru/Yanlış/Boş sayılarını renkli yatay progress bar olarak gösterir.
 */
function AnswerBar({ correct, wrong, blank, total }) {
  const { t } = useTranslation(["pages"]);
  if (total === 0) return null;
  const pCorrect = (correct / total) * 100;
  const pWrong = (wrong / total) * 100;
  const pBlank = (blank / total) * 100;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden flex">
      <div
        className="bg-emerald-500 h-full transition-all"
        style={{ width: `${pCorrect}%` }}
        title={t("pages:myTopicReport.card.tooltipCorrectAlt", { count: correct })}
      />
      <div
        className="bg-rose-400 h-full transition-all"
        style={{ width: `${pWrong}%` }}
        title={t("pages:myTopicReport.card.tooltipWrongAlt", { count: wrong })}
      />
      <div
        className="bg-slate-200 h-full transition-all"
        style={{ width: `${pBlank}%` }}
        title={t("pages:myTopicReport.card.tooltipBlankAlt", { count: blank })}
      />
    </div>
  );
}

/**
 * Trend okunun görsel gösterimi.
 * trend > 0 → yeşil yukarı, trend < 0 → kırmızı aşağı, trend === 0 → gri yatay, trend === null → gösterilmez.
 */
function TrendBadge({ trend }) {
  if (trend === null || trend === undefined) return null;
  if (trend > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 text-sm font-medium">
        <TrendingUp className="w-4 h-4" />+{trend.toFixed(1)}%
      </span>
    );
  if (trend < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-500 text-sm font-medium">
        <TrendingDown className="w-4 h-4" />
        {trend.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-400 text-sm">
      <Minus className="w-4 h-4" />
      0%
    </span>
  );
}

/**
 * Başarı yüzdesine göre renk sınıfı döndürür.
 */
function pctColor(pct) {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-blue-600";
  if (pct >= 40) return "text-amber-500";
  return "text-rose-500";
}

// ─── Konu grup kartı ──────────────────────────────────────────────────────────

/**
 * Tek bir (konu × sınav türü) grubu için kart bileşeni.
 * Grafik görünümü toggle ile açılıp kapatılabilir.
 */
function TopicGroupCard({ group }) {
  const { t } = useTranslation(["pages"]);
  const [expanded, setExpanded] = useState(false);

  const hasTimeline = group.timeline && group.timeline.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* ─── Kart başlığı ─── */}
        <div className="p-4">
          {/* Konu adı + sınav türü rozeti */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm leading-tight">
                {group.topicName}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {/* Sınav türünü ayırt edici rozet olarak göster */}
                {group.examTypeId !== "__none__" && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-indigo-50 text-indigo-700 border-0"
                  >
                    {group.examTypeName}
                  </Badge>
                )}
                {/* Süre aşımı uyarı rozeti — gelişime açık yön */}
                {group.hasOvertime && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-0 gap-1">
                    <Clock className="w-3 h-3" />
                    {t("pages:myTopicReport.card.overtimeBadge", { count: group.overtimeCount })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Genel başarı yüzdesi + trend */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className={`text-2xl font-bold leading-none ${pctColor(group.overallPct)}`}
              >
                %{group.overallPct.toFixed(1)}
              </span>
              <TrendBadge trend={group.trend} />
            </div>
          </div>

          {/* Doğru / yanlış / boş bar */}
          <AnswerBar
            correct={group.totalCorrect}
            wrong={group.totalWrong}
            blank={group.totalBlank}
            total={group.totalQuestions}
          />

          {/* Sayısal özet satırı */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              {t("pages:myTopicReport.card.correct", { count: group.totalCorrect })}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-400" />
              {t("pages:myTopicReport.card.wrong", { count: group.totalWrong })}
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-slate-300" />
              {t("pages:myTopicReport.card.blank", { count: group.totalBlank })}
            </span>
            <span className="ml-auto text-slate-400">
              {t("pages:myTopicReport.card.summary", { attempts: group.totalAttempts, questions: group.totalQuestions })}
            </span>
          </div>

          {/* Süre yönetimi uyarı bandı — gelişime açık yön */}
          {group.hasOvertime && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>
                {t("pages:myTopicReport.card.overtimeWarning", { count: group.overtimeCount })}
                {" "}<strong>{t("pages:myTopicReport.card.overtimeWarningEmphasis")}</strong>{" "}
                {t("pages:myTopicReport.card.overtimeWarningSuffix")}
              </span>
            </div>
          )}
        </div>

        {/* ─── Grafik toggle düğmesi (timeline varsa göster) ─── */}
        {hasTimeline && (
          <>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> {t("pages:myTopicReport.card.hideChart")}
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> {t("pages:myTopicReport.card.showChart")}
                </>
              )}
            </button>

            {/* ─── Zaman serisi grafiği ─── */}
            {expanded && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={group.timeline}
                    margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `%${v}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 text-xs space-y-1">
                            <p className="font-semibold text-slate-700">{label}</p>
                            <p className="text-indigo-600 font-bold">
                              %{d.pct.toFixed(1)}
                            </p>
                            <p className="text-emerald-600">{t("pages:myTopicReport.card.tooltipCorrect", { count: d.correct })}</p>
                            <p className="text-rose-500">{t("pages:myTopicReport.card.tooltipWrong", { count: d.wrong })}</p>
                            <p className="text-slate-400">{t("pages:myTopicReport.card.tooltipBlank", { count: d.blank })}</p>
                            <p className="text-slate-500 border-t border-slate-100 pt-1">
                              {t("pages:myTopicReport.card.tooltipTotal", { count: d.total })}
                            </p>
                            {d.overtimeSeconds > 0 && (
                              <p className="text-amber-600 font-medium">
                                {t("pages:myTopicReport.card.tooltipOvertime", { m: Math.floor(d.overtimeSeconds / 60), s: d.overtimeSeconds % 60 })}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={{ fill: "#4f46e5", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ana sayfa bileşeni ───────────────────────────────────────────────────────

/**
 * MyTopicReport — konu × sınav türü bazlı performans sayfası.
 * Aday, hangi konularda güçlü/zayıf olduğunu ve zamanla nasıl geliştiğini görebilir.
 */
export default function MyTopicReport() {
  const { t } = useTranslation(["pages"]);
  const { user } = useAuth();

  // Seçili sınav türü filtresi: "all" ya da examTypeId
  const [selectedExamType, setSelectedExamType] = useState("all");

  // Backend'den konu performans verisini çek
  const { data, isLoading, isError } = useQuery({
    queryKey: ["myTopicPerformance"],
    queryFn: async () => {
      const res = await api.get("/me/topic-performance");
      return res.data;
    },
    enabled: !!user,
    // 2 dakika boyunca yeniden fetch etme — veriler sık değişmez
    staleTime: 2 * 60 * 1000,
  });

  const groups = data?.groups ?? [];
  const examTypes = data?.examTypes ?? [];

  // Seçili sınav türüne göre grupları filtrele
  const filteredGroups =
    selectedExamType === "all"
      ? groups
      : groups.filter((g) => g.examTypeId === selectedExamType);

  // Özet istatistikler (tüm gruplara göre)
  const totalGroups = filteredGroups.length;
  const totalAttempts = filteredGroups.reduce((s, g) => s + g.totalAttempts, 0);
  const totalQuestions = filteredGroups.reduce(
    (s, g) => s + g.totalQuestions,
    0
  );
  const avgPct =
    filteredGroups.length > 0
      ? filteredGroups.reduce((s, g) => s + g.overallPct, 0) /
        filteredGroups.length
      : 0;

  // ─── Yükleniyor durumu ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">
          {t("pages:myTopicReport.errorLoad")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ─── Sayfa başlığı ─── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{t("pages:titles.myTopicReport")}</h1>
        <p className="text-slate-500 mt-2">
          {t("pages:titles.myTopicReportDesc")}
        </p>
      </div>

      {/* ─── Yükleniyor iskeleti ─── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        /* ─── Boş durum ─── */
        <div className="text-center py-20">
          <BookOpen className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">
            {t("pages:myTopicReport.empty.title")}
          </h2>
          <p className="text-slate-500 max-w-sm mx-auto">
            {t("pages:myTopicReport.empty.desc")}
          </p>
        </div>
      ) : (
        <>
          {/* ─── Özet kart satırı ─── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Konu sayısı */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("pages:myTopicReport.stats.topicCount")}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalGroups}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Toplam deneme */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("pages:myTopicReport.stats.totalAttempts")}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalAttempts}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Toplam soru */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("pages:myTopicReport.stats.totalQuestions")}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalQuestions}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Genel ortalama */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("pages:myTopicReport.stats.overallAvg")}</p>
                  <p className={`text-2xl font-bold ${pctColor(avgPct)}`}>
                    %{avgPct.toFixed(1)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Sınav türü filtre sekmeleri ─── */}
          {examTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {/* "Tümü" sekmesi */}
              <button
                onClick={() => setSelectedExamType("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedExamType === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t("pages:myTopicReport.filterAll")}
              </button>

              {/* Her sınav türü için sekme */}
              {examTypes.map((et) => (
                <button
                  key={et.id}
                  onClick={() => setSelectedExamType(et.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedExamType === et.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {et.name}
                </button>
              ))}
            </div>
          )}

          {/* ─── Konu kart ızgarası ─── */}
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {t("pages:myTopicReport.noGroupForExamType")}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredGroups.map((group) => (
                <TopicGroupCard
                  key={`${group.topicId}___${group.examTypeId}`}
                  group={group}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
