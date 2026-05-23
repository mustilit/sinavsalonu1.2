-- User.emailVerified + emailVerificationToken + emailVerificationTokenExpiresAt
-- Aday kayıt akışına email doğrulama eklemek için.

ALTER TABLE "users"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerificationToken" TEXT,
  ADD COLUMN "emailVerificationTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- Mevcut kullanıcılar zaten "doğrulanmış" sayılır (geri uyumluluk).
UPDATE "users" SET "emailVerified" = true WHERE "createdAt" < NOW();
