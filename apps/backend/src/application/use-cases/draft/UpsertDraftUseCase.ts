import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * UpsertDraftUseCase — kullanıcının kendi draft'ını yazar veya günceller.
 *
 * `key` mantıksal anahtar (örn. 'createTestWizard',
 * 'editTestWizard:abc123'); aynı kullanıcı + aynı key için tek kayıt
 * tutulur (composite unique). Payload JSON serileştirilebilir herhangi bir
 * şekil olabilir; backend içeriği yorumlamaz, sadece saklar.
 *
 * Boyut limiti: payload 1MB'ı aşarsa reddedilir (gereksiz storage'ı önler;
 * UI çoğu durumda <100KB taslak üretir).
 */
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB

export class UpsertDraftUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(ownerId: string, key: string, payload: any) {
    if (!ownerId) throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Missing ownerId' });
    if (!key || typeof key !== 'string' || key.length > 128) {
      throw new BadRequestException({ code: 'INVALID_KEY', message: 'Invalid key' });
    }
    if (payload == null) {
      throw new BadRequestException({ code: 'INVALID_PAYLOAD', message: 'Missing payload' });
    }

    // Boyut kontrolü — serialize edilmiş hali payload limitini aşamaz
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      throw new BadRequestException({
        code: 'PAYLOAD_TOO_LARGE',
        message: `Draft payload exceeds ${MAX_PAYLOAD_BYTES} bytes`,
      });
    }

    const draft = await (this.prisma as any).draftSnapshot.upsert({
      where: { ownerId_key: { ownerId, key } },
      create: { ownerId, key, payload },
      update: { payload },
    });

    return { id: draft.id, updatedAt: draft.updatedAt };
  }
}
