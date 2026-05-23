import { ITestPackageRepository } from '../../../domain/interfaces/ITestPackageRepository';
import { prisma } from '../../../infrastructure/database/prisma';

export class ListEducatorPackagesUseCase {
  constructor(private readonly repo: ITestPackageRepository) {}

  async execute(educatorId: string) {
    const packages = await this.repo.findByEducatorId(educatorId);
    if (packages.length === 0) return packages;

    const packageIds = packages.map((p: any) => p.id);

    const [saleRows, ratingRows] = await Promise.all([
      (prisma.purchase as any).groupBy({
        by: ['packageId'],
        where: { packageId: { in: packageIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      packageIds.length
        ? (prisma as any).review.groupBy({
            by: ['packageId'],
            where: { packageId: { in: packageIds } },
            _avg: { testRating: true },
            _count: { _all: true },
          })
        : [],
    ]);

    const saleByPackageId = new Map<string, number>();
    for (const s of saleRows) {
      if (s.packageId) saleByPackageId.set(s.packageId, s._count._all ?? 0);
    }

    const ratingByPackageId = new Map<string, { avg: number; count: number }>();
    for (const r of ratingRows as any[]) {
      if (r.packageId) {
        ratingByPackageId.set(r.packageId, { avg: r._avg.testRating ?? 0, count: r._count._all ?? 0 });
      }
    }

    return packages.map((pkg: any) => {
      const r = ratingByPackageId.get(pkg.id);
      return {
        ...pkg,
        saleCount: saleByPackageId.get(pkg.id) ?? 0,
        ratingAvg: r && r.count > 0 ? r.avg : null,
        ratingCount: r?.count ?? 0,
      };
    });
  }
}
