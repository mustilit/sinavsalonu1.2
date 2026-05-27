/**
 * CDN URL helper'ları — Sınav Salonu image/asset proxy.
 *
 * Üretimde uploads/, statik asset'ler CDN üzerinden serve edilir
 * (Cloudflare, Bunny, CloudFront). VITE_CDN_BASE_URL set edilirse
 * URL'ler otomatik rewrite edilir.
 *
 * KULLANIM:
 *
 *   import { cdnUrl, responsiveImage } from '@/lib/cdn';
 *
 *   // Basit URL rewrite
 *   const src = cdnUrl('/uploads/test-image.jpg');
 *   // → https://cdn.sinavsalonu.example/uploads/test-image.jpg
 *
 *   // Responsive srcset
 *   <img {...responsiveImage('/uploads/test-image.jpg')} alt="..." />
 *
 *   // Output:
 *   //   src     = .../test-image.jpg?w=800
 *   //   srcset  = .../test-image.jpg?w=400 400w, .../w=800 800w, .../w=1600 1600w
 *   //   sizes   = "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 800px"
 *
 * Cloudflare Image Resizing veya Bunny Optimizer arkadaysa otomatik resize yapar.
 * Yoksa origin server orijinal dosyayı serve eder (query param ignore edilir).
 */

const CDN_BASE = import.meta.env.VITE_CDN_BASE_URL?.replace(/\/$/, '') || '';

/**
 * Path'i CDN URL'ine çevir. CDN tanımlı değilse path olduğu gibi döner.
 *
 * @param {string} path - Backend'in döndüğü path (/uploads/foo.jpg) veya tam URL
 * @returns {string}
 */
export function cdnUrl(path) {
  if (!path) return '';
  // Zaten tam URL ise dokunma (Stripe avatarları, OAuth provider images)
  if (/^https?:\/\//i.test(path)) return path;
  // CDN tanımlı değilse origin'e bırak
  if (!CDN_BASE) return path;
  // Slash normalize
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${CDN_BASE}${normalized}`;
}

/**
 * Responsive image props üret — srcset + sizes.
 *
 * @param {string} path - Image path
 * @param {object} options
 * @param {number} options.defaultWidth - Varsayılan src width (px, default 800)
 * @param {number[]} options.widths - srcset için width listesi (default [400, 800, 1600])
 * @param {string} options.sizes - HTML sizes attr (default tipik responsive)
 * @returns {{ src: string, srcSet: string, sizes: string }}
 */
export function responsiveImage(path, options = {}) {
  const defaultWidth = options.defaultWidth ?? 800;
  const widths = options.widths ?? [400, 800, 1600];
  const sizes = options.sizes ?? '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 800px';

  if (!path) return { src: '', srcSet: '', sizes };

  const baseUrl = cdnUrl(path);

  // CDN yoksa srcset göndermek anlamsız (origin resize yapamaz)
  if (!CDN_BASE) {
    return { src: baseUrl, srcSet: '', sizes };
  }

  const srcSet = widths.map((w) => `${baseUrl}?w=${w} ${w}w`).join(', ');
  const src = `${baseUrl}?w=${defaultWidth}`;

  return { src, srcSet, sizes };
}

/**
 * CDN aktif mi (build-time)?
 */
export function isCdnEnabled() {
  return !!CDN_BASE;
}
