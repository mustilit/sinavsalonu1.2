import { BadRequestException } from '@nestjs/common';
import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';

/**
 * Mail'deki "Bu bendim — Cihazı doğrula" linkindeki token ile cihazı trusted=true yapar.
 * Token süresi (24 saat) dolmuşsa veya bulunamıyorsa anlamlı hata döner.
 */
export class VerifyDeviceUseCase {
  async execute(input: { token: string }): Promise<{ trusted: boolean; deviceId: string }> {
    if (!input?.token || input.token.length < 16) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Geçersiz doğrulama bağlantısı' });
    }

    const device = await prisma.userDevice.findUnique({ where: { trustToken: input.token } });
    if (!device) {
      throw new AppError('TOKEN_NOT_FOUND', 'Doğrulama bağlantısı bulunamadı veya kullanılmış', 404);
    }
    if (device.trustTokenExpiresAt && device.trustTokenExpiresAt.getTime() < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', 'Doğrulama bağlantısının süresi doldu', 410);
    }

    const updated = await prisma.userDevice.update({
      where: { id: device.id },
      data: {
        trusted: true,
        trustToken: null,           // token tek kullanımlık
        trustTokenExpiresAt: null,
        lastSeenAt: new Date(),
      },
    });
    return { trusted: updated.trusted, deviceId: updated.id };
  }
}
