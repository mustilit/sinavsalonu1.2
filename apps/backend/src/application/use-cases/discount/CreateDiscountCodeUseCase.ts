import { BadRequestException } from '@nestjs/common';
import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';
import type { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import type { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';

/**
 * FR-E-09: Eğiticinin limitli kullanım indirim kodu oluşturmasını sağlar.
 *
 * İndirim kodu büyük harfe dönüştürülerek kaydedilir ve tüm sistemde benzersiz olmalıdır.
 * İndirim oranı %1 ile %50 arasında olabilir. Geçerlilik tarihleri ve maksimum
 * kullanım sayısı opsiyoneldir.
 */
export class CreateDiscountCodeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  /**
   * Yeni indirim kodunu doğrulayıp veritabanına kaydeder.
   *
   * @param educatorId         - Kodu oluşturan eğiticinin kimliği
   * @param input.code         - İndirim kodu (en az 3 karakter, büyük harfe çevrilir)
   * @param input.percentOff   - İndirim yüzdesi (1-50 arası)
   * @param input.maxUses      - Maksimum kullanım sayısı (null ise sınırsız)
   * @param input.validFrom    - Geçerlilik başlangıç tarihi (opsiyonel)
   * @param input.validUntil   - Geçerlilik bitiş tarihi (opsiyonel, validFrom'dan sonra olmalı)
   * @param input.description  - Açıklama metni (opsiyonel)
   */
  async execute(
    educatorId: string,
    input: {
      code: string;
      percentOff: number;
      maxUses?: number | null;
      validFrom?: Date | null;
      validUntil?: Date | null;
      description?: string | null;
    },
  ) {
    const user = await this.userRepo.findById(educatorId);
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    // Askıya alınmış hesap indirim kodu oluşturamaz; educatorApprovedAt kontrolü yok
    // (paket oluşturmayla tutarlı: onay beklemeyen eğiticiler de kullanabilir).
    // ADMIN da indirim kodu oluşturabilir — aynı kuralları taşır.
    if (user.role !== 'EDUCATOR' && user.role !== 'ADMIN')
      throw new AppError('USER_NOT_AUTHORIZED', 'User is not authorized to create discount codes', 403);
    if (user.status === 'SUSPENDED') throw new AppError('USER_SUSPENDED', 'User account is suspended', 403);

    // Kod normalize edilir: boşluklar temizlenir ve büyük harfe çevrilir
    const code = input.code.trim().toUpperCase();
    if (!code || code.length < 3) {
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'Code must be at least 3 characters' });
    }
    // İndirim oranı 1-100 aralığında olmalı (DB constraint)
    if (input.percentOff < 1 || input.percentOff > 100) {
      throw new BadRequestException({ code: 'INVALID_PERCENT', message: 'percentOff must be between 1 and 100' });
    }
    // Admin ayarlarındaki maksimum indirim oranını oku — eğitici bu sınırı geçemez.
    // Admin'in kendisi bu sınırla kısıtlı değildir (yönetici override).
    if (user.role === 'EDUCATOR') {
      const settingsRow = await prisma.$queryRaw<Array<{ maxDiscountPercent: number | null }>>`
        SELECT "maxDiscountPercent" FROM admin_settings WHERE id = 1 LIMIT 1
      `;
      const maxAllowed = settingsRow[0]?.maxDiscountPercent ?? 50;
      if (input.percentOff > maxAllowed) {
        throw new BadRequestException({
          code: 'DISCOUNT_LIMIT_EXCEEDED',
          message: `İndirim oranı en fazla %${maxAllowed} olabilir`,
        });
      }
    }
    if (input.maxUses != null && input.maxUses < 1) {
      throw new BadRequestException({ code: 'INVALID_MAX_USES', message: 'maxUses must be at least 1' });
    }
    // Bitiş tarihi başlangıç tarihinden önce olamaz
    if (input.validFrom && input.validUntil && input.validFrom >= input.validUntil) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'validUntil must be after validFrom' });
    }

    // Kod tüm eğiticiler arasında benzersiz olmalıdır
    const existing = await prisma.discountCode.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException({ code: 'CODE_EXISTS', message: 'Discount code already exists' });
    }

    const created = await prisma.discountCode.create({
      data: {
        code,
        percentOff: input.percentOff,
        maxUses: input.maxUses ?? null,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        description: input.description ?? null,
        createdById: educatorId,
      },
    });

    try {
      await this.auditRepo.create({
        action: 'DISCOUNT_CREATED' as any,
        entityType: 'DiscountCode',
        entityId: created.id,
        actorId: educatorId,
        metadata: { code: created.code, percentOff: created.percentOff, maxUses: created.maxUses },
      });
    } catch {
      /* best-effort: audit log hatası ana akışı kesmez */
    }

    return {
      id: created.id,
      code: created.code,
      percentOff: created.percentOff,
      maxUses: created.maxUses,
      usedCount: created.usedCount,
      isActive: (created as any).isActive ?? true,
      validFrom: created.validFrom,
      validUntil: created.validUntil,
      description: created.description,
      createdAt: created.createdAt,
    };
  }
}
