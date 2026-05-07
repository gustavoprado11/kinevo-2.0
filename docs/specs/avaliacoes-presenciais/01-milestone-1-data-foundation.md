# Milestone 1 — Data Foundation

**Pré-requisito:** ler `00-visao-geral.md` antes desta spec.

**Goal:** estabelecer toda a fundação de dados, RLS, RPCs e tipos compartilhados para que os milestones seguintes (mobile, web, PDF) possam ser construídos em cima sem mexer mais em schema.

**Plataforma:** SQL (Supabase migrations) + TypeScript em `shared/`.

**Dura:** 4-6 dias úteis.

**Branch:** `feature/avaliacoes-presenciais-m1`.

---

## 1. Entregas

### 1.1 Migration `122_assessments_phase1.sql`

Cria/altera tudo numa única migration aditiva, idempotente. Numeração 122 — a última committed em main é `121_security_hardening_buckets_webhooks.sql`. Antes de criar o arquivo, **confirme** com `ls supabase/migrations/ | sort | tail -3` que 121 ainda é o último; se algo tiver entrado nesse meio-tempo, use o próximo número disponível e atualize o título desta seção via PR.

#### 1.1.1 Estender `form_templates`

```sql
-- Nova categoria 'assessment'
ALTER TABLE form_templates DROP CONSTRAINT IF EXISTS form_templates_category_check;
ALTER TABLE form_templates ADD CONSTRAINT form_templates_category_check
    CHECK (category IN ('anamnese', 'checkin', 'survey', 'assessment'));

-- Modo de entrega: assíncrono (aluno preenche) ou presencial (trainer captura na hora)
ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'student_self'
    CHECK (delivery_mode IN ('student_self', 'trainer_in_person', 'both'));

COMMENT ON COLUMN form_templates.delivery_mode IS
    'student_self = aluno preenche assíncrono (anamnese, checkin). trainer_in_person = trainer captura com aluno presente. both = ambos.';
```

#### 1.1.2 Tabela `assessment_sessions`

Uma sessão = um agendamento de avaliação para um aluno, baseado num template-pacote. Pode estar agendada, em andamento, concluída ou cancelada.

```sql
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Template de pacote usado (form_templates com category='assessment')
    template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL,
    template_version INTEGER,
    template_snapshot JSONB,  -- snapshot do schema_json no momento da sessão

    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Métricas calculadas (pré-computadas no finalize) para queries rápidas
    -- Ex: { "bmi": 23.7, "body_fat_percent": 22.4, "rcq": 0.85, "lean_mass_kg": 55.9, ... }
    computed_metrics JSONB,

    -- Notas livres do trainer
    notes TEXT,

    -- Inbox item criado pra o aluno ao concluir (link com tabela existente)
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
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_status_scheduled ON assessment_sessions(status, scheduled_at);

-- updated_at trigger seguindo padrão do projeto
CREATE TRIGGER trg_assessment_sessions_updated_at
    BEFORE UPDATE ON assessment_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE assessment_sessions IS
    'Sessões de avaliação física presencial. Uma sessão = um momento de avaliação com 1 aluno baseado num template-pacote.';
```

#### 1.1.3 Tabela `assessment_measurements`

Cada medição individual da sessão. Uma sessão tem N measurements. Inclui suporte a múltiplas tentativas (CMJ tira a melhor de 3, dobras tiram a mediana de 2).

```sql
CREATE TABLE IF NOT EXISTS assessment_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,

    -- Identificação da métrica (ex: 'weight', 'skinfold_triceps', 'waist_circumference')
    metric_key TEXT NOT NULL,

    -- Valores
    value_numeric NUMERIC,
    value_text TEXT,             -- para campos textuais (observações por medida)
    value_unit TEXT,             -- 'kg', 'cm', 'mm', '%', 's', 'reps'

    -- Lateralidade (para braço D/E, perna D/E, etc)
    side TEXT CHECK (side IS NULL OR side IN ('left', 'right', 'both', 'unilateral')),

    -- Tentativas (para protocolos com múltiplas tentativas)
    attempt_number INTEGER DEFAULT 1 CHECK (attempt_number >= 1),
    is_selected BOOLEAN DEFAULT true,  -- qual tentativa foi escolhida como resultado oficial

    -- Dados brutos (foto, frames de vídeo, raw input)
    raw_input JSONB,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_measurement_value_present
        CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL OR raw_input IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_assessment_measurements_session ON assessment_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_measurements_metric ON assessment_measurements(metric_key);
CREATE INDEX IF NOT EXISTS idx_assessment_measurements_session_metric
    ON assessment_measurements(session_id, metric_key, attempt_number);

COMMENT ON TABLE assessment_measurements IS
    'Medições individuais de uma sessão. Suporta multi-tentativa (attempt_number) e lateralidade (side).';
```

#### 1.1.4 RLS — espelhar padrão de `047_fix_inbox_data_leak.sql`

```sql
-- Habilitar RLS
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_measurements ENABLE ROW LEVEL SECURITY;

-- Trainer policies (CRUD nas próprias sessões)
CREATE POLICY assessment_sessions_trainer_select
    ON assessment_sessions FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY assessment_sessions_trainer_insert
    ON assessment_sessions FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY assessment_sessions_trainer_update
    ON assessment_sessions FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY assessment_sessions_trainer_delete
    ON assessment_sessions FOR DELETE
    USING (trainer_id = current_trainer_id());

-- Student policy (read-only nas próprias sessões concluídas)
CREATE POLICY assessment_sessions_student_select
    ON assessment_sessions FOR SELECT
    USING (
        student_id = current_student_id()
        AND status = 'completed'
    );

-- Measurements herdam do parent via JOIN
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
```

#### 1.1.5 RPCs (seguindo padrão de `049_trainer_mobile_rpcs.sql`)

Cinco RPCs cobrindo o lifecycle:

```sql
-- 1) Listar sessões do trainer (com filtros opcionais)
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

-- 2) Buscar uma sessão específica com todas as medições
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

-- 3) Criar uma nova sessão
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

    -- Verificar que o aluno é do trainer
    IF NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = p_student_id AND s.coach_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this trainer';
    END IF;

    -- Buscar template e fazer snapshot
    SELECT id, version, schema_json, category
    INTO v_template
    FROM form_templates
    WHERE id = p_template_id
      AND (trainer_id = v_trainer_id OR trainer_id IS NULL)  -- system templates ok
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

-- 4) Salvar medições (batch)
CREATE OR REPLACE FUNCTION public.save_assessment_measurements(
    p_session_id UUID,
    p_measurements JSONB  -- [{"metric_key":"weight","value_numeric":72.1,"value_unit":"kg",...}, ...]
)
RETURNS INT  -- número de medições salvas
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

    -- Marcar started_at se ainda não estiver
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

-- 5) Finalizar sessão (consome computed_metrics calculados pelo client)
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

    -- Criar inbox item para o aluno
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

    -- Atualizar sessão
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

-- Permissões
REVOKE ALL ON FUNCTION
    get_assessment_sessions(UUID, TEXT, INT),
    get_assessment_session(UUID),
    create_assessment_session(UUID, UUID, TIMESTAMPTZ, TEXT),
    save_assessment_measurements(UUID, JSONB),
    finalize_assessment_session(UUID, JSONB, TEXT)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    get_assessment_sessions(UUID, TEXT, INT),
    get_assessment_session(UUID),
    create_assessment_session(UUID, UUID, TIMESTAMPTZ, TEXT),
    save_assessment_measurements(UUID, JSONB),
    finalize_assessment_session(UUID, JSONB, TEXT)
    TO authenticated;
```

### 1.2 Tipos TypeScript em `shared/types/`

Criar `shared/types/assessments.ts` com:

```ts
// Lifecycle
export type AssessmentSessionStatus =
  | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type DeliveryMode = 'student_self' | 'trainer_in_person' | 'both';

// Lateralidade
export type MeasurementSide = 'left' | 'right' | 'both' | 'unilateral';

// Unidades suportadas
export type MeasurementUnit =
  | 'kg' | 'g' | 'cm' | 'mm' | 'm' | '%' | 's' | 'ms'
  | 'reps' | 'rpm' | 'w' | 'kg/m²';

// Métrica calculável (pré-computada no finalize)
export type ComputedMetricKey =
  | 'bmi' | 'body_fat_percent' | 'lean_mass_kg' | 'fat_mass_kg'
  | 'rcq' | 'body_density';

// Protocolo de cálculo
export type AssessmentProtocol =
  | 'jackson_pollock_3'
  | 'jackson_pollock_7'
  | 'petroski_4'
  | 'faulkner_4';

// Row types (mapeiam tabelas SQL)
export interface AssessmentSession {
  id: string;
  trainer_id: string;
  student_id: string;
  template_id: string | null;
  template_version: number | null;
  template_snapshot: AssessmentTemplateSchema | null;
  status: AssessmentSessionStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  computed_metrics: ComputedMetrics | null;
  notes: string | null;
  inbox_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentMeasurement {
  id: string;
  session_id: string;
  metric_key: string;
  value_numeric: number | null;
  value_text: string | null;
  value_unit: MeasurementUnit | null;
  side: MeasurementSide | null;
  attempt_number: number;
  is_selected: boolean;
  raw_input: Record<string, unknown> | null;
  measured_at: string;
}

// Schema do template (extensão do form schema atual)
export interface AssessmentTemplateSchema {
  schema_version: string;  // '1.0'
  layout?: {
    estimated_minutes?: number;
    progress_mode?: 'per_question' | 'bar';
  };
  sections: AssessmentSection[];
}

export interface AssessmentSection {
  id: string;
  title: string;       // ex: "Antropometria", "Composição"
  icon?: string;       // lucide name
  tests: AssessmentTest[];
}

export type AssessmentTest =
  | NumericUnitTest
  | BilateralNumericTest
  | MultiAttemptNumericTest
  | ComputedTest
  | ProtocolTest;     // ex: "dobras J&P 7" — agrupa N skinfolds com cálculo

export interface NumericUnitTest {
  id: string;
  type: 'numeric_unit';
  label: string;
  metric_key: string;
  unit: MeasurementUnit;
  min?: number;
  max?: number;
  required?: boolean;
  hint?: string;
}

export interface BilateralNumericTest {
  id: string;
  type: 'bilateral_numeric';
  label: string;
  metric_key: string;  // será expandido em metric_key+'_left' e '_right' nas measurements
  unit: MeasurementUnit;
  required?: boolean;
}

export interface MultiAttemptNumericTest {
  id: string;
  type: 'multi_attempt_numeric';
  label: string;
  metric_key: string;
  unit: MeasurementUnit;
  attempts: number;       // ex: 3
  selection_strategy: 'best_max' | 'best_min' | 'median' | 'mean';
}

export interface ComputedTest {
  id: string;
  type: 'computed';
  label: string;
  metric_key: ComputedMetricKey;
  formula_id: string;     // ex: 'bmi', 'rcq'
  inputs: string[];       // metric_keys das medições que alimentam a fórmula
}

export interface ProtocolTest {
  id: string;
  type: 'protocol';
  label: string;          // ex: "Dobras Jackson & Pollock 7"
  protocol: AssessmentProtocol;
  // Cada protocolo define internamente os skinfolds que ele coleta
}

// Métricas calculadas (output do finalize)
export interface ComputedMetrics {
  bmi?: number;
  body_density?: number;
  body_fat_percent?: number;
  lean_mass_kg?: number;
  fat_mass_kg?: number;
  rcq?: number;
  // Permite extensão futura sem quebrar compatibilidade
  [key: string]: number | string | undefined;
}
```

### 1.3 Atualizar Supabase types gerados

Rodar `npx supabase gen types typescript --local > shared/types/database.ts` (ou caminho equivalente do projeto) para refletir as novas tabelas. Commitar.

### 1.4 Hooks placeholder em `mobile/hooks/` e `web/src/lib/`

Criar shells dos hooks que serão implementados em M3/M4. Apenas a tipagem e a chamada RPC, sem UI.

**Mobile:** `mobile/hooks/useAssessmentSessions.ts`, `useAssessmentSession.ts`. Pattern: copiar `useTrainerFormSubmissions.ts`.

**Web:** `web/src/actions/assessments/get-sessions.ts`, `create-session.ts`, `save-measurements.ts`, `finalize-session.ts` seguindo o padrão de `web/src/actions/forms/*`.

---

## 2. Fora de escopo deste milestone

- ❌ Engine de fórmulas (Milestone 2)
- ❌ Templates seedados (Milestone 6)
- ❌ Qualquer UI nova (Milestones 3 e 4)
- ❌ PDF (Milestone 5)
- ❌ Edge functions

---

## 3. Acceptance criteria

- ✅ Migration `122_assessments_phase1.sql` aplicada limpa em ambiente de dev. Idempotente (rodar 2x sem erro).
- ✅ Constraint `category IN ('anamnese', 'checkin', 'survey', 'assessment')` ativa.
- ✅ RLS habilitado nas duas tabelas novas, policies cobrem trainer (CRUD) e student (read-only de sessões completed).
- ✅ Os 5 RPCs callable via `supabase.rpc(...)` com tipos retornando JSONB válido.
- ✅ Teste manual ponta a ponta via psql/Supabase Studio:
  1. Trainer cria template `assessment` com 1 NumericUnitTest.
  2. `create_assessment_session` retorna `session_id`.
  3. `save_assessment_measurements` aceita uma medição.
  4. `finalize_assessment_session` muda status para `completed`, cria inbox_item.
  5. `get_assessment_session` retorna a sessão com a medição embedada.
  6. Conectar como o aluno: `get_assessment_session` retorna a mesma sessão (porque está completed).
  7. Tentar como outro trainer: `get_assessment_session` falha com 'access denied'.
- ✅ Tipos TypeScript em `shared/types/assessments.ts` compilam sem erro (`tsc --noEmit`).
- ✅ Hooks placeholder existem (sem UI, mas tipados e funcionais quando chamados).
- ✅ PR aberto com: descrição clara, screenshots da migration aplicada (Supabase Studio), tabela de checklist do acceptance criteria.

---

## 4. Riscos e cuidados

1. **Não dropar `form_templates_category_check` sem o IF EXISTS**. Se já foi alterada por outra migration, a sequência pode quebrar.
2. **Função `update_updated_at()` precisa existir.** Confirmado em `001_initial_schema.sql:332`. Todos os triggers do projeto usam esse nome (não `update_updated_at_column()` que é a convenção genérica de Postgres).
3. **`current_trainer_id()` e `current_student_id()` são helpers já presentes.** Não criar novos. Confirmar que estão no schema `public`.
4. **`student_inbox_items.type` aceita `system_alert`** — confirmar no `026_forms_inbox_phase1_data_security.sql`. Se não, ajustar para usar tipo existente.
5. **JSONB validation**: as constraints `chk_*_is_object` evitam que strings ou arrays sejam armazenadas em colunas que esperam objetos. Manter.
6. **GRANT EXECUTE nos RPCs**: sem isso, RLS bloqueia tudo. Não esquecer.

---

## 5. Como testar manualmente

```sql
-- Como trainer logado, na role apropriada:
SET LOCAL "request.jwt.claim.sub" = '<trainer_user_id>';

-- 1. Criar template assessment de teste
INSERT INTO form_templates (trainer_id, title, category, delivery_mode, schema_json, is_active)
VALUES (
  '<trainer_id>', 'Teste M1', 'assessment', 'trainer_in_person',
  '{"schema_version":"1.0","sections":[{"id":"s1","title":"Antropometria","tests":[{"id":"t1","type":"numeric_unit","label":"Peso","metric_key":"weight","unit":"kg"}]}]}',
  true
)
RETURNING id;

-- 2. Criar sessão
SELECT public.create_assessment_session(
  '<student_id>'::uuid,
  '<template_id>'::uuid,
  NULL,
  'teste manual'
);

-- 3. Salvar medição
SELECT public.save_assessment_measurements(
  '<session_id>'::uuid,
  '[{"metric_key":"weight","value_numeric":72.1,"value_unit":"kg"}]'::jsonb
);

-- 4. Finalizar
SELECT public.finalize_assessment_session(
  '<session_id>'::uuid,
  '{"bmi":23.7}'::jsonb,
  NULL
);

-- 5. Conferir
SELECT public.get_assessment_session('<session_id>'::uuid);
```
