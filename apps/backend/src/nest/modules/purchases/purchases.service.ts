import { Injectable } from '@nestjs/common';
import { PurchaseUseCase } from '../../../application/use-cases/purchase/PurchaseUseCase';
import { Inject } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

@Injectable()
export class PurchasesService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  // Sprint 14 — ctx parametresi: mesafeli satış sözleşmesi onayı + IP/UA delili
  async purchase(
    testId: string,
    candidateId: string,
    discountCode?: string,
    paymentProvider?: string,
    ctx?: { acceptedDistanceSaleContractId?: string; ip?: string; userAgent?: string },
  ) {
    const uc = new PurchaseUseCase(this.prisma);
    return uc.execute(testId, candidateId, discountCode, paymentProvider, ctx);
  }
}

