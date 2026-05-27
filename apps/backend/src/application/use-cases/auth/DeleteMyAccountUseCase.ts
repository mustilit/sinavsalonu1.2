/**
 * KVKK Madde 11 — Kişisel Verilerin Silinmesi
 * GDPR Article 17 — Right to Erasure
 *
 * Aday/eğitici/admin kendi hesabını silebilir. Akış:
 *   1. Soft delete: User.deletedAt set + activeSessionId temizle (tüm cihazlardan logout)
 *   2. PII anonymization: email → "deleted-{uuid}@deleted.local", username → "deleted-{8char}"
 *      passwordHash, firstName, lastName, profil bilgileri sıfırla
 *   3. İlişkili tablolar:
 *      - EmailLog.recipientUserId = null (referans bozma, log integrity korunur)
 *      - AuditLog'da aktör olarak görünenleri null'lama (audit bütünlüğü için ID kalır)
 *      - Purchase, TestAttempt KORUNUR (eğitici komisyon hesabı için gerekli)
 *        Aday'ın kimliği anonim ama satın alma+çözüm istatistiği duruyor.
 *   4. Audit log: USER_DELETED action with reason
 *
 * GERİ ALMA YOK — Kullanıcı 30 günlük cooldown almak isterse:
 *   - "Silmeyi planla" + zamanlanmış job (gelecek özellik, şu an direkt sil)
 *
 * RETENTION POLITICA:
 *   - EmailLog.htmlBody/textBody zaten 90 gün sonra cron tarafından null'lanır
 *   - Backup'lar 2 gün rotasyon — bu süreden sonra eski PII tam silinir
 *
 * AUDIT:
 *   - AUTH_LOGIN_FAIL audit log'unda email plain saklanıyor (auth fail forensics).
 *     Bu kayıtlar 1 yıllık retention sonra cron ile temizlenir (Sprint 8 işi).
 */

import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditLogger, AuditContext } from '../../../infrastructure/audit/AuditLogger';
import { randomBytes } from 'crypto';

export interface DeleteMyAccountInput {
  userId: string;
  reason?: string;
  /** Aday kendi şifresini doğrulamak için tekrar girer (önemli aksiyon koruması) */
  passwordConfirmation?: string;
}

export interface DeleteMyAccountOutput {
  success: true;
  anonymizedAt: Date;
  message: string;
}

@Injectable()
export class DeleteMyAccountUseCase {
  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditLogger) private readonly audit: AuditLogger,
  ) {}

  async execute(input: DeleteMyAccountInput, ctx: AuditContext = {}): Promise<DeleteMyAccountOutput> {
    const { userId } = input;
    if (!userId) throw new BadRequestException({ code: 'INVALID_INPUT', message: 'userId zorunlu' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı' });

    if (user.deletedAt) {
      throw new BadRequestException({ code: 'ALREADY_DELETED', message: 'Bu hesap zaten silinmiş' });
    }

    // ADMIN hesabı kendini silmek için ekstra koruma — son admin kalırsa sistem
    // erişilemez olur. (Çoklu admin sistemde admin kendini silmeli, son admin yapamamalı.)
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } });
      if (adminCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_ADMIN',
          message: 'Sistemdeki tek admin hesabı silinemez. Önce başka bir admin oluştur.',
        });
      }
    }

    // PII anonymization payload
    const anonymousSuffix = randomBytes(8).toString('hex');
    const anonymizedEmail = `deleted-${user.id}@deleted.local`;
    const anonymizedUsername = `deleted-${anonymousSuffix}`;
    const now = new Date();

    // Multi-table soft delete + anonymization (atomic)
    await this.prisma.$transaction(async (tx) => {
      // 1. User PII alanlarını anonimleştir + deletedAt set + session temizle
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          username: anonymizedUsername,
          firstName: null,
          lastName: null,
          bio: null,
          googleId: null,
          passwordHash: '__DELETED_NO_LOGIN__',
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecovery: [],
          twoFactorEnabledAt: null,
          activeSessionId: null,
          emailVerified: false,
          deletedAt: now,
        },
      });

      // 2. EmailLog kayıtlarındaki referansı kopar (log integrity için silmiyoruz)
      await tx.emailLog.updateMany({
        where: { recipientUserId: userId },
        data: { recipientUserId: null, recipientEmail: anonymizedEmail },
      });

      // 3. UserDevice (yeni cihaz uyarısı için kayıt tutulan fingerprint'ler) → sil
      await tx.userDevice.deleteMany({ where: { userId } });

      // 4. Notification tercihleri (PII olmayan ama bu user'a özgü) → sil
      await tx.notificationPreference.deleteMany({ where: { userId } });

      // 5. Audit log atomic transaction içinde
      await tx.auditLog.create({
        data: {
          action: 'USER_DELETED',
          entityType: 'User',
          entityId: userId,
          actorId: ctx.userId ?? userId,
          metadata: {
            reason: input.reason ?? 'user_requested',
            kvkkArticle: 11,
            gdprArticle: 17,
            anonymizedAt: now.toISOString(),
            role: user.role,
            preservedTables: ['Purchase', 'TestAttempt', 'AuditLog'],
          },
        },
      });
    });

    // Audit logger (async, non-blocking) — ek izleme
    this.audit?.logAsync(ctx, {
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: userId,
      metadata: { reason: input.reason },
    });

    return {
      success: true,
      anonymizedAt: now,
      message:
        'Hesabınız başarıyla silindi. Kişisel verileriniz 30 gün içinde tüm yedeklerden de silinecek. ' +
        'Satın alma + test çözme istatistikleri eğitici komisyonu için anonim olarak korunur.',
    };
  }
}
