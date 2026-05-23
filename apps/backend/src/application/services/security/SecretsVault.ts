import { encryptSecret, decryptSecret } from '../email/utils/encryption';

/**
 * SecretsVault — admin yönetilen gizli alanlar (Turnstile secret, iyzico API
 * key/secret vb.) için şifreleme katmanı.
 *
 * Şifreleme: AES-256-GCM (mevcut email modülünün utility'si).
 * Anahtar: process.env.EMAIL_SECRETS_KEY (64 hex karakter).
 *
 * Saklanan format:
 *   - Şifreli değer: "enc:v1:<base64>"  → versionable prefix
 *   - Eski plain değerler: "<raw>"      → prefix yok, geriye dönük uyum
 *
 * Bu sayede:
 *   - Yeni yazılan değerler hep şifreli
 *   - Eski plain değerler okunabilir (legacy)
 *   - Bir kez "re-encrypt" çağrıldığında migrate edilir
 *
 * Anahtar yoksa (dev'de) graceful fallback: değerler plain saklanır,
 * uyarı log'lanır. Üretimde key set edilmiş olmalı (encryptOrThrow ile zorla).
 */
const PREFIX = 'enc:v1:';

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Plain veya zaten şifreli değeri şifreli forma çevirir.
 * - null/undefined/boş → null döner
 * - Zaten şifreli → değişmeden döner (idempotent)
 * - Plain → şifrelenip prefix eklenir
 * - Anahtar yoksa: uyarı + plain'i geri döner (dev fallback)
 */
export function encryptStoredSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (isEncrypted(trimmed)) return trimmed;
  try {
    return PREFIX + encryptSecret(trimmed);
  } catch (err) {
    // Anahtar eksik veya geçersiz — uyarı + plain dön. Üretimde aksi gerekirse
    // ENV `SECRETS_REQUIRE_ENCRYPTION=1` ile burayı throw'a çevirebiliriz.
    if (process.env.SECRETS_REQUIRE_ENCRYPTION === '1') throw err;
    // eslint-disable-next-line no-console
    console.warn('[SecretsVault] EMAIL_SECRETS_KEY eksik — plain saklandı:', (err as Error)?.message);
    return trimmed;
  }
}

/**
 * Şifreli değeri plain'e çevirir.
 * - null/boş → null
 * - Prefix'siz (legacy plain) → değişmeden döner
 * - Prefix'li → decrypt edilir; başarısızsa null
 */
export function decryptStoredSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value);
  if (!s) return null;
  if (!isEncrypted(s)) return s; // legacy plain
  try {
    return decryptSecret(s.slice(PREFIX.length));
  } catch {
    return null;
  }
}

/**
 * UI'ya dönerken kullanılır: ham değer asla görünmez, sadece var/yok + maske.
 */
export function maskStoredSecret(value: string | null | undefined): {
  isSet: boolean;
  masked: string;
} {
  const plain = decryptStoredSecret(value);
  if (!plain) return { isSet: false, masked: '' };
  if (plain.length <= 8) return { isSet: true, masked: '••••' };
  return {
    isSet: true,
    masked: `${plain.slice(0, 4)}•••${plain.slice(-4)}`,
  };
}
