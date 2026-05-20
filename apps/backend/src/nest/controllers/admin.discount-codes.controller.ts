import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Inject } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { ListAllDiscountCodesUseCase } from '../../application/use-cases/discount/ListAllDiscountCodesUseCase';
import { CreateDiscountCodeUseCase } from '../../application/use-cases/discount/CreateDiscountCodeUseCase';
import { ToggleDiscountCodeUseCase } from '../../application/use-cases/discount/ToggleDiscountCodeUseCase';
import { DeleteDiscountCodeUseCase } from '../../application/use-cases/discount/DeleteDiscountCodeUseCase';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';

/**
 * Admin: tüm indirim kodlarını listeler + admin olarak yeni kod oluşturur +
 * herhangi bir kodu aktif/pasif yapar + siler.
 *
 * Yalnızca ADMIN rolüne açıktır. Eğitici endpoint'leri `EducatorsController`
 * altında ayrı durur — admin tüm kodlara erişebilirken eğitici sadece kendi
 * oluşturdukları üzerinde işlem yapar.
 */
@Controller('admin/discount-codes')
@ApiTags('admin/discount-codes')
export class AdminDiscountCodesController {
  constructor(
    @Inject(ListAllDiscountCodesUseCase) private readonly listAll: ListAllDiscountCodesUseCase,
    @Inject(CreateDiscountCodeUseCase) private readonly createUC: CreateDiscountCodeUseCase,
    @Inject(ToggleDiscountCodeUseCase) private readonly toggleUC: ToggleDiscountCodeUseCase,
    @Inject(DeleteDiscountCodeUseCase) private readonly deleteUC: DeleteDiscountCodeUseCase,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'List all discount codes with creator info' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async list(@Req() req: any) {
    const actorId = (req as any).user?.id;
    return this.listAll.execute(actorId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Create discount code as admin' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async create(@Body() body: CreateDiscountCodeDto, @Req() req: any) {
    const actorId = (req as any).user?.id;
    return this.createUC.execute(actorId, {
      code: body.code,
      percentOff: body.percentOff,
      maxUses: body.maxUses ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      description: body.description ?? null,
    });
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Toggle isActive on any discount code' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async toggle(@Param('id') id: string, @Req() req: any) {
    const actorId = (req as any).user?.id;
    return this.toggleUC.execute(actorId, id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Delete any discount code' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const actorId = (req as any).user?.id;
    return this.deleteUC.execute(actorId, id);
  }
}
