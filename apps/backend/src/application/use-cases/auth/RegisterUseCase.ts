import { randomUUID } from 'crypto';
import { User, UserPublic } from '../../../domain/entities/User';
import { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import type { IContractRepository } from '../../../domain/interfaces/IContractRepository';
import type { IContractAcceptanceRepository } from '../../../domain/interfaces/IContractAcceptanceRepository';
import type { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';
import { PasswordService } from '../../../infrastructure/services/PasswordService';
import { AppError } from '../../errors/AppError';

/**
 * Aday (CANDIDATE) kullanıcı kaydını gerçekleştirir.
 *
 * Sprint 14 — Sözleşme onayı zorunluluğu:
 *   Üye kayıt formunda iki sözleşme kabulü ZORUNLUDUR:
 *     - CANDIDATE (Üyelik / Kullanım Sözleşmesi)
 *     - PRIVACY   (KVKK Aydınlatma Metni)
 *   Frontend `acceptedTermsContractId` ve `acceptedPrivacyContractId` gönderir.
 *   ID'ler aktif sözleşme ID'leriyle eşleşmezse 400 döner — eski versiyona
 *   onay verilemez, geçerli yasal kanıt zinciri için aktif sözleşme şart.
 *
 * Kayıt sonrası hesap hemen ACTIVE olur — eğiticilerden farklı olarak onay gerekmez.
 */
export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
    /**
     * Sprint 14 — Sözleşme zorlamak için. Opsiyonel: DI verilmediği test
     * senaryolarında acceptance step'i atlanır (backward compatible). Production
     * DI container her zaman verir, böylece akış zorunlu.
     */
    private readonly contractRepo?: IContractRepository,
    private readonly acceptanceRepo?: IContractAcceptanceRepository,
    private readonly auditRepo?: IAuditLogRepository,
  ) {}

  /**
   * Yeni bir aday hesabı oluşturur.
   *
   * @param dto.email                       - Kullanıcının e-posta adresi (küçük harfe dönüştürülür).
   * @param dto.username                    - Kullanıcı adı.
   * @param dto.password                    - Şifre (hash'lenerek saklanır).
   * @param dto.acceptedTermsContractId     - Sprint 14: Aktif CANDIDATE contract ID (üyelik sözleşmesi).
   * @param dto.acceptedPrivacyContractId   - Sprint 14: Aktif PRIVACY contract ID (KVKK aydınlatma).
   * @param ctx.ip                          - IP adresi (delil için ContractAcceptance.ip'ye yazılır).
   * @param ctx.userAgent                   - User-Agent (delil için saklanır).
   * @returns Kaydedilen kullanıcının public bilgileri (passwordHash içermez).
   * @throws TERMS_NOT_ACCEPTED — contract ID'leri verilmediyse veya geçersiz ID.
   */
  async execute(
    dto: {
      email: string;
      username: string;
      password: string;
      acceptedTermsContractId?: string;
      acceptedPrivacyContractId?: string;
    },
    ctx?: { ip?: string; userAgent?: string },
  ): Promise<UserPublic> {
    // Sözleşme zorlaması — DI verilmişse contract kontrolü yap
    let activeTerms: { id: string } | null = null;
    let activePrivacy: { id: string } | null = null;
    if (this.contractRepo && this.acceptanceRepo) {
      activeTerms = await this.contractRepo.getActiveByType('CANDIDATE');
      activePrivacy = await this.contractRepo.getActiveByType('PRIVACY');
      if (!activeTerms || !activePrivacy) {
        // Sistem hatası — admin yasal metinleri seed/yayımlamamış. Üyelik kapatılır.
        throw new AppError(
          'CONTRACTS_NOT_AVAILABLE',
          'Aktif üyelik veya gizlilik sözleşmesi bulunamadı — sistem yöneticisine başvurun',
          503,
        );
      }
      if (
        !dto.acceptedTermsContractId ||
        !dto.acceptedPrivacyContractId ||
        dto.acceptedTermsContractId !== activeTerms.id ||
        dto.acceptedPrivacyContractId !== activePrivacy.id
      ) {
        throw new AppError(
          'TERMS_NOT_ACCEPTED',
          'Üyelik sözleşmesi ve KVKK aydınlatma metni kabulü zorunludur',
          400,
        );
      }
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    // Aday rolüyle ve hemen aktif statüsüyle oluşturulur
    const user: User = {
      id: randomUUID(),
      email: dto.email.toLowerCase(),
      username: dto.username,
      passwordHash,
      role: 'CANDIDATE',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await this.userRepository.save(user);

    // Sözleşme acceptance kayıtları — kullanıcı oluşturulduktan sonra.
    // İdempotent: aynı kullanıcı + contract için tek kayıt (unique constraint).
    if (this.acceptanceRepo && activeTerms && activePrivacy) {
      for (const contract of [activeTerms, activePrivacy]) {
        await this.acceptanceRepo.create({
          userId: saved.id,
          contractId: contract.id,
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        });
        if (this.auditRepo) {
          try {
            await this.auditRepo.create({
              action: 'CONTRACT_ACCEPTED',
              entityType: 'CONTRACT',
              entityId: contract.id,
              actorId: saved.id,
              metadata: { during: 'register', role: 'CANDIDATE' },
            });
          } catch {
            /* best-effort */
          }
        }
      }
    }

    return this.toPublic(saved);
  }

  /** Kullanıcı entity'sini güvenli public tipine dönüştürür (passwordHash dahil edilmez). */
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
