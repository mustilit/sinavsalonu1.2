import { prisma } from '../../../infrastructure/database/prisma';
import { AppError } from '../../errors/AppError';
import { getDefaultTenantId } from '../../../common/tenant';
import { createHash } from 'crypto';

/**
 * Bir paket görüntülenmesini olay olarak loglar.
 *
 * Saf event log: aynı kullanıcı tekrar açtığında yeni satır yazılır.
 * Tekilleştirme istatistik aşamasında yapılır.
 *
 * Bot/spam koruması:
 *  - Aynı ipHash + packageId için 60 saniye içinde sadece 1 satır.
 *  - Paket var ve published olmalı.
 *
 * Privacy:
 *  - Ham IP saklanmaz; sha256(ip + günlük tarih + IP_HASH_SALT) ile özetlenir.
 *  - UA ve referrer 500 karaktere kırpılır.
 */
export class RecordPackageViewUseCase {
  async execute(params: {
    packageId: string;
    viewerId?: string | null;
    sessionId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    tenantId?: string;
  }): Promise<{ recorded: boolean; reason?: string }> {
    const { packageId } = params;
    if (!packageId) throw new AppError('INVALID_INPUT', 'packageId required', 400);

    // Paket var ve published mı? Drafları logla(ma)mak için kontrol.
    const pkg = await prisma.testPackage.findFirst({
      where: { id: packageId, publishedAt: { not: null } },
      select: { id: true, tenantId: true },
    });
    if (!pkg) return { recorded: false, reason: 'package_not_published' };

    const tenantId = params.tenantId ?? pkg.tenantId ?? getDefaultTenantId();

    // ipHash: sha256(ip + günün tarihi + salt). Salt env'den, yoksa default.
    // Aynı gün içinde aynı IP'nin abuse'ı tespit edilebilir ama gizlilik korunur.
    let ipHash: string | null = null;
    if (params.ip) {
      const salt = process.env.IP_HASH_SALT || 'dev-salt';
      const day = new Date().toISOString().slice(0, 10);
      ipHash = createHash('sha256').update(`${params.ip}|${day}|${salt}`).digest('hex').slice(0, 64);
    }

    // Rate limit: aynı ipHash + packageId, son 60sn içinde varsa kaydetme.
    if (ipHash) {
      const since = new Date(Date.now() - 60 * 1000);
      const recent = await prisma.packageView.findFirst({
        where: { packageId, ipHash, createdAt: { gte: since } },
        select: { id: true },
      });
      if (recent) return { recorded: false, reason: 'rate_limited' };
    }

    await prisma.packageView.create({
      data: {
        tenantId,
        packageId,
        viewerId: params.viewerId ?? null,
        sessionId: params.sessionId ? params.sessionId.slice(0, 64) : null,
        ipHash,
        userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
        referrer: params.referrer ? params.referrer.slice(0, 500) : null,
      },
    });

    return { recorded: true };
  }
}
