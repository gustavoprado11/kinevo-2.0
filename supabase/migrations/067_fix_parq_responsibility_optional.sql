-- Migration 067: Make parq_responsibility_term optional
--
-- Problem: Students get "Required field missing: parq_responsibility_term" when
-- submitting the initial assessment form. This field is a conditional liability
-- waiver that only applies if the student answered "Sim" to any PAR-Q question.
-- Since we don't support conditional logic between questions, the pragmatic fix
-- is to make it optional.
--
-- This migration updates:
-- 1. The form_templates.schema_json (for future assignments)
-- 2. Any existing draft submissions' schema_snapshot_json (so blocked students can resubmit)

BEGIN;

-- 1. Update the template schema_json
UPDATE form_templates
SET schema_json = (
    SELECT jsonb_set(
        schema_json,
        ARRAY['questions', idx::text, 'required'],
        'false'::jsonb
    )
    FROM (
        SELECT (ordinality - 1)::text AS idx
        FROM jsonb_array_elements(schema_json -> 'questions') WITH ORDINALITY AS q
        WHERE q.value ->> 'id' = 'parq_responsibility_term'
    ) sub
)
WHERE system_key = 'initial_assessment'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(schema_json -> 'questions') AS q
    WHERE q ->> 'id' = 'parq_responsibility_term'
      AND (q ->> 'required')::boolean = true
  );

-- 2. Update existing draft submissions so blocked students can retry
UPDATE form_submissions
SET schema_snapshot_json = (
    SELECT jsonb_set(
        schema_snapshot_json,
        ARRAY['questions', idx::text, 'required'],
        'false'::jsonb
    )
    FROM (
        SELECT (ordinality - 1)::text AS idx
        FROM jsonb_array_elements(schema_snapshot_json -> 'questions') WITH ORDINALITY AS q
        WHERE q.value ->> 'id' = 'parq_responsibility_term'
    ) sub
)
WHERE status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(schema_snapshot_json -> 'questions') AS q
    WHERE q ->> 'id' = 'parq_responsibility_term'
      AND (q ->> 'required')::boolean = true
  );

COMMIT;
