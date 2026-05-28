---
name: release-engineering
description: Dependabot konfigürasyonu, branch protection, conventional commits + commitlint, CHANGELOG otomasyonu (changesets/semantic-release), PR/issue şablonları, release süreci (image promotion), DORA metrikleri. Versiyon yayını, sürüm süreci tasarımı, CI/CD policy yazımı yapılırken referans alın.
---

# Release Engineering — Sınav Salonu

KALITE-DEGERLENDIRME §12 "Süreç Kalitesi 7/10"'u 9/10'a taşıyacak rehber. Tek geliştirici de çalışsa süreç disiplini hata kapatır.

## 1. Dependabot (haftalık, gruplu)

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/apps/backend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Istanbul"
    open-pull-requests-limit: 10
    groups:
      backend-prod-minor-patch:
        dependency-type: "production"
        update-types: ["minor", "patch"]
      backend-dev-minor-patch:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      backend-major:
        update-types: ["major"]
    commit-message:
      prefix: "chore(backend-deps)"
    labels:
      - "dependencies"
      - "backend"

  - package-ecosystem: "npm"
    directory: "/apps/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Istanbul"
    open-pull-requests-limit: 10
    groups:
      frontend-prod-minor-patch:
        dependency-type: "production"
        update-types: ["minor", "patch"]
      frontend-dev-minor-patch:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      frontend-major:
        update-types: ["major"]
    commit-message:
      prefix: "chore(frontend-deps)"
    labels:
      - "dependencies"
      - "frontend"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(ci)"
    labels:
      - "dependencies"
      - "ci"

  - package-ecosystem: "docker"
    directory: "/infra/docker"
    schedule:
      interval: "monthly"
    commit-message:
      prefix: "chore(docker)"
```

### Auto-merge minor/patch

`.github/workflows/dependabot-auto-merge.yml`:

```yaml
name: Dependabot auto-merge
on: pull_request_target

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - id: meta
        uses: dependabot/fetch-metadata@v2
      - name: Approve
        if: steps.meta.outputs.update-type == 'version-update:semver-patch' || steps.meta.outputs.update-type == 'version-update:semver-minor'
        run: gh pr review --approve "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Enable auto-merge
        if: steps.meta.outputs.update-type == 'version-update:semver-patch' || steps.meta.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 2. Branch Protection (main)

GitHub Settings → Branches → Add rule → `main`:

- ✅ Require pull request before merging (1 approval)
- ✅ Dismiss stale approvals on new commit
- ✅ Require status checks to pass: `backend-migrate-and-test`, `docker`, `frontend-test`, `frontend-build`
- ✅ Require branches to be up to date before merging
- ✅ Require linear history
- ✅ Require signed commits (opsiyonel ama önerilir)
- ✅ Restrict who can push to matching branches (Admin'ler `bypass` ile)
- ❌ Allow force pushes (asla)
- ❌ Allow deletions (asla)

Bunu IaC olarak da yazılabilir (Terraform `github_branch_protection`).

## 3. Conventional Commits + commitlint

```bash
npm i -D @commitlint/cli @commitlint/config-conventional husky
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

`commitlint.config.cjs`:

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
    ]],
    'scope-enum': [2, 'always', [
      'backend', 'frontend', 'infra', 'ci', 'docs',
      'auth', 'test', 'purchase', 'live', 'admin', 'live-session',
      'attempt', 'discount', 'objection', 'refund', 'ad', 'package',
      'review', 'contract', 'report', 'notification', 'security',
      'a11y', 'i18n', 'observability', 'deps',
    ]],
    'header-max-length': [2, 'always', 100],
  },
};
```

Geçerli örnekler:

```
feat(purchase): idempotency-key support
fix(backend): N+1 query in ListPublishedTests
docs(observability): add runbook for db-down
chore(backend-deps): bump prisma to 5.20
```

## 4. PR Template

`.github/pull_request_template.md`:

```markdown
## Özet
<!-- Ne değiştirdin? 2-3 cümle. -->

## Etkilenen Alanlar
- [ ] Backend (use case / controller / migration)
- [ ] Frontend (sayfa / component)
- [ ] Infra / CI
- [ ] Dokümantasyon
- [ ] Test

## Test
- [ ] Unit test eklendi / güncellendi
- [ ] E2E (Playwright) eklendi / güncellendi
- [ ] a11y testi gerekiyorsa eklendi
- [ ] Manuel test edildi

## Breaking Change
- [ ] Hayır
- [ ] Evet → CHANGELOG'a `BREAKING CHANGE` notu eklendi

## Migration / Veri
- [ ] Migration yok
- [ ] Migration var → ek review label'ı atandı (`needs-migration-review`)
- [ ] Geri alınabilir (rollback planı): ...

## Güvenlik
- [ ] Yetki kontrolü gerekiyor mu? Test edildi mi?
- [ ] Yeni dependency var mı? `npm audit` temiz mi?
- [ ] PII handling değişti mi?

## Ekran Görüntüleri (UI değişikliği)
<!-- before/after -->
```

## 5. Issue Template

`.github/ISSUE_TEMPLATE/bug.md`:

```markdown
---
name: Bug
about: Hata bildirimi
labels: bug
---

**Beklenen davranış**
**Gerçekleşen davranış**
**Yeniden üretme adımları**
1.
2.
3.

**Ortam**
- Tarayıcı / Cihaz:
- Kullanıcı rolü:
- Tenant:

**Sentry / log link**
```

`.github/ISSUE_TEMPLATE/feature.md`, `.github/ISSUE_TEMPLATE/security.md` (security için private vulnerability reporting tercih).

## 6. CHANGELOG Otomasyonu

İki seçenek:

### a) Changesets (önerilen — monorepo dostu)

```bash
npm i -D @changesets/cli
npx changeset init
```

Her PR'da geliştirici `npx changeset` ile değişikliği yazar:

```md
---
'@sinavsalonu/backend': minor
'@sinavsalonu/frontend': patch
---

feat(purchase): idempotency-key support
```

Release workflow:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - uses: changesets/action@v1
        with:
          publish: npm run release
          version: npm run changeset:version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### b) semantic-release (commit message tabanlı)

Conventional commits'ten otomatik sürüm + CHANGELOG. PR template'i daha hafif.

## 7. Release Süreci (image promotion)

```
[main push] → CI build → Docker image (tag: SHA) → Staging deploy (SHA)
       └─ Manual approval → Production deploy (SAME SHA — yeniden build YOK)
```

`docker.yml` workflow'una `workflow_dispatch` ile environment seçimi:

```yaml
on:
  workflow_dispatch:
    inputs:
      env:
        type: choice
        options: [staging, production]
      sha:
        description: 'Image SHA (default: HEAD)'

jobs:
  deploy:
    environment: ${{ inputs.env }}  # production environment'da required reviewers var
    steps:
      - name: Pull existing image
        run: docker pull ghcr.io/${{ github.repository }}:${{ inputs.sha }}
      - name: Tag and push to ${{ inputs.env }}
        run: |
          docker tag ghcr.io/${{ github.repository }}:${{ inputs.sha }} \
                     ghcr.io/${{ github.repository }}:${{ inputs.env }}
          docker push ghcr.io/${{ github.repository }}:${{ inputs.env }}
```

## 8. Migration Safety Check

PR'a Prisma migration eklendiğinde otomatik label + ekstra review:

`.github/workflows/migration-check.yml`:

```yaml
name: Migration safety check
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Detect migration files
        id: detect
        run: |
          changed=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | grep '^apps/backend/prisma/migrations/' || true)
          echo "files=$changed" >> $GITHUB_OUTPUT
      - name: Add label
        if: steps.detect.outputs.files != ''
        uses: actions-ecosystem/action-add-labels@v1
        with:
          labels: needs-migration-review
      - name: Detect destructive ops
        if: steps.detect.outputs.files != ''
        run: |
          if grep -E 'DROP COLUMN|DROP TABLE|ALTER TYPE' ${{ steps.detect.outputs.files }}; then
            echo "::error::Destructive migration detected — needs ops sign-off"
            exit 1
          fi
```

## 9. Performance Budget — MEVCUT İMPLEMENTASYON (Sprint 11)

> **Aktif workflow:** `.github/workflows/lighthouse.yml`. **Config:** `apps/frontend/lighthouserc.json`.

Bundle + Lighthouse + sıkıştırma + PWA — hepsi build pipeline'ında.

### Lighthouse CI

**Config (`apps/frontend/lighthouserc.json`):**

```jsonc
{
  "ci": {
    "collect": {
      "url": ["/", "/Explore", "/TestDetail?id=demo", "/Login"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance":   ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices":["warn",  { "minScore": 0.90 }],
        "categories:seo":           ["warn",  { "minScore": 0.85 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time":      ["error", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

**Workflow (`.github/workflows/lighthouse.yml`):** PR + main push tetiği, `apps/frontend/**` path filtresi, `actions/upload-artifact` 30 gün retention. PR thresholds altındaysa kırılır.

### Build sıkıştırma (Brotli + Gzip — Sprint 11 #1)

```js
// apps/frontend/vite.config.js
import { compression } from 'vite-plugin-compression2';
plugins: [
  compression({ algorithm: 'brotliCompress', include: /\.(js|mjs|json|css|html|svg|wasm)$/i, threshold: 1024 }),
  compression({ algorithm: 'gzip',           include: /\.(js|mjs|json|css|html|svg|wasm)$/i, threshold: 1024 }),
]
```

Build çıktısı her bundle'ın yanına `.br` ve `.gz` dosyaları üretir. nginx `brotli_static + gzip_static` runtime sıkıştırma yapmadan bunları servisler (`infra/nginx/default.conf.template`).

nginx Brotli module: `infra/docker/frontend.Dockerfile` Alpine edge community'den `nginx-mod-http-brotli` paketini kurar, `/etc/nginx/modules-enabled/00-brotli-*.conf` ile load eder.

### PWA build çıktısı (Sprint 11 #3)

`npm run build` → `dist/sw.js` + `dist/workbox-*.js` + `dist/manifest.webmanifest`. Workbox precache 185 entry (~3877 KiB) — yeni route eklendiğinde otomatik artar. Yeni PNG ikonu: `npm run pwa:icons`.

### Bundle size budget (Sprint 12 #1 sonrası)

- **Initial entry:** `dist/assets/index-*.js` = **~496 KB / 159 KB gzip** (Sprint 11 sonu 1117 KB / 354 KB idi).
- **Vendor chunk'ları (`vite.config.js` `manualChunks`):**
  - `react-vendor` ~157 KB (react + react-dom + react-router-dom)
  - `radix-vendor` ~146 KB (tüm @radix-ui/* primitives)
  - `analytics-vendor` ~211 KB (posthog + @sentry/react)
  - `i18n-vendor` ~68 KB (i18next + react-i18next + LanguageDetector)
  - `form-vendor` ~53 KB (react-hook-form + zod + @hookform/resolvers)
  - `icons-vendor` ~50 KB (lucide-react)
  - `query-vendor` ~43 KB (@tanstack/react-query)
  - `date-vendor` ~26 KB (date-fns)
- **Dynamic chunk'lar** (heavy lib lazy):
  - `xlsx` ~429 KB — sadece "Excel'e aktar" tıklanınca
  - `html2canvas` ~202 KB — sadece "Paylaş" tıklanınca
  - `LineChart` ~392 KB — MyResults grafik açılınca
- **Sayfa chunk'ları:** her sayfa kendi chunk'ında 20-80 KB.
- **`chunkSizeWarningLimit`:** 600 KB (vendor chunk büyük olabilir).

**Sprint 12 sonrası tekrar ziyaret performansı:** Vendor chunk'lar stable hash → cache hit. Kullanıcı sadece değişen entry chunk'ı indirir (~159 KB gzip).

```bash
ANALYZE=1 npm run build   # dist/stats.html treemap — CI'da artifact yüklenir
```

**Yeni vendor lib eklenirken:** `vite.config.js` `manualChunks`'a uygun grubu seç. Entry chunk'a (uncategorized) yeni büyük lib yüklemek yasak. Heavy lib (>100 KB) tek sayfada gerekiyorsa `await import()` ile dinamik yükle. Detay: `react-component` skill, "Bundle Discipline" bölümü.

### Lighthouse manuel çalıştırma

```bash
cd apps/frontend
npx lhci autorun --config=./lighthouserc.json
# Sonuçlar .lighthouseci/ altında
```

## 10. DORA Metrikleri

Ölç ve dashboard'a yansıt:

| Metric | Tanım | Hedef |
|---|---|---|
| Deployment Frequency | Üretim deploy / hafta | ≥ 5 |
| Lead Time for Changes | Commit → prod median | < 24h |
| MTTR (Mean Time to Restore) | Incident süresi median | < 1h |
| Change Failure Rate | Hotfix gerektiren deploy oranı | < %15 |

Bunlar GitHub API + Sentry release ID + statuspage'den otomatik çekilebilir.

## Checklist (release süreci sağlık)

- [ ] `.github/dependabot.yml` var mı?
- [ ] Branch protection main üzerinde aktif mi?
- [ ] CHANGELOG son release ile güncel mi?
- [ ] Conventional commits zorunlu mu (commitlint)?
- [ ] PR template uygulanıyor mu?
- [ ] Security workflow (Trivy/audit) yeşil mi?
- [ ] Last 30 gün DORA metrikleri targetin üzerinde mi?

İlgili skill'ler: `observability` (deploy sonrası health), `security-hardening` (dependency scan).
