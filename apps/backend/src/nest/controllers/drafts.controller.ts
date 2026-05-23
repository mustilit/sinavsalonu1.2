import { Body, Controller, Delete, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../swagger/decorators';
import { prisma } from '../../infrastructure/database/prisma';
import { UpsertDraftUseCase } from '../../application/use-cases/draft/UpsertDraftUseCase';
import { GetDraftUseCase } from '../../application/use-cases/draft/GetDraftUseCase';
import { DeleteDraftUseCase } from '../../application/use-cases/draft/DeleteDraftUseCase';
import { UpsertDraftDto } from './dto/upsert-draft.dto';

/**
 * Server-side draft yedeği endpoint'leri.
 *
 * Kullanıcı bazlı; sadece kendi draft'larına erişebilir (owner = req.user.id).
 * Tüm endpoint'ler JWT korumalı — JwtAuthGuard global olduğundan ekstra decorator
 * gerekmez. @Public dekoratörü konulmadığı için varsayılan olarak auth zorunlu.
 *
 * Path parametre 'key' URL-encoded olarak gelmelidir (ör. createTestWizard,
 * editTestWizard:abc123). Backend 'key' içeriğini yorumlamaz.
 */
@Controller('drafts')
@ApiTags('Drafts')
@ApiBearerAuth('bearer')
export class DraftsController {
  private readonly upsertUC: UpsertDraftUseCase;
  private readonly getUC: GetDraftUseCase;
  private readonly deleteUC: DeleteDraftUseCase;

  constructor() {
    this.upsertUC = new UpsertDraftUseCase(prisma as any);
    this.getUC = new GetDraftUseCase(prisma as any);
    this.deleteUC = new DeleteDraftUseCase(prisma as any);
  }

  /** Belirli key için draft'ı oku. Yoksa null döner. */
  @Get(':key')
  @ApiOkResponse({ description: 'Draft içeriği veya null' })
  @ApiErrorResponses()
  async get(@Req() req: any, @Param('key') key: string) {
    const ownerId = req.user?.id;
    return this.getUC.execute(ownerId, decodeURIComponent(key));
  }

  /** Draft'ı yaz veya güncelle. */
  @Put(':key')
  @ApiOkResponse({ description: 'Draft kaydedildi' })
  @ApiErrorResponses()
  async upsert(@Req() req: any, @Param('key') key: string, @Body() dto: UpsertDraftDto) {
    const ownerId = req.user?.id;
    return this.upsertUC.execute(ownerId, decodeURIComponent(key), dto.payload);
  }

  /** Draft'ı sil. Yoksa sessiz geçer. */
  @Delete(':key')
  @ApiOkResponse({ description: 'Draft silindi' })
  @ApiErrorResponses()
  async delete(@Req() req: any, @Param('key') key: string) {
    const ownerId = req.user?.id;
    return this.deleteUC.execute(ownerId, decodeURIComponent(key));
  }
}
