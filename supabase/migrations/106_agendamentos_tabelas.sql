-- ============================================================================
-- Kinevo — 106 Agendamentos (Fase 1)
-- ============================================================================
-- Rotinas recorrentes de atendimento 1:1 entre trainer e aluno.
--
-- Estratégia: guardar a REGRA (recurring_appointments) + apenas desvios
-- pontuais (appointment_exceptions). Ocorrências são computadas on-the-fly
-- via shared/utils/appointments-projection.ts — mesmo padrão de
-- assigned_workouts.scheduled_days + shared/utils/schedule-projection.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- recurring_appointments — regra de uma rotina
-- ----------------------------------------------------------------------------
CREATE TABLE recurring_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Regra de recorrência
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    frequency TEXT NOT NULL DEFAULT 'weekly'
        CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),

    -- Ciclo de vida
    starts_on DATE NOT NULL,
    ends_on DATE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'canceled')),

    -- Metadados
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_appointments_trainer
    ON recurring_appointments(trainer_id);
CREATE INDEX idx_recurring_appointments_student
    ON recurring_appointments(student_id);
CREATE INDEX idx_recurring_appointments_active_trainer
    ON recurring_appointments(trainer_id, status) WHERE status = 'active';

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON recurring_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- appointment_exceptions — desvios pontuais de uma regra
-- ----------------------------------------------------------------------------
CREATE TABLE appointment_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_appointment_id UUID NOT NULL
        REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Data original da ocorrência (antes de qualquer mudança)
    occurrence_date DATE NOT NULL,

    kind TEXT NOT NULL
        CHECK (kind IN ('rescheduled', 'canceled', 'completed', 'no_show')),

    -- Preenchidos apenas quando kind = 'rescheduled'
    new_date DATE,
    new_start_time TIME,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (recurring_appointment_id, occurrence_date)
);

CREATE INDEX idx_appointment_exceptions_recurring
    ON appointment_exceptions(recurring_appointment_id);
CREATE INDEX idx_appointment_exceptions_trainer_date
    ON appointment_exceptions(trainer_id, occurrence_date);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_exceptions ENABLE ROW LEVEL SECURITY;

-- recurring_appointments
CREATE POLICY "Trainer can read own recurring appointments"
    ON recurring_appointments FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can insert own recurring appointments"
    ON recurring_appointments FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can update own recurring appointments"
    ON recurring_appointments FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can delete own recurring appointments"
    ON recurring_appointments FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access recurring_appointments"
    ON recurring_appointments FOR ALL
    USING (auth.role() = 'service_role');

-- appointment_exceptions
CREATE POLICY "Trainer can read own appointment exceptions"
    ON appointment_exceptions FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can insert own appointment exceptions"
    ON appointment_exceptions FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can update own appointment exceptions"
    ON appointment_exceptions FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY "Trainer can delete own appointment exceptions"
    ON appointment_exceptions FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access appointment_exceptions"
    ON appointment_exceptions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_exceptions;

COMMENT ON TABLE recurring_appointments IS
    'Rotinas recorrentes de atendimento. Guarda a regra; ocorrências são computadas on-the-fly.';
COMMENT ON TABLE appointment_exceptions IS
    'Desvios pontuais de uma rotina (remarcações, cancelamentos individuais, completions, no-shows).';
