import { Logger } from '@nestjs/common';
import { prisma } from '../../../infrastructure/database/prisma';
import { decryptStoredSecret } from './SecretsVault';

/**
 * Cloudflare Turnstile token doğrulayıcı.
 *
 * Secret key kaynağı (öncelik sırasıyla):
 *   1. AdminSettings.turnstileSecretKey (admin panelinden yönetilir)
 *   2. process.env.TURNSTILE_SECRET_KEY (env fallback)
 *
 * Her ikisi de boşsa CAPTCHA devre dışı — verify() her zaman true döner.
 * Bu sayede sistem yöneticisi anahtarları yazana kadar login/register
 * normal akışta çalışır.
 *
 * Secret 60 saniye in-memory cache ile saklanır; admin paneli güncellemesi
 * en geç 1 dakika içinde devreye girer.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CACHE_TTL_MS = 60_000;

let cachedSecret: { value: string | null; fetchedAt: number } | null = null;

export class TurnstileVerifier {
  private readonly logger = new Logger(TurnstileVerifier.name);
  private warnedDisabled = false;

  /** Aktif secret'i döner (DB > env > null). 60 sn cache'li. */
  private async getSecret(): Promise<string | null> {
    if (cachedSecret && Date.now() - cachedSecret.fetchedAt < CACHE_TTL_MS) {
      return cachedSecret.value;
    }
    let dbSecret: string | null = null;
    try {
      const rows = await prisma.$queryRaw<Array<{ turnstileSecretKey: string | null }>>`
        SELECT "turnstileSecretKey" FROM admin_settings WHERE id = 1
      `;
      // DB değeri şifreli olabilir (enc:v1:...) veya legacy plain. Vault otomatik
      // ayırt eder ve plain'i döndürür.
      dbSecret = decryptStoredSecret(rows?.[0]?.turnstileSecretKey ?? null);
    } catch {
      // DB hatası - cache'i invalidate etme, env fallback'e geç
    }
    const envSecret = (process.env.TURNSTILE_SECRET_KEY ?? '').trim();
    const value = (dbSecret && dbSecret.trim()) || envSecret || null;
    cachedSecret = { value, fetchedAt: Date.now() };
    return value;
  }

  /**
   * Cache'i manuel temizler. Admin update sonrası çağrılabilir; çağrılmasa
   * bile cache 60 sn içinde otomatik tazelenir.
   */
  static invalidateCache(): void {
    cachedSecret = null;
  }

  /**
   * Token'ı doğrular.
   * @param token cf-turnstile-response (frontend submit)
   * @param remoteIp Opsiyonel
   * @returns true = geçerli VEYA CAPTCHA devre dışı; false = invalid token
   */
  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const secret = await this.getSecret();
    if (!secret) {
      if (!this.warnedDisabled) {
        this.logger.warn('[Turnstile] turnstileSecretKey boş — CAPTCHA devre dışı. Admin panel → Entegrasyonlar sekmesinden anahtar girilebilir.');
        this.warnedDisabled = true;
      }
      return true;
    }
    if (!token || typeof token !== 'string') return false;

    try {
      const body = new URLSearchParams();
      body.set('secret', secret);
      body.set('response', token);
      if (remoteIp) body.set('remoteip', remoteIp);

      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });
      const data: any = await res.json();
      const success = data?.success === true;
      if (!success) {
        this.logger.warn(`[Turnstile] Doğrulama başarısız: ${JSON.stringify(data?.['error-codes'] ?? data)}`);
      }
      return success;
    } catch (err: any) {
      this.logger.error(`[Turnstile] Doğrulama hatası: ${err?.message ?? err}`);
      return false;
    }
  }
}
