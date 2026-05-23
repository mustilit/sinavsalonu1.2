import { prisma } from '../../../infrastructure/database/prisma';
import { BadRequestException } from '@nestjs/common';

/**
 * Email doğrulama: token ile kullanıcıyı bulur, süresi dolmadıysa emailVerified=true yapar.
 *
 * Idempotent: aynı token ile ikinci çağrı (mevcut kullanıcı zaten doğrulanmışsa) yine başarılı döner.
 */
export class VerifyEmailUseCase {
  async execute(token: string): Promise<{ userId: string; email: string; role: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Token gerekli' });
    }

    const user: any = await (prisma as any).user.findFirst({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        emailVerificationTokenExpiresAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Geçersiz doğrulama bağlantısı' });
    }

    // Idempotent: zaten doğrulanmışsa hata vermeden döndür (kullanıcı linki tekrar tıklamış olabilir)
    if (user.emailVerified) {
      return { userId: user.id, email: user.email, role: user.role };
    }

    if (user.emailVerificationTokenExpiresAt && user.emailVerificationTokenExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Doğrulama bağlantısının süresi dolmuş. Yeni bağlantı isteyebilirsiniz.',
      });
    }

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { userId: user.id, email: user.email, role: user.role };
  }
}
