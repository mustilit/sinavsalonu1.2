import { prisma } from '../../../infrastructure/database/prisma';
import { encryptStoredSecret } from '../../services/security/SecretsVault';

/**
 * Payment Settings güncellemesi.
 * Gizli alanlar (iyzicoApiKey, iyzicoSecretKey, googlePayMerchantId,
 * amazonPayMerchantId) SecretsVault ile AES-GCM şifrelenerek saklanır.
 * Merchant ID'ler aslında public sayılır ama yine de şifreliyoruz —
 * tutarlı pattern + DB sızıntısında en az iz.
 */
const SECRET_FIELDS = new Set([
  'iyzicoApiKey',
  'iyzicoSecretKey',
  'googlePayMerchantId',
  'amazonPayMerchantId',
]);

export class UpdatePaymentSettingsUseCase {
  async execute(data: {
    mode?: string;
    iyzicoEnabled?: boolean;
    iyzicoApiKey?: string;
    iyzicoSecretKey?: string;
    googlePayEnabled?: boolean;
    googlePayMerchantId?: string;
    amazonPayEnabled?: boolean;
    amazonPayMerchantId?: string;
    companyName?: string;
    companyTaxId?: string;
    companyAddress?: string;
  }) {
    // undefined olan alanları at, hassas alanları şifrele
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (SECRET_FIELDS.has(k)) {
        filtered[k] = typeof v === 'string' ? encryptStoredSecret(v) : v;
      } else {
        filtered[k] = v;
      }
    }
    return (prisma as any).paymentSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...filtered },
      update: filtered,
    });
  }
}
