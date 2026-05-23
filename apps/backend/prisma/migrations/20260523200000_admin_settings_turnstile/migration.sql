-- Cloudflare Turnstile entegrasyonu için admin yönetilen anahtarlar.
-- Boş bırakılırsa CAPTCHA devre dışı (login/register normal akıştan geçer).

ALTER TABLE "admin_settings"
  ADD COLUMN "turnstileSiteKey"   TEXT,
  ADD COLUMN "turnstileSecretKey" TEXT;
