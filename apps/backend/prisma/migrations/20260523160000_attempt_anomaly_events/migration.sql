-- Aday'ın test çözme oturumunda toplanan anti-leak / anti-cheat olayları.
-- Frontend useTestProctoring hook'u event'leri buraya gönderir.

CREATE TABLE "attempt_anomaly_events" (
  "id"          TEXT NOT NULL,
  "attemptId"   TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "payload"     JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempt_anomaly_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attempt_anomaly_events_attemptId_type_idx" ON "attempt_anomaly_events"("attemptId", "type");
CREATE INDEX "attempt_anomaly_events_candidateId_createdAt_idx" ON "attempt_anomaly_events"("candidateId", "createdAt");

ALTER TABLE "attempt_anomaly_events"
  ADD CONSTRAINT "attempt_anomaly_events_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attempt_anomaly_events"
  ADD CONSTRAINT "attempt_anomaly_events_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
