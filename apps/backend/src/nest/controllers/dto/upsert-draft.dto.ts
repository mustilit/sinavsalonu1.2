import { IsDefined } from 'class-validator';

/**
 * Draft endpoint'leri payload'u herhangi bir JSON kabul eder; içerik
 * client'in mantıksal şemasıdır. Backend yorumlamaz.
 */
export class UpsertDraftDto {
  @IsDefined()
  payload!: unknown;
}
