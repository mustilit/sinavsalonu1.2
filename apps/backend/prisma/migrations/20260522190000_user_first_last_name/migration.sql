-- User.firstName + User.lastName — eğitici kayıt formu için resmi ad alanları.
-- Aday için nullable; eğitici için RegisterEducatorUseCase tarafında zorunluluk doğrulanır.

ALTER TABLE "users"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT;
