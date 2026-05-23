import { createHash } from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';
import { UpdateUserPreferencesUseCase } from './UpdateUserPreferencesUseCase';

/**
 * 6 haneli OTP'yi doğrular ve hassas profil alanlarını uygular.
 *
 * - code: kullanıcının e-postasına gönderilen 6 hane
 * - phone / website / linkedin: yeni değerler (boş string → alanı sil)
 *
 * Başarılı doğrulama sonrası UpdateUserPreferencesUseCase çağrılır ve OTP state
 * temizlenir. Başarısız doğrulamada OTP state korunur ki kullanıcı bir kez daha
 * deneyebilsin (rate-limit RequestOtp'da var).
 */
const ALLOWED_FIELDS = ['phone', 'website', 'linkedin'] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export class VerifySensitiveProfileChangeUseCase {
  constructor(private readonly updatePrefsUC: UpdateUserPreferencesUseCase) {}

  async execute(
    userId: string,
    input: { code: string; phone?: string; website?: string; linkedin?: string },
  ) {
    if (!userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    const code = (input?.code ?? '').toString().trim();
    if (!/^\d{6}$/.test(code)) {
      throw new AppError('OTP_INVALID', 'Doğrulama kodu 6 hane olmalı', 400);
    }

    const user: any = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, metadata: true },
    });
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);

    const stored = (user.metadata?.sensitiveProfileOtp ?? null) as
      | { hash: string; expiresAt: string }
      | null;
    if (!stored) {
      throw new AppError('OTP_NOT_REQUESTED', 'Önce kod isteyin', 400);
    }
    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      throw new AppError('OTP_EXPIRED', 'Kod süresi doldu, yeni bir kod isteyin', 400);
    }

    const expected = createHash('sha256').update(`${code}:${userId}`).digest('hex');
    if (expected !== stored.hash) {
      throw new AppError('OTP_MISMATCH', 'Kod hatalı', 400);
    }

    // Sadece izin verilen alanları al — diğerlerini görmezden gel
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS as readonly AllowedField[]) {
      if (input[key] !== undefined) updates[key] = input[key];
    }

    // allowSensitive: true — bu use-case OTP doğrulamasını az önce yaptığı için
    // hassas alanların uygulanmasına izin verir.
    const updated = await this.updatePrefsUC.execute(userId, updates, { allowSensitive: true });

    // OTP state'i temizle — tek seferlik kullanım
    const nextMetadata = { ...(user.metadata ?? {}) };
    delete (nextMetadata as any).sensitiveProfileOtp;
    await prisma.user.update({
      where: { id: userId },
      data: { metadata: nextMetadata } as any,
    });

    return { ok: true, preferences: updated };
  }
}
