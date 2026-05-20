import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { liveSessions as liveApi } from "@/api/dalClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap, Plus, Users, Clock, CheckCircle2,
  FileEdit, ChevronRight, Radio, RefreshCw, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_CONFIG = {
  DRAFT:  { label: "Taslak",     color: "bg-slate-100 text-slate-600",     icon: FileEdit    },
  ACTIVE: { label: "Aktif",      color: "bg-emerald-100 text-emerald-700", icon: Radio       },
  ENDED:  { label: "Tamamlandı", color: "bg-blue-100 text-blue-700",       icon: CheckCircle2 },
};

function safeDate(iso) {
  if (!iso) return null;
  try { return format(new Date(iso), "d MMM yyyy HH:mm", { locale: tr }); }
  catch { return null; }
}

/**
 * Oturum kartı — Tur 1 (parent) için tüm yaşam döngüsünü tek satırda yönetir:
 *  - DRAFT/ACTIVE: tıkla → host (eski davranış)
 *  - ENDED + Tur 2 yok: "Gözden Geçir" + "İkinci Turu Başlat"
 *  - ENDED + Tur 2 DRAFT/ACTIVE: "Gözden Geçir" + "Tur 2'ye Git"
 *  - ENDED + Tur 2 ENDED: "Tur 1 Gözden Geçir" + "Tur 2 Gözden Geçir"
 */
function SessionCard({ session, round2, onOpenHost, onCreateRound2, creating }) {
  const cfg        = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.DRAFT;
  const StatusIcon = cfg.icon;
  const qCount     = session.questions?.length ?? session._count?.questions ?? 0;
  const pCount     = session.participants?.length ?? session._count?.participants ?? 0;
  const isEnded    = session.status === "ENDED";
  const isActive   = session.status === "ACTIVE";
  const isDraft    = session.status === "DRAFT";

  // Tur 2'nin durumu (varsa)
  const r2Status = round2?.status;
  const r2Ended  = r2Status === "ENDED";

  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isActive ? "bg-emerald-100" :
              isEnded  ? "bg-blue-100"    : "bg-slate-100"
            }`}>
              <StatusIcon className={`w-5 h-5 ${
                isActive ? "text-emerald-600" :
                isEnded  ? "text-blue-600"    : "text-slate-500"
              }`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-slate-900 truncate">{session.title}</h3>
                <Badge className={cfg.color}>{cfg.label}</Badge>
                {round2 && (
                  <Badge className="bg-indigo-100 text-indigo-700">
                    Tur 2 {r2Ended ? "tamamlandı" : r2Status === "ACTIVE" ? "aktif" : "taslak"}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {qCount} soru
                </span>
                {pCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {pCount} katılımcı
                  </span>
                )}
                {session.tier?.label && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {session.tier.label}
                  </span>
                )}
                {session.createdAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {safeDate(session.createdAt)}
                  </span>
                )}
              </div>

              {/* Katılım kodu — DRAFT/ACTIVE turlarda göster */}
              {(isDraft || isActive) && session.joinCode && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                  <span className="text-xs text-amber-600 font-medium">Kod:</span>
                  <span className="text-sm font-mono font-bold text-amber-800 tracking-widest">
                    {session.joinCode}
                  </span>
                </div>
              )}

              {/* Tur 2 katılım kodu — Tur 1 ENDED + Tur 2 DRAFT/ACTIVE */}
              {isEnded && round2 && !r2Ended && round2.joinCode && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                  <span className="text-xs text-indigo-600 font-medium">Tur 2 Kod:</span>
                  <span className="text-sm font-mono font-bold text-indigo-800 tracking-widest">
                    {round2.joinCode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sağ aksiyon alanı — duruma göre */}
          <div className="flex items-start gap-2 shrink-0">
            {(isDraft || isActive) && (
              <Button size="sm" variant="outline" onClick={() => onOpenHost(session.id)}>
                <ChevronRight className="w-4 h-4 ml-1" />
                Yönet
              </Button>
            )}
            {isEnded && (
              <div className="flex flex-col items-end gap-2">
                {/* Tur 1 gözden geçir */}
                <Button size="sm" variant="outline" onClick={() => onOpenHost(session.id)} className="gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {round2 ? "Tur 1 Gözden Geçir" : "Gözden Geçir"}
                </Button>
                {/* Tur 2 yoksa: İkinci Turu Başlat */}
                {!round2 && (
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1"
                    onClick={() => onCreateRound2(session.id)}
                    disabled={creating}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    İkinci Turu Başlat
                  </Button>
                )}
                {/* Tur 2 var ama bitmemiş: Tur 2'ye Git */}
                {round2 && !r2Ended && (
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1"
                    onClick={() => onOpenHost(round2.id)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Tur 2'ye Git
                  </Button>
                )}
                {/* Tur 2 de bitmiş: Gözden Geçir */}
                {round2 && r2Ended && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={() => onOpenHost(round2.id)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Tur 2 Gözden Geçir
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyLiveSessions() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["myLiveSessions"],
    queryFn: () => liveApi.listMy(),
    enabled: !!user,
  });

  // Tur 2 oturumlarını parent altında grupla — listede ayrı satır olarak görünmesinler
  const { parentSessions, round2ByParent } = useMemo(() => {
    const r2Map = new Map();
    for (const s of sessions) {
      if (s.roundNumber === 2 && s.parentSessionId) {
        r2Map.set(s.parentSessionId, s);
      }
    }
    const parents = sessions.filter((s) => s.roundNumber !== 2);
    return { parentSessions: parents, round2ByParent: r2Map };
  }, [sessions]);

  const round2Mut = useMutation({
    mutationFn: (id) => liveApi.createRound2(id),
    onSuccess: (data) => {
      toast.success(`2. tur oluşturuldu! Kod: ${data?.joinCode ?? "—"}`);
      queryClient.invalidateQueries({ queryKey: ["myLiveSessions"] });
      const newId = data?.id ?? data?.sessionId;
      if (newId) {
        navigate(createPageUrl("LiveSessionHost") + "?id=" + newId);
      }
    },
    onError: (e) => {
      const d = e?.response?.data;
      toast.error(d?.error?.message || d?.message || "2. tur oluşturulamadı");
    },
  });

  const draft  = parentSessions.filter((s) => s.status === "DRAFT");
  const active = parentSessions.filter((s) => s.status === "ACTIVE");
  const ended  = parentSessions.filter((s) => s.status === "ENDED");

  const goToHost   = (id) => navigate(createPageUrl("LiveSessionHost") + "?id=" + id);
  const goToCreate = () => navigate(createPageUrl("LiveSessionCreate"));

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const renderList = (list) => (
    <div className="space-y-3">
      {list.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          round2={round2ByParent.get(s.id) ?? null}
          onOpenHost={goToHost}
          onCreateRound2={(id) => {
            if (confirm("Aynı soruları kullanarak 2. tur (son-test) oluşturmak istiyor musunuz?\nYalnızca bu tura katılan adaylar girebilir."))
              round2Mut.mutate(id);
          }}
          creating={round2Mut.isPending}
        />
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Canlı Testlerim
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Oluşturduğunuz canlı test oturumlarını yönetin.
          </p>
        </div>
        <Button onClick={goToCreate} className="bg-amber-500 hover:bg-amber-600 gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Yeni Canlı Test
        </Button>
      </div>

      {parentSessions.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Henüz canlı test oluşturmadınız
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Canlı bir oturum başlatın, katılımcılar QR kod veya kod ile katılsın.
          </p>
          <Button onClick={goToCreate} className="bg-amber-500 hover:bg-amber-600 gap-2">
            <Plus className="w-4 h-4" />
            İlk Canlı Testimi Oluştur
          </Button>
        </div>
      )}

      {active.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
              Aktif ({active.length})
            </h2>
          </div>
          {renderList(active)}
        </section>
      )}

      {draft.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Taslak ({draft.length})
          </h2>
          {renderList(draft)}
        </section>
      )}

      {ended.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Tamamlanan ({ended.length})
          </h2>
          {renderList(ended)}
        </section>
      )}
    </div>
  );
}
