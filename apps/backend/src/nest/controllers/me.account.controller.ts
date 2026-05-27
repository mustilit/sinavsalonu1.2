import { Controller, Delete, Body, Req, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { DeleteMyAccountUseCase } from '../../application/use-cases/auth/DeleteMyAccountUseCase';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * KVKK/GDPR uyumlu hesap silme endpoint'i.
 *
 * Frontend (ProfileSettings sayfası) kullanıcıya bir onay diyaloğu
 * gösterir: "Hesabınız ve PII verileriniz silinecek. Bu işlem geri alınamaz."
 * Aday "Evet, sil" der → bu endpoint çağrılır.
 *
 * Token (JWT) silindikten hemen sonra geçersiz olur — kullanıcı her isteğinde 401.
 */
export class DeleteMyAccountBodyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  reason?: string;

  /** Önemli aksiyon koruması — Frontend'de re-auth modal'ı zaten gösterir */
  @IsOptional()
  @IsString()
  passwordConfirmation?: string;
}

@Controller('me/account')
@ApiTags('me')
@ApiBearerAuth('bearer')
export class MeAccountController {
  constructor(@Inject(DeleteMyAccountUseCase) private readonly deleteUC: DeleteMyAccountUseCase) {}

  @Delete()
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN', 'WORKER')
  @ApiOperation({
    summary: 'Hesabımı sil (KVKK Madde 11 / GDPR Article 17)',
    description:
      'Kullanıcı kendi hesabını anonimleştirip soft-delete eder. PII alanları (email, isim, ' +
      'telefon, avatar) sıfırlanır. Satın alma + test çözme istatistikleri eğitici komisyonu ' +
      'için anonim olarak korunur. Geri alınamaz.',
  })
  @ApiOkResponse({
    description: 'Hesap anonimleştirildi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        anonymizedAt: { type: 'string', format: 'date-time' },
        message: { type: 'string' },
      },
    },
  })
  async deleteMyAccount(@Body() body: DeleteMyAccountBodyDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);

    const userAgent = req.headers?.['user-agent']?.toString() ?? undefined;

    return this.deleteUC.execute(
      { userId, reason: body.reason, passwordConfirmation: body.passwordConfirmation },
      { userId, ip: req.ip, userAgent, role: req.user?.role, tenantId: req.user?.tenantId },
    );
  }
}
