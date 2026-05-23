import { randomBytes } from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma';
import { EmailService } from '../../services/email/EmailService';

/**
 * Email doğrulama token'ı üretir, kullanıcı kaydına yazar ve doğrulama e-postası kuyruğa atar.
 *
 * Token: cryptographically random 32-byte hex (64 karakter). 24 saat geçerli.
 * Email: `email-verification` template'i ile kullanıcıya gönderilir.
 *
 * Kullanıcıyı id ile fetch eder — controller'da tenantId vs. taşıma gerekmez.
 */
export class SendEmailVerificationUseCase {
  constructor(private readonly emailService: EmailService = new EmailService()) {}

  async execute(input: { userId: string; appBaseUrl?: string }): Promise<{ token: string; expiresAt: Date }> {
    const user: any = await (prisma as any).user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, username: true, tenantId: true, emailVerified: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationTokenExpiresAt: expiresAt,
      },
    });

    const appBaseUrl = (input.appBaseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:5174').replace(/\/+$/, '');
    const verifyUrl = `${appBaseUrl}/VerifyEmail?token=${encodeURIComponent(token)}`;

    try {
      await this.emailService.send({
        tenantId: user.tenantId,
        templateKey: 'email-verification',
        to: { userId: user.id, email: user.email },
        data: {
          user: { username: user.username },
          verifyUrl,
        },
        bypassPreferences: true, // doğrulama maili kritik — preferences'a takılmaz
        bypassSendWindow: true,  // quiet hours uygulanmaz
      });
    } catch {
      // Email gönderim hatası kayıt akışını bozmaz — token DB'de duruyor, resend ile yeniden denenebilir
    }

    return { token, expiresAt };
  }
}
