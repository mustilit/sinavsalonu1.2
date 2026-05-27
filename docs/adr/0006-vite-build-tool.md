# ADR-0006: Vite build tool seçimi

## Statü

Accepted

## Bağlam

Frontend 47 sayfa, 50+ UI bileşeni, 5 dil locale dosyası, React.lazy code splitting, dark mode, Tailwind utility CSS, axe-core a11y test'leri ile build edilmeli. Dev experience hızlı feedback, prod build optimize edilmiş chunk'lar gerektiriyor.

Kısıtlar:

1. **Dev hız kritik** — 200+ component, ekipte hot reload <500ms olmazsa flow bozulur.
2. **Bundle size disiplini** — Sınav Salonu hedef kitlesi mobil cihaz (3G ağ) kullanıcıları dahil. İlk yükleme `< 200kb gzip` hedefli.
3. **JavaScript (JSX) kullanılıyor**, TypeScript yok (CLAUDE.md kuralı). `checkJs` ile tip sızdırma olabilir; build tool buna uyumlu olmalı.

## Karar

**Vite 6.x** seçildi. `apps/frontend/vite.config.js` ile yapılandırma. Build target `esnext`, modern browser hedefli (browserslist `apps/frontend/package.json`'da tanımlı).

### Niçin Vite

| Kriter | Vite | Webpack 5 + Babel | Next.js | Parcel |
|---|---|---|---|---|
| Dev başlatma süresi | <1s (ESM dev server) | 10-30s (bundling) | 5-15s | 2-5s |
| HMR (hot reload) | <100ms | 500ms-3s | 1-3s | 200ms-1s |
| Yapılandırma kompleksitesi | Düşük (declarative config) | Yüksek (loader chains) | Düşük (Next routing dahil) | Çok düşük (zero config) |
| Code splitting | ✓ Otomatik route + manual `lazy()` | ✓ Manuel chunk strategy | ✓ Otomatik (page-based) | ✓ Otomatik |
| Tree shaking | ✓ ESM + rollup | ✓ Webpack 5 | ✓ Next | ✓ Parcel 2 |
| SSR/SSG | Vite SSR (manuel) | webpack-dev-middleware | ✓ Native | Sınırlı |
| Plugin ekosistemi | Büyük (rollup uyumlu) | Çok büyük | Next ecosystem | Küçük |
| Production maturity | ✓ 2024+ stabil | ✓ Çok olgun | ✓ Çok olgun | Orta |

Vite'ın iki seçilme nedeni:

1. **Dev server ESM-native**: Production bundle Rollup ile, dev server browser'ın native ESM yükleyicisini kullanır. 200+ component projede dev başlatma <1s, HMR <100ms.
2. **Rollup tabanlı prod build**: Tree shaking + code splitting Webpack'in agresif chunking'inden daha temiz çıktı veriyor. 47 sayfa için route-bazlı chunk + vendor split otomatik.

### SSR/SSG değil çünkü

Sınav Salonu **client-rendered SPA** olarak konumlandı:
- Çoğu sayfa auth-gated (Login, MyTests, ProfileSettings) — SEO bonus yok.
- Marketplace listesi public ama dinamik filtre-search ağırlıklı — SSG cache'i hızlı eskir.
- TestDetail SEO için faydalı olabilir; Cloudflare cache veya prerender fallback gelecekte değerlendirilecek.

Next.js seçilseydi SSR + auth + tier guard üçlüsü için ek karmaşıklık gelirdi.

### Yapılandırma detayları (`apps/frontend/vite.config.js`)

```js
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix-vendor': ['@radix-ui/*'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`ANALYZE=1 npm run build` `rollup-plugin-visualizer` ile `dist/stats.html` treemap üretir. CI artifact'i olarak yüklenir (`backend-migrate-and-test.yml` frontend_build job'ı).

## Sonuçlar

**Olumlu**

- Dev başlatma + HMR yıldız — geliştirici akışı bozulmuyor.
- `pages.config.js` ile React.lazy + manual chunks: 47 sayfa için ilk yüklemede sadece Home + Layout indiriliyor.
- Vitest aynı `vite.config.js`'i kullanır — test + build config tek noktada.
- Plugin ekosistemi: `@vitejs/plugin-react`, `rollup-plugin-visualizer`, `@vitest/coverage-v8` direkt entegre.
- Production bundle gzip <200kb hedefi tutuyor (Sentry, PostHog dahil).

**Olumsuz / takas**

- **SSR yok** — Marketplace public sayfaları için SEO snippet sınırlı (meta tag client-render edilir). React Helmet zaten kullanılıyor; gelecekte prerender ile çözülebilir.
- **`browserslist` esnek değil** — Vite default'u `esnext` yani modern browser hedefli. `@vitejs/plugin-legacy` ile IE11/eski browser fallback verilebilir ama Türkiye browser pazarı %95+ modern olduğu için eklenmedi (ADR notu).
- **Production debug zorluk:** Source map var ama Rollup'ın chunk isimlendirmesi Webpack kadar okunaklı değil. Sentry release manifest'i bunu kompanse eder.
- **CSS modülasyon**: Tailwind utility-first kullanıldığı için CSS modules + PostCSS pipeline'ı minimal — Vite default'u yeterli.

## Alternatifler

### Webpack 5 + Babel

Klasik, olgun, çok geniş plugin ekosistemi.

**Niçin değil:**
- Dev bundling 10-30s (200+ component için).
- Yapılandırma kompleks (loader chain, babel preset karmaşası).
- HMR yavaş — büyük projede flow bozar.
- ESM-native değil, transformation overhead.

### Next.js

SSR + SSG + API routes + image optimization tek pakette.

**Niçin değil:**
- SPA modeli için fazla feature; auth-gated sayfalar SSR'dan fayda görmez.
- Build sistemi opaque (Next'in kendi compiler'ı SWC).
- Tier-guard + multi-tenant gibi cross-cutting Next middleware'inde elle yazılmalı.
- TypeScript zorunluluğu yok ama Next'in kendi tip dünyası ile uyum maliyeti var.

Gelecekte SEO kritik olursa, sadece marketplace + landing sayfalarını Next.js subroute olarak ayırabiliriz; auth-gated kısım Vite SPA olarak kalır.

### Parcel

Zero-config build tool.

**Niçin değil:**
- Production maturity orta — büyük SPA için sürpriz davranışlar bildirilmiş.
- Plugin ekosistemi küçük; özel ihtiyaçlarda (PWA, Sentry release, Vitest) ek konfig zorluğu.
- React + Tailwind + Vitest ile out-of-box uyum Vite kadar iyi değil.

### Remix

Modern React framework, SSR-first.

**Niçin değil:**
- React Router v7 ile Remix birleşti; ama hâlâ SSR-first; SPA modeli için aşırı.
- Auth + tier-guard + Stripe gibi entegrasyon Vite'tan daha karmaşık.

## İlgili kararlar

- ADR-0001 Clean Architecture — backend yapısı (Vite ile alakasız).
- ADR-0004 JWT Stateless Auth — token client-side localStorage; SSR olmayışıyla uyumlu.
- ADR-0007 URI Versioning — backend API kontratı; Vite frontend bunu tüketir.

## İlgili dosyalar

- `apps/frontend/vite.config.js` — build + test config tek dosyada.
- `apps/frontend/package.json` — `browserslist` + scripts.
- `apps/frontend/pages.config.js` — React.lazy ile route-based code splitting.
- `apps/frontend/src/main.jsx` — entry point, Sentry + analytics init.

## Revizyon

- 2026-05 — İlk yazım. Karar yürürlükte.
- (gelecek) Marketplace SEO acil ihtiyaç olursa landing/Marketplace subroute Next.js'e ayrılabilir.

## Notlar

Vite major sürüm yükseltmesi:
1. CHANGELOG breaking change kontrolü.
2. Plugin uyumluluğu (`@vitejs/plugin-react`, `rollup-plugin-visualizer`, `@vitest/coverage-v8`).
3. Dev server + HMR smoke test (`npm run dev` → 5174'e bağlan).
4. Prod build smoke test (`npm run build && npm run preview`).
5. Bundle size delta kontrolü (`ANALYZE=1 npm run build` → `dist/stats.html`).
