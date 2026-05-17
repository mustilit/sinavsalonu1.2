import { IExamRepository } from '../../../domain/interfaces/IExamRepository';
import { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';
import { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import { AppError } from '../../errors/AppError';
import { ensureEducatorActive } from '../../policies/ensureEducatorActive';

/** Test metadata güncelleme (title, priceCents, duration, isTimed). Fiyat değişimi audit edilir. */
export class UpdateTestUseCase {
  constructor(
    private readonly examRepository: IExamRepository,
    private readonly auditRepository: IAuditLogRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    testId: string,
    updates: {
      title?: string;
      priceCents?: number;
      duration?: number;
      isTimed?: boolean;
      hasSolutions?: boolean;
      campaignPriceCents?: number | null;
      campaignValidFrom?: Date | null;
      campaignValidUntil?: Date | null;
      coverImageUrl?: string | null;
    },
    actorId?: string,
  ) {
    if (actorId) {
      const user = await this.userRepository.findById(actorId);
      if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      ensureEducatorActive(user);
    }

    const test = await this.examRepository.findById(testId);
    if (!test) throw new AppError('TEST_NOT_FOUND', 'Test not found', 404);

    if (actorId && test.educatorId && test.educatorId !== actorId) {
      throw new AppError('FORBIDDEN_NOT_OWNER', 'Only the educator who owns the test can update it', 403);
    }

    const oldPriceCents = (test as any).priceCents ?? null;
    const newPriceCents = updates.priceCents;
    const priceChanged = typeof newPriceCents === 'number' && newPriceCents !== oldPriceCents;

    const updated = await this.examRepository.updateTestMetadata(testId, {
      title: updates.title,
      priceCents: updates.priceCents,
      duration: updates.duration,
      isTimed: updates.isTimed,
      hasSolutions: updates.hasSolutions,
      campaignPriceCents: updates.campaignPriceCents,
      campaignValidFrom: updates.campaignValidFrom,
      campaignValidUntil: updates.campaignValidUntil,
      coverImageUrl: updates.coverImageUrl,
    });
    if (!updated) throw new AppError('UPDATE_FAILED', 'Failed to update test', 400);

    if (priceChanged) {
      try {
        await this.auditRepository.create({
          action: 'PRICE_CHANGED',
          entityType: 'ExamTest',
          entityId: testId,
          actorId: actorId ?? null,
          metadata: { oldPriceCents, newPriceCents },
        });
      } catch {
        /* best-effort */
      }
    }

    return updated;
  }
}
