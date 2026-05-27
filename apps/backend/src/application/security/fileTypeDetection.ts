/**
 * Magic byte detection — kullanıcı HTTP MIME header'ına asla güvenme.
 *
 * Yüklenen dosyanın ilk N byte'ından gerçek tipini tespit eder.
 * Sınav Salonu yalnızca güvenli görsel formatları kabul eder:
 *   - JPEG, PNG, WebP, GIF
 *   - SVG REDDEDİLİR (içerebileceği <script> + onload XSS riski)
 *   - HEIC, AVIF gelecekte beyaz listeye alınabilir.
 *
 * Multer dosyayı `Buffer` veya stream olarak verir; bu fonksiyon Buffer alır.
 *
 * ATAK YÜZEYİ:
 *   - polyglot dosya (içine PHP shell koyup PNG header'ı ile başlayan)
 *     → magic byte geçer ama backend bu dosyayı execute etmiyor (Nginx
 *       sadece statik serve eder). Kombinasyon: ClamAV virus scan (Sprint 8).
 *   - SVG XSS → açıkça reddedildi.
 *   - ZIP slip / path traversal → filename yeniden üretilir, originalName
 *       kullanıcı dosyaya yakın bile gitmez.
 */

export type AllowedImageType = 'jpeg' | 'png' | 'webp' | 'gif';

export interface DetectedFile {
  type: AllowedImageType;
  mimeType: string;
  extension: string;
}

/**
 * Buffer'ın ilk byte'larını magic signature'a karşı kontrol eder.
 * Bilinen güvenli görsel tipi değilse `null` döner.
 */
export function detectImageType(buffer: Buffer): DetectedFile | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF (start of image marker)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { type: 'jpeg', mimeType: 'image/jpeg', extension: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { type: 'png', mimeType: 'image/png', extension: '.png' };
  }

  // WebP: "RIFF....WEBP" (4 byte RIFF + 4 byte size + 4 byte WEBP)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { type: 'webp', mimeType: 'image/webp', extension: '.webp' };
  }

  // GIF: "GIF87a" veya "GIF89a"
  if (
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 or 9
    buffer[5] === 0x61 // a
  ) {
    return { type: 'gif', mimeType: 'image/gif', extension: '.gif' };
  }

  return null;
}

/**
 * SVG açıkça tespit ve reddetme — XSS payload riski.
 *
 * SVG bir XML dosyası; içine <script> + onload + onclick eklenebilir.
 * Browser SVG'yi <img src> içinde mount ederse script çalışmaz, ama
 * doğrudan <object>, <iframe>, <embed> ile veya saldırgan link
 * paylaşırsa çalışır. Sanitize'ten emin olmadıkça SVG yasak.
 */
export function looksLikeSvg(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return false;
  // İlk 256 byte içinde "<svg" arıyoruz (UTF-8 + UTF-16 BOM olabilir)
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString('utf8').toLowerCase();
  return head.includes('<svg') || head.includes('<?xml');
}

/**
 * Yüksek seviyeli yardımcı: tip beyaz-listede mi, SVG değil mi, kontrol et.
 *
 * @throws asla — null/undefined döner; caller controller exception fırlatır.
 */
export function validateImageUpload(buffer: Buffer): { ok: true; detected: DetectedFile } | { ok: false; reason: string } {
  if (looksLikeSvg(buffer)) {
    return { ok: false, reason: 'SVG dosyaları kabul edilmiyor (XSS riski)' };
  }
  const detected = detectImageType(buffer);
  if (!detected) {
    return {
      ok: false,
      reason: 'Dosya tipi tanınmadı veya desteklenmiyor (yalnızca JPEG, PNG, WebP, GIF)',
    };
  }
  return { ok: true, detected };
}
