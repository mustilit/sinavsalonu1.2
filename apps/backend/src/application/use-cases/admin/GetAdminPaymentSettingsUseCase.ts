import { prisma } from '../../../infrastructure/database/prisma';
import { maskStoredSecret } from '../../services/security/SecretsVault';

/**
 * Admin tarafı ödeme ayarları — UI için maskelenmiş anahtar gösterimi.
 *
 * GİZLİLİK: API anahtarı + secret key + merchant ID asla plain dönmez.
 * Admin sadece "tanımlı mı?" + maskelenmiş önek görür ("0x4A•••ABCD").
 * Backend (örn. iyzico payment flow) gerçek değeri decryptStoredSecret ile
 * okur — bu use-case kullanıcı arayüzü içindir.
 */
export class GetAdminPaymentSettingsUseCase {
  async execute() {
    const s = await (prisma as any).paymentSettings.findFirst({ where: { id: 1 } });
    return {
      mode:                s?.mode                  ?? 'test',
      // iyzico — maskelenmiş gösterim
      iyzicoEnabled:       s?.iyzicoEnabled         ?? true,
      iyzicoApiKey:        maskStoredSecret(s?.iyzicoApiKey).masked     || '',
      iyzicoSecretKey:     maskStoredSecret(s?.iyzicoSecretKey).masked  || '',
      iyzicoBaseUrl:       s?.iyzicoBaseUrl         ?? 'https://sandbox-api.iyzipay.com',
      // Google Pay
      googlePayEnabled:    s?.googlePayEnabled      ?? true,
      googlePayMerchantId: maskStoredSecret(s?.googlePayMerchantId).masked  || '',
      // Amazon Pay
      amazonPayEnabled:    s?.amazonPayEnabled      ?? true,
      amazonPayMerchantId: maskStoredSecret(s?.amazonPayMerchantId).masked  || '',
      // Firma (gizli değil)
      companyName:         s?.companyName           ?? '',
      companyTaxId:        s?.companyTaxId          ?? '',
      companyAddress:      s?.companyAddress        ?? '',
    };
  }
}
