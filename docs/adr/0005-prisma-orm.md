# ADR-0005: Prisma ORM seçimi

## Statü

Accepted

## Bağlam

Sınav Salonu marketplace 35+ model, 42 migration, 48+ composite index, multi-tenant tablo scope'u, cursor pagination, tsvector full-text search, transaction'lı para akışları ihtiyacı duyuyor. Aşağıdaki kararı vermemiz gerekiyor:

- Veritabanı erişim katmanı için hangi araç?
- Schema definition + migration mekanizması nedir?
- Multi-tenant filtering, transaction, raw SQL fallback'i nasıl olacak?

İki temel kısıt:

1. **Type safety zorunlu** — TypeScript strict mode aktif; runtime sürprizleri istemiyoruz. Sınav verileri (skor, ödeme tutarı) tip hatasıyla bozulamaz.
2. **Şema değişikliği ekip ölçeğinde güvenli olmalı** — 42 migration zaten var, her hafta yeni feature schema değişikliği getiriyor. Migration disiplini olmadan prod patlar.

## Karar

**Prisma ORM** (`@prisma/client ^5.x`) seçildi. Tüm DB erişimi `apps/backend/src/infrastructure/repositories/Prisma*Repository.ts` altından geçer.

### Niçin Prisma

| Kriter | Prisma | TypeORM | Drizzle | Knex + Zapatos |
|---|---|---|---|---|
| Type safety | ✓ Otomatik üretilir (generated client) | Decorator tabanlı, kısmi | ✓ Schema-as-code | Kısmi (Zapatos eklenirse) |
| Migration sistemi | ✓ Resmi (`prisma migrate`) | ✓ Var ama el yapımı | ✗ Manuel SQL | ✓ Knex migration |
| Performans (Node) | İyi | Orta (decorator overhead) | Çok iyi (lightweight) | Çok iyi |
| Raw SQL fallback | `$queryRaw` parametreli | `query()` | `sql\`...\`` | Knex native |
| Schema introspection | ✓ DB → schema reverse | ✓ | ✗ | ✗ |
| Composite index DSL | ✓ `@@index([a, b])` | Kısmi | ✓ | Manuel SQL |
| Tenant extension hook | ✓ `Prisma.defineExtension` (v5) | ✗ | Manuel middleware | Manuel |
| Topluluk + öğrenme eğrisi | Büyük, iyi dokümante | Büyük ama dağınık | Yeni, küçük | Olgun ama düşük seviye |
| Vendor lock-in riski | Orta (schema kendine özgü) | Düşük (decorator yaygın) | Düşük (yakın-SQL) | Düşük |

Prisma'nın **schema-as-source-of-truth** modeli, ekip için tek yönlü disiplin sağlar:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  role      Role     @default(CANDIDATE)
  tenantId  String   // multi-tenant zorunlu kolon
  createdAt DateTime @default(now())

  @@index([tenantId, role])
  @@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])  // cursor pagination
}
```

`schema.prisma` tek doğru kaynak; migration'lar diff'ten otomatik üretilir; generated client tüm type'ları açar.

### Uygulanan disiplinler

- **Repository pattern**: Controller/use-case Prisma'yı ASLA doğrudan çağırmaz. `domain/interfaces/IXRepository` arayüzü → `infrastructure/repositories/PrismaXRepository` implementasyonu. Test için `InMemoryXRepository` mevcuttur.
- **Select discipline**: Liste endpoint'lerinde `findMany({ select: { ... } })` zorunlu. `include: true` PR review'da reddedilir.
- **Cursor pagination**: ADR-0002 ile bağlantılı. `skip + take` yalnızca admin raporlarında.
- **Transaction**: Birden fazla tablo yazıyorsa `prisma.$transaction([...])` zorunlu. Purchase + Payment + AuditLog tek transaction.
- **Tenant extension**: `apps/backend/src/infrastructure/database/tenantExtension.ts` her `findMany/count/aggregate/groupBy` üzerine `tenantId` filtre injection eder (`AsyncLocalStorage` üzerinden request context). Admin endpoint'leri `runWithoutTenantFilter` ile bypass eder.
- **Raw SQL**: tsvector araması, `searchVector @@ to_tsquery(...)` gibi Prisma'nın desteklemediği özellikler için `prisma.$queryRaw` template literal (SQL injection güvenli). `apps/backend/src/application/use-cases/package/ListMarketplacePackagesUseCase.ts` örnek.

## Sonuçlar

**Olumlu**

- 213 use-case için tutarlı veritabanı erişim katmanı.
- Migration sistemi prod'da güvenli — `prisma migrate deploy` CI'da çalışıyor (`.github/workflows/backend-migrate-and-test.yml`).
- Generated client TypeScript IDE autocompletion'ı tam.
- Test izolasyonu kolay — InMemory repository ile use-case unit test'i DB'siz çalışır.
- 42 migration tutarlılığı `prisma migrate status` ile her zaman doğrulanabilir.

**Olumsuz / takas**

- **Performans:** Prisma engine N+1 keşfi otomatik değil; `select` disiplinini PR review'da elle uygulamamız gerek. CLAUDE.md'de zorunlu kural.
- **`Unsupported` tipleri:** `tsvector`, `PostGIS` gibi tipler için Prisma `Unsupported("tsvector")` yer tutucu kullanır, query raw SQL ile yazılır. `test_packages.search_vector` (`prisma/schema.prisma`) örnek.
- **Schema'da generated column desteği yok:** `searchVector` STORED column manuel SQL migration ile eklendi (`20260517000000_add_package_search_vector/migration.sql`).
- **Migration rollback yok**: `prisma migrate down` üretimde yoktur. Disaster recovery için PostgreSQL snapshot + `BackupSchedulerService` kullanılır.
- **Lock-in riski**: Schema'yı başka bir ORM'e taşımak migration sistemi nedeniyle pahalı. Risk kabul edildi — yan etkisi olarak Prisma ekosistem yararı geliyor.

## Alternatifler

### Drizzle ORM

Hafif, performanslı, "SQL'e yakın" type-safe query builder. Schema TypeScript dosyasında tanımlanır. Multi-tenant filtering manuel middleware ile yapılabilir.

**Niçin değil:**
- Migration sistemi 2025 itibarıyla hâlâ olgunlaşmadı (`drizzle-kit` deneysel komutlar).
- Composite index DSL'i Prisma kadar olgun değil.
- Schema introspection yok — mevcut DB'den schema üretemez.
- Ekibin Prisma deneyimi yüksek; öğrenme maliyeti yüksek.

Gelecekte performans darboğazı varsa critical path use-case'leri Drizzle'a porting edilebilir (ikisi aynı DB üzerinde çalışır).

### TypeORM

Klasik decorator tabanlı ORM. NestJS ekosistemi ile yaygın kullanım.

**Niçin değil:**
- Decorator overhead runtime maliyet.
- Type safety Prisma kadar güçlü değil (entity class'ları runtime check'e bağımlı).
- Migration disiplini el yapımı — `synchronize: true` prod için yasak ama hata yapma kolay.
- 2024 sonrası geliştirme yavaşladı (TypeORM 0.4 alpha 2 yıldır beklemede).

### Knex + Zapatos

Düşük seviye query builder + tip üretici. Tam SQL kontrolü.

**Niçin değil:**
- Boilerplate çok — 213 use-case için tekrar tekrar SQL yazmak.
- Migration sistemi Knex'in kendi DSL'i; Prisma'nın diff sistemi yok.
- Repository pattern Knex üzerinde elle kurulur.

### Raw `pg` driver + el yapımı katman

**Niçin değil:**
- Type üretimi yok.
- SQL injection riski geliştiriciye düşer.
- Migration sistemi sıfırdan yazılır.

## İlgili kararlar

- ADR-0001 Clean Architecture — Repository pattern'i bu mimariyi destekler.
- ADR-0002 Cursor pagination — Prisma `cursor + take` ile uyumlu.
- ADR-0003 Multi-tenant Shared DB — Prisma extension hook'u tenant izolasyonu için kullanıldı.

## İlgili dosyalar

- `apps/backend/prisma/schema.prisma` — tek doğru kaynak.
- `apps/backend/src/infrastructure/database/prisma.ts` — singleton + tenantExtension.
- `apps/backend/src/infrastructure/database/tenantExtension.ts` — cross-cutting filter.
- `apps/backend/src/infrastructure/repositories/` — 32 PrismaXRepository.

## Revizyon

- 2026-05 — İlk yazım. Karar yürürlükte.

## Notlar

Prisma sürüm yükseltmeleri (5.x → 6.x gibi major'lar) sırasında:
1. CHANGELOG'u oku — breaking change var mı?
2. `prisma migrate dev` ile development'ta test et.
3. CI'da `prisma generate` ve `prisma migrate deploy` ayrı job'da koşur.
4. Generated client'ı staging'e deploy et — query plan değişikliği var mı?
