-- Migration: Review per-package model
--
-- Eski: 1 review = 1 (testId, candidateId) çifti — aday paketin her testine ayrı puan veriyordu
-- Yeni: 1 review = 1 (packageId, candidateId) çifti — aday paket için TEK puan verir
--
-- Adımlar:
--   1) packageId kolonunu nullable ekle, testId'yi nullable yap (provenance için tut)
--   2) Mevcut review'ları packageId ile zenginleştir (exam_tests.packageId lookup)
--   3) Aynı (packageId, candidateId) için birden çok satır varsa: en yeniyi tut, testRating'i
--      grup ortalamasına ata, comment'i grubun en yeni non-null comment'i yap, diğer satırları sil
--   4) Eski unique constraint (testId, candidateId) drop
--   5) Yeni unique constraint (packageId, candidateId) ekle
--   6) Yeni index (packageId) ekle

-- 1) Şema değişiklikleri
ALTER TABLE "reviews" ADD COLUMN "packageId" TEXT;
ALTER TABLE "reviews" ALTER COLUMN "testId" DROP NOT NULL;

-- 2) Backfill: testId üzerinden exam_tests.packageId'yi al
UPDATE "reviews" r
SET "packageId" = et."packageId"
FROM "exam_tests" et
WHERE et.id = r."testId"
  AND et."packageId" IS NOT NULL;

-- 3) Dedupe: aynı (packageId, candidateId) grubu için tek satır bırak
--    - Tutulacak satır = en son updatedAt (yoksa createdAt)
--    - testRating = grubun ortalamasının yuvarlanmış değeri
--    - comment    = en yeni non-null comment

-- 3a) Her grup için ortalama puan, en yeni yorum ve tutulacak ID hesapla
WITH groups AS (
  SELECT
    "packageId",
    "candidateId",
    ROUND(AVG("testRating"))::int AS avg_rating,
    -- En yeni non-null comment (created date desc)
    (
      SELECT comment FROM "reviews" r2
      WHERE r2."packageId" = r1."packageId"
        AND r2."candidateId" = r1."candidateId"
        AND r2.comment IS NOT NULL AND TRIM(r2.comment) <> ''
      ORDER BY r2."updatedAt" DESC, r2."createdAt" DESC
      LIMIT 1
    ) AS latest_comment,
    -- Tutulacak satır = en yeni
    (
      SELECT id FROM "reviews" r3
      WHERE r3."packageId" = r1."packageId"
        AND r3."candidateId" = r1."candidateId"
      ORDER BY r3."updatedAt" DESC, r3."createdAt" DESC
      LIMIT 1
    ) AS keep_id
  FROM "reviews" r1
  WHERE r1."packageId" IS NOT NULL
  GROUP BY "packageId", "candidateId"
)
UPDATE "reviews" r
SET "testRating" = g.avg_rating,
    "comment"    = g.latest_comment,
    "updatedAt"  = NOW()
FROM groups g
WHERE r.id = g.keep_id;

-- 3b) Aynı gruptaki tutulmayacak satırları sil
DELETE FROM "reviews" r
WHERE r."packageId" IS NOT NULL
  AND r.id NOT IN (
    SELECT (
      SELECT id FROM "reviews" r2
      WHERE r2."packageId" = r."packageId"
        AND r2."candidateId" = r."candidateId"
      ORDER BY r2."updatedAt" DESC, r2."createdAt" DESC
      LIMIT 1
    )
    FROM "reviews"
    WHERE "packageId" IS NOT NULL
    GROUP BY "packageId", "candidateId"
  );

-- 4) Eski unique constraint kaldır
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_testId_candidateId_key";

-- 5) Yeni unique constraint
CREATE UNIQUE INDEX "reviews_packageId_candidateId_key"
  ON "reviews" ("packageId", "candidateId");

-- 6) Yeni index
CREATE INDEX "reviews_packageId_idx" ON "reviews" ("packageId");
