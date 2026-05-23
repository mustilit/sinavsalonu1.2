---
name: i18n
description: Çok dilli arayüz (dil desteği) — react-i18next ile çeviri anahtarları, locale dosyaları, aday (CANDIDATE) ve eğitici (EDUCATOR) alanları. Yeni sayfa/component/özellik geliştirilirken kullanıcıya görünen HER metin için çeviri anahtarı eklenmesi ZORUNLUDUR. UI metni, buton, etiket, hata mesajı yazılan her işte referans alın.
---

# Dil Desteği (i18n) — Sinav Salonu

## Altın Kural

**Kullanıcıya görünen hiçbir metin hardcode edilmez.** Her metin `t('namespace:key')` üzerinden gelir ve **5 dilin hepsine** anahtar eklenir. Bu, yeni özellik geliştirirken otomatik yapılan bir adımdır — ayrı komut beklenmez.

## Kurulum (mevcut)

- **Kütüphane:** react-i18next + i18next-browser-languagedetector
- **Yapılandırma:** `apps/frontend/src/lib/i18n.js`
- **Diller (5):** `tr` (fallback/kaynak), `en`, `es`, `zh`, `de`
- **Namespace'ler (4):** `common`, `auth`, `pages`, `onboarding`
- **Dosya yolu:** `apps/frontend/src/locales/<lang>/<namespace>.json`
- **Dil tespiti:** localStorage (`i18nextLng`) → navigator → htmlTag
- **`<html lang>`** dil değişiminde otomatik güncellenir (a11y + SEO)

## Kullanım

```jsx
import { useTranslation } from 'react-i18next';

export function PackageCard({ pkg }) {
  const { t } = useTranslation('pages');  // namespace seç
  return (
    <article>
      <h3>{pkg.title}</h3>
      <button>{t('card.viewDetails')}</button>   {/* "İncele" */}
      <span>{t('card.questionsCount', { count: pkg.questionCount })}</span>
    </article>
  );
}
```

Birden fazla namespace:
```jsx
const { t } = useTranslation(['pages', 'common']);
t('common:save');       // common namespace
t('pages:card.free');   // pages namespace
```

## Namespace Seçimi

| Namespace | İçerik | Örnek |
|-----------|--------|-------|
| `common` | Paylaşılan: butonlar, etiketler, durum metinleri | `save`, `cancel`, `loading`, `error.generic` |
| `auth` | Giriş, kayıt, şifre sıfırlama | `login.title`, `register.emailLabel` |
| `pages` | Sayfa/özellik-spesifik | `home.hero.title`, `mySales.empty` |
| `onboarding` | Tur, ilk kullanım | `tour.step1.title` |

**Yeni özellik → genelde `pages`.** Tekrar kullanılan generic metin → `common`.

## Anahtar İsimlendirme

Nested, sayfa/özellik bazlı, camelCase:

```json
{
  "mySales": {
    "title": "Satışlarım",
    "empty": "Henüz satış yok",
    "table": {
      "package": "Paket",
      "amount": "Tutar",
      "date": "Tarih"
    },
    "filters": {
      "allTime": "Tüm zamanlar",
      "thisMonth": "Bu ay"
    }
  }
}
```

- Üst seviye: sayfa/özellik adı (`mySales`, `myResults`, `createTest`)
- Alt seviye: bölüm (`table`, `filters`, `empty`)
- Yaprak: anlamlı isim (`title`, `amount`)
- Çakışmayı önle: aynı sayfa için tek üst anahtar.

## Aday (CANDIDATE) ve Eğitici (EDUCATOR) Alanları

Sinav Salonu'nda iki ana kullanıcı kitlesi var. **İkisi için de** çeviri anahtarı eklenmeli:

**Aday-yönelik sayfalar** (CANDIDATE görür):
- `home`, `explore`, `testCard`, `packageDetail`, `attempt`, `myResults`, `myTopicReport`, `myObjections`, `library`, `checkout`

**Eğitici-yönelik sayfalar** (EDUCATOR görür):
- `createTest`, `editTest`, `myTestPackages`, `mySales`, `myDiscountCodes`, `myAds`, `myLiveSessions`, `educatorSettings`, `questionReports`, `educatorRefunds`

**Audience-spesifik metin** aynı sayfada ayrılır:
```json
{
  "home": {
    "cta": {
      "candidateTitle": "Aday Olarak Katıl",
      "candidateDesc": "Binlerce test çöz, performansını takip et.",
      "educatorTitle": "Eğitici Olarak Katıl",
      "educatorDesc": "Test paketleri oluştur, adaylara ulaş, gelir elde et."
    }
  }
}
```

**Terminoloji (çevirilerde tutarlılık):**
- Aday = CANDIDATE (STUDENT/öğrenci **değil**)
- Eğitici = EDUCATOR (AUTHOR/yazar **değil**)
- TR metinlerde "aday" ve "eğitici" kullan; EN'de "candidate" ve "educator".

## Pluralization

i18next çoğul desteği (`_one`, `_other`):

```json
{
  "card": {
    "questionsCount_one": "{{count}} soru",
    "questionsCount_other": "{{count}} soru",
    "salesCount_one": "{{count}} satış",
    "salesCount_other": "{{count}} satış"
  }
}
```

```jsx
t('card.questionsCount', { count: 5 });  // "5 soru"
```

Türkçede tekil/çoğul ayrımı çoğu zaman aynı, ama `_one`/`_other` yine de tanımlanır (EN/DE için gerekir: "1 question" / "5 questions").

## Interpolation

```json
{ "welcome": "Hoş geldin, {{name}}", "remaining": "{{count}} dakika kaldı" }
```

```jsx
t('welcome', { name: user.name });
t('remaining', { count: minutes });
```

## Para ve Tarih Formatı

`apps/frontend/src/lib/i18n.js` içinde hazır:

```jsx
import { formatCurrency, formatRelativeTime } from '@/lib/i18n';

formatCurrency(1900, 'TRY');     // "₺19,00"  (amountCents → fiyat)
formatRelativeTime(date);        // "2 saat önce"
```

**Önemli:** Para `Int` cents olarak saklanır (`priceCents`), gösterimde `formatCurrency` ile böl. Manuel `/100` yapma.

i18next format syntax de var:
```json
{ "price": "Fiyat: {{amount, currency}}" }
```

## Yeni Özellik Geliştirirken — Otomatik Akış

Yeni sayfa/component yazarken **her zaman** şu adımlar (ayrı komut beklemeden):

1. **Hiçbir metni hardcode etme.** Her görünür string için `t('...')` kullan.
2. Anahtarları uygun namespace'e koy (genelde `pages`).
3. **Beş locale dosyasının hepsine** anahtarı ekle:
   - `tr/<ns>.json` — gerçek Türkçe metin (kaynak)
   - `en/<ns>.json` — İngilizce çeviri
   - `es/<ns>.json` — İspanyolca çeviri
   - `zh/<ns>.json` — Çince çeviri
   - `de/<ns>.json` — Almanca çeviri
4. Aday VE eğitici alanları kapsanıyorsa ikisinin de anahtarlarını ekle.
5. Pluralization gereken sayımlar için `_one`/`_other`.
6. Para/tarih için `formatCurrency`/`formatRelativeTime`.

**Çeviri kalitesi:** TR kaynak doğru olmalı. EN/ES/ZH/DE için anlamlı çeviri yaz (placeholder/TR kopyası bırakma — fallback zaten tr). Emin değilsen profesyonel terim kullan, teknik terimleri (test, paket) hedef dilin yaygın karşılığıyla çevir.

## Yeni Namespace veya Dil Ekleme

**Yeni namespace** (örn. `admin`):
1. 5 dil için `<lang>/admin.json` oluştur.
2. `i18n.js`'de import + `resources` + `ns: [...]` listesine ekle.

**Yeni dil** (örn. `fr`):
1. `locales/fr/` altına 4 namespace dosyası.
2. `i18n.js`'de import + `resources.fr` + `SUPPORTED_LANGUAGES` listesine ekle.
3. `LanguageSwitcher` otomatik gösterir (listeyi okur).

## Eksik Çeviri Tespiti

- Anahtar yoksa i18next `fallbackLng: 'tr'` ile Türkçe gösterir — kullanıcı kırılma görmez ama EN kullanıcısı Türkçe metin görür.
- Geliştirme sırasında console'da `i18next::translator: missingKey` uyarısı çıkar.
- CI'da bir script ile 5 dosyanın anahtar setlerini karşılaştır — biri eksikse uyar (ileride eklenebilir).

## Test

```jsx
// Test'te i18n provider gerekiyor
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

render(<I18nextProvider i18n={i18n}><MyComponent /></I18nextProvider>);
```

Veya `t`'yi mock'la:
```jsx
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { changeLanguage: vi.fn() } }),
}));
```

Test'te `t(key) => key` mock'u ile anahtar varlığını doğrula (metin yerine key kontrol et).

## Yapmayacakların

- Kullanıcıya görünen metni hardcode etme (`<button>Kaydet</button>` ❌ → `<button>{t('common:save')}</button>` ✓).
- Sadece TR'ye anahtar ekleyip diğer 4 dili atlamak.
- Para'yı manuel formatlamak (`{price/100} ₺`) — `formatCurrency` kullan.
- "öğrenci"/"student" terimini kullanmak — **aday/candidate**.
- "yazar"/"author" terimini kullanmak — **eğitici/educator**.
- Aynı metin için iki farklı anahtar (duplikasyon) — `common`'a çek.

## Checklist (her yeni UI metni)

- [ ] Metin `t('...')` ile mi (hardcode değil)?
- [ ] Doğru namespace (common/auth/pages/onboarding)?
- [ ] 5 dilin **hepsinde** anahtar var mı (tr+en+es+zh+de)?
- [ ] Çeviriler anlamlı mı (placeholder/TR kopyası değil)?
- [ ] Aday + eğitici alanları kapsandı mı (ilgiliyse)?
- [ ] Sayım metni pluralization (`_one`/`_other`) içeriyor mu?
- [ ] Para/tarih `formatCurrency`/`formatRelativeTime` ile mi?
- [ ] Terminoloji: aday (CANDIDATE), eğitici (EDUCATOR)?
- [ ] Test `t` mock'u veya I18nextProvider ile yazıldı mı?

Skill'ler: yeni component için `react-component`, form metinleri için `form-mutation`.
