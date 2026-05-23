import { IReviewRepository } from '../../../domain/interfaces/IReviewRepository';
import { IPurchaseRepository } from '../../../domain/interfaces/IPurchaseRepository';
import { IAttemptRepository } from '../../../domain/interfaces/IAttemptRepository';
import { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';
import { BadRequestException } from '@nestjs/common';

/**
 * Paket bazlı review oluşturur veya günceller (upsert).
 *
 * Yeni model (TR domain): 1 aday × 1 paket = 1 review.
 *
 * İş kuralları:
 *   - Aday paketi satın almış olmalı (en az bir test'i için Purchase var)
 *   - Puan 1-5 aralığında olmalı
 *   - Aynı (packageId, candidateId) için ikinci çağrı mevcut kaydı günceller
 *
 * NOT: Eskiden "en az bir test SUBMITTED olmalı" şartı vardı. Aday'ın TestDetail
 * sayfasından (test bitmeden) de puanlama yapabilmesi için bu kural kaldırıldı.
 * Test bitirme akışındaki review modal aynı use-case'i çağırdığı için (upsert)
 * iki giriş senkron kalır.
 */
export class CreateOrUpdateReviewUseCase {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly purchaseRepo: IPurchaseRepository,
    // attemptRepo geriye dönük constructor uyumu için tutuluyor; eskiden SUBMITTED
    // attempt kuralı kontrol ediyordu, kural kaldırıldı.
    private readonly _attemptRepo: IAttemptRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(
    packageId: string,
    candidateId: string,
    payload: { testRating?: number; educatorRating?: number; comment?: string },
  ) {
    const { testRating, educatorRating, comment } = payload;
    if (!packageId || !candidateId) throw new BadRequestException('INVALID_INPUT');
    if (testRating === undefined && educatorRating === undefined) throw new BadRequestException('RATING_INVALID');
    if (testRating !== undefined && (testRating < 1 || testRating > 5)) throw new BadRequestException('RATING_INVALID');
    if (educatorRating !== undefined && (educatorRating < 1 || educatorRating > 5)) throw new BadRequestException('RATING_INVALID');

    const { prisma } = require('../../../infrastructure/database/prisma');

    // Paketi ve testlerini al
    const pkg = await prisma.testPackage.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        educatorId: true,
        tests: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!pkg) throw new BadRequestException('PACKAGE_NOT_FOUND');
    const testIds: string[] = pkg.tests.map((t: any) => t.id);
    if (testIds.length === 0) throw new BadRequestException('PACKAGE_HAS_NO_TESTS');

    // Satın alma kontrolü — paketteki herhangi bir test için (purchase repo testId üzerinden çalışıyor)
    let hasPurchase = false;
    for (const tid of testIds) {
      if (await this.purchaseRepo.hasPurchase(tid, candidateId)) {
        hasPurchase = true;
        break;
      }
    }
    if (!hasPurchase) {
      throw new BadRequestException({ code: 'NO_PURCHASE', message: 'Candidate has not purchased this package' });
    }

    const educatorId = pkg.educatorId;

    // Upsert (packageId, candidateId)
    const created = await this.reviewRepo.upsertPackageReview({
      packageId,
      educatorId,
      candidateId,
      testRating,
      educatorRating,
      comment,
    });

    try {
      await this.auditRepo.create({
        action: 'REVIEW_UPSERTED' as any,
        entityType: 'Review',
        entityId: created.id,
        actorId: candidateId,
        metadata: { packageId, testRating, educatorRating },
      } as any);
    } catch {}

    // Stats refresh — best-effort
    try {
      const { QueueService } = require('../../../infrastructure/queue/queue.service');
      const qs = new QueueService();
      await qs.enqueueJob('stats-queue', 'refresh', { packageId });
    } catch {}

    return created;
  }
}
