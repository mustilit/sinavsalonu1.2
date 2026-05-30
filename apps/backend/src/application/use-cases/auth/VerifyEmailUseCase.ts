import { randomUUID } from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma';
import { BadRequestException } from '@nestjs/common';
import { getDefaultTenantId } from '../../../common/tenant';

/**
 * Email doğrulama: token ile kullanıcıyı bulur ya da PendingRegistration'ı User'a promote eder.
 *
 * İki yol:
 *   1. PendingRegistration token'ı: pending kaydı bulunur, User oluşturulur, pending silinir.
 *      ContractAcceptance kayıtları yazılır, audit logu oluşturulur.
 *   2. User.emailVerificationToken (legacy): mevcut User bulunur, emailVerified=true yapılır.
 *      Eski kayıtlar (pinarak86 gibi) için backward compat.
 */
export class VerifyEmailUseCase {
  async execute(token: string): Promise<{ userId: string; email: string; role: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Token gerekli' });
    }

    // Yol 1: PendingRegistration token'ı kontrol et (raw SQL — client regenerate edilmedi)
    const pendingRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM pending_registrations WHERE "verificationToken" = ${token} LIMIT 1
    `;
    const pending = pendingRows[0];

    if (pending) {
      return this.promoteToUser(pending);
    }

    // Yol 2: Legacy — User.emailVerificationToken (mevcut User kayıtları için)
    return this.verifyExistingUser(token);
  }

  /** PendingRegistration'dan User oluştur (promote). */
  private async promoteToUser(pending: any): Promise<{ userId: string; email: string; role: string }> {
    // Token süresi kontrolü
    if (pending.verificationTokenExpiresAt && pending.verificationTokenExpiresAt < new Date()) {
      // Expired pending kaydını temizle (raw SQL)
      await prisma.$executeRaw`DELETE FROM pending_registrations WHERE id = ${pending.id}`;
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Doğrulama bağlantısının süresi dolmuş. Lütfen yeniden kayıt olun.',
      });
    }

    const tenantId = pending.tenantId ?? getDefaultTenantId();
    const isEducator = pending.role === 'EDUCATOR';
    const userId = randomUUID();

    // Eğitici wizard alanları için metadata hazırla
    const educatorMetadata: Record<string, any> = {};
    if (isEducator) {
      if (pending.cvUrl) educatorMetadata['cv_url'] = pending.cvUrl;
      if (Array.isArray(pending.specializations) && pending.specializations.length > 0) {
        educatorMetadata['specialized_exam_types'] = pending.specializations;
      } else if (typeof pending.specializations === 'string' && (pending.specializations as string).length > 2) {
        // raw SQL'den gelen '{id1,id2}' formatını parse et
        const parsed = (pending.specializations as string)
          .replace(/^\{/, '').replace(/\}$/, '').split(',').filter(Boolean);
        if (parsed.length > 0) educatorMetadata['specialized_exam_types'] = parsed;
      }
      if (pending.educationInfo) educatorMetadata['education_info'] = pending.educationInfo;
      if (pending.bio) educatorMetadata['bio'] = pending.bio;
    }

    // User oluştur — transaction içinde
    await prisma.$transaction(async (tx) => {
      // User yarat
      await (tx as any).user.create({
        data: {
          id: userId,
          email: pending.email,
          username: pending.username,
          passwordHash: pending.passwordHash,
          firstName: pending.firstName ?? undefined,
          lastName: pending.lastName ?? undefined,
          role: pending.role,
          status: isEducator ? 'PENDING_EDUCATOR_APPROVAL' : 'ACTIVE',
          emailVerified: true, // doğrulama tamamlandı
          tenantId,
          metadata: educatorMetadata,
        },
      });

      // ContractAcceptance kayıtları
      const contractIds: string[] = [];
      if (pending.acceptedTermsContractId) contractIds.push(pending.acceptedTermsContractId);
      if (pending.acceptedPrivacyContractId && pending.acceptedPrivacyContractId !== pending.acceptedTermsContractId) {
        contractIds.push(pending.acceptedPrivacyContractId);
      }

      for (const contractId of contractIds) {
        // upsert — duplicate durumunda sessizce geç
        await (tx as any).contractAcceptance.upsert({
          where: { userId_contractId: { userId, contractId } },
          create: {
            userId,
            contractId,
            ip: pending.ip ?? undefined,
            userAgent: pending.userAgent ?? undefined,
          },
          update: {},
        });
      }

      // Audit log — best-effort (transaction içinde olduğu için failure tümünü geri alır
      // ama biz transaction dışında yapalım: audit başarısız olsa User oluşmalı)
    });

    // Audit log — transaction dışı, best-effort
    try {
      await (prisma as any).auditLog.create({
        data: {
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: userId,
          actorId: userId,
          metadata: { role: pending.role, via: 'email_verification' },
        },
      });
    } catch {
      /* best-effort */
    }

    // PendingRegistration'ı sil (raw SQL)
    await prisma.$executeRaw`DELETE FROM pending_registrations WHERE id = ${pending.id}`;

    return { userId, email: pending.email, role: pending.role };
  }

  /** Mevcut User'ın emailVerified bayrağını günceller (legacy path). */
  private async verifyExistingUser(token: string): Promise<{ userId: string; email: string; role: string }> {
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

    // Idempotent: zaten doğrulanmışsa hata vermeden döndür
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
