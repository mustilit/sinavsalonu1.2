import { Injectable } from '@nestjs/common';
import { ModerationCategory } from '@prisma/client';
import { IBlockedTermRepository } from '../../../domain/interfaces/IBlockedTermRepository';

export interface CreateBlockedTermParams {
  tenantId: string;
  term: string;
  pattern?: string | null;
  category: ModerationCategory;
  severity?: number;
  isActive?: boolean;
  createdBy: string;
}

@Injectable()
export class CreateBlockedTermUseCase {
  constructor(private readonly repo: IBlockedTermRepository) {}

  async execute(params: CreateBlockedTermParams) {
    const result = await this.repo.create({
      tenantId: params.tenantId,
      term: params.term.trim().toLowerCase(),
      pattern: params.pattern ?? null,
      category: params.category,
      severity: params.severity ?? 1,
      isActive: params.isActive ?? true,
      createdBy: params.createdBy,
    });

    await this.repo.invalidateCache(params.tenantId);
    return result;
  }
}
