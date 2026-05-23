-- Tek aktif oturum: User.activeSessionId
ALTER TABLE "users" ADD COLUMN "activeSessionId" TEXT;

-- Server-side draft yedeği — eğitici sihirbazları için
CREATE TABLE "draft_snapshots" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "payload"   JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "draft_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "draft_snapshots_ownerId_key_key" ON "draft_snapshots"("ownerId", "key");
CREATE INDEX "draft_snapshots_updatedAt_idx" ON "draft_snapshots"("updatedAt");

ALTER TABLE "draft_snapshots"
  ADD CONSTRAINT "draft_snapshots_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
