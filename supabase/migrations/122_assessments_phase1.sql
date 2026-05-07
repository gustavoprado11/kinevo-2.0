-- ============================================================================
-- Kinevo — 122 Assessments Phase 1 (Data Foundation)
-- ============================================================================
-- Estabelece a fundação de dados para o módulo de Avaliações Presenciais:
--   1. Estende form_templates (categoria 'assessment' + delivery_mode).
--   2. Cria assessment_sessions (lifecycle de uma avaliação presencial).
--   3. Cria assessment_measurements (medições individuais com multi-tentativa).
--   4. Habilita RLS com policies trainer-scoped (CRUD) e student-scoped (read-only
--      em sessões 'completed').
--   5. Cria 5 RPCs SECURITY DEFINER cobrindo o lifecycle:
--        - get_assessment_sessions
--        - get_assessment_session
--        - create_assessment_session
--        - save_assessment_measurements
--        - finalize_assessment_session
--
-- Migration aditiva e idempotente. Não dropa nada além do CHECK de category
-- (que é recriado com a nova lista de valores).
-- Helpers reutilizados: current_trainer_id(), current_student_id(),
-- update_updated_at() (todos definidos em 001_initial_schema.sql).
-- ============================================================================

-- ============================================================================
-- 1) form_templates: categoria 'assessment' + delivery_mode
-- ============================================================================
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_category_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_category_check
    CHECK (category IN ('anamnese', 'checkin', 'survey', 'assessment'));

ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'student_self';

-- Adiciona o CHECK em separado pra ser idempotente em re-runs (não há IF NOT
-- EXISTS para constraints; DROP IF EXISTS evita erro na segunda execução).
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_delivery_mode_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_delivery_mode_check
    CHECK (delivery_mode IN ('student_self', 'trainer_in_person', 'both'));

COMMENT ON COLUMN form_templates.delivery_mode IS
    'student_self = aluno preenche assíncrono (anamnese, checkin). trainer_in_person = trainer captura com aluno presente. both = ambos.';

-- ============================================================================
-- 2) assessment_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL,
    template_version INTEGER,
    template_snapshot JSONB,

    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    computed_metrics JSONB,
    notes TEXT,

    inbox_item_id UUID REFERENCES student_inbox_items(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_assessment_sessions_metrics_is_object
        CHECK (computed_metrics IS NULL OR jsonb_typeof(computed_metrics) = 'object'),
    CONSTRAINT chk_assessment_sessions_snapshot_is_object
        CHECK (template_snapshot IS NULL OR jsonb_typeof(template_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_trainer ON assessment_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_student ON assessment_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status_scheduled
    ON assessment_sessions(status, scheduled_at);

DROP TRIGGER IF EXISTS trg_assessment_sessions_updated_at ON assessment_sessions;
CREATE TRIGGER trg_assessment_sessions_updated_at
    BEFORE UPDATE ON assessment_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE assessment_sessions IS
    'Sessões de avaliação física presencial. Uma sessão = um momento de avaliação com 1 aluno baseado num template-pacote.';

-- ============================================================================
-- 3) assessment_measurements
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,

    metric_key TEXT NOT NULL,

    value_numeric NUMERIC,
    value_text TEXT,
    value_unit TEXT,

    side TEXT CHECK (side IS NULL OR side IN ('left', 'right', 'both', 'unilateral')),

    attempt_number INTEGER DEFAULT 1 CHECK (attempt_number >= 1),
    is_selected BOOLEAN DEFAULT true,

    raw_input JSONB,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_measurement_value_present
        CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL OR raw_input IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_assessment_measurements_session
    ON assessment_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_measurements_metric
    ON assessment_measurements(metric_key);
CREATE INDEX IF NOT EXISTS idx_assessment_measurements_session_metric
    ON assessment_measurements(session_id, metric_key, attempt_number);

COMMENT ON TABLE assessment_measurements IS
    'Medições individuais de uma sessão. Suporta multi-tentativa (attempt_number) e lateralidade (side).';

-- ============================================================================
-- 4) RLS — assessment_sessions
-- ============================================================================
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_sessions_trainer_select ON assessment_sessions;
CREATE POLICY assessment_sessions_trainer_select
    ON assessment_sessions FOR SELECT
    USING (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS assessment_sessions_trainer_insert ON assessment_sessions;
CREATE POLICY assessment_sessions_trainer_insert
    ON assessment_sessions FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS assessment_sessions_trainer_update ON assessment_sessions;
CREATE POLICY assessment_sessions_trainer_update
    ON assessment_sessions FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS assessment_sessions_trainer_delete ON assessment_sessions;
CREATE POLICY assessment_sessions_trainer_delete
    ON assessment_sessions FOR DELETE
    USING (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS assessment_sessions_student_select ON assessment_sessions;
CREATE POLICY assessment_sessions_student_select
    ON assessment_sessions FOR SELECT
    USING (
        student_id = current_student_id()
        AND status = 'completed'
    );

-- ============================================================================
-- 5) RLS — assessment_measurements (herdam permissão do parent)
-- ============================================================================
ALTER TABLE assessment_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_measurements_trainer_all ON assessment_measurements;
CREATE POLICY assessment_measurements_trainer_all
    ON assessment_measurements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM assessment_sessions s
            WHERE s.id = assessment_measurements.session_id
              AND s.trainer_id = current_trainer_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM assessment_sessions s
            WHERE s.id = assessment_measurements.session_id
              AND s.trainer_id = current_trainer_id()
        )
    );

DROP POLICY IF EXISTS assessment_measurements_student_select ON assessment_measurements;
CREATE POLICY assessment_measurements_student_select
    ON assessment_measurements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM assessment_sessions s
            WHERE s.id = assessment_measurements.session_id
              AND s.student_id = current_student_id()
              AND s.status = 'completed'
        )
    );

-- ============================================================================
-- 6) RPCs
-- ============================================================================

-- 6.1 — Listar sessões do trainer
CREATE OR REPLACE FUNCTION public.get_assessment_sessions(
    p_student_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.scheduled_at DESC NULLS LAST)
        FROM (
            SELECT s.id, s.student_id, s.template_id, s.status,
                   s.scheduled_at, s.started_at, s.completed_at,
                   s.computed_metrics,
                   st.name AS student_name, st.avatar_url AS student_avatar,
                   ft.title AS template_title
            FROM assessment_sessions s
            JOIN students st ON st.id = s.student_id
            LEFT JOIN form_templates ft ON ft.id = s.template_id
            WHERE s.trainer_id = v_trainer_id
              AND (p_student_id IS NULL OR s.student_id = p_student_id)
              AND (p_status IS NULL OR s.status = p_status)
            ORDER BY s.scheduled_at DESC NULLS LAST
            LIMIT p_limit
        ) sub
    ), '[]'::jsonb);
END;
$$;

-- 6.2 — Buscar uma sessão específica com todas as medições
CREATE OR REPLACE FUNCTION public.get_assessment_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_student_id UUID := current_student_id();
    v_result JSONB;
BEGIN
    IF v_trainer_id IS NULL AND v_student_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT jsonb_build_object(
        'session', row_to_json(s)::jsonb,
        'student', row_to_json(st)::jsonb,
        'template', row_to_json(ft)::jsonb,
        'measurements', COALESCE((
            SELECT jsonb_agg(row_to_json(m)::jsonb ORDER BY m.measured_at)
            FROM assessment_measurements m
            WHERE m.session_id = p_session_id
        ), '[]'::jsonb)
    )
    INTO v_result
    FROM assessment_sessions s
    JOIN students st ON st.id = s.student_id
    LEFT JOIN form_templates ft ON ft.id = s.template_id
    WHERE s.id = p_session_id
      AND (s.trainer_id = v_trainer_id
           OR (s.student_id = v_student_id AND s.status = 'completed'));

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Session not found or access denied';
    END IF;

    RETURN v_result;
END;
$$;

-- 6.3 — Criar uma nova sessão
CREATE OR REPLACE FUNCTION public.create_assessment_session(
    p_student_id UUID,
    p_template_id UUID,
    p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_template RECORD;
    v_session_id UUID;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can create assessment sessions';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = p_student_id AND s.coach_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this trainer';
    END IF;

    SELECT id, version, schema_json, category
    INTO v_template
    FROM form_templates
    WHERE id = p_template_id
      AND (trainer_id = v_trainer_id OR trainer_id IS NULL)
      AND category = 'assessment'
      AND is_active = true;

    IF v_template IS NULL THEN
        RAISE EXCEPTION 'Assessment template not found or not accessible';
    END IF;

    INSERT INTO assessment_sessions (
        trainer_id, student_id, template_id, template_version, template_snapshot,
        status, scheduled_at, notes
    ) VALUES (
        v_trainer_id, p_student_id, v_template.id, v_template.version, v_template.schema_json,
        CASE WHEN p_scheduled_at IS NULL THEN 'in_progress' ELSE 'scheduled' END,
        p_scheduled_at, p_notes
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

-- 6.4 — Salvar medições (batch)
CREATE OR REPLACE FUNCTION public.save_assessment_measurements(
    p_session_id UUID,
    p_measurements JSONB
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_session RECORD;
    v_count INT := 0;
    v_m JSONB;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can save measurements';
    END IF;

    SELECT id, status INTO v_session
    FROM assessment_sessions
    WHERE id = p_session_id AND trainer_id = v_trainer_id;

    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF v_session.status NOT IN ('scheduled', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot save measurements on a % session', v_session.status;
    END IF;

    UPDATE assessment_sessions
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now())
    WHERE id = p_session_id AND status = 'scheduled';

    FOR v_m IN SELECT * FROM jsonb_array_elements(p_measurements)
    LOOP
        INSERT INTO assessment_measurements (
            session_id, metric_key, value_numeric, value_text, value_unit,
            side, attempt_number, is_selected, raw_input
        ) VALUES (
            p_session_id,
            v_m->>'metric_key',
            (v_m->>'value_numeric')::NUMERIC,
            v_m->>'value_text',
            v_m->>'value_unit',
            v_m->>'side',
            COALESCE((v_m->>'attempt_number')::INT, 1),
            COALESCE((v_m->>'is_selected')::BOOLEAN, true),
            v_m->'raw_input'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 6.5 — Finalizar sessão (consome computed_metrics calculados pelo client)
CREATE OR REPLACE FUNCTION public.finalize_assessment_session(
    p_session_id UUID,
    p_computed_metrics JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_session RECORD;
    v_inbox_id UUID;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can finalize sessions';
    END IF;

    SELECT id, student_id, status INTO v_session
    FROM assessment_sessions
    WHERE id = p_session_id AND trainer_id = v_trainer_id;

    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF v_session.status = 'completed' THEN
        RAISE EXCEPTION 'Session already completed';
    END IF;

    INSERT INTO student_inbox_items (
        student_id, trainer_id, type, status, title, subtitle, payload, completed_at
    ) VALUES (
        v_session.student_id, v_trainer_id, 'system_alert', 'unread',
        'Avaliação concluída',
        'Seu treinador compartilhou os resultados da avaliação',
        jsonb_build_object('assessment_session_id', p_session_id),
        now()
    )
    RETURNING id INTO v_inbox_id;

    UPDATE assessment_sessions
    SET status = 'completed',
        completed_at = now(),
        computed_metrics = p_computed_metrics,
        notes = COALESCE(p_notes, notes),
        inbox_item_id = v_inbox_id
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'session_id', p_session_id,
        'inbox_item_id', v_inbox_id,
        'completed_at', now()
    );
END;
$$;

-- ============================================================================
-- 7) Permissões — REVOKE ALL FROM PUBLIC + GRANT EXECUTE TO authenticated
-- ============================================================================
REVOKE ALL ON FUNCTION
    public.get_assessment_sessions(UUID, TEXT, INT),
    public.get_assessment_session(UUID),
    public.create_assessment_session(UUID, UUID, TIMESTAMPTZ, TEXT),
    public.save_assessment_measurements(UUID, JSONB),
    public.finalize_assessment_session(UUID, JSONB, TEXT)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.get_assessment_sessions(UUID, TEXT, INT),
    public.get_assessment_session(UUID),
    public.create_assessment_session(UUID, UUID, TIMESTAMPTZ, TEXT),
    public.save_assessment_measurements(UUID, JSONB),
    public.finalize_assessment_session(UUID, JSONB, TEXT)
    TO authenticated;
