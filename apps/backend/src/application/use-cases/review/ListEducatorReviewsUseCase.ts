import { prisma } from '../../../infrastructure/database/prisma';

export interface EducatorReviewItem {
  id: string;
  packageId: string | null;
  packageTitle: string;
  testRating: number | null;
  educatorRating: number | null;
  comment: string | null;
  createdAt: string;
}

/**
 * Bir eğiticinin paketlerine gelen review'ları listeler (yeni model: paket bazlı).
 */
export class ListEducatorReviewsUseCase {
  async execute(educatorId: string, limit = 20): Promise<EducatorReviewItem[]> {
    const safeLimit = Math.min(50, Math.max(1, limit));

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        packageId: string | null;
        package_title: string | null;
        testRating: number;
        educatorRating: number | null;
        comment: string | null;
        createdAt: Date;
      }>
    >`
      SELECT r.id, r."packageId", p.title AS package_title,
             r."testRating", r."educatorRating", r.comment, r."createdAt"
      FROM reviews r
      LEFT JOIN test_packages p ON r."packageId" = p.id
      WHERE r."educatorId" = ${educatorId}
        AND r."educatorRating" IS NOT NULL
      ORDER BY r."createdAt" DESC
      LIMIT ${safeLimit}
    `;

    return rows.map((r) => ({
      id: r.id,
      packageId: r.packageId,
      packageTitle: r.package_title ?? '',
      testRating: r.testRating,
      educatorRating: r.educatorRating ?? null,
      comment: r.comment ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }
}
