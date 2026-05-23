import { Body, Controller, Get, HttpException, HttpStatus, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { UpdateUserEmailPreferencesUseCase } from '../../application/use-cases/email/UpdateUserEmailPreferencesUseCase';
import { UpdateEmailPreferencesDto } from './dto/email-preferences.dto';

/**
 * Aday/eğitici/admin kendi email tercihlerini günceller.
 * `marketing`, `weeklyDigest` gibi tercih alanları kullanıcının kontrolü altındadır;
 * CRITICAL şablonlar (şifre/ödeme/iade) bu tercihten etkilenmez.
 */
@Controller('me/email-preferences')
@ApiTags('me')
@ApiBearerAuth('bearer')
export class MeEmailPreferencesController {
  constructor(private readonly uc: UpdateUserEmailPreferencesUseCase) {}

  @Get()
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN', 'WORKER')
  async get(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    return this.uc.get(userId);
  }

  @Patch()
  @Roles('CANDIDATE', 'EDUCATOR', 'ADMIN', 'WORKER')
  async update(@Body() body: UpdateEmailPreferencesDto, @Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    return this.uc.update({ userId, changes: body });
  }
}
