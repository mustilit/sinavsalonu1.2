import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';

/**
 * Bir aday için paket review'unu döner (yeni model: 1 aday × 1 paket = 1 review).
 *
 * Frontend "kendi puanın" alanını besler. Hiç review yoksa `null` döner.
 */
export class GetMyPackageReviewUseCase {
  async execute(
    packageId: string,
    candidateId: string,
  ): Promise<{
    rating: number;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    if (!packageId) throw new AppError('INVALID_INPUT', 'packageId required', 400);
    if (!candidateId) throw new AppError('UNAUTHORIZED', 'candidateId required', 401);

    const row: any = await (prisma as any).review.findFirst({
      where: { packageId, candidateId },
      select: {
        testRating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) return null;

    return {
      rating: row.testRating,
      comment: row.comment ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
