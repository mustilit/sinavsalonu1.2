import { prisma } from '../../infrastructure/database/prisma';

/**
 * Paket değerlendirmelerini toplu agregat hesaplayan servis.
 * Yeni model: aday başına tek satır → her review tek "oy".
 */
export class ReviewAggregationService {
  /**
   * Birden fazla test için ortalama puan ve değerlendirme sayısı.
   *
   * Yeni domain'de review per-package olduğu için, testId üzerinden çağrılan
   * eski API'leri kırmamak adına testId → packageId lookup yapıp paket
   * agregat'ını döner. Aynı paketteki birden fazla test için aynı puan döner.
   *
   * @returns testId → { avg, count } eşlemesi
   */
  async getAggregatesForTestIds(testIds: string[]) {
    if (!testIds || testIds.length === 0) return {};

    // testId → packageId map'i
    const tests = await prisma.examTest.findMany({
      where: { id: { in: testIds } },
      select: { id: true, packageId: true },
    });
    const packageByTest = new Map<string, string | null>(
      tests.map((t: any) => [t.id, t.packageId ?? null]),
    );
    const packageIds = Array.from(
      new Set(tests.map((t: any) => t.packageId).filter(Boolean)),
    ) as string[];

    if (packageIds.length === 0) {
      return Object.fromEntries(testIds.map((id) => [id, { avg: null, count: 0 }]));
    }

    const rows: any[] = await (prisma as any).review.groupBy({
      by: ['packageId'],
      where: { packageId: { in: packageIds } },
      _avg: { testRating: true },
      _count: { _all: true },
    });
    const aggByPackage = new Map<string, { avg: number | null; count: number }>();
    for (const r of rows) {
      if (r.packageId) {
        aggByPackage.set(r.packageId, {
          avg: r._avg.testRating ?? null,
          count: r._count._all ?? 0,
        });
      }
    }

    const map: Record<string, { avg: number | null; count: number }> = {};
    for (const tid of testIds) {
      const pid = packageByTest.get(tid) ?? null;
      map[tid] = pid ? aggByPackage.get(pid) ?? { avg: null, count: 0 } : { avg: null, count: 0 };
    }
    return map;
  }
}
