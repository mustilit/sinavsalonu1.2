import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * GetDraftUseCase — kullanıcının kendi draft'ını okur. Yoksa null döner;
 * frontend "taslak yok" olarak yorumlar (404 yerine sade kontrat).
 */
export class GetDraftUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(ownerId: string, key: string) {
    if (!ownerId || !key) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Missing ownerId or key' });
    }

    const draft = await (this.prisma as any).draftSnapshot.findUnique({
      where: { ownerId_key: { ownerId, key } },
    });

    if (!draft) return null;
    return {
      key: draft.key,
      payload: draft.payload,
      updatedAt: draft.updatedAt,
    };
  }
}
