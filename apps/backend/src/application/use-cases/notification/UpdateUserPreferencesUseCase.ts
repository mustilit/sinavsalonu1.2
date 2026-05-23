import { AppError } from '../../errors/AppError';
import type { IUserPreferenceRepository } from '../../../domain/interfaces/IUserPreferenceRepository';

/**
 * Güvenli güncelleme için izin verilen preferences alanları.
 * Bu listede olmayan hiçbir anahtar işlenmez — injection ve yetki yükseltme engellenir.
 * Yeni alan eklenecekse buraya da eklenmeli.
 */
const WHITELIST = [
  'theme', 'layout', 'fontSize', 'sidebarCollapsed',
  'phone', 'city', 'website', 'linkedin', 'interested_exam_types', 'notification_preferences',
  'education', 'bio', 'google_scholar_url', 'cv_url', 'profile_image_url', 'specialized_exam_types',
  'educator_status', 'rejection_reason', 'role',
  'iban', 'bankName', 'accountHolder',
  // Onboarding tur tamamlama bayrakları
  'ob_cand_welcome', 'ob_cand_test', 'ob_edu_welcome', 'ob_edu_create',
];

/**
 * Hassas iletişim alanları — yalnızca OTP doğrulamasından geçtikten sonra
 * uygulanır. Doğrudan PATCH /me/preferences çağrısı bunları görmezden gelir.
 * VerifySensitiveProfileChangeUseCase `allowSensitive: true` flag'i ile
 * UpdateUserPreferencesUseCase'i çağırır.
 */
const SENSITIVE_FIELDS = new Set(['phone', 'website', 'linkedin']);

/**
 * Kullanıcı tercihlerini günceller. Sadece WHITELIST'teki alanlar işlenir.
 * Mevcut preferences ile merge edilir (patch semantiği — tam üzerine yazmaz).
 *
 * @param options.allowSensitive default false. Sadece OTP-doğrulanmış akıştan
 *   çağrılırken true verilir; aksi halde phone/website/linkedin sessiz strip edilir.
 */
export class UpdateUserPreferencesUseCase {
  constructor(private readonly repo: IUserPreferenceRepository) {}

  async execute(
    userId: string | undefined,
    input: Record<string, unknown>,
    options: { allowSensitive?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    const allowSensitive = options.allowSensitive === true;

    // Whitelist dışındaki anahtarları + (OTP'siz çağrıda) hassas alanları filtrele
    const filtered: Record<string, unknown> = {};
    for (const k of Object.keys(input)) {
      if (!WHITELIST.includes(k)) continue;
      if (!allowSensitive && SENSITIVE_FIELDS.has(k)) continue;
      filtered[k] = input[k];
    }
    // Güncellenecek geçerli alan yoksa mevcut preferences'ı döndür
    if (Object.keys(filtered).length === 0) {
      const existing = await this.repo.findByUserId(userId);
      return existing?.preferences ?? {};
    }

    const existing = await this.repo.findByUserId(userId);
    // Mevcut değerleri koru; yeni değerleri üstüne ekle (deep merge değil, shallow merge)
    const merged = { ...(existing?.preferences ?? {}), ...filtered };
    const updated = await this.repo.upsert(userId, merged);
    return updated.preferences;
  }
}
