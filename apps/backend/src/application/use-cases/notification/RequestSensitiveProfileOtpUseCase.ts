import { randomInt, createHash } from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma';
import { EmailService } from '../../services/email/EmailService';
import { AppError } from '../../errors/AppError';

/**
 * Hassas profil alanlarını (telefon, website, LinkedIn) güncellemek isteyen
 * kullanıcıya e-posta ile 6 haneli doğrulama kodu yollar.
 *
 * - Kod: 100000-999999 arası rastgele 6 hane
 * - Hash: sha256(code + userId) → User.metadata.sensitiveProfileOtp altında saklanır
 * - TTL: 10 dakika
 * - Spam koruması: aynı kullanıcı son 60 saniyede istek yapmışsa reddedilir
 *
 * Frontend verify endpoint'ine kodu + güncellenecek alanları birlikte gönderir.
 */
const OTP_TTL_MS = 10 * 60 * 1000;        // 10 dakika
const REQUEST_COOLDOWN_MS = 60 * 1000;    // 60 sn

export class RequestSensitiveProfileOtpUseCase {
  constructor(private readonly emailService: EmailService = new EmailService()) {}

  async execute(userId: string): Promise<{ sentTo: string; expiresAt: Date }> {
    if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);

    const user: any = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, tenantId: true, metadata: true },
    });
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);

    // Spam koruması — aynı kullanıcı son 60 sn'de istek yapmışsa reddet
    const existing = (user.metadata?.sensitiveProfileOtp ?? null) as
      | { hash: string; expiresAt: string; lastSentAt: string }
      | null;
    if (existing?.lastSentAt) {
      const last = new Date(existing.lastSentAt).getTime();
      if (Date.now() - last < REQUEST_COOLDOWN_MS) {
        throw new AppError(
          'OTP_RATE_LIMITED',
          'Lütfen yeni bir kod istemeden önce bir dakika bekleyin',
          429,
        );
      }
    }

    const code = String(randomInt(100000, 1000000));
    const hash = createHash('sha256').update(`${code}:${userId}`).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const nextMetadata = {
      ...(user.metadata ?? {}),
      sensitiveProfileOtp: {
        hash,
        expiresAt: expiresAt.toISOString(),
        lastSentAt: new Date().toISOString(),
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: { metadata: nextMetadata } as any,
    });

    try {
      await this.emailService.send({
        tenantId: user.tenantId,
        templateKey: 'profile-change-otp',
        to: { userId: user.id, email: user.email },
        data: {
          user: { username: user.username },
          code,
        },
        bypassPreferences: true, // güvenlik kodu — preferences engellemesin
        bypassSendWindow: true,
      });
    } catch {
      // Best-effort; OTP DB'de zaten kayıtlı, kullanıcı resend isteyebilir
    }

    return { sentTo: maskEmail(user.email), expiresAt };
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
