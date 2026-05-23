import { SetMetadata } from '@nestjs/common';

/**
 * Endpoint'in CaptchaGuard tarafından Cloudflare Turnstile token doğrulaması
 * yapmasını zorunlu kılar.
 *
 * Frontend ilgili form'da Turnstile widget'ı render eder; aday/eğitici
 * kullanıcı arayüzünde görünmez (sadece anomali durumunda challenge çıkar).
 * Token submit body'de `turnstileToken` alanı veya `X-Turnstile-Token` header
 * olarak gönderilir.
 *
 * Uygulanması gereken endpoint örnekleri:
 *   - POST /auth/login
 *   - POST /auth/register
 *   - POST /purchases/:testId
 *   - POST /marketplace/packages/:id/reviews
 *
 * Dev modda TURNSTILE_SECRET_KEY env'i boşsa CaptchaGuard her isteği geçer.
 */
export const REQUIRE_CAPTCHA_KEY = 'requireCaptcha';
export const RequireCaptcha = () => SetMetadata(REQUIRE_CAPTCHA_KEY, true);
