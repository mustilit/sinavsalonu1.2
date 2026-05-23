import { IExamRepository } from '../../../domain/interfaces/IExamRepository';
import { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import { IAttemptRepository } from '../../../domain/interfaces/IAttemptRepository';
import { AppError } from '../../errors/AppError';
import { ensureEducatorActive } from '../../policies/ensureEducatorActive';

/**
 * Şık güncelleme. Eğitici her zaman güncelleyebilir; mevcut alıcılar
 * Purchase.testsSnapshot ve TestAttempt.questionsSnapshot sayesinde
 * satın alma anındaki içerik + doğru cevap kümesiyle korunur. Yeni
 * satışlar canlı versiyonu snapshot olarak alır.
 *
 * SubmitAttempt skorlamayı snapshotCorrectMap üzerinden yapar — option
 * ID değişmediği için AttemptAnswer.selectedOptionId snapshot ile
 * birebir eşleşmeye devam eder.
 */
export class UpdateOptionUseCase {
  constructor(
    private readonly examRepository: IExamRepository,
    private readonly userRepository: IUserRepository,
    // Geriye dönük constructor uyumluluğu için parametre korundu; artık kullanılmıyor.
    private readonly _attemptRepository: IAttemptRepository,
  ) {}

  async execute(
    optionId: string,
    updates: { content?: string; isCorrect?: boolean },
    actorId?: string,
  ) {
    if (actorId) {
      const user = await this.userRepository.findById(actorId);
      if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      ensureEducatorActive(user);
    }

    const option = await this.examRepository.findOptionById(optionId);
    if (!option) throw new AppError('OPTION_NOT_FOUND', 'Option not found', 404);

    const test = await this.examRepository.findById(option.testId);
    if (!test) throw new AppError('TEST_NOT_FOUND', 'Test not found', 404);

    if (actorId && test.educatorId && test.educatorId !== actorId) {
      throw new AppError('FORBIDDEN_NOT_OWNER', 'Only the educator who owns the test can update it', 403);
    }

    return this.examRepository.updateOption(optionId, updates);
  }
}
