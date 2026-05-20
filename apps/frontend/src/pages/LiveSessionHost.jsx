import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QRCode from "react-qr-code";
import { liveSessions as liveApi } from "@/api/dalClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, BarChart2, EyeOff, Users,
  Play, Square, Zap, Copy, CheckCircle2,
  RefreshCw, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Grup karşılaştırma bölümü ────────────────────────────────────────────────
function ComparisonPanel({ sessionId }) {
  const { data: cmp, isLoading } = useQuery({
    queryKey: ["liveComparison", sessionId],
    queryFn: () => liveApi.getComparison(sessionId),
    retry: false,
  });

  if (isLoading) return <div className="h-24 bg-slate-50 rounded-xl animate-pulse mt-4" />;
  if (!cmp) return null;

  const diff = cmp.improvement;
  const DiffIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const diffColor = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-500";

  return (
    <div className="mt-5 bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Grup Ön-Test / Son-Test Karşılaştırması
      </p>

      {/* Overall */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-600 mb-1">1. Tur Ort.</p>
          <p className="text-2xl font-black text-blue-700">%{cmp.round1.avgPct}</p>
          <p className="text-xs text-blue-500">{cmp.round1.participantCount} kişi</p>
        </div>
        <div className={`rounded-xl p-3 text-center flex flex-col items-center justify-center ${diff > 0 ? "bg-emerald-50" : diff < 0 ? "bg-rose-50" : "bg-slate-50"}`}>
          <DiffIcon className={`w-6 h-6 mb-1 ${diffColor}`} />
          <p className={`text-xl font-black ${diffColor}`}>{diff > 0 ? "+" : ""}{diff}%</p>
          <p className="text-xs text-slate-500">gelişim</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 text-center">
          <p className="text-xs text-indigo-600 mb-1">2. Tur Ort.</p>
          <p className="text-2xl font-black text-indigo-700">%{cmp.round2.avgPct}</p>
          <p className="text-xs text-indigo-500">{cmp.round2.participantCount} kişi</p>
        </div>
      </div>

      {/* Per-question */}
      <div className="space-y-2">
        {cmp.round1.questions.map((q1, idx) => {
          const q2 = cmp.round2.questions[idx];
          if (!q2) return null;
          const qDiff = q2.pct - q1.pct;
          return (
            <div key={q1.questionId} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <p className="flex-1 text-xs text-slate-600 truncate">{q1.questionContent}</p>
              <span className="text-xs text-blue-600 font-semibold w-10 text-right">%{q1.pct}</span>
              <span className={`text-xs font-bold w-10 text-center ${qDiff > 0 ? "text-emerald-600" : qDiff < 0 ? "text-rose-500" : "text-slate-400"}`}>
                {qDiff > 0 ? `+${qDiff}` : qDiff}%
              </span>
              <span className="text-xs text-indigo-600 font-semibold w-10 text-left">%{q2.pct}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E"];
const OPTION_COLORS = [
  "bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500"
];

// ─── Bar chart for live answer distribution (eski yardımcı — şu an opsiyonların
// arka planına entegre edildi; bileşen ileride başka yerde kullanılabilir diye saklı)
function _StatsBar({ stats }) {
  if (!stats) return null;
  const total = stats.reduce((s, o) => s + o.count, 0);
  return (
    <div className="space-y-2 mt-4">
      {stats.map((s, idx) => {
        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return (
          <div key={s.optionId} className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 ${OPTION_COLORS[idx % OPTION_COLORS.length]}`}>
              {LETTERS[idx]}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm text-slate-700 truncate max-w-[180px]">{s.content}</span>
                <span className="text-sm font-semibold text-slate-900 ml-2">{s.count} ({pct}%)</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${s.isCorrect ? "bg-emerald-500" : OPTION_COLORS[idx % OPTION_COLORS.length]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {s.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LiveSessionHost() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("id");
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ["liveState", sessionId],
    queryFn: () => liveApi.getState(sessionId),
    enabled: !!sessionId,
    refetchInterval: (data) => (data?.status === "ACTIVE" ? 3000 : false),
  });

  const mut = (fn) => ({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["liveState", sessionId] }),
    onError: (e) => {
      // Backend hata response'u birkaç farklı şekilde gelebilir:
      // { error: { code, message } } veya { message } veya { code, message }
      const d = e?.response?.data;
      const msg =
        d?.error?.message ||
        d?.message ||
        d?.error?.code ||
        d?.code ||
        e?.message ||
        "Hata";
      toast.error(msg);
    },
  });

  const startMut    = useMutation(mut(() => liveApi.start(sessionId)));
  const nextMut     = useMutation(mut(() => liveApi.next(sessionId)));
  const prevMut     = useMutation(mut(() => liveApi.prev(sessionId)));
  const statsMut    = useMutation(mut(() => liveApi.toggleStats(sessionId)));
  const endMut = useMutation({
    ...mut(() => liveApi.end(sessionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liveState", sessionId] });
      toast.success("Oturum sonlandırıldı");
    },
  });

  const round2Mut = useMutation({
    mutationFn: () => liveApi.createRound2(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["liveState", sessionId] });
      const newId = data?.id ?? data?.sessionId;
      if (!newId) {
        toast.error("2. tur oluşturuldu ancak yönlendirme yapılamadı");
        return;
      }
      toast.success(`2. tur oluşturuldu! Kod: ${data.joinCode}`);
      navigate(createPageUrl("LiveSessionHost") + "?id=" + newId);
    },
    onError: (e) => toast.error(e?.response?.data?.message || "2. tur oluşturulamadı"),
  });

  const joinUrl = `${window.location.origin}${createPageUrl("LiveSessionJoin")}?code=${state?.joinCode ?? ""}`;

  const copyCode = () => {
    navigator.clipboard.writeText(state?.joinCode ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!state) return <p className="text-center py-20 text-slate-500">Oturum bulunamadı</p>;

  const q = state.currentQuestion;
  const isDraft  = state.status === "DRAFT";
  const isActive = state.status === "ACTIVE";
  const isEnded  = state.status === "ENDED";
  const stats    = q ? state.stats?.[q.id] : null;
  const parentStats = q ? state.parentStats?.[q.id] : null;
  const isFirst  = state.currentQuestionIdx === 0;
  const isLast   = state.currentQuestionIdx === state.totalQuestions - 1;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* ── Top bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500" />
          <div>
            <p className="font-semibold text-slate-900">{state.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={cn(
                "text-xs",
                isDraft ? "bg-slate-100 text-slate-600" :
                isActive ? "bg-emerald-100 text-emerald-700" :
                "bg-rose-100 text-rose-700"
              )}>
                {isDraft ? "Başlamadı" : isActive ? "Canlı" : "Bitti"}
              </Badge>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span className="font-semibold text-emerald-700">{state.activeParticipantCount ?? 0}</span>
                  <span>aktif</span>
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {state.participantCount}
                  {state.maxParticipants != null && `/${state.maxParticipants}`} toplam
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <Button
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Play className="w-4 h-4 fill-white" /> Başlat
            </Button>
          )}
          {isActive && (
            <Button
              variant="outline"
              className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-2"
              onClick={() => { if (confirm("Oturumu bitirmek istediğinize emin misiniz?")) endMut.mutate(); }}
              disabled={endMut.isPending}
            >
              <Square className="w-4 h-4" /> Bitir
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* ── Question card: tam genişlik, normal test stiliyle ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Soru {state.currentQuestionIdx + 1}
            </span>
            {q?.mediaUrl && (
              <div className="mt-2 w-full max-h-64 rounded-xl overflow-hidden border border-slate-100">
                <img src={q.mediaUrl} alt="soru" className="w-full h-full object-contain" />
              </div>
            )}
            <p className="text-slate-700 text-lg mt-3 leading-relaxed">
              {q?.content ?? "—"}
            </p>
          </div>

          {/* Options — TakeTest stilinde; istatistik açıkken sağa yaslı yüzde.
              Tur 2'de aynı sıradaki Tur 1 yüzdesi de gösterilir (karşılaştırma). */}
          {q && (() => {
            const showStats = (isActive || isEnded) && state.showStats && Array.isArray(stats);
            const isRound2 = state.roundNumber === 2;
            // optionId → { count, pct } eşlemesi (Tur 2 / mevcut tur)
            const statByOpt = new Map();
            if (showStats) {
              const total = stats.reduce((s, o) => s + o.count, 0);
              stats.forEach((s) => {
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                statByOpt.set(s.optionId, { count: s.count, pct });
              });
            }
            // Tur 1 (parent) istatistikleri — yalnızca Tur 2'de mevcut
            const r1ByOpt = new Map();
            if (showStats && isRound2 && Array.isArray(parentStats)) {
              parentStats.forEach((p) => {
                const pct = p.total > 0 ? Math.round((p.count / p.total) * 100) : 0;
                r1ByOpt.set(p.optionId, { count: p.count, pct });
              });
            }
            return (
              <div className="space-y-3 mb-4">
                {q.options.map((opt, idx) => {
                  const isCorrect = !!opt.isCorrect;
                  const highlight = isEnded && isCorrect;
                  const stat = statByOpt.get(opt.id);
                  const r1 = r1ByOpt.get(opt.id);
                  const delta = stat && r1 ? stat.pct - r1.pct : null;
                  return (
                    <div
                      key={opt.id}
                      className={cn(
                        "relative w-full p-4 rounded-xl border-2 text-left flex items-center gap-4 transition-all overflow-hidden",
                        highlight
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      {/* İstatistik açıkken arka planda yüzde dolgusu */}
                      {showStats && stat && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-y-0 left-0 transition-all duration-500",
                            isCorrect ? "bg-emerald-100" : "bg-indigo-50",
                          )}
                          style={{ width: `${stat.pct}%` }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0",
                          highlight ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {LETTERS[idx]}
                      </span>
                      <span className="relative text-slate-700 flex-1">{opt.content}</span>
                      {showStats && stat && (
                        <div className="relative flex items-center gap-3 shrink-0 ml-2">
                          {isRound2 && r1 && (
                            <div className="flex flex-col items-end text-xs leading-tight">
                              <span className="text-slate-400">Tur 1: %{r1.pct}</span>
                              {delta != null && delta !== 0 && (
                                <span
                                  className={cn(
                                    "font-medium tabular-nums",
                                    delta > 0
                                      ? (isCorrect ? "text-emerald-600" : "text-rose-600")
                                      : (isCorrect ? "text-rose-600" : "text-emerald-600"),
                                  )}
                                >
                                  {delta > 0 ? "+" : ""}{delta} pp
                                </span>
                              )}
                            </div>
                          )}
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              isCorrect ? "text-emerald-700" : "text-slate-700",
                            )}
                            title={`${stat.count} kişi`}
                          >
                            {isRound2 && <span className="text-xs text-slate-500 mr-1">Tur 2:</span>}
                            %{stat.pct}
                            <span className="text-xs text-slate-400 font-normal ml-1">({stat.count})</span>
                          </span>
                        </div>
                      )}
                      {highlight && !showStats && (
                        <CheckCircle2 className="relative w-5 h-5 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

          {/* Controls — ACTIVE: canlı yönetim; ENDED: gözden geçirme navigasyonu */}
          {(isActive || isEnded) && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => prevMut.mutate()}
                disabled={isFirst || prevMut.isPending}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Önceki
              </Button>

              <Button
                variant="outline"
                onClick={() => statsMut.mutate()}
                disabled={statsMut.isPending}
                className={state.showStats ? "bg-indigo-50 text-indigo-700 border-indigo-200" : ""}
              >
                {state.showStats
                  ? <><EyeOff className="w-4 h-4 mr-1" /> İstatistikleri Gizle</>
                  : <><BarChart2 className="w-4 h-4 mr-1" /> İstatistikleri Göster</>}
              </Button>

              <Button
                onClick={() => nextMut.mutate()}
                disabled={isLast || nextMut.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Sonraki <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {isEnded && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-800">
                  {state.roundNumber === 2 ? "Son-Test Tamamlandı!" : "Oturum tamamlandı"}
                </p>
                <p className="text-sm text-emerald-700 mt-1">
                  {state.participantCount} katılımcı • {state.totalQuestions} soru
                </p>
              </div>

              {/* Round 2 button — only for round 1, if no round 2 yet */}
              {state.roundNumber === 1 && !state.round2 && (
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                  onClick={() => {
                    if (confirm("Aynı soruları kullanarak 2. tur (son-test) oluşturmak istiyor musunuz?\nYalnızca bu tura katılan adaylar girebilir."))
                      round2Mut.mutate();
                  }}
                  disabled={round2Mut.isPending}
                >
                  <RefreshCw className="w-4 h-4" />
                  İkinci Kez Uygula (Son-Test)
                </Button>
              )}

              {/* Round 2 already exists */}
              {state.roundNumber === 1 && state.round2 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center text-sm text-indigo-700">
                  2. tur mevcut — Kod: <strong className="font-mono">{state.round2.joinCode}</strong>
                  <Button
                    size="sm" variant="ghost" className="ml-3 text-indigo-600"
                    onClick={() => navigate(createPageUrl("LiveSessionHost") + "?id=" + state.round2.id)}
                  >
                    Oturuma Git →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Comparison panel for round 2 when ended */}
          {isEnded && state.roundNumber === 2 && (
            <ComparisonPanel sessionId={sessionId} />
          )}

        {/* ── Alt satır: sol Aktif Katılımcılar + İlerleme, sağ QR (küçük) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Sol: Aktif katılımcılar — İlerleme zaten soru kartı başlığında var, ayrı bloka gerek yok */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Aktif Katılımcılar</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-lg font-bold text-emerald-700">{state.activeParticipantCount ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Toplam katılan</span>
              <span className="font-medium">
                {state.participantCount}
                {state.maxParticipants != null && (
                  <span className="text-slate-400"> / {state.maxParticipants}</span>
                )}
              </span>
            </div>
            {state.maxParticipants != null && (
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (state.participantCount / state.maxParticipants) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Sağ: Katılım kodu + küçük QR */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Katılım Kodu</p>
                <div className="text-2xl font-black tracking-widest text-indigo-700 font-mono break-all">
                  {state.joinCode}
                </div>
                <button
                  onClick={copyCode}
                  className="mt-1 text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Kopyalandı!" : "Kodu kopyala"}
                </button>
                <p className="text-xs text-slate-400 mt-2">QR kodu ile katılım</p>
              </div>
              {/* QR kodu — eski 140 px'in %50'si */}
              <div className="bg-white p-2 rounded-lg border border-slate-100 shrink-0">
                <QRCode value={joinUrl} size={70} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
