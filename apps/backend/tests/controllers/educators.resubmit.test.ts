/**
 * EducatorsController.resubmitApplication() unit testleri (B9).
 *
 * Yeni endpoint: POST /educators/me/resubmit-application
 * - REJECTED → PENDING_EDUCATOR_APPROVAL (raw SQL UPDATE)
 * - rejectionReason + rejectedAt temizlenir
 * - EDUCATOR_RESUBMITTED audit log yazılır
 * - REJECTED değilse no-op (NO_CHANGE)
 * - User bulunamazsa hata
 * - Audit log fail olursa endpoint yine başarılı (best-effort)
 *
 * Raw SQL prisma.$queryRaw / $executeRaw kullanır → enum bypass.
 */
jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

import { EducatorsController } from '../../src/nest/controllers/educators.controller';
import { prisma } from '../../src/infrastructure/database/prisma';

const mockPrisma = prisma as any;

const makeController = (auditOverride: any = {}) => {
  const userRepo: any = { findById: jest.fn() };
  const auditRepo: any = {
    create: jest.fn().mockResolvedValue({}),
    ...auditOverride,
  };
  // Diğer 7 UseCase dependency me/resubmit'te kullanılmıyor — null geç
  const ctrl = new EducatorsController(
    userRepo,
    auditRepo,
    null as any, null as any, null as any,
    null as any, null as any, null as any,
    null as any, null as any,
  );
  return { ctrl, userRepo, auditRepo };
};

const req = (userId: string) => ({ user: { id: userId } });

describe('EducatorsController.resubmitApplication()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  describe('REJECTED kullanıcı (mutlu yol)', () => {
    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([{ status: 'REJECTED' }]);
    });

    it('status PENDING_EDUCATOR_APPROVAL döner', async () => {
      const { ctrl } = makeController();
      const res: any = await ctrl.resubmitApplication(req('user-1'));
      expect(res.status).toBe('PENDING_EDUCATOR_APPROVAL');
      expect(res.resubmittedAt).toBeInstanceOf(Date);
    });

    it('$executeRaw ile UPDATE çağrılır (rejectionReason + rejectedAt temizlenir)', async () => {
      const { ctrl } = makeController();
      await ctrl.resubmitApplication(req('user-1'));
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('EDUCATOR_RESUBMITTED audit log yazılır', async () => {
      const { ctrl, auditRepo } = makeController();
      await ctrl.resubmitApplication(req('user-1'));
      expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        action: 'EDUCATOR_RESUBMITTED',
        entityType: 'USER',
        entityId: 'user-1',
        actorId: 'user-1', // kullanıcı kendi başvurusunu gönderdi
      }));
    });

    it('audit log fail olursa endpoint yine başarılı (best-effort)', async () => {
      const { ctrl } = makeController({
        create: jest.fn().mockRejectedValue(new Error('audit table down')),
      });
      const res: any = await ctrl.resubmitApplication(req('user-1'));
      // Audit fail olmasına rağmen status update başarılı
      expect(res.status).toBe('PENDING_EDUCATOR_APPROVAL');
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('REJECTED olmayan kullanıcı (idempotent no-op)', () => {
    it('ACTIVE → NO_CHANGE, UPDATE atılmaz', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ status: 'ACTIVE' }]);
      const { ctrl, auditRepo } = makeController();
      const res: any = await ctrl.resubmitApplication(req('user-1'));
      expect(res.status).toBe('ACTIVE');
      expect(res.message).toBe('NO_CHANGE');
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
      expect(auditRepo.create).not.toHaveBeenCalled();
    });

    it('PENDING_EDUCATOR_APPROVAL → NO_CHANGE (zaten incelemede)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ status: 'PENDING_EDUCATOR_APPROVAL' }]);
      const { ctrl } = makeController();
      const res: any = await ctrl.resubmitApplication(req('user-1'));
      expect(res.message).toBe('NO_CHANGE');
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('SUSPENDED → NO_CHANGE (askıya alma resubmit ile geri alınamaz)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ status: 'SUSPENDED' }]);
      const { ctrl } = makeController();
      const res: any = await ctrl.resubmitApplication(req('user-1'));
      expect(res.message).toBe('NO_CHANGE');
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('hata yolları', () => {
    it('user DB\'de yoksa USER_NOT_FOUND fırlatır', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]); // boş array
      const { ctrl } = makeController();
      await expect(ctrl.resubmitApplication(req('user-1'))).rejects.toThrow('USER_NOT_FOUND');
    });
  });
});
