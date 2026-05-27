# Read Replica Stratejisi — Prisma + PostgreSQL

KALITE-DEGERLENDIRME §4 (Verimlilik) önerisi. Raporlama ve analytics sorgularını primary'den ayırarak transactional yükü koru.

## Ne zaman gerek

Hangi sorgular replica'ya gider?

| Sorgu sınıfı | Hedef |
|---|---|
| `POST/PUT/DELETE`, `BEGIN TX` | Primary (kesin) |
| `GET /marketplace/...` (popüler liste) | Replica (eventually consistent OK) |
| `GET /educator/dashboard/stats` | Replica |
| `GET /admin/reports/...` | Replica |
| `GET /me`, `GET /attempts/:id` | Primary (kullanıcı hemen yeni veriyi görmek ister) |
| Background analytics job | Replica |
| Backup `pg_dump` | Replica (primary'i yormaz) |

**Kural:** Read-after-write garantisi gerekiyorsa primary. Saniye gecikmeye toleranslıysa replica.

## Mimari

```
                       ┌─────────────────┐
                       │  Load Balancer  │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │  Backend Pods   │
                       └────────┬────────┘
                                │
                  ┌─────────────┴──────────────┐
                  │                            │
            (write + read-after-write)    (read-only)
                  │                            │
        ┌─────────▼─────────┐         ┌────────▼─────────┐
        │   Postgres        │ replic. │  Read Replica    │
        │   PRIMARY         │ ──────▶ │  (1+ instance)   │
        │ (port 5432)       │         │ (port 5432)      │
        └───────────────────┘         └──────────────────┘
```

AWS RDS: Multi-AZ + Read Replica (otomatik replikasyon).
Self-hosted: Streaming replication (`pg_basebackup` + `recovery.conf`).

## Prisma — iki client pattern

Prisma 5.x native multi-database desteklemediği için iki ayrı `PrismaClient` instance:

```ts
// apps/backend/src/infrastructure/database/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },  // PRIMARY
  },
});

// Replica varsa, ayrı client:
export const prismaReplica = process.env.DATABASE_REPLICA_URL
  ? new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_REPLICA_URL },
      },
    })
  : prisma;  // Fallback: replica yoksa primary'i kullan
```

`.env`:
```
DATABASE_URL=postgresql://user:pass@primary:5432/sinavsalonu
DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/sinavsalonu
```

## Repository pattern güncellemesi

Mevcut repository constructor'ı primary'i alıyor. Replica desteği için:

```ts
// apps/backend/src/infrastructure/repositories/ReportingTestRepository.ts
export class ReportingTestRepository {
  constructor(
    private readonly read: PrismaClient,   // replica
    // Write yok — bu repo SADECE read.
  ) {}

  async topSellers(tenantId: string, days = 30) {
    return this.read.examTest.findMany({
      where: { tenantId, /* ... */ },
      orderBy: { purchaseCount: 'desc' },
      take: 20,
    });
  }
}
```

Module DI:

```ts
// apps/backend/src/nest/modules/reporting.module.ts
{
  provide: ReportingTestRepository,
  useFactory: () => new ReportingTestRepository(prismaReplica),
}
```

## Use Case rehberi

```ts
// READ-ONLY use case:
class GetTopSellersUseCase {
  constructor(private readonly reportingRepo: ReportingTestRepository) {}
  async execute(tenantId) { return this.reportingRepo.topSellers(tenantId); }
}

// READ-AFTER-WRITE use case:
class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepo: PurchaseRepository,  // primary
  ) {}
  async execute(...) {
    const purchase = await this.purchaseRepo.create(...);   // primary write
    // 5 saniye içinde tekrar okumak istersek primary'den oku (replica gecikmeli olabilir)
    return this.purchaseRepo.findById(purchase.id);
  }
}
```

## Replication lag izleme

PostgreSQL'de:

```sql
SELECT
  client_addr,
  application_name,
  state,
  pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes,
  (now() - reply_time)::interval AS lag_time
FROM pg_stat_replication;
```

Replica `lag_time > 5s` → alarm (Sentry breadcrumb + Slack). 30s üzeri → otomatik fallback primary'e.

## Health check entegrasyonu

`/health/full` (observability skill) replica check eklenir:

```ts
async checkReplica() {
  if (!process.env.DATABASE_REPLICA_URL) return { ok: true, skipped: true };
  try {
    await prismaReplica.$queryRaw`SELECT 1`;
    const lag = await prismaReplica.$queryRaw<{ lag_seconds: number }[]>`
      SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds
    `;
    return { ok: lag[0].lag_seconds < 30, lagSeconds: lag[0].lag_seconds };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

## Failover

Primary down olunca:

1. **AWS RDS Multi-AZ:** Standby otomatik promote (~60s downtime).
2. **Self-hosted:** `pg_promote()` ile manuel veya `Patroni` ile otomatik.
3. Connection string DNS'i güncellenir (Route53 weighted veya app reload).

App tarafında: connection retry + exponential backoff. Prisma 5.x `RetryStrategy` desteklemez → use case'lerde `try/catch + retry` veya `opossum` circuit breaker.

## Maliyet etkisi

Read replica = +%50–100 DB maliyeti (instance + storage + IO + cross-AZ traffic).

Eşik: primary `pg_stat_database.tup_fetched` > 10M/saat veya CPU > %70 → replica zamanı geldi.

## Kod kullanımı (dbRouter)

### Helper'lar

`apps/backend/src/infrastructure/database/dbRouter.ts` iki temel client expose eder:

```typescript
import { prismaWrite, prismaRead } from '../../infrastructure/database/dbRouter';

// Mutation — daima primary
await prismaWrite.purchase.create({ data: { ... } });

// Read — replica tercih (lag toleranslı use case'ler)
const stats = await prismaRead().testStats.findMany({ where: { ... } });

// Read-after-write — son yazılan kaydı oku, replica lag riski → primary
await prismaWrite.user.update({ where: { id }, data: { ... } });
const fresh = await prismaRead({ requireFresh: true }).user.findUnique({ where: { id } });
```

### Lag detection

```typescript
import { measureReplicaLag, getReplicaStatus } from '../../infrastructure/database/dbRouter';

// Çıplak lag (saniye)
const lag = await measureReplicaLag();

// Detaylı status — health endpoint için
const status = await getReplicaStatus();
// { enabled, lagSeconds, healthy, degradedMode }
```

### Otomatik fallback

`prismaRead()` her çağrıda cache kontrolü yapar:
- Cache miss + ilk çağrı → primary (LAG_FAIL_OPEN=true)
- Cache hit + lag ≤ 5s → replica
- Cache hit + lag > 5s → primary

Cache TTL: 5 saniye. Lag query başarısızsa fail-open.

### Test

`apps/backend/tests/infrastructure/dbRouter.test.ts` — 13 test case:
- prismaWrite/prismaRead client seçimi
- requireFresh override
- measureReplicaLag (success/error/0-lag)
- getReplicaStatus (healthy/degraded/unhealthy)

### Migration plan (use-case bazlı)

İlk batch (lag toleranslı, **şu an primary kullanıyor → replica'ya geçirilebilir**):
- `ListMarketplacePackagesUseCase` — marketplace listing
- `GetCommissionReportUseCase` — admin raporu
- `GetCandidateReportUseCase` — admin raporu
- `GetEducatorReportUseCase` — admin raporu
- `ListAuditLogsUseCase` — admin audit query
- `MeTopicPerformanceController` — kullanıcı istatistik
- `MyResults` listing

İkinci batch (deneysel — primary'de kalmaya devam edebilir):
- `GetEducatorPageUseCase`
- `ListEducatorTestsUseCase`

ASLA replica kullanma:
- `CreatePurchaseUseCase` ve tüm para akışı
- `LoginUseCase` (session lookup)
- `SubmitAnswerUseCase` (yarış koşulu)
- `GetAttemptStateUseCase` (kullanıcı az önce kendi attempt'ını yazdı)

### Production deployment

1. Replica'yı ayağa kaldır (AWS RDS Read Replica veya self-hosted streaming):
   ```bash
   # AWS CLI
   aws rds create-db-instance-read-replica \
     --db-instance-identifier sinavsalonu-replica-1 \
     --source-db-instance-identifier sinavsalonu-primary
   ```
2. `DATABASE_REPLICA_URL` env var set et (read-only user):
   ```bash
   DATABASE_REPLICA_URL=postgresql://readonly:xxx@replica.aws.com:5432/sinavsalonu
   ```
3. Backend pod restart — `isReplicaEnabled()` true döner, `prismaRead()` aktif olur
4. `/health/replica` endpoint izle — lag <1s olmalı
5. K8s HPA replica pool'a yansıt (`worker-deployment.yaml` zaten ayrı pod)

## İlgili

- KALITE-DEGERLENDIRME §4
- ADR-0005 Prisma ORM
- Skill: `observability` (replication lag monitor)
- Test: `tests/infrastructure/dbRouter.test.ts`
