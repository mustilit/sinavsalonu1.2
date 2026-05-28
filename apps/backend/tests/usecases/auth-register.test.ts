import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

function makeUserRepo(savedUser: any = null) {
  return {
    save: jest.fn(async (u: any) => savedUser ?? { ...u, id: u.id || 'new-id' }),
  };
}

function makePasswordService() {
  return {
    hash: jest.fn(async (p: string) => `hashed-${p}`),
  };
}

describe('RegisterUseCase', () => {
  it('yeni CANDIDATE kullanıcı oluşturur, public bilgi döner', async () => {
    const uc = new RegisterUseCase(makeUserRepo() as any, makePasswordService() as any);
    const result = await uc.execute({ email: 'New@Test.COM', username: 'newuser', password: 'securepass' });
    expect(result.email).toBe('new@test.com'); // normalize
    expect(result.role).toBe('CANDIDATE');
    expect(result.status).toBe('ACTIVE');
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('passwordHash plain metin şifresini içermez', async () => {
    const uc = new RegisterUseCase(makeUserRepo() as any, makePasswordService() as any);
    const result = await uc.execute({ email: 'a@b.com', username: 'u', password: 'mypass' });
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('e-posta küçük harfe çevrilir', async () => {
    const repo = makeUserRepo();
    const uc = new RegisterUseCase(repo as any, makePasswordService() as any);
    await uc.execute({ email: 'UPPER@CASE.COM', username: 'u', password: 'pass12345' });
    const savedUser = repo.save.mock.calls[0][0];
    expect(savedUser.email).toBe('upper@case.com');
  });

  it('şifre hash\'lenerek kaydedilir', async () => {
    const pwSvc = makePasswordService();
    const uc = new RegisterUseCase(makeUserRepo() as any, pwSvc as any);
    await uc.execute({ email: 'x@x.com', username: 'u', password: 'mypassword' });
    expect(pwSvc.hash).toHaveBeenCalledWith('mypassword');
  });

  it('sunucu tarafında UUID üretilir', async () => {
    const repo = makeUserRepo();
    const uc = new RegisterUseCase(repo as any, makePasswordService() as any);
    await uc.execute({ email: 'x@x.com', username: 'u', password: 'pass' });
    const savedUser = repo.save.mock.calls[0][0];
    expect(savedUser.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('createdAt alanı döner', async () => {
    const uc = new RegisterUseCase(makeUserRepo() as any, makePasswordService() as any);
    const result = await uc.execute({ email: 'x@x.com', username: 'u', password: 'pass' });
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  // ---------------------------------------------------------------------------
  // Sprint 14 — Sözleşme onayı zorunluluğu
  // ---------------------------------------------------------------------------
  describe('Sprint 14: contract enforcement', () => {
    function makeContractRepo(opts: {
      candidateId?: string | null;
      privacyId?: string | null;
    } = {}) {
      const { candidateId = 'ctr-candidate-1', privacyId = 'ctr-privacy-1' } = opts;
      return {
        getActiveByType: jest.fn(async (type: string) => {
          if (type === 'CANDIDATE' && candidateId) return { id: candidateId, isActive: true, type };
          if (type === 'PRIVACY' && privacyId) return { id: privacyId, isActive: true, type };
          return null;
        }),
        getById: jest.fn(),
      };
    }

    function makeAcceptanceRepo() {
      return {
        create: jest.fn(async (data: any) => ({ id: 'acc-' + Math.random(), ...data, acceptedAt: new Date() })),
        findByUserAndContract: jest.fn(async () => null),
      };
    }

    function makeAuditRepo() {
      return { create: jest.fn(async () => undefined) };
    }

    it('contract repo DI verilmediğinde acceptance kontrolü atlanır (backward compat)', async () => {
      const uc = new RegisterUseCase(makeUserRepo() as any, makePasswordService() as any);
      const result = await uc.execute({ email: 'x@x.com', username: 'u', password: 'p12345' });
      expect(result.email).toBe('x@x.com');
    });

    it('DI varsa acceptedTermsContractId verilmezse TERMS_NOT_ACCEPTED atar', async () => {
      const uc = new RegisterUseCase(
        makeUserRepo() as any,
        makePasswordService() as any,
        makeContractRepo() as any,
        makeAcceptanceRepo() as any,
        makeAuditRepo() as any,
      );
      await expect(
        uc.execute({ email: 'x@x.com', username: 'u', password: 'p12345' }),
      ).rejects.toMatchObject({ code: 'TERMS_NOT_ACCEPTED' });
    });

    it('contractId aktif ID ile eşleşmezse TERMS_NOT_ACCEPTED atar', async () => {
      const uc = new RegisterUseCase(
        makeUserRepo() as any,
        makePasswordService() as any,
        makeContractRepo() as any,
        makeAcceptanceRepo() as any,
        makeAuditRepo() as any,
      );
      await expect(
        uc.execute({
          email: 'x@x.com',
          username: 'u',
          password: 'p12345',
          acceptedTermsContractId: 'stale-id', // eski versiyon
          acceptedPrivacyContractId: 'ctr-privacy-1',
        }),
      ).rejects.toMatchObject({ code: 'TERMS_NOT_ACCEPTED' });
    });

    it('doğru contract ID\'ler verilirse user oluşur + 2 acceptance kaydı atılır', async () => {
      const acceptanceRepo = makeAcceptanceRepo();
      const auditRepo = makeAuditRepo();
      const userRepo = makeUserRepo();
      const uc = new RegisterUseCase(
        userRepo as any,
        makePasswordService() as any,
        makeContractRepo() as any,
        acceptanceRepo as any,
        auditRepo as any,
      );
      const result = await uc.execute(
        {
          email: 'aday@test.com',
          username: 'aday',
          password: 'p12345',
          acceptedTermsContractId: 'ctr-candidate-1',
          acceptedPrivacyContractId: 'ctr-privacy-1',
        },
        { ip: '1.2.3.4', userAgent: 'Mozilla/5.0' },
      );
      expect(result.email).toBe('aday@test.com');
      expect(acceptanceRepo.create).toHaveBeenCalledTimes(2);
      // İlk acceptance: CANDIDATE üyelik
      expect(acceptanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: 'ctr-candidate-1',
          ip: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        }),
      );
      // İkinci acceptance: PRIVACY
      expect(acceptanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: 'ctr-privacy-1' }),
      );
      // 2 audit log (CONTRACT_ACCEPTED) yazıldı
      expect(auditRepo.create).toHaveBeenCalledTimes(2);
    });

    it('aktif sözleşme yoksa (admin yayımlamamış) CONTRACTS_NOT_AVAILABLE 503 atar', async () => {
      const uc = new RegisterUseCase(
        makeUserRepo() as any,
        makePasswordService() as any,
        makeContractRepo({ candidateId: null }) as any, // CANDIDATE contract yok
        makeAcceptanceRepo() as any,
        makeAuditRepo() as any,
      );
      await expect(
        uc.execute({
          email: 'x@x.com',
          username: 'u',
          password: 'p12345',
          acceptedTermsContractId: 'whatever',
          acceptedPrivacyContractId: 'whatever',
        }),
      ).rejects.toMatchObject({ code: 'CONTRACTS_NOT_AVAILABLE' });
    });
  });
});
