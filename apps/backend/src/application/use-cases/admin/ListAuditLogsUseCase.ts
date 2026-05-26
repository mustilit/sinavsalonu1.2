import type { IAuditLogRepository } from '../../../domain/interfaces/IAuditLogRepository';
import { runWithoutTenantFilter } from '../../../common/tenantContext';
import { resolveAuditEntities } from '../../services/AuditEntityResolver';

/**
 * Sistem denetim kayıtlarını filtreli listeler.
 * Tarih aralığı, eylem türü, aktör veya entity'ye göre filtreleme desteklenir.
 * Yalnızca admin panelinden erişilebilir.
 *
 * Tenant bypass: Admin cross-tenant audit log görüntüleyebilir; aksi halde
 * legacy kayıtlar (tenantId=null) veya başka tenant'taki kayıtlar gözükmez.
 *
 * Enrichment: Her log kaydına `entityLabel` ve `entityLink` (frontend route)
 * eklenir — admin sayfasında UUID yerine anlamlı başlık görünür.
 */
export class ListAuditLogsUseCase {
  constructor(private readonly auditRepo: IAuditLogRepository) {}

  async execute(filters?: {
    action?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(filters.to) : undefined;
    const result = await runWithoutTenantFilter(() =>
      this.auditRepo.list({
        action: filters?.action,
        entityType: filters?.entityType,
        entityId: filters?.entityId,
        actorId: filters?.actorId,
        from,
        to,
        page: filters?.page,
        limit: filters?.limit,
      }),
    );

    // Batch resolve: aynı tipte tüm id'ler tek findMany'de çekilir (N+1 yok).
    const items = (result as any).items ?? [];
    if (Array.isArray(items) && items.length > 0) {
      const refs = items.map((log: any) => ({
        entityType: log.entityType,
        entityId: log.entityId,
      }));
      const resolved = await resolveAuditEntities(refs);
      for (const log of items) {
        const key = `${log.entityType}::${log.entityId}`;
        const r = resolved.get(key);
        log.entityLabel = r?.label ?? null;
        log.entityLink = r?.link ?? null;
      }
    }

    return result;
  }
}
