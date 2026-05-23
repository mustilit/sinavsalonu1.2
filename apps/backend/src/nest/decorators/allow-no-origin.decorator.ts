import { SetMetadata } from '@nestjs/common';

/**
 * Webhook ve callback endpoint'lerini OriginProtectionGuard'dan muaf tutar.
 *
 * Stripe / Brevo / iyzico gibi dış servisler X-Client-App header'ı veya
 * frontend Origin'ı gönderemez — kendi imza doğrulamalarıyla korunurlar
 * (örn. Stripe-Signature, Brevo HMAC). Bu decorator o endpoint'lere
 * "Origin/Referer + X-Client-App zorunluluğunu atla" der.
 *
 * KULLANIM:
 *   @AllowNoOrigin()
 *   @Post('webhook')
 *   async handleWebhook(...) { ... }
 */
export const ALLOW_NO_ORIGIN_KEY = 'allowNoOrigin';
export const AllowNoOrigin = () => SetMetadata(ALLOW_NO_ORIGIN_KEY, true);
