-- Migration 034: Student Prescription Profiles
-- Description: Creates the student_prescription_profiles table for AI prescription module.
-- This table stores anamnesis/assessment data needed by the prescription engine,
-- separated from the core students table to avoid schema pollution.

-- ============================================================================
-- TABLE: student_prescription_profiles
-- ============================================================================

CREATE TABLE public.student_prescription_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    student_id UUID NOT NULL UNIQUE
        REFERENCES public.students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL
        REFERENCES public.trainers(id) ON DELETE CASCADE,

    -- Training level & goal (PRD §2.2 and §4.1)
    training_level TEXT NOT NULL DEFAULT 'beginner'
        CHECK (training_level IN ('beginner', 'intermediate', 'advanced')),
    goal TEXT NOT NULL DEFAULT 'hypertrophy'
        CHECK (goal IN ('hypertrophy', 'weight_loss', 'performance', 'health')),

    -- Availability (PRD §2.3)
    available_days INTEGER[] NOT NULL DEFAULT '{}',
    session_duration_minutes INTEGER NOT NULL DEFAULT 60
        CHECK (session_duration_minutes BETWEEN 20 AND 180),

    -- Equipment & preferences (PRD §4.1 and §4.2)
    available_equipment TEXT[] NOT NULL DEFAULT '{}',
    favorite_exercise_ids UUID[] DEFAULT '{}',
    disliked_exercise_ids UUID[] DEFAULT '{}',

    -- Medical restrictions (PRD §2.5 — flexible JSONB)
    -- Format: [{ "description": "...", "restricted_exercise_ids": [], "restricted_muscle_groups": [], "severity": "mild|moderate|severe" }]
    medical_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(medical_restrictions) = 'array'),

    -- AI operation mode (PRD §3.1)
    ai_mode TEXT NOT NULL DEFAULT 'copilot'
        CHECK (ai_mode IN ('auto', 'copilot', 'assistant')),

    -- System-computed fields (updated by backend, not by trainer directly)
    adherence_rate NUMERIC(5,2) DEFAULT NULL
        CHECK (adherence_rate IS NULL OR (adherence_rate >= 0 AND adherence_rate <= 100)),
    avg_session_duration_minutes INTEGER DEFAULT NULL,
    last_calculated_at TIMESTAMPTZ DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_prescription_profiles_student
    ON public.student_prescription_profiles(student_id);

CREATE INDEX idx_prescription_profiles_trainer
    ON public.student_prescription_profiles(trainer_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.student_prescription_profiles ENABLE ROW LEVEL SECURITY;

-- Trainer manages profiles of their own students
CREATE POLICY "Trainer manages own student prescription profiles"
    ON public.student_prescription_profiles FOR ALL
    USING (trainer_id = public.current_trainer_id())
    WITH CHECK (trainer_id = public.current_trainer_id());

-- Student can read their own profile
CREATE POLICY "Student reads own prescription profile"
    ON public.student_prescription_profiles FOR SELECT
    USING (student_id = public.current_student_id());

-- ============================================================================
-- TRIGGER: auto-update updated_at
-- ============================================================================

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.student_prescription_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
