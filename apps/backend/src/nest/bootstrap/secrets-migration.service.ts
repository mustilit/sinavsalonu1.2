import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { encryptStoredSecret, isEncrypted } from '../../application/services/security/SecretsVault';

// SecretsMigrationService: bootstrap'ta legacy plain secret degerlerini
// sifreli forma migrate eder (idempotent).
//
// AdminSettings.turnstileSecretKey + PaymentSettings.iyzico* / googlePay* /
// amazonPay* alanlari baslangicta plain saklaniyordu. Her acilista bu service
// satiri okur, "enc:v1:" prefix yoksa sifreler ve yazar.
//
// Sifreleme anahtari (EMAIL_SECRETS_KEY) yoksa skip edilir (uyari log).

@Injectable()
export class SecretsMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SecretsMigrationService.name);

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!process.env.EMAIL_SECRETS_KEY) {
      this.logger.warn('[SecretsMigration] EMAIL_SECRETS_KEY tanimli degil, migration atlandi.');
      return;
    }

    try {
      await this.migrateAdminSettings();
    } catch (err: any) {
      this.logger.warn(`[SecretsMigration] admin_settings migrate hatasi: ${err?.message ?? err}`);
    }
    try {
      await this.migratePaymentSettings();
    } catch (err: any) {
      this.logger.warn(`[SecretsMigration] payment_settings migrate hatasi: ${err?.message ?? err}`);
    }
    try {
      await this.migrateUserPreferencesPII();
    } catch (err: any) {
      this.logger.warn(`[SecretsMigration] user_preferences PII migrate hatasi: ${err?.message ?? err}`);
    }
  }

  private async migrateAdminSettings(): Promise<void> {
    const rows = await (this.prisma as any).$queryRaw`
      SELECT "turnstileSecretKey" FROM admin_settings WHERE id = 1
    ` as Array<Record<string, string | null>>;
    if (!rows?.length) return;
    const row = rows[0];

    const val = row.turnstileSecretKey;
    if (val && !isEncrypted(val)) {
      const enc = encryptStoredSecret(val);
      if (enc && enc !== val) {
        await (this.prisma as any).$executeRaw`UPDATE admin_settings SET "turnstileSecretKey" = ${enc} WHERE id = 1`;
        this.logger.log('[SecretsMigration] admin_settings.turnstileSecretKey sifrelendi');
      }
    }
  }

  private async migratePaymentSettings(): Promise<void> {
    let rows: Array<Record<string, string | null>> = [];
    try {
      rows = await (this.prisma as any).$queryRaw`
        SELECT "iyzicoApiKey", "iyzicoSecretKey", "googlePayMerchantId", "amazonPayMerchantId"
        FROM payment_settings WHERE id = 1
      `;
    } catch {
      return;
    }
    if (!rows?.length) return;
    const row = rows[0];

    const migrated: string[] = [];

    if (row.iyzicoApiKey && !isEncrypted(row.iyzicoApiKey)) {
      const enc = encryptStoredSecret(row.iyzicoApiKey);
      if (enc && enc !== row.iyzicoApiKey) {
        await (this.prisma as any).$executeRaw`UPDATE payment_settings SET "iyzicoApiKey" = ${enc} WHERE id = 1`;
        migrated.push('iyzicoApiKey');
      }
    }
    if (row.iyzicoSecretKey && !isEncrypted(row.iyzicoSecretKey)) {
      const enc = encryptStoredSecret(row.iyzicoSecretKey);
      if (enc && enc !== row.iyzicoSecretKey) {
        await (this.prisma as any).$executeRaw`UPDATE payment_settings SET "iyzicoSecretKey" = ${enc} WHERE id = 1`;
        migrated.push('iyzicoSecretKey');
      }
    }
    if (row.googlePayMerchantId && !isEncrypted(row.googlePayMerchantId)) {
      const enc = encryptStoredSecret(row.googlePayMerchantId);
      if (enc && enc !== row.googlePayMerchantId) {
        await (this.prisma as any).$executeRaw`UPDATE payment_settings SET "googlePayMerchantId" = ${enc} WHERE id = 1`;
        migrated.push('googlePayMerchantId');
      }
    }
    if (row.amazonPayMerchantId && !isEncrypted(row.amazonPayMerchantId)) {
      const enc = encryptStoredSecret(row.amazonPayMerchantId);
      if (enc && enc !== row.amazonPayMerchantId) {
        await (this.prisma as any).$executeRaw`UPDATE payment_settings SET "amazonPayMerchantId" = ${enc} WHERE id = 1`;
        migrated.push('amazonPayMerchantId');
      }
    }

    if (migrated.length) {
      this.logger.log(`[SecretsMigration] payment_settings: ${migrated.join(', ')} sifrelendi`);
    }
  }

  /**
   * UserPreference.preferences JSON icindeki PII alanlarini (phone, iban,
   * bankName, accountHolder) sifreler. Tum kullanicilarin tercihlerini tarar;
   * sadece plain (sifresiz) string degeri olan alanlar guncellenir.
   */
  private async migrateUserPreferencesPII(): Promise<void> {
    const PII_KEYS = ['phone', 'iban', 'bankName', 'accountHolder'] as const;

    // Tum tercihleri tek seferde cek (toplam kullanici sayisi genellikle yonetilebilir).
    const rows: Array<{ userId: string; preferences: any }> = await (this.prisma as any).$queryRaw`
      SELECT "userId", preferences FROM user_preferences
    `;
    if (!rows?.length) return;

    let migratedRowCount = 0;
    let migratedFieldCount = 0;
    for (const r of rows) {
      const prefs = (r.preferences ?? {}) as Record<string, unknown>;
      let touched = false;
      const next: Record<string, unknown> = { ...prefs };
      for (const k of PII_KEYS) {
        const v = next[k];
        if (typeof v === 'string' && v.trim() && !isEncrypted(v)) {
          const enc = encryptStoredSecret(v);
          if (enc && enc !== v) {
            next[k] = enc;
            touched = true;
            migratedFieldCount++;
          }
        }
      }
      if (touched) {
        await (this.prisma as any).userPreference.update({
          where: { userId: r.userId },
          data: { preferences: next as any },
        });
        migratedRowCount++;
      }
    }

    if (migratedRowCount) {
      this.logger.log(`[SecretsMigration] user_preferences: ${migratedRowCount} kullanici, ${migratedFieldCount} alan sifrelendi`);
    }
  }
}
