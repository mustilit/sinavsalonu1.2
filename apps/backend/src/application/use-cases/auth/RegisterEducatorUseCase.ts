import { randomUUID } from 'crypto';
import { User, UserPublic } from '../../../domain/entities/User';
import type { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import type { IContractRepository } from '../../../domain/interfaces/IContractRepository';
import type { IContractAcceptanceRepository } from '../../../domain/interfaces/IContractAcceptanceRepository';
import type { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';
import { PasswordService } from '../../../infrastructure/services/PasswordService';
import { JwtService } from '../../../infrastructure/services/JwtService';
import { AppError } from '../../errors/AppError';
import { prisma } from '../../../infrastructure/database/prisma';

/**
 * FR-E-01: Eğitici kaydı ve sözleşme onayı.
 * - Kullanıcı EDUCATOR rolüyle ve PENDING_EDUCATOR_APPROVAL statüsüyle oluşturulur.
 * - Admin onayı gerektiğinden hesap hemen aktif olmaz.
 * - Aktif EDUCATOR sözleşmesi otomatik kabul edilir; audit kaydı oluşturulur.
 * - firstName ve lastName **zorunludur** (aday kaydından farklı olarak).
 * - CV ve uzmanlık alanları ise post-verification onboarding adımında istenir.
 */
export class RegisterEducatorUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly contractRepo: IContractRepository,
    private readonly acceptanceRepo: IContractAcceptanceRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ user: UserPublic; token: string }> {
    // Zorunlu alan doğrulaması
    const firstName = (dto.firstName ?? '').trim();
    const lastName = (dto.lastName ?? '').trim();
    if (!firstName) throw new AppError('FIRSTNAME_REQUIRED', 'Ad gereklidir', 400);
    if (!lastName) throw new AppError('LASTNAME_REQUIRED', 'Soyad gereklidir', 400);
    if (firstName.length < 2 || firstName.length > 50) {
      throw new AppError('FIRSTNAME_INVALID', 'Ad 2-50 karakter olmalı', 400);
    }
    if (lastName.length < 2 || lastName.length > 50) {
      throw new AppError('LASTNAME_INVALID', 'Soyad 2-50 karakter olmalı', 400);
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user: User = {
      id: randomUUID(),
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
      role: 'EDUCATOR',
      status: 'PENDING_EDUCATOR_APPROVAL',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await this.userRepo.save(user);

    // firstName/lastName User entity tarafında olmadığı için repository.save bunları yazmaz.
    // Schema'ya yeni eklenen kolonları doğrudan Prisma ile güncelle (ek tour gerektirmeden).
    await (prisma as any).user.update({
      where: { id: saved.id },
      data: { firstName, lastName },
    });

    // Aktif EDUCATOR sözleşmesi zorunludur
    const contract = await this.contractRepo.getActiveByType('EDUCATOR');
    if (!contract || !contract.isActive) {
      throw new AppError('CONTRACT_NOT_AVAILABLE', 'Active educator contract not found', 400);
    }

    const existingAcceptance = await this.acceptanceRepo.findByUserAndContract(saved.id, contract.id);
    if (!existingAcceptance) {
      await this.acceptanceRepo.create({
        userId: saved.id,
        contractId: contract.id,
      });
      try {
        await this.auditRepo.create({
          action: 'CONTRACT_ACCEPTED',
          entityType: 'CONTRACT',
          entityId: contract.id,
          actorId: saved.id,
          metadata: { type: 'EDUCATOR' },
        });
      } catch {
        /* best-effort */
      }
    }

    // Tek aktif oturum — kayıt sonrası kullanıcıya verilen token'ın session ID'si
    // User.activeSessionId'ye yazılır. Sonraki bir login'de bu invalidate olur.
    const sid = randomUUID();
    await prisma.user.update({
      where: { id: saved.id },
      data: { activeSessionId: sid } as any,
    });
    const token = this.jwtService.sign({ sub: saved.id, email: saved.email, role: saved.role, sid });
    return { user: this.toPublic(saved), token };
  }

  private toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
