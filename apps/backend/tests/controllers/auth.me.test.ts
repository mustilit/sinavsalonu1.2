/**
 * AuthController.me() unit testleri (B9).
 *
 * Kapsam: dünkü "kayıt wizard verisi profile yansımıyor" bug'ı için kalıcı
 * regresyon koruması. /auth/me response'unun users.metadata JSONB'sini ve
 * firstName/lastName/bio kolonlarını user objesine flatten ettiğini + bilinen
 * alias'ları map ettiğini doğrular.
 *
 * Controller bağımlılıkları geniş (7+ UseCase) — yalnızca `me()` test edildiği
 * için stub'larla minimum kurulum yapılıyor (NestJS testing context yok).
 */
jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    workerPermission: {
      findUnique: jest.fn(),
    },
  },
}));

import { AuthController } from '../../src/nest/controllers/auth.controller';
import { HttpException } from '@nestjs/common';
import { prisma } from '../../src/infrastructure/database/prisma';

const mockPrisma = prisma as any;

const makeDomainUser = (overrides: any = {}) => ({
  id: 'user-1',
  email: 'wizard@test.com',
  username: 'wizardtest',
  role: 'EDUCATOR',
  status: 'ACTIVE',
  educatorApprovedAt: null,
  metadata: {},
  createdAt: new Date('2026-05-30T10:00:00Z'),
  updatedAt: new Date(),
  ...overrides,
});

const makeController = (userRepoOverride: any = {}) => {
  // 7 UseCase bağımlılığı — me() bunları kullanmaz; null geçer
  const userRepo = {
    findById: jest.fn().mockResolvedValue(makeDomainUser()),
    ...userRepoOverride,
  };
  // Hepsi me() yolunda kullanılmıyor — null/stub ile geç
  return new AuthController(
    null as any,
    null as any,
    null as any,
    userRepo as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );
};

const req = (sub: string | undefined) => ({ user: sub ? { sub } : {} });

describe('AuthController.me()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: detail row boş metadata + isim
    mockPrisma.$queryRaw.mockResolvedValue([{
      rejectionReason: null,
      rejectedAt: null,
      firstName: 'Wizard',
      lastName: 'Test',
      bio: 'Hello',
      metadata: {},
    }]);
  });

  describe('yetki', () => {
    it('JWT sub yoksa 401', async () => {
      const ctrl = makeController();
      await expect(ctrl.me(req(undefined))).rejects.toThrow(HttpException);
    });

    it('kullanıcı DB\'de yoksa 404', async () => {
      const ctrl = makeController({ findById: jest.fn().mockResolvedValue(null) });
      await expect(ctrl.me(req('user-1'))).rejects.toThrow(HttpException);
    });
  });

  describe('temel response', () => {
    it('id + email + username + role + status döner', async () => {
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user).toMatchObject({
        id: 'user-1',
        email: 'wizard@test.com',
        username: 'wizardtest',
        role: 'EDUCATOR',
        status: 'ACTIVE',
      });
    });

    it('createdAt + educatorApprovedAt geçer', async () => {
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({
          educatorApprovedAt: new Date('2026-05-25T00:00:00Z'),
        })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.educatorApprovedAt).toBeDefined();
      expect(res.user.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('full_name çözümlemesi (B9)', () => {
    it('firstName + lastName birleştirilir', async () => {
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.firstName).toBe('Wizard');
      expect(res.user.lastName).toBe('Test');
      expect(res.user.full_name).toBe('Wizard Test');
    });

    it('firstName/lastName boşsa username fallback', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: null, lastName: null,
        bio: '', metadata: {},
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.full_name).toBe('wizardtest');
    });
  });

  describe('metadata flatten + alias map (B9)', () => {
    it('metadata.cv_url → user.cv_url', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { cv_url: 'http://uploads/cv.pdf' },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.cv_url).toBe('http://uploads/cv.pdf');
    });

    it('metadata.specialized_exam_types → user.specialized_exam_types (array)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { specialized_exam_types: ['t1', 't2', 't3'] },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.specialized_exam_types).toEqual(['t1', 't2', 't3']);
    });

    it('specialized_exam_types yoksa boş array fallback', async () => {
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.specialized_exam_types).toEqual([]);
    });

    it('metadata.education_info → hem education hem education_info', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { education_info: 'Bilkent Math' },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.education).toBe('Bilkent Math');
      expect(res.user.education_info).toBe('Bilkent Math');
    });

    it('metadata.website_url → hem website hem website_url alias', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { website_url: 'https://example.com' },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.website).toBe('https://example.com');
      expect(res.user.website_url).toBe('https://example.com');
    });

    it('metadata.linkedin_url → hem linkedin hem linkedin_url alias', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { linkedin_url: 'https://linkedin.com/in/x' },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.linkedin).toBe('https://linkedin.com/in/x');
      expect(res.user.linkedin_url).toBe('https://linkedin.com/in/x');
    });

    it('bio kolondan gelir; yoksa metadata.bio fallback', async () => {
      const ctrl = makeController();
      const res1: any = await ctrl.me(req('user-1'));
      expect(res1.user.bio).toBe('Hello'); // kolon

      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B',
        bio: null,
        metadata: { bio: 'fallback bio' },
      }]);
      const res2: any = await ctrl.me(req('user-1'));
      expect(res2.user.bio).toBe('fallback bio');
    });

    it('ham metadata da response\'ta dursun (fallback için)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: null, rejectedAt: null,
        firstName: 'A', lastName: 'B', bio: '',
        metadata: { future_field: 'x' },
      }]);
      const ctrl = makeController();
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.metadata.future_field).toBe('x');
    });
  });

  describe('REJECTED + onay aşaması bilgisi', () => {
    it('REJECTED kullanıcı → rejectionReason + educator_status=rejected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{
        rejectionReason: 'CV eksik',
        rejectedAt: new Date('2026-05-30T19:30:00Z'),
        firstName: 'A', lastName: 'B', bio: '', metadata: {},
      }]);
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({ status: 'REJECTED' })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.status).toBe('REJECTED');
      expect(res.user.rejectionReason).toBe('CV eksik');
      expect(res.user.rejection_reason).toBe('CV eksik'); // geriye dönük uyumluluk
      expect(res.user.educator_status).toBe('rejected');
    });

    it('PENDING_EDUCATOR_APPROVAL → educator_status=pending', async () => {
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({ status: 'PENDING_EDUCATOR_APPROVAL' })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.educator_status).toBe('pending');
    });

    it('ACTIVE + educatorApprovedAt → educator_status=approved', async () => {
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({
          status: 'ACTIVE',
          educatorApprovedAt: new Date(),
        })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.educator_status).toBe('approved');
    });
  });

  describe('WORKER izinleri', () => {
    it('WORKER kullanıcı workerPages ile döner', async () => {
      mockPrisma.workerPermission.findUnique.mockResolvedValue({
        userId: 'user-1',
        pages: ['ManageUsers', 'AdminClaims'],
      });
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({ role: 'WORKER' })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.workerPages).toEqual(['ManageUsers', 'AdminClaims']);
    });

    it('WORKER ama izin kaydı yoksa boş array', async () => {
      mockPrisma.workerPermission.findUnique.mockResolvedValue(null);
      const ctrl = makeController({
        findById: jest.fn().mockResolvedValue(makeDomainUser({ role: 'WORKER' })),
      });
      const res: any = await ctrl.me(req('user-1'));
      expect(res.user.workerPages).toEqual([]);
    });
  });
});
