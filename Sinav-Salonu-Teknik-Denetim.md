# Sınav Salonu — Teknik Denetim Dokümanı

**Hazırlanma tarihi:** 22 Mayıs 2026
**Kapsam:** Fonksiyonalite (rol-fonksiyon matrisi), fonksiyonel olmayan özellikler (mimari, altyapı, teknoloji, sistem kontrolleri), veritabanı loglama/audit izleri.
**Yöntem:** Kod tabanının doğrudan taranması — `apps/backend/src/nest/controllers`, `guards`, `decorators`, `prisma/schema.prisma`, `infra/`, `.github/`, `apps/frontend/src`. Bulgular dosya yolu ve model/alan adıyla doğrulanmıştır.
**Amaç:** Proje teslim öncesi gözden kaçan/eksik kalan noktaların tespiti.

---

## Yönetici Özeti

Sınav Salonu, olgun bir mimariye sahip: Clean Architecture katmanları net ayrılmış, 55+ controller ince tutulmuş, merkezi `AuditLog` mekanizması güçlü (76 olay tipi, tam aktör/hedef/diff izi), cursor pagination + composite index + tsvector full-text search disiplini gerçekten uygulanmış. Güvenlik tarafında JWT + ban kontrolü, 2FA (TOTP + recovery), CSP (helmet), throttling (Redis tabanlı), webhook imza doğrulama, idempotency, AES-GCM şifreleme ve KVKK uyumlu retention mevcut.

Buna karşılık denetim, teslim öncesi giderilmesi önerilen **birkaç önemli boşluk** ortaya çıkardı. En kritik olanları:

1. **WORKER yetkilendirmesi backend'de hiç uygulanmıyor.** `@WorkerPermissions` decorator'ı metadata yazıyor ama bu metadata'yı okuyan bir guard yok — yetki kontrolü yalnızca frontend'de, dolayısıyla API doğrudan çağrıldığında bypass edilebilir.
2. **Yedekleme (backup) özelliği dokümante edilmiş ama implemente edilmemiş.** `BackupLog` modeli, `BackupSchedulerService` ve `pg_dump` kodu kod tabanında yok; yalnızca `BACKUP_RUN` enum değeri ve dokümanlar var.
3. **CLAUDE.md ile kod arasında çok sayıda tutarsızlık var** (nginx katmanı, `scripts/staging.sh`, `.husky/`, `docker-compose.local-staging.yml` dokümante edilmiş ama dosyalar mevcut değil). Bunlar, dokümanın koddan ileride kaldığını veya bazı özelliklerin geri alındığını gösteriyor.

Detaylar Bölüm 4'te önceliklendirilmiş olarak listelenmiştir.

---

## 1. Fonksiyonalite — Rol-Fonksiyon Matrisi

Roller: **CANDIDATE** (aday), **EDUCATOR** (eğitici), **ADMIN**, **WORKER** (admin altında yetkili çalışan). *(AUTHOR/STUDENT terimleri kullanılmaz.)*

### 1.1 Yetkilendirme Mekanizması

Global guard zinciri `apps/backend/src/nest/main.ts` içinde kuruludur:

```
app.useGlobalGuards(new JwtAuthGuard(...), new RolesGuard(reflector));
```

Her istek önce `JwtAuthGuard`, ardından `RolesGuard`'tan geçer. Ayrıca `app.module.ts`'te `APP_GUARD` olarak `CustomThrottlerGuard` bağlıdır (rate limiting).

**JwtAuthGuard** (`guards/jwt-auth.guard.ts`)
- `@Public()` ile işaretli endpoint'leri atlar.
- Aksi halde `Bearer` token zorunlu; doğrulanır, `req.user = { ...payload, id: payload.sub }` set edilir.
- Ek ban/suspend kontrolü yapar (Redis cache, 60s TTL). Banlı/askıya alınmış kullanıcı `ACCOUNT_SUSPENDED_OR_BANNED` ile reddedilir.

**RolesGuard** (`guards/roles.guard.ts`)
- `@Public()` ise geçer.
- `@Roles(...)` metadata'sı **yoksa** geçer — yani yalnızca JWT taşıyan, `@Roles` içermeyen endpoint **her kimlik doğrulanmış role açıktır**.
- `@Roles` varsa `requiredRoles.includes(user.role)` ile kontrol edilir. **Tek seviye, hiyerarşi yok** — ADMIN otomatik üst-rol değildir; bir endpoint'in ADMIN'e açık olması için `'ADMIN'` açıkça listelenmelidir.

**@Public default davranışı:** `@Public()` konmayan her endpoint JWT zorunludur.

**WORKER izin modeli (kritik):** `@WorkerPermissions(...)` decorator'ı `worker_permissions` metadata'sı set eder, ancak bu metadata'yı okuyan **hiçbir guard yoktur**. `WorkerPermissionsGuard` dosyası mevcut değildir ve global guard listesinde yer almaz. Sonuç: WORKER sayfa-bazlı yetkilendirme backend'de uygulanmaz (bkz. Bölüm 4.1). *(Doğrulandı: `WORKER_PERMISSIONS_KEY` referansı yalnızca kendi decorator dosyasında bulunuyor.)*

**TierGuard** (`guards/tier.guard.ts`): Yalnızca `@RequireTier(...)` ile çalışır, global değildir ve hiçbir controller'da kullanılmamaktadır — şu an pasif/ölü koddur.

### 1.2 CANDIDATE (Aday)

| Method + Route | İşlev |
|---|---|
| `POST /tests/:id/start` | Deneme başlat |
| `POST /attempts/:id/pause`, `/resume` | Duraklat / devam et |
| `POST /attempts/:id/answer`, `/answers` | Cevap gönder |
| `GET /attempts/:id/state`, `/result`, `/:id` | Deneme durumu / sonuç / detay |
| `PATCH /attempts/:id/checkpoint` | İlerleme kaydı |
| `POST /attempts/:id/finish`, `/timeout` | Bitir / zaman aşımı |
| `GET .../questions/:qid/solution` | Çözüm görüntüleme |
| `POST /purchases/:testId` | Test satın al (throttle 30/dk) |
| `POST /tests/:id/reviews`, `POST /marketplace/packages/:id/reviews` | Test / paket değerlendir |
| `POST /objections`, `GET /me/objections` | İtiraz aç / kendi itirazları |
| `POST /refunds` (throttle 3/5dk), `POST /refunds/:id/appeal`, `GET /me/refunds` | İade talebi / itiraz / liste |
| `POST /follows`, `DELETE /follows`, `GET /follows` | Eğitici takip et / bırak / listele |
| `GET /home/recommended-tests` | Önerilen testler |
| `GET /me/topic-performance` | Konu bazlı performans (CANDIDATE, ADMIN) |
| `PATCH /notifications` | Bildirim tercihleri |

### 1.3 EDUCATOR (Eğitici)

| Method + Route | İşlev |
|---|---|
| `POST /tests` | Test oluştur (EDUCATOR, ADMIN) |
| `PUT /tests/:id/publish`, `/unpublish` | Yayımla / geri çek |
| `POST /tests/:id/questions`, `PATCH .../questions/:qid`, `.../options/:oid`, `DELETE .../questions/:qid` | Soru & seçenek CRUD |
| `PATCH /tests/:id` | Test güncelle |
| `GET/POST/PATCH/DELETE /packages...` (`/:id/tests`, `/publish`, `/unpublish`) | Paket CRUD + yayımlama |
| `PATCH /educators/me` | Profil güncelle |
| `POST/GET /educators/me/discount-codes`, `PATCH .../:id/toggle` | İndirim kodu yönet |
| `GET /educators/me/reports/sales`, `/me/sales` | Satış raporu |
| `POST/GET /educators/me/ads`, `GET /me/ads/stats` | Reklam satın al / listele / istatistik |
| `GET /educators/me/tests`, `/me/packages/views` | Kendi test/paket metrikleri |
| `GET /educators/me/objections`, `POST .../:id/answer` | İtirazları gör / yanıtla |
| `GET /educator/refunds` (EDUCATOR, ADMIN), `POST /educator/refunds/:id/approve`, `/reject` | İade onay/red |
| `POST /live-sessions`, `GET /live-sessions/my`, `POST /:id/{pay,start,next,prev,toggle-stats,end,round2}`, `GET /:id/comparison` | Canlı oturum yönetimi (EDUCATOR, ADMIN) |
| `GET /me/moderation-status` | Moderasyon durumu (EDUCATOR, ADMIN) |

### 1.4 ADMIN

ADMIN'e açık alan çok geniştir. Özet (tümü `@Roles('ADMIN')` veya ADMIN dahil):

- **Kullanıcı/eğitici yönetimi:** `GET/PATCH /admin/users`, `POST /admin/educators/:id/{approve,suspend,unsuspend}`, `POST /admin/workers` + `GET/PUT /admin/workers/:userId/permissions`.
- **İçerik:** `/admin/exam-types`, `/admin/topics` (+ `GET /admin/topics` EDUCATOR ile paylaşımlı), `/admin/topics/tree`.
- **Moderasyon:** `GET /admin/moderation/queue`, `results/:id` + approve/reject (ADMIN, WORKER), `risky-educators`, `educators/:id/violations`, `POST educators/:id/actions`, blocked-terms CRUD.
- **Finans:** `GET/PATCH /admin/settings`, `/admin/site-settings`, komisyon (`report/export/rates`), `/admin/ads/report`, `/admin/ad-packages` CRUD, `/admin/discount-codes` CRUD.
- **İade/itiraz:** `GET /admin/refunds`, `POST /admin/refunds/:id/{approve,reject}`, `GET /admin/objections` (+ `all`, `test-stats`), `POST /admin/objections/:id/admin-answer`.
- **Raporlama:** `/admin/stats`, `/admin/candidates/report` + `bulk-email`, `/admin/educator-report` + `bulk-email`, `/admin/audit`, `/admin/dlq/{emails,errors}`.
- **Sözleşme:** `/admin/contracts` GET/POST/PATCH + `:id/set-active`.
- **Email trafiği:** `/admin/email/*` (dashboard, logs, retry, providers CRUD+test, kill-switches, suppressions, templates).
- **Canlı tier:** `GET /live-sessions/tiers/all`, `POST/PUT/DELETE /live-sessions/tiers...`.

### 1.5 WORKER

`@Roles('ADMIN','WORKER')` ile **yalnızca** şu endpoint'ler WORKER'a açıktır:

- `GET /admin/moderation/queue`
- `GET /admin/moderation/results/:id`
- `POST /admin/moderation/results/:id/approve`
- `POST /admin/moderation/results/:id/reject`

Hepsinde `@WorkerPermissions('ModerationQueue')` vardır ancak (Bölüm 4.1'de açıklandığı üzere) **etkisizdir** — izin matrisi backend'de denetlenmez.

### 1.6 Birden Fazla Role Açık Endpoint'ler

| Endpoint | Roller |
|---|---|
| Tüm `/tests/*` yazma, `/packages/*`, canlı oturum yönetimi | EDUCATOR + ADMIN |
| `GET /admin/topics` | ADMIN + EDUCATOR |
| `GET /educators/me/packages/views`, `GET /educator/refunds`, `GET /me/moderation-status` | EDUCATOR + ADMIN |
| `GET /me/topic-performance`, `GET /me/purchases` | CANDIDATE + ADMIN |
| `GET/PATCH /me/preferences`, `GET /me/ping`, `POST /contracts/accept` | CANDIDATE + EDUCATOR + ADMIN |
| `/admin/moderation/...` | ADMIN + WORKER |

### 1.7 Yetkilendirme Bulguları (Bölüm 4'te önceliklendirildi)

- **WORKER izin granülaritesi backend'de uygulanmıyor** (kritik).
- **Yalnızca JWT olan, `@Roles` taşımayan endpoint'ler** her authenticated role açıktır: `POST /upload/image`, `/v1/billing/{checkout,portal,subscription}`, `/v1/auth/2fa/*`, `GET/PATCH /me/email-preferences`, canlı oturum katılımcı endpoint'leri (`join/:code`, `/:id/{state,ping,answer}`), `GET /live-sessions/tiers`.
- **`@Public` olması gözden geçirilmeli:** `GET /metrics`, `/health/*` (DB/Redis detayı sızıntısı olasılığı), webhook'lar (imza doğrulaması teyit edilmeli).
- **ADMIN hiyerarşisi yok:** Yalnızca `@Roles('EDUCATOR')` taşıyan endpoint'lere ADMIN erişemez (örn. `POST /educator/refunds/:id/approve` ADMIN'e kapalı, ama `GET /educator/refunds` açık — tutarsız).
- **Çakışan controller'lar:** İki ayrı `attempts` controller'ı aynı path'leri kaydediyor; `GET /marketplace/tests` iki yerde tanımlı. Belirsiz handler davranışı riski.

---

## 2. Fonksiyonel Olmayan Özellikler

> Not: Kod tabanı, CLAUDE.md'de tarif edilenden geniştir. Dokümanda anılmayan ek modüller tespit edildi: **Subscription/Billing (Stripe + Iyzico)**, **Webhook replay koruması**, **IdempotencyKey interceptor**, **AI içerik moderasyonu**, **2FA**, **UserDevice (yeni cihaz uyarısı)**, **Helm/K8s chart'ları**, **i18n + frontend analytics**.

### 2.1 Mimari

Clean Architecture dört katmanı fiziksel olarak ayrılmıştır:

- `application/use-cases/<domain>/` — iş mantığı (17+ domain klasörü; auth, billing, email, moderation, live dahil).
- `domain/interfaces/` — Repository arayüzleri (`IUserRepository`, `IAuditLogRepository`, `SubscriptionRepository` vb.) + `entities/`, `types.ts`.
- `infrastructure/repositories/` — Prisma implementasyonları **ve** test için `InMemory*` çift implementasyonlar.
- `nest/controllers/` — ince HTTP katmanı (55+ controller).

Bağımlılık enjeksiyonu `app.module.ts` (≈690 satır) içinde `useFactory` ile yapılır; sabit token'lar (`USER_REPO`, `AUDIT_LOG_REPO`, `SUBSCRIPTION_REPOSITORY` vb.) kullanılır.

**API versiyonlama:** `VersioningType.URI`, `defaultVersion: VERSION_NEUTRAL`, prefix `v`. Yeni controller'lar `/v1/...`, eskiler version-neutral.

**Multi-tenant:** `Tenant` modeli + neredeyse tüm tablolarda `tenantId` ve `@@index([tenantId])`. Ancak `middleware/tenant.middleware.ts` tenant'ı yalnızca context'e ekler; sorgular `tenantId` ile otomatik filtrelenmez. İzolasyon enforce **edilmez** — bu bir "foundation"dır (bkz. Bölüm 4.2).

### 2.2 Güvenlik / Sistem Kontrolleri

| Alan | Durum |
|---|---|
| **JWT auth** | Global guard; `@Public` bypass; ban/suspend kontrolü (Redis 60s) |
| **2FA** | TOTP (`otplib`) + QR; `twoFactorSecret` AES-GCM şifreli, `twoFactorRecovery[]` bcrypt'li; admin kill-switch (`twoFactorSystemEnabled`) |
| **Şifre sıfırlama** | `passwordResetToken` + `passwordResetTokenExpiresAt` |
| **Google OAuth** | `User.googleId`, `AdminSettings.googleClientId` |
| **Cihaz güvenliği** | `UserDevice` — yeni cihazdan giriş uyarısı, `trustToken` |
| **Yetkilendirme** | `RolesGuard` (basit includes); **WorkerPermissions enforce edilmiyor** |
| **CSP** | `nest/security/csp.ts` + helmet (`reportOnly` env-kontrollü, `frameAncestors 'none'`, HSTS prod, noSniff, frameguard) |
| **Kill-switch'ler** | `AdminSettings`: purchases / packageCreation / testPublishing / testAttempts / adPurchases / twoFactor + moderasyon + email matrisi |
| **Input validation** | Global `ValidationPipe({ whitelist, transform })`; class-validator DTO disiplini |
| **Webhook güvenliği** | Stripe/Iyzico imza doğrulama (`verifyWebhookSignature.ts`), raw-body capture; `WebhookEvent` replay koruması (`@@unique(provider, providerEventId)`) |
| **Idempotency** | `idempotency.interceptor.ts` — `Idempotency-Key`, Redis SET NX, 24h TTL, body-hash mismatch → 409 |
| **Rate limiting** | `@nestjs/throttler` + Redis storage; tenant > user > IP key; prod 60/60s, dev 500; throttle olayları `SUSPICIOUS_RATE_LIMIT` audit'ine (%10) |
| **CAPTCHA** | `captcha.service.ts` — Turnstile/hCaptcha/none, env-kontrollü, prod fail-safe |
| **PII filtresi** | Sentry `beforeSend`: authorization/cookie/set-cookie silinir; frontend `sendDefaultPii: false` |
| **KVKK retention** | `EmailLog` body alanları `emailRetentionDays` (90) sonra anonimleştirilir; `PackageView.ipHash` (ham IP yok) |
| **Şifreleme** | `EmailProviderConfig.encryptedSecrets` AES-256-GCM; bcrypt password |
| **npm audit / Dependabot** | Haftalık gruplu Dependabot + CI `security_audit` (`npm audit --audit-level=high`) |
| **Yedekleme** | **EKSİK** — kod yok (bkz. Bölüm 4.1) |

### 2.3 Performans / Ölçeklenebilirlik

- **Cursor pagination:** 12+ use-case'te `cursor`/`take` (marketplace, reviews, moderasyon, email logs vb.).
- **Composite index disiplini:** `AuditLog [tenantId, createdAt desc]`, `PackageView [packageId, createdAt desc]`, `EmailLog` (5 composite index), `Subscription [status, currentPeriodEnd]`, `LiveParticipant [sessionId, lastSeenAt]` vb.
- **Full-text search:** `test_packages.search_vector` PostgreSQL GENERATED tsvector kolonu + GIN; `ts_rank` + `to_tsquery` (`$queryRaw`), `username ILIKE` fallback.
- **Select discipline:** Liste use-case'lerinde kolon seçimi uygulanır.
- **Redis cache:** `RedisCache.ts` (get/set/setIfNotExists NX, `delByPrefix`, TTL); `REDIS_DISABLED=1` fail-open. Ban-status, idempotency, throttler, queue kullanır.
- **PgBouncer:** `docker-compose.pgbouncer.yml` (transaction pooling, MAX_CLIENT_CONN 1000).
- **Prisma retry:** `prisma-retry.ts` — P1001/P1008'de 3 deneme, lineer backoff.
- **Read replica foundation:** `health/replica` + `DATABASE_REPLICA_URL` + `replicationLagSeconds()`.
- **Frontend code splitting:** `pages.config.js` 71 `lazy(() => import())` + `<Suspense>`.
- **Bundle analyzer:** `rollup-plugin-visualizer`, `ANALYZE=1` → `dist/stats.html`; CI artifact.
- **Queue/Worker:** BullMQ — ayrı `email.worker`, `email-traffic.worker`, `dlq.worker` process'leri.

### 2.4 Gözlemlenebilirlik

- **Sentry:** Backend `src/instrument.ts` (DSN yoksa sessiz, prod sample %10, PII filtresi); `HttpExceptionFilter` yalnızca 5xx → `captureException`, tutarlı hata zarfı (`{ error: { code, message, details }, path, timestamp }`). Frontend `main.jsx` + root `<ErrorBoundary>`.
- **Health:** `/health`, `/health/db`, `/health/redis`, `/health/replica`, `/ready` (K8s/LB readiness) — tümü `@Public`.
- **Metrics:** `/metrics` Prometheus text formatı (`dal_requests_total`, uptime, rss) — **in-memory, process-local** (restart'ta sıfırlanır, multi-replica'da toplam vermez).
- **Logging:** `infrastructure/logger/logger.ts` — prod'da JSON structured (level/msg/time/requestId/tenantId); `request-id.middleware.ts`.

### 2.5 Altyapı / DevOps

- **Docker Compose** (`infra/docker/`): `docker-compose.yml` (dev: postgres15, redis7, backend, worker, dlq-worker, email-traffic-worker, frontend), `docker-compose.prod.yml` (CRON aktif, `/ready` healthcheck, TRUST_PROXY), `docker-compose.ci.yml` (postgres16 + redis), `docker-compose.pgbouncer.yml`. *(`docker-compose.local-staging.yml` CLAUDE.md'de geçer ama mevcut değildir — yerine `.ci.yml` var.)*
- **Helm / K8s:** `infra/helm/sinavsalonu/` — Chart, values, backend/worker/frontend deployment, configmap, secret, migration-job, ingress. *(CLAUDE.md'de anılmıyor.)*
- **Nginx:** **Mevcut değil.** CLAUDE.md `infra/nginx/default.conf` ve nginx tabanlı frontend Dockerfile'dan bahseder; gerçekte `infra/nginx/` dizini yoktur, `frontend.Dockerfile` `serve -s dist` kullanır (CSP header / gzip / asset cache / SPA-aware proxy yok). Frontend statik dosyaları CSP header'sız sunulur.
- **CI/CD** (`.github/workflows/`): `backend-migrate-and-test.yml` job'ları — `build_test`, `frontend_test`, `frontend_a11y` (Playwright + axe, **bloklayıcı**), `frontend_build` (bundle artifact), `security_audit`, `smoke_public_endpoints`, `e2e_smoke_db`, `migrate_stage2_guard` (drift check), `migrate_deploy` (environment approval), `notify_on_failure` (Slack). Ayrıca `mutation-test.yml` (Stryker, haftalık, bloklamaz).
- **Pre-commit / scripts:** `.husky/` dizini ve `scripts/staging.sh` **mevcut değildir** (CLAUDE.md'de tarif edilse de). Dokümante edilen geliştirici akışı çalışmaz (bkz. Bölüm 4.2).

### 2.6 Frontend NFR

- **Dark mode:** `next-themes` (`attribute="class"`, `defaultTheme="system"`, localStorage persist), `ThemeToggle`.
- **Accessibility:** Playwright + `@axe-core/playwright`; `e2e/specs/a11y.spec.*` (public, candidate, admin moderation, educator + modal/klavye testleri); `disableRules()` kullanılmaz; CI'da bloklayıcı (WCAG 2.1 AA).
- **Test altyapısı:** Vitest (jsdom, coverage v8 — **eşikler düşük: statements/lines/functions %30, branches %25**), Jest (unit/integration/smoke/e2e + Codecov), Stryker mutation (haftalık).
- **State / routing:** TanStack Query (`query-client.js`), React Router v6.
- **i18n:** `lib/i18n` (i18next). **API merkezileştirme:** `api/dalClient.js`.

---

## 3. Veritabanı Loglama / Audit İzleri

Şema: `apps/backend/prisma/schema.prisma` (≈1502 satır).

### 3.1 Audit / İş Logları

**Merkezi `AuditLog` (`audit_logs`) — ana audit mekanizması.** Tam iz alanları:

| Alan | Açıklama |
|---|---|
| `action` (`AuditAction` enum, 76 değer) | Ne yapıldı |
| `entityType` / `entityId` | Hedef kayıt |
| `actorId` (nullable) | Kim yaptı |
| `tenantId` (nullable) | Hangi tenant |
| `actorEmail` / `actorRole` | Aktör snapshot'ı |
| `before` / `after` (Json) | Değişiklik diff'i |
| `ip` / `userAgent` | Kaynak |
| `metadata` (Json) | Ek bağlam |
| `createdAt` | Ne zaman |

Index: `(entityType, entityId)`, `(createdAt)`, `(tenantId, createdAt desc)`, `(actorId, createdAt desc)`, `(action, createdAt desc)`.

`AuditAction` enum 76 olay tipi kapsar: iş akışı (PURCHASE, REFUND_*, TEST_PUBLISHED/UNPUBLISHED, PRICE_CHANGED, OBJECTION_*, REVIEW_*, DISCOUNT_CREATED, SUBMIT_ATTEMPT/ANSWER, CONTRACT_ACCEPTED), kullanıcı yönetimi (EDUCATOR_APPROVED/SUSPENDED, USER_ROLE_CHANGED, USER_SUSPENDED/DELETED), güvenlik (AUTH_LOGIN_SUCCESS/FAIL, AUTH_MFA_*, CSP_VIOLATION, SUSPICIOUS_RATE_LIMIT, WEBHOOK_RECEIVED/REJECTED), admin/sistem (ADMIN_SETTINGS_UPDATED, PAYOUT_PROCESSED, **BACKUP_RUN**, EXAMTYPE/TOPIC CRUD), email trafiği (11 değer) ve abonelik (SUBSCRIPTION_*).

**Email log tabloları:**

| Model / Tablo | Loglanan | Anahtar alanlar |
|---|---|---|
| `EmailLog` / `email_logs` | Her tek gönderim | `queuedAt`, `sentAt`, `deliveredAt`, `bouncedAt`, `attemptCount`, `lastErrorMessage/Code`, `status`, `providerMessageId`; body alanları retention sonrası null'lanır |
| `EmailEvent` / `email_events` | Yaşam döngüsü olayları | `eventType` (QUEUED→DELIVERED/BOUNCED/COMPLAINED/OPENED/CLICKED), `occurredAt`, `source`, `meta` |
| `SuppressedEmail` / `suppressed_emails` | Engellenen alıcılar | `reason`, `source`, `createdBy`, `createdAt`, `expiresAt` |
| `EmailProviderConfig` | Sağlayıcı durum izi | `lastSuccessAt`, `lastFailureAt`, `lastFailureReason`, `dailySentCount` |
| `EmailTemplate` | Versiyonlama | `version`, `createdAt`, `updatedAt` |

Kuyruklar: `EmailQueue` = CRITICAL / NOTIFY / BULK.

**Webhook / ödeme:** `WebhookEvent` (`provider`, `providerEventId` unique, `payload`, `receivedAt`, `processedAt`, `error`); `IdempotencyKey` (`status`, `responseCode`, `responseBody`, `expiresAt`).

**Moderasyon (audit niteliğinde):** `ModerationResult` (`scores`, `matchedTerms`, `rawResponse`, `cost`, `latencyMs`, `reviewedAt`), `ModerationViolation` (`severity`, `reviewedBy`, `reviewedAt`, `resolvedAt`, `adminNote`), `ModerationAction` (`actorId`, `actionType`, `reason`, `expiresAt` — **tam aktör/aksiyon/zaman izi**), `EducatorRiskScore`, `BlockedTerm` (`createdBy`, `createdAt`, `updatedAt`).

**İş akışı durum kayıtları:**

| Model | Durum izi |
|---|---|
| `RefundRequest` | `status` (7 durum), `educatorDeadline`, `educatorDecidedAt`, `appealedAt`, `decidedBy`, `decidedAt` — **iyi izli** |
| `Objection` | `status`, `answeredAt`, `escalatedAt`, `adminAnsweredAt`, `adminAnswererId` — **iyi izli** |
| `Purchase` | `status`, `createdAt`, `deletedAt` — REFUNDED/EXPIRED geçişi için ayrı zaman damgası **yok** |
| `AdPurchase` | yalnızca `createdAt`, `validUntil` — durum/iptal izi **yok** |
| `Subscription` | `startedAt`, `canceledAt`, `currentPeriodStart/End`, `trialEndsAt` — `createdAt` **yok** |

**`BackupLog` — tablo yok.** `BACKUP_RUN` enum değeri var ancak ne model ne de yedekleme kodu mevcut (bkz. Bölüm 4.1).

### 3.2 Sistem / Hata Logları

| Mekanizma | Nereye yazar | Detay |
|---|---|---|
| **Sentry** | Harici (SaaS), DB değil | DSN yoksa devre dışı; prod sample %10; PII header filtresi |
| **HttpExceptionFilter** | 5xx → Sentry; throttle → DB | 429 olayları %10 sampling ile `AuditLog`'a `SUSPICIOUS_RATE_LIMIT` |
| **CSP raporu** | DB (`AuditLog`) | `POST /csp-report` (@Public, throttle 10/dk) → `CSP_VIOLATION` |
| **Email webhook** | DB (`EmailEvent` + `SuppressedEmail`) | BOUNCED/COMPLAINED + suppression |
| **Metrics** | Bellek-içi | `/metrics` in-memory snapshot |
| **Health** | Kayıt tutmaz | Hatalar yalnızca `console.error` |

> **Tutarsızlık:** `AdminDlqController.listEmails` başarısız mailleri `EmailLog`'tan değil `AuditLog`'tan (action=EMAIL_FAILED) okur. `email_logs` tablosundaki `FAILED`/`DEAD_LETTER` kayıtları admin DLQ ekranında görünmez (iki ayrı kaynak).

### 3.3 createdAt / updatedAt ve Durum İzleri

**Soft-delete (`deletedAt`)** yalnızca 3 modelde: `User`, `ExamTest`, `Purchase`. Diğerlerinde hard delete / cascade. `User.isBanned` ayrıca var.

**Güvenlik zaman damgaları** (`User`): `lastLoginAt`, `educatorApprovedAt`, `passwordResetToken(+ExpiresAt)`, `twoFactorEnabled(+At)`, `twoFactorSecret`, `twoFactorRecovery[]`, `emailUnsubscribeToken`, `suspendedUntil`, `isBanned`. `UserDevice`: `firstSeenAt`, `lastSeenAt`, `trustToken(+ExpiresAt)`.

**createdAt/updatedAt matrisi:**

- **Her ikisi var:** Tenant, User, UserPreference, ExamType, ExamTest, TestPackage, NotificationPreference, RefundRequest, Review, Contract, AdPackage, WorkerPermission, EmailProviderConfig, EmailTemplate, BlockedTerm, EducatorRiskScore, LiveSessionTier, LiveSession, AttemptAnswer (+ yalnız updatedAt: AdminSettings, SiteSettings/PaymentSettings, TestStats).
- **Yalnız createdAt:** Topic, Purchase, PackageView, Follow, AuditLog, DiscountCode, Objection, ContractAcceptance, CommissionRateHistory, AdPurchase, AdImpression, IdempotencyKey, EmailLog, EmailEvent, SuppressedEmail, ModerationResult/Action, LiveQuestion, LiveParticipant, LiveAnswer.
- **İkisi de yok:** `TopicExamType` (junction), `ExamQuestion`, `ExamOption` (yalnız `moderatedAt`), `LiveOption`, `Subscription` (yalnız `startedAt`).

---

## 4. Gözden Kaçan / Eksik Noktalar — Bulgular ve Öneriler

### 4.1 Kritik

1. **WORKER yetkilendirmesi backend'de uygulanmıyor.** `@WorkerPermissions` decorator'ı metadata yazar ama onu okuyan guard yoktur. `workerPages` listesinde "ModerationQueue" olmayan bir WORKER bile moderasyon endpoint'lerine erişebilir; kısıtlama yalnızca frontend `routeRoles.js`'tedir ve API doğrudan çağrılırsa bypass edilir. *Öneri:* `WorkerPermissionsGuard` yazılıp global guard zincirine eklenmeli, metadata `user.workerPages` ile karşılaştırılmalı.

2. **Yedekleme özelliği yok.** CLAUDE.md `BackupSchedulerService`, `pg_dump → gzip`, `BackupLog` modeli ve admin ayarları vaat eder; kodda yalnızca `BACKUP_RUN` enum değeri vardır. Felaket kurtarma kapasitesi dokümante ama implemente değil. *Öneri:* Özelliği tamamlayın veya dokümandan ve enum'dan çıkarın; en azından dış (managed) yedekleme stratejisini netleştirin.

3. **Rol kontrolü olmayan hassas endpoint'ler.** `POST /upload/image` ve `/v1/billing/*` herhangi bir authenticated role açık. *Öneri:* Açık `@Roles` belirleyin (muhtemelen EDUCATOR/ADMIN); upload için boyut/tip/oran kısıtı zaten var, rol kısıtı eklenmeli.

### 4.2 Orta

4. **Çakışan controller kayıtları.** İki `attempts` controller'ı aynı path'leri, `GET /marketplace/tests` iki yerde tanımlı — NestJS'te belirsiz handler riski. *Öneri:* Tekilleştirin.

5. **Multi-tenant izolasyonu enforce edilmiyor.** `tenantMiddleware` yalnızca context set eder; sorgular `tenantId` ile filtrelenmez. Çok-tenant'a geçişte cross-tenant sızıntı riski. *Öneri:* Repository seviyesinde tenant scope veya Prisma middleware/extension.

6. **CLAUDE.md ↔ kod tutarsızlıkları.** `infra/nginx/default.conf`, `scripts/staging.sh`, `.husky/`, `docker-compose.local-staging.yml` dokümante edilmiş ama dosyalar yok. *Öneri:* CLAUDE.md'yi gerçek duruma göre güncelleyin; nginx/SPA-serving ve pre-commit hook gerçekten isteniyorsa ekleyin (aksi halde prod'da statik dosyalarda CSP/gzip/cache yok).

7. **`/metrics` ve `/health/*` `@Public` ve kimliksiz.** İç bilgi (uptime, rss, DB/Redis durumu) sızıntısı. Reverse proxy de bulunmadığından (madde 6) ağ-seviyesi koruma yok. *Öneri:* IP-allowlist veya auth; metrics'i internal-only yapın.

8. **DLQ email kaynağı tutarsız.** Admin DLQ ekranı `AuditLog`'tan okur, `email_logs` `FAILED`/`DEAD_LETTER` kayıtlarını göstermez. *Öneri:* Tek kaynağa indirin.

9. **Test coverage eşikleri düşük.** Frontend %25-30; kritik `dalClient.js` için eşik yok. *Öneri:* Kademeli yükseltme planını uygulayın.

10. **Metrics in-memory / process-local.** Restart'ta sıfırlanır, multi-replica'da toplam vermez; histogram/latency/error-rate yok. *Öneri:* `prom-client` ile gerçek metrik kütüphanesi.

### 4.3 Düşük

11. **ADMIN hiyerarşisi yok** — yalnız EDUCATOR'a açık endpoint'lere ADMIN erişemez; `educator/refunds` GET/approve tutarsızlığı. Bilinçli karar mı netleştirin.
12. **İş akışı durum izleri eksik:** `Purchase` REFUNDED/EXPIRED ve `AdPurchase` iptal/durum için tablo-içi zaman damgası yok; `ExamQuestion`/`ExamOption` oluşturma/güncelleme izi yok; `Subscription.createdAt` yok.
13. **CORS allowedHeaders dar:** `Idempotency-Key`, `X-Tenant-Id` gibi kullanılan custom header'lar `allowedHeaders`'da yok → cross-origin preflight reddi riski.
14. **CSP `style-src 'unsafe-inline'` varsayılanı** report-only modda fark edilmeyebilir.
15. **`InMemory*` repository'ler prod kod ağacında** — yanlış wiring riski (düşük).
16. **`requestCount` sayacının** bir interceptor/middleware tarafından artırıldığı doğrulanmalı; bağlı değilse `/metrics` hep 0 döner.

---

## Ek: Doğrulanan Tutarsızlıklar (CLAUDE.md vs. Kod)

| CLAUDE.md iddiası | Gerçek durum |
|---|---|
| `BackupLog` modeli, BackupSchedulerService, pg_dump | Yalnızca `BACKUP_RUN` enum değeri; model/servis/kod yok |
| WorkerPermissions ile yetki | Decorator var, **guard yok** — enforce edilmiyor |
| `infra/nginx/default.conf`, nginx frontend Dockerfile | `infra/nginx/` yok; frontend `serve -s dist` |
| `scripts/staging.sh`, `.husky/pre-commit` | İki dizin de mevcut değil |
| `docker-compose.local-staging.yml` | Yok; yerine `docker-compose.ci.yml` var |

*Not: Yetki, audit ve durum geçişleri gibi alanların bir kısmı bilinçli tasarım kararı olabilir; bu doküman bunları "kesin hata" olarak değil, teslim öncesi gözden geçirilmesi gereken noktalar olarak işaretler.*
