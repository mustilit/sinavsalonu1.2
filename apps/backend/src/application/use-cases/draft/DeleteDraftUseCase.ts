import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * DeleteDraftUseCase — başarılı bir kalıcı kayıt (örn. paket publish) sonrası
 * frontend bu endpoint'i çağırır. Yoksa sessiz geçer (idempotent).
 */
export class DeleteDraftUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(ownerId: string, key: string) {
    if (!ownerId || !key) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Missing ownerId or key' });
    }

    await (this.prisma as any).draftSnapshot.deleteMany({
      where: { ownerId, key },
    });

    return { ok: true };
  }
}
