import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_NO_ORIGIN_KEY } from '../decorators/allow-no-origin.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * OriginProtectionGuard — frontend dışından gelen mutasyon isteklerini reddeder.
 *
 * Katman A: Origin/Referer header'ı CLIENT_URL allowlist'inde olmalı.
 * Katman B: X-Client-App header'ı `sinavsalonu-web/...` ile başlamalı.
 *
 * UYGULANIR:
 *   - POST / PUT / PATCH / DELETE (mutasyon yapan tüm endpoint'ler)
 *
 * UYGULANMAZ:
 *   - GET / HEAD / OPTIONS (CORS preflight ve okuma — bunlar zaten throttle altında)
 *   - @AllowNoOrigin() decorator'lı endpoint'ler (webhook'lar)
 *
 * Bypass maliyeti: Her iki katman da `curl -H` ile geçilebilir. Asıl etki:
 * otomatik scraper / scriptkid / Postman default isteklerini durdurmak.
 * Hedeflenmiş saldırgan bypass eder ama log'da "INVALID_ORIGIN" görünür.
 *
 * Dev ortamında ORIGIN_PROTECTION_DISABLED=1 ile devre dışı bırakılabilir.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CLIENT_APP_PREFIX = 'sinavsalonu-web';

@Injectable()
export class OriginProtectionGuard implements CanActivate {
  private readonly logger = new Logger(OriginProtectionGuard.name);
  private readonly disabled = process.env.ORIGIN_PROTECTION_DISABLED === '1';
  private readonly allowedOrigins: string[];

  constructor(private readonly reflector: Reflector) {
    this.allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ].filter(Boolean) as string[];
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (this.disabled) return true;

    const handler = ctx.getHandler();
    const cls = ctx.getClass();

    // @AllowNoOrigin() ile muaf tutulan endpoint'ler (webhook'lar vb.)
    const allowNoOrigin = this.reflector.getAllAndOverride<boolean>(
      ALLOW_NO_ORIGIN_KEY,
      [handler, cls],
    );
    if (allowNoOrigin) return true;

    const req = ctx.switchToHttp().getRequest();
    const method: string = (req.method || '').toUpperCase();

    // Sadece mutating method'lar kontrol edilir — public GET endpoint'leri
    // ve OPTIONS (CORS preflight) etkilenmez
    if (!MUTATING_METHODS.has(method)) return true;

    // Public ve mutating endpoint'ler bile bu kuraldan geçmek zorunda
    // (örn. /auth/login public ama mutating; yine frontend'den gelmeli)
    void this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, cls]);

    const origin = (req.headers['origin'] as string | undefined) ?? '';
    const referer = (req.headers['referer'] as string | undefined) ?? '';
    const clientApp = (req.headers['x-client-app'] as string | undefined) ?? '';

    // Katman A: Origin veya Referer allowlist'te olmalı
    const originOk = origin && this.allowedOrigins.includes(origin);
    const refererOk = referer && this.allowedOrigins.some((o) => referer.startsWith(o + '/') || referer === o);

    if (!originOk && !refererOk) {
      this.logger.warn(
        `[OriginProtection] REJECT ${method} ${req.url} — origin="${origin}" referer="${referer}" ip=${req.ip}`,
      );
      throw new ForbiddenException({
        code: 'INVALID_ORIGIN',
        message: 'İstek izin verilen bir frontend adresinden gelmiyor.',
      });
    }

    // Katman B: X-Client-App header zorunlu
    if (!clientApp || !clientApp.startsWith(CLIENT_APP_PREFIX)) {
      this.logger.warn(
        `[OriginProtection] REJECT ${method} ${req.url} — missing/invalid X-Client-App="${clientApp}" ip=${req.ip}`,
      );
      throw new ForbiddenException({
        code: 'MISSING_CLIENT_HEADER',
        message: 'X-Client-App header bekleniyor.',
      });
    }

    return true;
  }
}
