import { Injectable } from '@nestjs/common';
import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Sınav türüne göre konuları düz liste olarak döndürür.
 * examTypeId verilmezse tüm konular döner.
 *
 * Her satır için `path` ve `fullPath` üretilir: root → leaf yol zinciri.
 * Örn. "Matematik › Sayılar › Gerçek Sayılar". Bu, soru oluşturma akışındaki
 * combobox'ta kullanıcının konuyu ağaçtaki yerini tam görmesini sağlar.
 *
 * `parent` filtreleme aktif filtreyi (activeOnly veya examTypeId) atlatabilir;
 * path hesaplama için tüm aktif parent'ları ayrı bir map'le çözeriz.
 */
@Injectable()
export class ListTopicsByExamTypeUseCase {
  async execute(examTypeId?: string, activeOnly = true) {
    const where: any = activeOnly ? { active: true } : {};
    if (examTypeId) where.examTypes = { some: { examTypeId } };

    const rows = await (prisma.topic as any).findMany({
      where,
      include: {
        examTypes: { include: { examType: { select: { id: true, name: true } } } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // examTypeId filtresi parent'ı dışarda bırakabilir; path için tüm
    // aktif Topic'leri ek olarak çekip id→{id,name,parentId} haritası kur.
    const allTopics: Array<{ id: string; name: string; parentId: string | null }> =
      await (prisma.topic as any).findMany({
        where: activeOnly ? { active: true } : {},
        select: { id: true, name: true, parentId: true },
      });
    const byId = new Map(allTopics.map((t) => [t.id, t]));

    const buildPath = (id: string): string[] => {
      const out: string[] = [];
      const seen = new Set<string>();
      let cur: { id: string; name: string; parentId: string | null } | undefined = byId.get(id);
      // Cycle koruması: ata zincirinde aynı id'yi ikinci kez görmeyiz.
      while (cur && !seen.has(cur.id)) {
        out.unshift(cur.name);
        seen.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return out;
    };

    return rows.map((r: any) => {
      const path = buildPath(r.id);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        active: r.active,
        parentId: r.parentId ?? null,
        parentName: r.parent?.name ?? null,
        path, // ["Matematik", "Sayılar", "Gerçek Sayılar"]
        fullPath: path.join(' › '), // tek string halinde UI için
        examTypes: r.examTypes.map((te: any) => ({ id: te.examType.id, name: te.examType.name })),
      };
    });
  }
}
