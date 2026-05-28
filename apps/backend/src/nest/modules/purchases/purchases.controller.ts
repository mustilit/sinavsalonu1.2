import { Controller, Post, Param, Body, Req, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PurchasesService } from './purchases.service';
import { Request } from 'express';
import { Roles } from '../../decorators/roles.decorator';

// Dev modunda satın alma denemelerini sınırlamak istemiyoruz (manual test ederken
// 30/dk hızlıca tükeniyordu). Prod'da abuse koruması için sıkı limit korunur.
const PURCHASE_THROTTLE_LIMIT = process.env.NODE_ENV === 'production' ? 30 : 500;

@Controller('purchases')
export class PurchasesController {
  constructor(@Inject(PurchasesService) private readonly purchasesService: PurchasesService) {}

  @Post(':testId')
  @Roles('CANDIDATE')
  @Throttle({ default: { limit: PURCHASE_THROTTLE_LIMIT, ttl: 60000 } })
  async purchase(@Param('testId') testId: string, @Body() body: any, @Req() req: Request) {
    // candidateId must come from authenticated JWT only
    const candidateId = (req as any).user?.id;
    const discountCode = body?.discountCode;
    const paymentProvider = body?.paymentProvider;
    // Sprint 14 — Mesafeli satış sözleşmesi acceptance: frontend body içinde gönderir
    const acceptedDistanceSaleContractId = body?.acceptedDistanceSaleContractId;
    if (!candidateId) {
      throw new HttpException('candidateId required', HttpStatus.BAD_REQUEST);
    }
    // Sprint 14 — IP/UA delil olarak Purchase tablosuna snapshot edilir
    const ip = ((req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim())
      || (req.socket?.remoteAddress as string | undefined);
    const userAgent = req.headers?.['user-agent'];
    try {
      return await this.purchasesService.purchase(
        testId,
        candidateId,
        discountCode,
        paymentProvider,
        { acceptedDistanceSaleContractId, ip, userAgent },
      );
    } catch (e: any) {
      if (e?.status === 409 || e?.message === 'ALREADY_PURCHASED' || e?.response?.code === 'ALREADY_PURCHASED') {
        throw new HttpException('Already purchased', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }
}

