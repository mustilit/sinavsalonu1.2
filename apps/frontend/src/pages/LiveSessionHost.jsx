import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import QRCode from "react-qr-code";
import { liveSessions as liveApi } from "@/api/dalClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

// ─── Bar chart for live answer distribution ───────────────────────────────────
function StatsBar({ stats }) {
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
    onError: (e) => toast.error(e?.response?.data?.message || "Hata"),
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
      toast.success(`2. tur oluşturuldu! Kod: ${data.joinCode}`);
      // Navigate to the new round 2 session
      navigate(createPageUrl("LiveSessionHost") + "?id=" + data.sessionId);
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

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Left: QR + join info ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Katılım Kodu</p>
            <div className="text-4xl font-black tracking-widest text-indigo-700 mb-3 font-mono">
              {state.joinCode}
            </div>
            <button
              onClick={copyCode}
              className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 mx-auto mb-4"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Kopyalandı!" : "Kodu kopyala"}
            </button>
            <div className="bg-white p-3 rounded-xl border border-slate-100 inline-block">
              <QRCode value={joinUrl} size={140} />
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Adaylar QR kodu tarayarak katılabilir
            </p>
          </div>

          {/* Katılımcı durumu */}
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

          {/* Progress */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">İlerleme</span>
              <span className="text-sm text-slate-500">
                {state.currentQuestionIdx + 1} / {state.totalQuestions}
              </span>
            </div>
            <Progress
              value={((state.currentQuestionIdx + 1) / state.totalQuestions) * 100}
              className="h-2"
            />
          </div>
        </div>

        {/* ── Right: Current question + controls ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Question card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Soru {state.currentQuestionIdx + 1}
                </span>
                {q?.mediaUrl && (
                  <div className="mt-2 w-full max-h-48 rounded-xl overflow-hidden border border-slate-100">
                    <img src={q.mediaUrl} alt="soru" className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-xl font-semibold text-slate-900 mt-2 leading-snug">
                  {q?.content ?? "—"}
                </p>
              </div>
            </div>

            {/* Options grid */}
            {q && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {q.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border-2",
                      isEnded && opt.isCorrect
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 ${OPTION_COLORS[idx % OPTION_COLORS.length]}`}>
                      {LETTERS[idx]}
                    </span>
                    <span className="text-sm text-slate-700 flex-1">{opt.content}</span>
                    {isEnded && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}

            {/* Stats */}
            {(isActive || isEnded) && state.showStats && stats && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">İstatistikler</p>
                <StatsBar stats={stats} />
              </div>
            )}
          </div>

          {/* Controls */}
          {(isActive || isEnded) && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => prevMut.mutate()}
                disabled={isFirst || prevMut.isPending || !isActive}
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
                disabled={isLast || nextMut.isPending || !isActive}
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
        </div>
      </div>
    </div>
  );
}
