import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { ListMarketplaceTestsUseCase } from '../../../application/use-cases/test/ListMarketplaceTestsUseCase';
import { ListMarketplacePackagesUseCase } from '../../../application/use-cases/package/ListMarketplacePackagesUseCase';
import { GetMarketplacePackageUseCase } from '../../../application/use-cases/package/GetMarketplacePackageUseCase';
import { GetPackageReviewsUseCase } from '../../../application/use-cases/package/GetPackageReviewsUseCase';
import { GetMyPackageReviewUseCase } from '../../../application/use-cases/package/GetMyPackageReviewUseCase';
import { RecordPackageViewUseCase } from '../../../application/use-cases/package/RecordPackageViewUseCase';
import { PrismaExamRepository } from '../../../infrastructure/repositories/PrismaExamRepository';

@Module({
  controllers: [MarketplaceController],
  providers: [
    {
      provide: ListMarketplaceTestsUseCase,
      useFactory: () => new ListMarketplaceTestsUseCase(new PrismaExamRepository()),
    },
    {
      provide: ListMarketplacePackagesUseCase,
      useFactory: () => new ListMarketplacePackagesUseCase(),
    },
    {
      provide: GetMarketplacePackageUseCase,
      useFactory: () => new GetMarketplacePackageUseCase(),
    },
    {
      provide: GetPackageReviewsUseCase,
      useFactory: () => new GetPackageReviewsUseCase(),
    },
    {
      provide: GetMyPackageReviewUseCase,
      useFactory: () => new GetMyPackageReviewUseCase(),
    },
    {
      provide: RecordPackageViewUseCase,
      useFactory: () => new RecordPackageViewUseCase(),
    },
  ],
  exports: [
    ListMarketplaceTestsUseCase,
    ListMarketplacePackagesUseCase,
    GetMarketplacePackageUseCase,
    GetPackageReviewsUseCase,
    GetMyPackageReviewUseCase,
    RecordPackageViewUseCase,
  ],
})
export class MarketplaceModule {}

