-- Migration: 20260530180000_pending_registration_educator_fields
-- PendingRegistration tablosuna eğitici wizard step 2 alanları eklendi.
-- Kayıt anında toplanan: CV URL, uzmanlık alanları, mezuniyet bilgisi, bio.
-- Prisma client regenerate edilemediği (Windows EPERM) için raw SQL.

ALTER TABLE "pending_registrations"
  ADD COLUMN "cvUrl"         TEXT,
  ADD COLUMN "specializations" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "educationInfo" TEXT,
  ADD COLUMN "bio"           TEXT;
