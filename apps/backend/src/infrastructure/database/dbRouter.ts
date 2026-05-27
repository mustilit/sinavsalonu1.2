/**
 * Read/Write veritabanı router'ı.
 *
 * KAT: PostgreSQL streaming replication + Prisma çift client.
 *   - PRIMARY (write):   `prisma` instance, `DATABASE_URL`
 *   - REPLICA (read):    `prismaReplica` instance, `DATABASE_REPLICA_URL`
 *
 * KULLANIM:
 *
 *   // Mutation — daima primary
 *   await prismaWrite.purchase.create({...});
 *
 *   // Read — replica tercih, lag toleranslı use case'ler için
 *   const stats = await prismaRead().testStats.findMany({...});
 *
 *   // Read-after-write — son yazılan kaydı oku, replica lag riski
 *   await prismaWrite.user.update({...});
 *   const fresh = await prismaWrite.user.findUnique({...});  // primary
 *
 * KARAR MATRİSİ:
 *
 *   | Use case türü        | Client          |
 *   |---|---|
 *   | Tüm mutations        | prismaWrite     |
 *   | Read-after-write     | prismaWrite     |
 *   | Para akışı sorguları | prismaWrite     |
 *   | Listing/marketplace  | prismaRead()    |
 *   | Analytics/raporlar   | prismaRead()    |
 *   | Admin dashboard      | prismaRead()    |
 *   | Audit log query      | prismaRead()    |
 *
 * LAG TOLERANSI:
 *   - Replica lag tipik 50-500ms (LAN içi PostgreSQL streaming)
 *   - Para akışı / kritik state sorgular için ASLA replica kullanma
 *   - `prismaRead({ requireFresh: true })` lag check + primary fallback
 *
 * MONITORING:
 *   - `/health/db-lag` endpoint replica lag'ini saniye olarak döner
 *   - Lag > 5s → otomatik primary fallback (`degradeMode = true`)
 */

import { prisma, prismaReplica, isReplicaEnabled } from './prisma';
import type { PrismaClient } from '@prisma/client';

/** Tipik kullanım — mutation. */
export const prismaWrite: PrismaClient = prisma;

interface ReadOptions {
  /**
   * true ise replica yerine primary kullanılır.
   * Read-after-write veya hot data için.
   */
  requireFresh?: boolean;
}

let lagCheckCache: { value: number; checkedAt: number } | null = null;
const LAG_CACHE_TTL_MS = 5_000; // 5 saniye cache
const LAG_THRESHOLD_S = 5; // 5 saniyeden büyük lag → primary'e düş
const LAG_FAIL_OPEN = true; // Lag query başarısızsa primary'e düş (güvenli)

/**
 * Read query için doğru client'ı seç.
 * Replica yoksa veya lag yüksekse primary döner.
 */
export function prismaRead(options: ReadOptions = {}): PrismaClient {
  if (options.requireFresh) return prismaWrite;
  if (!isReplicaEnabled()) return prismaWrite;

  // Cache'lenmiş lag değeri varsa onu kullan (her query'de DB sormamak için)
  const cached = lagCheckCache;
  if (cached && Date.now() - cached.checkedAt < LAG_CACHE_TTL_MS) {
    return cached.value <= LAG_THRESHOLD_S ? prismaReplica : prismaWrite;
  }

  // Cache miss — sync fallback: primary kullan, async refresh tetikle
  refreshLagCache().catch(() => {
    // Lag query başarısızsa fail-open
  });

  // İlk çağrıda cache yok → güvenli taraf: primary (LAG_FAIL_OPEN=true ise)
  return LAG_FAIL_OPEN ? prismaWrite : prismaReplica;
}

/**
 * Replica lag'ini saniye olarak ölç.
 *
 * PostgreSQL'de `pg_last_xact_replay_timestamp()` replica'da son uygulanan
 * transaction'ın zamanını döner. `now() - last_replay` = lag.
 *
 * @returns lag (saniye) veya null (sorgu başarısız)
 */
export async function measureReplicaLag(): Promise<number | null> {
  if (!isReplicaEnabled()) return 0;

  try {
    const result = await prismaReplica.$queryRaw<Array<{ lag_seconds: number | null }>>`
      SELECT
        CASE
          WHEN pg_is_in_recovery() THEN
            EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
          ELSE 0
        END AS lag_seconds
    `;
    const lag = result?.[0]?.lag_seconds;
    return typeof lag === 'number' ? lag : null;
  } catch {
    return null;
  }
}

/**
 * Lag cache'i güncelle. Cron veya periyodik task'tan çağrılabilir.
 * Manuel çağrı performans amaçlı; otomatik prismaRead() içinde tetikleniyor.
 */
export async function refreshLagCache(): Promise<number | null> {
  const lag = await measureReplicaLag();
  if (lag !== null) {
    lagCheckCache = { value: lag, checkedAt: Date.now() };
  }
  return lag;
}

/**
 * Health check endpoint için: replica state özeti.
 */
export async function getReplicaStatus(): Promise<{
  enabled: boolean;
  lagSeconds: number | null;
  healthy: boolean;
  degradedMode: boolean;
}> {
  const enabled = isReplicaEnabled();
  if (!enabled) {
    return { enabled: false, lagSeconds: 0, healthy: true, degradedMode: false };
  }
  const lag = await measureReplicaLag();
  const healthy = lag !== null;
  const degraded = !healthy || (lag !== null && lag > LAG_THRESHOLD_S);
  return { enabled, lagSeconds: lag, healthy, degradedMode: degraded };
}
