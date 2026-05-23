export type ReviewRecord = {
  id: string;
  packageId: string | null;
  testId: string | null;
  educatorId: string;
  candidateId: string;
  testRating: number;
  educatorRating?: number | null;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface IReviewRepository {
  /**
   * Paket bazlı review upsert — yeni domain modeli.
   * Aynı (packageId, candidateId) için varsa günceller, yoksa yeni kayıt.
   */
  upsertPackageReview(input: {
    packageId: string;
    educatorId: string;
    candidateId: string;
    testRating?: number;
    educatorRating?: number;
    comment?: string;
  }): Promise<ReviewRecord>;

  /**
   * Paket için review listesi (cursor pagination).
   * Yeni model: her aday tek satır.
   */
  listReviewsForPackage(packageId: string, limit?: number, cursor?: string): Promise<{ items: ReviewRecord[]; nextCursor?: string }>;

  /** Paket için ortalama puan ve sayım — her aday tek oy. */
  getAggregateForPackage(packageId: string): Promise<{ avg: number | null; count: number }>;

  /** Eğitici için ortalama puan ve sayım. */
  getAggregateForEducator(educatorId: string): Promise<{ avg: number | null; count: number }>;
}
