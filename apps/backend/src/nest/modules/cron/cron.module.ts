import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaNotificationPreferenceRepository } from '../../../infrastructure/repositories/PrismaNotificationPreferenceRepository';
import { PrismaFollowRepository } from '../../../infrastructure/repositories/PrismaFollowRepository';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { PrismaObjectionRepository } from '../../../infrastructure/repositories/PrismaObjectionRepository';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { SendWeeklyFollowDigestUseCase } from '../../../application/use-cases/notification/SendWeeklyFollowDigestUseCase';
import { SendMonthlyInactiveReminderUseCase } from '../../../application/use-cases/notification/SendMonthlyInactiveReminderUseCase';
import { EscalateOverdueObjectionsUseCase } from '../../../application/use-cases/objection/EscalateOverdueObjectionsUseCase';
import { EscalateOverdueRefundsUseCase } from '../../../application/use-cases/refund/EscalateOverdueRefundsUseCase';
import { PrismaRefundRepository } from '../../../infrastructure/repositories/PrismaRefundRepository';
import { PrismaAuditLogRepository } from '../../../infrastructure/repositories/PrismaAuditLogRepository';
import { EmailCronService } from './email-cron.service';
import { AnonymizeOldEmailLogsUseCase } from '../../../application/use-cases/email/AnonymizeOldEmailLogsUseCase';
import { CheckBounceRateAlertUseCase } from '../../../application/use-cases/email/CheckBounceRateAlertUseCase';
import { ResetProviderDailyCountUseCase } from '../../../application/use-cases/email/ResetProviderDailyCountUseCase';
import { ExpireSuppressionsUseCase } from '../../../application/use-cases/email/ExpireSuppressionsUseCase';
import { ModerationCronService } from './ModerationCronService';
import { PrismaModerationViolationRepository } from '../../../infrastructure/repositories/PrismaModerationViolationRepository';
import { PrismaEducatorRiskScoreRepository } from '../../../infrastructure/repositories/PrismaEducatorRiskScoreRepository';
import { PrismaModerationActionRepository } from '../../../infrastructure/repositories/PrismaModerationActionRepository';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    PrismaModerationViolationRepository,
    PrismaEducatorRiskScoreRepository,
    PrismaModerationActionRepository,
    // ModerationCronService: explicit factory ile bağımlılıkları ver.
    // Aynı EmailCronService'te yaşanan tip-tabanlı DI sorununa karşı önlem
    // (tsx + reflect-metadata gibi belirli koşullarda inject çözümlenmiyor).
    {
      provide: ModerationCronService,
      useFactory: (
        v: PrismaModerationViolationRepository,
        r: PrismaEducatorRiskScoreRepository,
        a: PrismaModerationActionRepository,
      ) => new ModerationCronService(v, r, a),
      inject: [
        PrismaModerationViolationRepository,
        PrismaEducatorRiskScoreRepository,
        PrismaModerationActionRepository,
      ],
    },
    { provide: AnonymizeOldEmailLogsUseCase, useFactory: () => new AnonymizeOldEmailLogsUseCase() },
    { provide: CheckBounceRateAlertUseCase, useFactory: () => new CheckBounceRateAlertUseCase() },
    { provide: ResetProviderDailyCountUseCase, useFactory: () => new ResetProviderDailyCountUseCase() },
    { provide: ExpireSuppressionsUseCase, useFactory: () => new ExpireSuppressionsUseCase() },
    // EmailCronService: tip-tabanlı DI bağımlılıkları çözmediği için explicit factory.
    // Önceki `EmailCronService,` shorthand'i constructor parametrelerini undefined
    // bırakıyor ve cron tetikleyicide "Cannot read properties of undefined (reading
    // 'execute')" hatasına yol açıyordu.
    {
      provide: EmailCronService,
      useFactory: (
        bc: CheckBounceRateAlertUseCase,
        dr: ResetProviderDailyCountUseCase,
        an: AnonymizeOldEmailLogsUseCase,
        es: ExpireSuppressionsUseCase,
      ) => new EmailCronService(bc, dr, an, es),
      inject: [
        CheckBounceRateAlertUseCase,
        ResetProviderDailyCountUseCase,
        AnonymizeOldEmailLogsUseCase,
        ExpireSuppressionsUseCase,
      ],
    },
    PrismaNotificationPreferenceRepository,
    PrismaFollowRepository,
    PrismaUserRepository,
    PrismaObjectionRepository,
    PrismaAuditLogRepository,
    QueueService,
    {
      provide: SendWeeklyFollowDigestUseCase,
      useFactory: (f: PrismaFollowRepository, p: PrismaNotificationPreferenceRepository, q: QueueService, a: PrismaAuditLogRepository) =>
        new SendWeeklyFollowDigestUseCase(f, p, q, a),
      inject: [PrismaFollowRepository, PrismaNotificationPreferenceRepository, QueueService, PrismaAuditLogRepository],
    },
    {
      provide: SendMonthlyInactiveReminderUseCase,
      useFactory: (u: PrismaUserRepository, p: PrismaNotificationPreferenceRepository, q: QueueService, a: PrismaAuditLogRepository) =>
        new SendMonthlyInactiveReminderUseCase(u, p, q, a),
      inject: [PrismaUserRepository, PrismaNotificationPreferenceRepository, QueueService, PrismaAuditLogRepository],
    },
    {
      provide: EscalateOverdueObjectionsUseCase,
      useFactory: (o: PrismaObjectionRepository, a: PrismaAuditLogRepository) => new EscalateOverdueObjectionsUseCase(o, a),
      inject: [PrismaObjectionRepository, PrismaAuditLogRepository],
    },
    PrismaRefundRepository,
    {
      provide: EscalateOverdueRefundsUseCase,
      useFactory: (r: PrismaRefundRepository) => new EscalateOverdueRefundsUseCase(r),
      inject: [PrismaRefundRepository],
    },
    // CronService: haftalık/aylık ve eskalasyon cron'ları için use-case'leri
    // explicit factory ile bağla — tip-tabanlı DI'ya güvenme.
    {
      provide: CronService,
      useFactory: (
        weekly: SendWeeklyFollowDigestUseCase,
        monthly: SendMonthlyInactiveReminderUseCase,
        escalate: EscalateOverdueObjectionsUseCase,
        escalateRefunds: EscalateOverdueRefundsUseCase,
      ) => new CronService(weekly, monthly, escalate, escalateRefunds),
      inject: [
        SendWeeklyFollowDigestUseCase,
        SendMonthlyInactiveReminderUseCase,
        EscalateOverdueObjectionsUseCase,
        EscalateOverdueRefundsUseCase,
      ],
    },
  ],
  exports: [CronService, EmailCronService, ModerationCronService],
})
export class CronModule {}

