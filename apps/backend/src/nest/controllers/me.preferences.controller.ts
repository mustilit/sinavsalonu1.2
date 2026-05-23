import { Controller, Get, Patch, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { GetUserPreferencesUseCase } from '../../application/use-cases/notification/GetUserPreferencesUseCase';
import { UpdateUserPreferencesUseCase } from '../../application/use-cases/notification/UpdateUserPreferencesUseCase';
import { RequestSensitiveProfileOtpUseCase } from '../../application/use-cases/notification/RequestSensitiveProfileOtpUseCase';
import { VerifySensitiveProfileChangeUseCase } from '../../application/use-cases/notification/VerifySensitiveProfileChangeUseCase';
import { PrismaUserPreferenceRepository } from '../../infrastructure/repositories/PrismaUserPreferenceRepository';

/**
 * Kullanıcının UI tercihlerini (onboarding durumu, tema vb.) okur ve günceller.
 * Tüm roller erişebilir; güncelleme için WHITELIST kontrolü use-case katmanında yapılır.
 */
@Controller('me')
@ApiTags('me')
export class MePreferencesController {
  @Get('preferences')
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'User UI preferences' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async get(@Req() req: any) {
    const userId = (req as any).user?.id ?? (req as any).user?.sub;
    const repo = new PrismaUserPreferenceRepository();
    const uc = new GetUserPreferencesUseCase(repo);
    return uc.execute(userId);
  }

  @Patch('preferences')
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Preferences updated' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async update(@Req() req: any, @Body() body: Record<string, unknown>) {
    const userId = (req as any).user?.id ?? (req as any).user?.sub;
    const repo = new PrismaUserPreferenceRepository();
    const uc = new UpdateUserPreferencesUseCase(repo);
    // allowSensitive default false → phone/website/linkedin silently stripped.
    // Bu alanlar yalnızca /me/preferences/sensitive/verify üzerinden değişebilir.
    return uc.execute(userId, body);
  }

  /**
   * Hassas profil alanları (telefon, website, LinkedIn) için doğrulama kodu iste.
   * 6 haneli kod kullanıcının e-postasına gönderilir, 10 dakika geçerli.
   */
  @Post('preferences/sensitive/request')
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'OTP sent to user email' })
  async requestSensitiveOtp(@Req() req: any) {
    const userId = (req as any).user?.id ?? (req as any).user?.sub;
    const uc = new RequestSensitiveProfileOtpUseCase();
    return uc.execute(userId);
  }

  /**
   * 6 haneli kodu doğrula ve hassas alanları uygula.
   * Body: { code, phone?, website?, linkedin? }
   */
  @Post('preferences/sensitive/verify')
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Sensitive fields applied' })
  async verifySensitive(
    @Req() req: any,
    @Body() body: { code: string; phone?: string; website?: string; linkedin?: string },
  ) {
    const userId = (req as any).user?.id ?? (req as any).user?.sub;
    const repo = new PrismaUserPreferenceRepository();
    const updatePrefsUC = new UpdateUserPreferencesUseCase(repo);
    const uc = new VerifySensitiveProfileChangeUseCase(updatePrefsUC);
    return uc.execute(userId, body);
  }
}
