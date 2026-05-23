import { prisma } from '../database/prisma';
import { IReviewRepository, ReviewRecord } from '../../domain/interfaces/IReviewRepository';

/**
 * Yeni model: review per-package per-candidate.
 * Mevcut Prisma client'ı yeni şemayla yeniden generate edilene kadar `as any` kullanılır.
 */
export class PrismaReviewRepository implements IReviewRepository {
  async upsertPackageReview(input: {
    packageId: string;
    educatorId: string;
    candidateId: string;
    testRating?: number;
    educatorRating?: number;
    comment?: string;
  }): Promise<ReviewRecord> {
    // Mevcut kaydı ara
    const existing: any = await (prisma as any).review.findFirst({
      where: { packageId: input.packageId, candidateId: input.candidateId },
    });

    const resolvedTestRating = input.testRating ?? existing?.testRating ?? 1;

    let row: any;
    if (existing) {
      row = await (prisma as any).review.update({
        where: { id: existing.id },
        data: {
          ...(input.testRating !== undefined && { testRating: input.testRating }),
          ...(input.educatorRating !== undefined && { educatorRating: input.educatorRating }),
          ...(input.comment !== undefined && { comment: input.comment }),
          educatorId: input.educatorId,
          updatedAt: new Date(),
        },
      });
    } else {
      row = await (prisma as any).review.create({
        data: {
          packageId: input.packageId,
          educatorId: input.educatorId,
          candidateId: input.candidateId,
          testRating: resolvedTestRating,
          educatorRating: input.educatorRating ?? null,
          comment: input.comment ?? null,
        },
      });
    }
    return this.toDomain(row);
  }

  async listReviewsForPackage(
    packageId: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ items: ReviewRecord[]; nextCursor?: string }> {
    const take = Math.min(50, Math.max(1, limit || 20));
    const findOpts: any = {
      where: { packageId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    };
    if (cursor) {
      findOpts.cursor = { id: cursor };
      findOpts.skip = 1;
    }
    const rows: any[] = await (prisma as any).review.findMany(findOpts);
    const items = rows.map((r) => this.toDomain(r));
    const nextCursor = items.length === take ? items[items.length - 1].id : undefined;
    return { items, nextCursor };
  }

  async getAggregateForPackage(packageId: string): Promise<{ avg: number | null; count: number }> {
    const rows: any = await (prisma as any).review.aggregate({
      _avg: { testRating: true },
      _count: { _all: true },
      where: { packageId },
    });
    return { avg: rows._avg.testRating ?? null, count: rows._count._all ?? 0 };
  }

  async getAggregateForEducator(educatorId: string): Promise<{ avg: number | null; count: number }> {
    const rows: any = await (prisma as any).review.aggregate({
      _avg: { educatorRating: true },
      _count: { _all: true },
      where: { educatorId },
    });
    return { avg: rows._avg.educatorRating ?? null, count: rows._count._all ?? 0 };
  }

  private toDomain(row: any): ReviewRecord {
    return {
      id: row.id,
      packageId: row.packageId ?? null,
      testId: row.testId ?? null,
      educatorId: row.educatorId,
      candidateId: row.candidateId,
      testRating: row.testRating,
      educatorRating: row.educatorRating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
