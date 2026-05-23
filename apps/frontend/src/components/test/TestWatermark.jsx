import { useMemo } from 'react';

/**
 * TestWatermark — Test çözme ekranı üzerinde tekrarlayan, yarı saydam,
 * çapraz filigran.
 *
 * Amaç: Aday cihazından ekran fotoğrafı / kaydı yapılırsa kişiyi belirleyen
 * bilgi (kullanıcı adı, e-posta, IP, zaman) görüntüye gömülmüş olur. Hile
 * yapan kişi sosyal/yasal sorumluluk taşır.
 *
 * Yerleşim:
 *   - position: fixed, tüm viewport
 *   - z-index: yüksek ama modal'ların altında (modal: 50, watermark: 40)
 *   - pointer-events: none → kullanıcı altındaki butonları tıklayabilir
 *   - select-none → kopyalanamaz
 *
 * Tekrar: CSS grid yerine arka arkaya çapraz çizgiler — SVG pattern de
 * çalışırdı ama HTML doğrudan kontrast/erişilebilirlik için daha kolay.
 *
 * GERÇEK: Kötü niyetli kullanıcı DevTools'tan div'i silebilir. Buna karşı
 * mutlak çözüm yok ama günlük kullanıcılar için ciddi caydırıcı.
 */
export function TestWatermark({ identity }) {
  // identity: { name, email, ip?, attemptId? }
  const text = useMemo(() => {
    const parts = [];
    if (identity?.name) parts.push(identity.name);
    if (identity?.email) parts.push(identity.email);
    if (identity?.ip) parts.push(identity.ip);
    parts.push(new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }));
    return parts.join(' · ');
  }, [identity]);

  if (!text) return null;

  // 6 sütun × 8 satır grid — sayfa boyunca kaplar
  const rows = 8;
  const cols = 6;
  const cells = rows * cols;

  // absolute inset-0 → yalnızca en yakın "position: relative" parent kadar
  // kaplar. Soru çözme ekranında soru kartının içinde render edildiğinden
  // sidebar / answer-sheet / arka plan üzerine taşmaz, sadece soru alanını
  // kaplar.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
      style={{
        // Çok hafif transparan — soru okunabilirliğini bozmasın, sadece
        // screenshot/ekran kaydında ad/zaman tespit edilebilsin.
        opacity: 0.025,
      }}
    >
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          transform: 'rotate(-30deg) scale(1.6)',
          transformOrigin: 'center',
        }}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-slate-900 dark:text-gray-100 text-xs font-semibold whitespace-nowrap"
          >
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TestWatermark;
