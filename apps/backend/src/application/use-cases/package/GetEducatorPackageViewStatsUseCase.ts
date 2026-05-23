import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';

/**
 * Eğiticinin kendi paketleri için görüntülenme istatistikleri.
 *
 * Döndürür: paket başına
 *  - totalViews:  tüm zamanlar (her aday + her oturum = ayrı satır)
 *  - uniqueViewers: DISTINCT viewerId (login yapmış adaylar)
 *  - last7Days:   son 7 gün toplam (trend göstergesi)
 *
 * Yetki: educatorId, paketin sahibi olmalı. Yoksa o paket gelmez.
 * Batch query — N+1 yok.
 */
export class GetEducatorPackageViewStatsUseCase {
  async execute(educatorId: string, packageIds?: string[]): Promise<Array<{
    packageId: string;
    totalViews: number;
    uniqueViewers: number;
    last7Days: number;
  }>> {
    if (!educatorId) throw new AppError('UNAUTHORIZED', 'educatorId required', 401);

    // Sadece eğiticinin sahip olduğu paketleri al
    const myPackages = await prisma.testPackage.findMany({
      where: {
        educatorId,
        ...(packageIds && packageIds.length > 0 ? { id: { in: packageIds } } : {}),
      },
      select: { id: true },
    });
    if (myPackages.length === 0) return [];

    const ids = myPackages.map((p) => p.id);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Tek query'de paket-bazlı agrega
    const [totalsRaw, uniqueRaw, last7Raw] = await Promise.all([
      prisma.packageView.groupBy({
        by: ['packageId'],
        where: { packageId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ packageId: string; count: bigint }>>`
        SELECT "packageId", COUNT(DISTINCT "viewerId")::bigint AS count
        FROM package_views
        WHERE "packageId" = ANY(${ids}::text[]) AND "viewerId" IS NOT NULL
        GROUP BY "packageId"
      `,
      prisma.packageView.groupBy({
        by: ['packageId'],
        where: { packageId: { in: ids }, createdAt: { gte: since7d } },
        _count: { _all: true },
      }),
    ]);

    const totalsByPkg = new Map<string, number>();
    for (const r of totalsRaw) totalsByPkg.set(r.packageId, r._count._all);

    const uniqueByPkg = new Map<string, number>();
    for (const r of uniqueRaw) uniqueByPkg.set(r.packageId, Number(r.count));

    const last7ByPkg = new Map<string, number>();
    for (const r of last7Raw) last7ByPkg.set(r.packageId, r._count._all);

    return ids.map((id) => ({
      packageId: id,
      totalViews: totalsByPkg.get(id) ?? 0,
      uniqueViewers: uniqueByPkg.get(id) ?? 0,
      last7Days: last7ByPkg.get(id) ?? 0,
    }));
  }
}
