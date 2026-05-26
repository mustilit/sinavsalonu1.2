import { IAttemptRepository } from '../../../domain/interfaces/IAttemptRepository';
import { IExamRepository } from '../../../domain/interfaces/IExamRepository';
import { IAttemptAnswerRepository } from '../../../domain/interfaces/IAttemptAnswerRepository';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

export class GetAttemptStateUseCase {
  constructor(
    private readonly attemptRepo: IAttemptRepository,
    private readonly examRepo: IExamRepository,
    private readonly answerRepo: IAttemptAnswerRepository,
  ) {}

  async execute(attemptId: string, candidateId: string) {
    if (!attemptId || !candidateId) throw new BadRequestException('INVALID_INPUT');

    const attempt = await this.attemptRepo.findAttemptById(attemptId);
    if (!attempt) throw new BadRequestException({ code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' });
    if (attempt.candidateId !== candidateId) throw new ForbiddenException({ code: 'NOT_ATTEMPT_OWNER', message: 'Not owner' });

    const test = await this.examRepo.findById(attempt.testId);
    if (!test) throw new BadRequestException({ code: 'TEST_NOT_FOUND', message: 'Test not found' });

    // minimal questions list (id and order). assume examRepo returns ordered questions
    const answers = await this.answerRepo.findByAttemptId(attemptId);
    const answerMap: Record<string, string | null> = {};
    for (const a of answers) answerMap[a.questionId] = a.selectedOptionId ?? null;

    // Snapshot varsa canlı soru listesi yerine onu kullan (eğitici güncellemelerinden bağımsız).
    // SubmitAttemptUseCase'in beklediği gibi her zaman snapshot tercih edilir; canlı fallback
    // sadece çok eski testler için geçerli (testsSnapshot/migration öncesi).
    const questionSource: Array<any> =
      (attempt as any).questionsSnapshot ?? test.questions ?? [];

    // IN_PROGRESS sırasında doğru cevap (isCorrect) sızdırılmaz; submit sonrası açılır.
    const revealCorrect = attempt.status !== 'IN_PROGRESS';
    // Çözüm metni / görseli için ayrı kural: test.hasSolutions = true ise eğitici
    // bu testi "çözümlü/çalışma" modu olarak işaretlemiştir — aday aktif test sırasında
    // da çözümü görebilir. Aksi takdirde sadece submit sonrası gösterilir.
    const revealSolutions = !!test.hasSolutions || attempt.status !== 'IN_PROGRESS';

    const questions = questionSource.map((q: any, idx: number) => {
      const selected = answerMap[q.id] ?? null;
      const options = Array.isArray(q.options)
        ? q.options.map((o: any) => ({
            id: o.id,
            content: o.content ?? '',
            mediaUrl: o.mediaUrl ?? null,
            ...(revealCorrect ? { isCorrect: !!o.isCorrect } : {}),
          }))
        : [];
      return {
        id: q.id,
        index: idx + 1,
        answered: selected !== null,
        selectedOptionId: selected,
        // Snapshot içerik — eğitici sonradan değiştirse de sabit kalır.
        content: q.content ?? '',
        mediaUrl: q.mediaUrl ?? null,
        order: typeof q.order === 'number' ? q.order : idx,
        options,
        ...(revealSolutions
          ? {
              solutionText: q.solutionText ?? null,
              solutionMediaUrl: q.solutionMediaUrl ?? null,
            }
          : {}),
      };
    });

    const answeredCount = questions.filter((q) => q.answered).length;
    const blankCount = questions.length - answeredCount;

    let durationMinutes: number | undefined = undefined;
    let endsAt: string | undefined = undefined;
    let remainingSeconds: number | undefined = undefined;
    // Süre aşımı (overtime) hesaplama — backend artık aşımda cevap kabul ediyor,
    // frontend bu alanları kullanarak "Süre Aşımı +Xm Ys" badge'i gösterir.
    let isOvertime = false;
    let overtimeSeconds = 0;
    if (test.isTimed && typeof test.duration === 'number') {
      durationMinutes = test.duration;
      const started = new Date(attempt.startedAt).getTime();
      const ends = started + test.duration * 60 * 1000;
      endsAt = new Date(ends).toISOString();
      const now = Date.now();
      remainingSeconds = Math.max(0, Math.floor((ends - now) / 1000));
      if (now > ends && attempt.status === 'IN_PROGRESS') {
        isOvertime = true;
        overtimeSeconds = Math.floor((now - ends) / 1000);
      }
    }
    let totalSeconds: number | undefined = undefined;
    let isInLast10Percent = false;
    let isInLast3Minutes = false;
    if (typeof durationMinutes === 'number' && durationMinutes > 0) {
      totalSeconds = durationMinutes * 60;
      if (typeof remainingSeconds === 'number') {
        const elapsed = Math.max(0, totalSeconds - remainingSeconds);
        isInLast10Percent = totalSeconds > 0 ? remainingSeconds <= Math.ceil(totalSeconds * 0.1) : false;
        isInLast3Minutes = remainingSeconds <= 180;
      }
    }

    // If attempt is already finished, normalize timing fields: remaining 0 and warnings false.
    // Tamamlanmış attempt'ta overtime değeri DB'deki kalıcı kayıttan alınır
    // (SubmitAttemptUseCase finish anında attempt.overtimeSeconds'a yazar).
    if (attempt.status !== 'IN_PROGRESS') {
      remainingSeconds = 0;
      isInLast10Percent = false;
      isInLast3Minutes = false;
      const persistedOvertime = (attempt as any).overtimeSeconds ?? 0;
      if (persistedOvertime > 0) {
        isOvertime = true;
        overtimeSeconds = persistedOvertime;
      }
    }

    return {
      attempt: {
        id: attempt.id,
        testId: attempt.testId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt ?? null,
        durationMinutes,
        totalSeconds,
        endsAt,
        remainingSeconds,
        isInLast10Percent,
        isInLast3Minutes,
        isOvertime,
        overtimeSeconds,
        savedElapsedSeconds: (attempt as any).metadata != null
          ? ((attempt as any).metadata as any)?.elapsedSeconds ?? null
          : null,
      },
      test: {
        id: test.id,
        title: test.title,
        questionCount: test.questionCount ?? (test.questions ? test.questions.length : 0),
        isTimed: !!test.isTimed,
        hasSolutions: !!test.hasSolutions,
      },
      questions,
      summary: { answeredCount, blankCount },
    };
  }
}

