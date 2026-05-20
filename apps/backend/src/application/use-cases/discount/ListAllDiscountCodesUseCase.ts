import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';
import type { IUserRepository } from '../../../domain/interfaces/IUserRepository';

/**
 * Admin paneli için tüm indirim kodlarını creator bilgisiyle birlikte listeler.
 * Her kod hangi kullanıcı tarafından (eğitici veya admin) oluşturulduğunu
 * `creatorId`, `creatorUsername`, `creatorEmail`, `creatorRole` alanlarıyla
 * gösterir.
 */
export class ListAllDiscountCodesUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(actorId: string) {
    const user = await this.userRepo.findById(actorId);
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    if (user.role !== 'ADMIN') {
      throw new AppError('USER_NOT_ADMIN', 'Only admin can list all discount codes', 403);
    }

    // Tüm kodlar + creator join
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        code: string;
        percentOff: number;
        maxUses: number | null;
        usedCount: number;
        isActive: boolean;
        validFrom: Date | null;
        validUntil: Date | null;
        description: string | null;
        createdAt: Date;
        createdById: string | null;
        creatorUsername: string | null;
        creatorEmail: string | null;
        creatorRole: string | null;
      }>
    >`SELECT d.id, d.code, d."percentOff", d."maxUses", d."usedCount", d."isActive",
             d."validFrom", d."validUntil", d.description, d."createdAt",
             d."createdById",
             u.username AS "creatorUsername",
             u.email AS "creatorEmail",
             u.role::text AS "creatorRole"
      FROM discount_codes d
      LEFT JOIN users u ON u.id = d."createdById"
      ORDER BY d."createdAt" DESC`;

    return rows.map((d) => ({
      id: d.id,
      code: d.code,
      percentOff: d.percentOff,
      maxUses: d.maxUses,
      usedCount: d.usedCount,
      isActive: d.isActive ?? true,
      validFrom: d.validFrom,
      validUntil: d.validUntil,
      description: d.description,
      createdAt: d.createdAt,
      creatorId: d.createdById,
      creatorUsername: d.creatorUsername,
      creatorEmail: d.creatorEmail,
      creatorRole: d.creatorRole,
    }));
  }
}
