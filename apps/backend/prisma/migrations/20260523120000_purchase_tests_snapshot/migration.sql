-- Satın alma anında paketin testlerinin / sorularının / seçeneklerinin
-- donmuş snapshot'ı için Purchase.testsSnapshot JSONB kolonu.
--
-- Eğitici sonradan soru güncellerse mevcut alıcılar bu snapshot'tan beslenir,
-- yeni alıcılar canlı içeriği snapshot olarak alır.

ALTER TABLE "purchases" ADD COLUMN "testsSnapshot" JSONB;

-- Backfill: mevcut satın almalar için canlı içeriği snapshot olarak yaz.
-- Best-effort: educator zaten güncel sürümü görüyor, yeni snapshot yapısı
-- en azından sonraki güncellemelere karşı koruyor.
DO $$
DECLARE
  p RECORD;
  snap JSONB;
BEGIN
  FOR p IN SELECT id, "testId", "packageId" FROM "purchases" WHERE "testsSnapshot" IS NULL LOOP
    IF p."packageId" IS NOT NULL THEN
      -- Paket satın alımı: paketteki tüm testlerin snapshot'ını al
      SELECT COALESCE(jsonb_agg(t_snap), '[]'::jsonb) INTO snap
      FROM (
        SELECT jsonb_build_object(
          'testId', et.id,
          'title', et.title,
          'isTimed', et."isTimed",
          'duration', et.duration,
          'questions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', eq.id,
              'content', eq.content,
              'mediaUrl', eq."mediaUrl",
              'order', eq."order",
              'solutionText', eq."solutionText",
              'solutionMediaUrl', eq."solutionMediaUrl",
              'options', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', eo.id,
                  'content', eo.content,
                  'mediaUrl', eo."mediaUrl",
                  'isCorrect', eo."isCorrect"
                ) ORDER BY eo.id)
                FROM "exam_options" eo WHERE eo."questionId" = eq.id
              ), '[]'::jsonb)
            ) ORDER BY eq."order", eq.id)
            FROM "exam_questions" eq WHERE eq."testId" = et.id
          ), '[]'::jsonb)
        ) AS t_snap
        FROM "exam_tests" et
        WHERE et."packageId" = p."packageId"
          AND et."deletedAt" IS NULL
        ORDER BY et."createdAt" ASC
      ) s;
    ELSE
      -- Tekil test satın alımı (eski akış): sadece o testi snapshot'a al
      SELECT jsonb_build_array(jsonb_build_object(
        'testId', et.id,
        'title', et.title,
        'isTimed', et."isTimed",
        'duration', et.duration,
        'questions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', eq.id,
            'content', eq.content,
            'mediaUrl', eq."mediaUrl",
            'order', eq."order",
            'solutionText', eq."solutionText",
            'solutionMediaUrl', eq."solutionMediaUrl",
            'options', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', eo.id,
                'content', eo.content,
                'mediaUrl', eo."mediaUrl",
                'isCorrect', eo."isCorrect"
              ) ORDER BY eo.id)
              FROM "exam_options" eo WHERE eo."questionId" = eq.id
            ), '[]'::jsonb)
          ) ORDER BY eq."order", eq.id)
          FROM "exam_questions" eq WHERE eq."testId" = et.id
        ), '[]'::jsonb)
      )) INTO snap
      FROM "exam_tests" et
      WHERE et.id = p."testId" AND et."deletedAt" IS NULL;
    END IF;

    IF snap IS NOT NULL THEN
      UPDATE "purchases" SET "testsSnapshot" = snap WHERE id = p.id;
    END IF;
  END LOOP;
END $$;
