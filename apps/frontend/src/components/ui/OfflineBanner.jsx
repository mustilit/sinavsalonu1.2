/**
 * OfflineBanner — Test sırasında bağlantı koptuğunda tam ekran overlay gösterir.
 *
 * Özellikler:
 *   - Bağlantı kesildiğinde soru arayüzünü tamamen kapatır (isOffline prop)
 *   - Otomatik çıkış geri sayımı gösterir (remainingSeconds prop)
 *   - Bekleyen / senkronize edilen cevap sayısını gösterir
 *   - Bağlantı gelince yeşil "Yeniden bağlandı" bildirimi geçer
 *
 * Props:
 *   isOffline        : boolean   - Overlay görünsün mü
 *   remainingSeconds : number    - Otomatik çıkışa kalan saniye
 *   pendingCount     : number    - Kuyruktaki gönderilmemiş cevap sayısı
 *   isFlushing       : boolean   - Senkronizasyon devam ediyor mu
 *   onManualExit     : () => void - "Şimdi Çık" butonu callback'i
 */
import { useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { WifiOff, Wifi, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflineBanner({
  isOffline,
  remainingSeconds,
  pendingCount = 0,
  isFlushing   = false,
  onManualExit,
}) {
  const { t } = useTranslation(['common']);
  // Bağlantı yeni geldikten sonra kısa süre "Yeniden bağlandı" göster
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      // Bağlantı yeni kuruldu — 3 saniye bildirim göster
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  // ─── Bağlantı yeni geldi bildirimi ───────────────────────────────────────
  if (showReconnected && !isOffline) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl">
          <Wifi className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">{t('common:offlineBanner.reconnectedTitle')}</p>
            {isFlushing && (
              <p className="text-xs text-emerald-200 mt-0.5">{t('common:offlineBanner.syncing')}</p>
            )}
            {!isFlushing && pendingCount === 0 && (
              <p className="text-xs text-emerald-200 mt-0.5">{t('common:offlineBanner.allSaved')}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Offline değilse hiçbir şey gösterme ─────────────────────────────────
  if (!isOffline) return null;

  // Sayaç rengini kalan süreye göre belirle
  const isUrgent = remainingSeconds <= 10;

  // ─── Tam ekran offline overlay ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Bağlantı kesildi ikonu */}
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-rose-600" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">{t('common:offlineBanner.disconnectedTitle')}</h2>
        <p className="text-slate-500 text-sm mb-6">
          {t('common:offlineBanner.disconnectedDesc')}
        </p>

        {/* Cevap durumu */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-5 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-amber-800">
              {/* <strong> elementi i18n string'ine native — Trans ile parse edilir */}
              <Trans
                i18nKey="common:offlineBanner.pendingCount"
                count={pendingCount}
                components={{ strong: <strong /> }}
                values={{ count: pendingCount }}
              />
            </span>
          </div>
        )}
        {pendingCount === 0 && (
          <div className="text-sm text-slate-400 mb-5">
            {t('common:offlineBanner.noPending')}
          </div>
        )}

        {/* Geri sayım */}
        <div
          className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 mb-6 ${
            isUrgent
              ? 'bg-rose-50 border-2 border-rose-300'
              : 'bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock
            className={`w-5 h-5 flex-shrink-0 ${
              isUrgent ? 'text-rose-600 animate-pulse' : 'text-slate-400'
            }`}
          />
          <div className="text-left">
            <p className={`font-semibold text-lg ${isUrgent ? 'text-rose-700' : 'text-slate-700'}`}>
              {t('common:offlineBanner.remainingSeconds', { count: remainingSeconds })}
            </p>
            <p className="text-xs text-slate-400">
              {t('common:offlineBanner.countdownDesc')}
            </p>
          </div>
        </div>

        {/* Manuel çıkış butonu */}
        <Button
          variant="outline"
          className="w-full text-slate-600 border-slate-300 hover:bg-slate-50"
          onClick={onManualExit}
        >
          {t('common:offlineBanner.exitNow')}
        </Button>
      </div>
    </div>
  );
}
