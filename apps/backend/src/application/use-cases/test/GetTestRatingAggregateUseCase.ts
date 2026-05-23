import { IReviewRepository } from '../../../domain/interfaces/IReviewRepository';
import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Bir test için değerlendirme özetini döner: ortalama puan ve değerlendirme sayısı.
 *
 * Yeni model (paket bazlı review) gereği, testId'den paket bulunup paketin aggregate'i döner.
 */
export class GetTestRatingAggregateUseCase {
  constructor(private readonly reviewRepo: IReviewRepository) {}
  async execute(testId: string) {
    if (!testId) return { avg: null, count: 0 };
    const test = await prisma.examTest.findUnique({
      where: { id: testId },
      select: { packageId: true },
    });
    const packageId = (test as any)?.packageId;
    if (!packageId) return { avg: null, count: 0 };
    return this.reviewRepo.getAggregateForPackage(packageId);
  }
}
