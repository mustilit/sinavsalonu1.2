import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_CAPTCHA_KEY } from '../decorators/require-captcha.decorator';
import { TurnstileVerifier } from '../../application/services/security/TurnstileVerifier';

/**
 * CaptchaGuard — @RequireCaptcha() decorator'lı endpoint'lerde Cloudflare
 * Turnstile token doğrular.
 *
 * Token kaynağı (önce body, sonra header):
 *   1. req.body.turnstileToken
 *   2. req.headers['x-turnstile-token']
 *
 * Doğrulama başarısızsa 403 CAPTCHA_FAILED döner. Dev modda (secret env yoksa)
 * verifier her token'ı geçer.
 */
@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly logger = new Logger(CaptchaGuard.name);
  private readonly verifier: TurnstileVerifier;

  constructor(private readonly reflector: Reflector) {
    this.verifier = new TurnstileVerifier();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CAPTCHA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest();
    const token: string =
      req.body?.turnstileToken ||
      (req.headers['x-turnstile-token'] as string) ||
      '';

    const ip = (req.ip as string)
      || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || undefined;

    const ok = await this.verifier.verify(token, ip);
    if (!ok) {
      this.logger.warn(`[CaptchaGuard] REJECT ${req.method} ${req.url} — token invalid/missing ip=${ip}`);
      throw new ForbiddenException({
        code: 'CAPTCHA_FAILED',
        message: 'Bot doğrulaması başarısız. Lütfen sayfayı yenileyip tekrar deneyin.',
      });
    }
    return true;
  }
}
