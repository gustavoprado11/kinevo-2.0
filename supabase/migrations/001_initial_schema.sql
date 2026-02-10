-- ============================================================================
-- Kinevo 2.0 — Initial Database Schema
-- PostgreSQL (Supabase)
-- ============================================================================
-- This migration creates the complete database schema for Kinevo 2.0,
-- a SaaS platform for workout prescription and execution.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 trainers — Treinadores
-- ----------------------------------------------------------------------------
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainers_auth_user_id ON trainers(auth_user_id);

-- ----------------------------------------------------------------------------
-- 2.2 students — Alunos
-- ----------------------------------------------------------------------------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_trainer_id ON students(trainer_id);
CREATE INDEX idx_students_auth_user_id ON students(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_students_email_trainer ON students(trainer_id, email);

-- ----------------------------------------------------------------------------
-- 2.3 exercises — Biblioteca de Exercícios
-- ----------------------------------------------------------------------------
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    instructions TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_trainer_id ON exercises(trainer_id);
CREATE INDEX idx_exercises_muscle_group ON exercises(trainer_id, muscle_group);
CREATE INDEX idx_exercises_name_search ON exercises(trainer_id, name);

-- ----------------------------------------------------------------------------
-- 2.4 program_templates — Biblioteca de Programas (Templates)
-- ----------------------------------------------------------------------------
CREATE TABLE program_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_templates_trainer_id ON program_templates(trainer_id);

-- ----------------------------------------------------------------------------
-- 2.5 workout_templates — Treinos do Template (A, B, C...)
-- ----------------------------------------------------------------------------
CREATE TABLE workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workout_templates_program ON workout_templates(program_template_id);
CREATE INDEX idx_workout_templates_order ON workout_templates(program_template_id, order_index);

-- ----------------------------------------------------------------------------
-- 2.6 workout_item_templates — Itens do Treino Template
-- ----------------------------------------------------------------------------
CREATE TABLE workout_item_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES workout_item_templates(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('exercise', 'superset', 'note')),
    order_index INTEGER NOT NULL,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    sets INTEGER,
    reps TEXT,
    rest_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT chk_exercise_required CHECK (
        item_type != 'exercise' OR exercise_id IS NOT NULL
    ),
    CONSTRAINT chk_superset_no_parent CHECK (
        item_type != 'superset' OR parent_item_id IS NULL
    )
);

CREATE INDEX idx_workout_item_templates_workout ON workout_item_templates(workout_template_id);
CREATE INDEX idx_workout_item_templates_parent ON workout_item_templates(parent_item_id) WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_workout_item_templates_order ON workout_item_templates(workout_template_id, parent_item_id, order_index);

-- ----------------------------------------------------------------------------
-- 2.7 assigned_programs — Programas Atribuídos a Alunos (Instâncias)
-- ----------------------------------------------------------------------------
CREATE TABLE assigned_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES program_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Progress tracking fields
    current_week INTEGER,
    last_completed_workout_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assigned_programs_student ON assigned_programs(student_id);
CREATE INDEX idx_assigned_programs_trainer ON assigned_programs(trainer_id);
CREATE INDEX idx_assigned_programs_active ON assigned_programs(student_id) WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- 2.8 assigned_workouts — Treinos Atribuídos (Cópia)
-- ----------------------------------------------------------------------------
CREATE TABLE assigned_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_program_id UUID NOT NULL REFERENCES assigned_programs(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assigned_workouts_program ON assigned_workouts(assigned_program_id);
CREATE INDEX idx_assigned_workouts_order ON assigned_workouts(assigned_program_id, order_index);

-- ----------------------------------------------------------------------------
-- 2.9 assigned_workout_items — Itens do Treino Atribuído (Cópia com Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE assigned_workout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_workout_id UUID NOT NULL REFERENCES assigned_workouts(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES assigned_workout_items(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES workout_item_templates(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('exercise', 'superset', 'note')),
    order_index INTEGER NOT NULL,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    -- Exercise snapshots for historical consistency
    exercise_name TEXT,
    exercise_muscle_group TEXT,
    exercise_equipment TEXT,
    -- Prescription parameters
    sets INTEGER,
    reps TEXT,
    rest_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assigned_workout_items_workout ON assigned_workout_items(assigned_workout_id);
CREATE INDEX idx_assigned_workout_items_parent ON assigned_workout_items(parent_item_id) WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_assigned_workout_items_order ON assigned_workout_items(assigned_workout_id, parent_item_id, order_index);

-- ----------------------------------------------------------------------------
-- 2.10 workout_sessions — Sessões de Treino (Execução)
-- ----------------------------------------------------------------------------
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    assigned_workout_id UUID NOT NULL REFERENCES assigned_workouts(id) ON DELETE CASCADE,
    assigned_program_id UUID NOT NULL REFERENCES assigned_programs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    -- Scheduling fields for adherence tracking
    scheduled_date DATE,
    program_week INTEGER,
    -- Offline-first support
    device_id UUID,
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workout_sessions_student ON workout_sessions(student_id);
CREATE INDEX idx_workout_sessions_trainer ON workout_sessions(trainer_id);
CREATE INDEX idx_workout_sessions_workout ON workout_sessions(assigned_workout_id);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(student_id, started_at DESC);
CREATE INDEX idx_workout_sessions_scheduled ON workout_sessions(student_id, scheduled_date);
CREATE INDEX idx_workout_sessions_sync ON workout_sessions(student_id) WHERE sync_status = 'pending';

-- ----------------------------------------------------------------------------
-- 2.11 set_logs — Logs de Séries Executadas
-- ----------------------------------------------------------------------------
CREATE TABLE set_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    assigned_workout_item_id UUID NOT NULL REFERENCES assigned_workout_items(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    set_number INTEGER NOT NULL,
    weight DECIMAL(10,2),
    weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
    reps_completed INTEGER,
    rpe DECIMAL(3,1) CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    -- Offline-first support
    local_id UUID,
    device_id UUID,
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_set_logs_session ON set_logs(workout_session_id);
CREATE INDEX idx_set_logs_item ON set_logs(assigned_workout_item_id);
CREATE INDEX idx_set_logs_exercise_history ON set_logs(exercise_id, completed_at DESC);
CREATE INDEX idx_set_logs_sync ON set_logs(workout_session_id) WHERE sync_status = 'pending';

-- Unique constraint for offline idempotency
CREATE UNIQUE INDEX idx_set_logs_offline_idempotency ON set_logs(local_id, device_id) 
    WHERE local_id IS NOT NULL AND device_id IS NOT NULL;

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 current_trainer_id() — Returns the trainer ID for the current user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_trainer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM trainers WHERE auth_user_id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- 3.2 current_student_id() — Returns the student ID for the current user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM students WHERE auth_user_id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- 3.3 is_trainer() — Checks if current user is a trainer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM trainers WHERE auth_user_id = auth.uid())
$$;

-- ----------------------------------------------------------------------------
-- 3.4 is_student() — Checks if current user is a student
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM students WHERE auth_user_id = auth.uid())
$$;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 update_updated_at() — Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply to all tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON trainers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON program_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workout_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workout_item_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assigned_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assigned_workouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assigned_workout_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workout_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON set_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 4.2 calculate_session_duration() — Auto-calculate workout duration
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_session_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER calc_session_duration 
    BEFORE UPDATE ON workout_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION calculate_session_duration();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_item_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_workout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5.1 trainers — Trainer can only see/edit their own record
-- ----------------------------------------------------------------------------
CREATE POLICY trainers_select ON trainers
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY trainers_update ON trainers
    FOR UPDATE USING (auth_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5.2 students — Trainer manages their students, Student sees self
-- ----------------------------------------------------------------------------
CREATE POLICY students_trainer_all ON students
    FOR ALL USING (trainer_id = current_trainer_id());

CREATE POLICY students_self_select ON students
    FOR SELECT USING (auth_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5.3 exercises — Trainer manages their exercises
-- ----------------------------------------------------------------------------
CREATE POLICY exercises_trainer_all ON exercises
    FOR ALL USING (trainer_id = current_trainer_id());

-- Students can view exercises (for display purposes)
CREATE POLICY exercises_student_select ON exercises
    FOR SELECT USING (
        trainer_id IN (
            SELECT trainer_id FROM students WHERE auth_user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.4 program_templates — Trainer only
-- ----------------------------------------------------------------------------
CREATE POLICY program_templates_trainer_all ON program_templates
    FOR ALL USING (trainer_id = current_trainer_id());

-- ----------------------------------------------------------------------------
-- 5.5 workout_templates — Trainer only (via program_template)
-- ----------------------------------------------------------------------------
CREATE POLICY workout_templates_trainer_all ON workout_templates
    FOR ALL USING (
        program_template_id IN (
            SELECT id FROM program_templates WHERE trainer_id = current_trainer_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.6 workout_item_templates — Trainer only (via workout_template)
-- ----------------------------------------------------------------------------
CREATE POLICY workout_item_templates_trainer_all ON workout_item_templates
    FOR ALL USING (
        workout_template_id IN (
            SELECT wt.id FROM workout_templates wt
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.7 assigned_programs — Trainer manages, Student views own
-- ----------------------------------------------------------------------------
CREATE POLICY assigned_programs_trainer_all ON assigned_programs
    FOR ALL USING (trainer_id = current_trainer_id());

CREATE POLICY assigned_programs_student_select ON assigned_programs
    FOR SELECT USING (student_id = current_student_id());

-- ----------------------------------------------------------------------------
-- 5.8 assigned_workouts — Trainer manages, Student views own
-- ----------------------------------------------------------------------------
CREATE POLICY assigned_workouts_trainer_all ON assigned_workouts
    FOR ALL USING (
        assigned_program_id IN (
            SELECT id FROM assigned_programs WHERE trainer_id = current_trainer_id()
        )
    );

CREATE POLICY assigned_workouts_student_select ON assigned_workouts
    FOR SELECT USING (
        assigned_program_id IN (
            SELECT id FROM assigned_programs WHERE student_id = current_student_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.9 assigned_workout_items — Trainer manages, Student views own
-- ----------------------------------------------------------------------------
CREATE POLICY assigned_workout_items_trainer_all ON assigned_workout_items
    FOR ALL USING (
        assigned_workout_id IN (
            SELECT aw.id FROM assigned_workouts aw
            JOIN assigned_programs ap ON aw.assigned_program_id = ap.id
            WHERE ap.trainer_id = current_trainer_id()
        )
    );

CREATE POLICY assigned_workout_items_student_select ON assigned_workout_items
    FOR SELECT USING (
        assigned_workout_id IN (
            SELECT aw.id FROM assigned_workouts aw
            JOIN assigned_programs ap ON aw.assigned_program_id = ap.id
            WHERE ap.student_id = current_student_id()
        )
    );

-- ----------------------------------------------------------------------------
-- 5.10 workout_sessions — Trainer views, Student manages own
-- ----------------------------------------------------------------------------
CREATE POLICY workout_sessions_trainer_select ON workout_sessions
    FOR SELECT USING (trainer_id = current_trainer_id());

CREATE POLICY workout_sessions_student_all ON workout_sessions
    FOR ALL USING (student_id = current_student_id());

-- ----------------------------------------------------------------------------
-- 5.11 set_logs — Trainer views, Student manages own
-- ----------------------------------------------------------------------------
CREATE POLICY set_logs_trainer_select ON set_logs
    FOR SELECT USING (
        workout_session_id IN (
            SELECT id FROM workout_sessions WHERE trainer_id = current_trainer_id()
        )
    );

CREATE POLICY set_logs_student_all ON set_logs
    FOR ALL USING (
        workout_session_id IN (
            SELECT id FROM workout_sessions WHERE student_id = current_student_id()
        )
    );

-- ============================================================================
-- 6. GRANTS (for service role and authenticated users)
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all on tables to service_role (for backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant necessary permissions to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION current_trainer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_trainer() TO authenticated;
GRANT EXECUTE ON FUNCTION is_student() TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
