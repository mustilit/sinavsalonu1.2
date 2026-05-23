import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';

/**
 * Bir TestPackage için review listesi (yeni model: aday başına tek satır).
 *
 * Dönüş:
 *  - avg   = paketin genel ortalaması = unique adayların verdiği puanların ortalaması
 *  - count = paketi puanlayan farklı aday sayısı (limit/offset'ten bağımsız toplam)
 *  - items[] = sayfalanmış aday review'ları
 *
 * Paging: offset-based. Frontend prev/next pattern'i için doğal seçim.
 */
export class GetPackageReviewsUseCase {
  async execute(
    packageId: string,
    limit = 10,
    offset = 0,
  ): Promise<{
    avg: number | null;
    count: number;
    items: Array<{
      candidateId: string;
      candidateName: string | null;
      rating: number;
      comment: string | null;
      createdAt: string;
    }>;
  }> {
    if (!packageId) throw new AppError('INVALID_INPUT', 'packageId required', 400);

    const take = Math.max(1, Math.min(100, limit));
    const skip = Math.max(0, offset);

    const rows: any[] = await (prisma as any).review.findMany({
      where: { packageId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
      select: {
        candidateId: true,
        testRating: true,
        comment: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // Total avg + count — paginate olmadan aggregate
    const agg: any = await (prisma as any).review.aggregate({
      where: { packageId },
      _avg: { testRating: true },
      _count: { _all: true },
    });

    if (rows.length === 0) {
      return {
        avg: agg._avg.testRating != null ? Number(Number(agg._avg.testRating).toFixed(2)) : null,
        count: agg._count._all ?? 0,
        items: [],
      };
    }

    // Aday isimleri için ayrı sorgu
    const candidateIds = Array.from(new Set(rows.map((r) => r.candidateId)));
    const candidates = await prisma.user.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, username: true },
    });
    const nameById = new Map(candidates.map((c) => [c.id, c.username]));

    const items = rows.map((r) => ({
      candidateId: r.candidateId,
      candidateName: nameById.get(r.candidateId) ?? null,
      rating: r.testRating,
      comment: r.comment ?? null,
      createdAt: (r.updatedAt ?? r.createdAt).toISOString(),
    }));

    return {
      avg: agg._avg.testRating != null ? Number(Number(agg._avg.testRating).toFixed(2)) : null,
      count: agg._count._all ?? 0,
      items,
    };
  }
}
