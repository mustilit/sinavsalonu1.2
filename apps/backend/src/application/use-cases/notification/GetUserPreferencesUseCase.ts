import { AppError } from '../../errors/AppError';
import type { IUserPreferenceRepository } from '../../../domain/interfaces/IUserPreferenceRepository';
import { decryptPreferencesPII } from './UpdateUserPreferencesUseCase';

/**
 * Kullanıcının tercihler JSON'ını döner.
 * Tercihler: tema, dil, interested_exam_types, onboarding flags, IBAN, biyografi vb.
 * Kayıt yoksa boş obje ({}) ile fail-open çalışır.
 *
 * Hassas alanlar (phone, iban, bankName, accountHolder) DB'de AES-GCM ile
 * şifreli saklanır; bu endpoint sadece OWNER'a açık olduğu için decrypt edilip
 * formda gösterilecek plain değer döndürülür.
 */
export class GetUserPreferencesUseCase {
  constructor(private readonly repo: IUserPreferenceRepository) {}

  async execute(userId: string | undefined): Promise<Record<string, unknown>> {
    if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    const pref = await this.repo.findByUserId(userId);
    if (!pref?.preferences) return {};
    return decryptPreferencesPII(pref.preferences as Record<string, unknown>);
  }
}
