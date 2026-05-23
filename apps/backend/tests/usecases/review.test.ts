import { CreateOrUpdateReviewUseCase } from '../../src/application/use-cases/review/CreateOrUpdateReviewUseCase';

// Yeni domain: review per-package per-candidate.
// CreateOrUpdateReviewUseCase artık packageId alır ve testPackage.findUnique sorgulayıp
// paketteki test'ler için hasPurchase/hasSubmittedAttempt kontrolü yapar.
jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: {
    testPackage: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'pkg1',
        educatorId: 'e1',
        tests: [{ id: 't1' }, { id: 't2' }],
      }),
    },
  },
}));

jest.mock('../../src/infrastructure/queue/queue.service', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    enqueueJob: jest.fn().mockResolvedValue(undefined),
  })),
}));

test('cannot create review without purchase for any test in the package', async () => {
  const reviewRepo: any = { upsertPackageReview: async () => null };
  const purchaseRepo: any = { hasPurchase: async () => false };
  const attemptRepo: any = { hasSubmittedAttempt: async () => true };
  const auditRepo: any = { create: async () => null };
  const uc = new CreateOrUpdateReviewUseCase(reviewRepo, purchaseRepo, attemptRepo, auditRepo);
  await expect(uc.execute('pkg1', 'c1', { testRating: 4 })).rejects.toThrow();
});

test('cannot create review without any submitted attempt in the package', async () => {
  const reviewRepo: any = { upsertPackageReview: async () => null };
  const purchaseRepo: any = { hasPurchase: async () => true };
  const attemptRepo: any = { hasSubmittedAttempt: async () => false };
  const auditRepo: any = { create: async () => null };
  const uc = new CreateOrUpdateReviewUseCase(reviewRepo, purchaseRepo, attemptRepo, auditRepo);
  await expect(uc.execute('pkg1', 'c1', { testRating: 5 })).rejects.toThrow();
});

test('upsert package review works when candidate has purchase + submitted attempt', async () => {
  const created = { id: 'r1', packageId: 'pkg1', candidateId: 'c1', testRating: 5 };
  const reviewRepo: any = { upsertPackageReview: async () => created };
  const purchaseRepo: any = { hasPurchase: async () => true };
  const attemptRepo: any = { hasSubmittedAttempt: async () => true };
  const auditRepo: any = { create: async () => null };
  const uc = new CreateOrUpdateReviewUseCase(reviewRepo, purchaseRepo, attemptRepo, auditRepo);
  const res = await uc.execute('pkg1', 'c1', { testRating: 5 });
  expect(res).toEqual(created);
});
