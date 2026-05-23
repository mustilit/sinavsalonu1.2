import { IReviewRepository } from '../../../domain/interfaces/IReviewRepository';
import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Belirli bir test için review listesi — geri uyumluluk amacıyla mevcut.
 *
 * Yeni model (paket bazlı review) gereği, testId'den paket bulunup paketin
 * review'ları döner. Aday başına tek satır.
 */
export class ListTestReviewsUseCase {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(testId: string, limit = 20, cursor?: string) {
    if (!testId) return { items: [], nextCursor: undefined };
    const test = await prisma.examTest.findUnique({
      where: { id: testId },
      select: { packageId: true },
    });
    const packageId = (test as any)?.packageId;
    if (!packageId) return { items: [], nextCursor: undefined };
    return this.reviewRepo.listReviewsForPackage(packageId, limit, cursor);
  }
}
