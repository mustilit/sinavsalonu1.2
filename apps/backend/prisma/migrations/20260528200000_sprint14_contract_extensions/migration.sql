-- Sprint 14 — Sözleşme onayı zorunluluğu
--
-- 1. ContractType enum'una 2 yeni değer ekle:
--    PRIVACY      → KVKK Aydınlatma Metni (kayıt sırasında)
--    DISTANCE_SALE → Mesafeli Satış Sözleşmesi + Ön Bilgilendirme (her satın almada)
--
-- 2. Purchase tablosuna mesafeli satış acceptance snapshot kolonları:
--    - Her satın alma satırı kendi içinde delil zinciri taşır
--    - ContractAcceptance tablosundan ayrı (TKHK m.48 + KVKK kanıt zinciri)
--    - distanceSaleContractId snapshot'tır (FK değil) — Contract pasif/silinse bile kayıt korunur

-- 1) ContractType enum genişletme (PostgreSQL ALTER TYPE ... ADD VALUE)
-- IF NOT EXISTS zaten Postgres 12+ destekli; idempotent yapar (re-run safe).
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'PRIVACY';
ALTER TYPE "ContractType" ADD VALUE IF NOT EXISTS 'DISTANCE_SALE';

-- 2) Purchase tablosuna 4 yeni kolon
ALTER TABLE "purchases"
  ADD COLUMN IF NOT EXISTS "distanceSaleContractId"       UUID,
  ADD COLUMN IF NOT EXISTS "distanceSaleAcceptedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "distanceSaleAcceptedIp"       TEXT,
  ADD COLUMN IF NOT EXISTS "distanceSaleAcceptedUserAgent" TEXT;

-- NOT NULL constraint EKLEMEYİZ; mevcut purchase kayıtları için null kalır.
-- Yeni satın almalarda backend zorunlu kılar (uygulama katmanı).
