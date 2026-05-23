import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * Aday'ın test çözme oturumunda gerçekleşen şüpheli/anti-leak olaylarını loglar.
 * Frontend useTestProctoring hook'u tarafından beslenir.
 *
 * - Owner kontrolü: aday yalnızca kendi attempt'ı için event yazabilir.
 * - Throttling/rate-limit: aynı tipten arka arkaya çok sayıda event spam'i
 *   olur. Aynı type için son 2 saniye içinde kayıt varsa atlanır.
 * - Type whitelist: bilinmeyen type'lar reddedilmez ama "OTHER" gibi davranılır
 *   (ileride yeni type eklendiğinde migration gerekmesin).
 */
const VALID_TYPES = new Set([
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'CONTEXT_MENU',
  'COPY_ATTEMPT',
  'CUT_ATTEMPT',
  'PASTE_ATTEMPT',
  'PRINT_KEY',
  'DEVTOOLS_HEURISTIC',
  'SHORTCUT_BLOCKED',
  'RAPID_ANSWER',
  'HEADLESS_DETECTED',
  'OTHER',
]);

const THROTTLE_MS = 2000;

export class LogAttemptAnomalyUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    attemptId: string,
    candidateId: string,
    type: string,
    payload: unknown,
  ) {
    if (!attemptId || !candidateId) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Missing attemptId or candidateId' });
    }
    if (!type || typeof type !== 'string') {
      throw new BadRequestException({ code: 'INVALID_TYPE', message: 'Missing type' });
    }

    const normalizedType = VALID_TYPES.has(type) ? type : 'OTHER';

    // Owner doğrulama
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, candidateId: true, status: true },
    });
    if (!attempt) throw new NotFoundException({ code: 'ATTEMPT_NOT_FOUND' });
    if (attempt.candidateId !== candidateId) {
      throw new ForbiddenException({ code: 'NOT_ATTEMPT_OWNER' });
    }

    // Throttle: aynı tipten son THROTTLE_MS içinde event varsa atla
    const recent = await (this.prisma as any).attemptAnomalyEvent.findFirst({
      where: {
        attemptId,
        type: normalizedType,
        createdAt: { gte: new Date(Date.now() - THROTTLE_MS) },
      },
      select: { id: true },
    });
    if (recent) return { id: recent.id, throttled: true };

    // Payload boyut kontrolü — JSON serialize edilmiş hali çok büyük olmasın
    let safePayload: any = null;
    if (payload != null) {
      try {
        const s = JSON.stringify(payload);
        if (s.length > 4096) {
          safePayload = { truncated: true, preview: s.slice(0, 200) };
        } else {
          safePayload = payload;
        }
      } catch {
        safePayload = null;
      }
    }

    const ev = await (this.prisma as any).attemptAnomalyEvent.create({
      data: {
        attemptId,
        candidateId,
        type: normalizedType,
        payload: safePayload,
      },
    });

    return { id: ev.id, throttled: false };
  }
}
