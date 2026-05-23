-- 156_perfect_weeks.sql
-- Conquista "Semana Perfeita": persiste um registro quando o aluno fecha 100%
-- dos treinos previstos da semana. Calcular no histórico é frágil (a grade da
-- semana pode mudar), então gravamos um snapshot por semana.
--
-- Backward compatible: tabela nova, defaults seguros. Aplicar sem o código novo
-- NÃO quebra produção (nada lê/escreve até o cliente novo embarcar).

CREATE TABLE IF NOT EXISTS public.perfect_weeks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    trainer_id          UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
    -- Início da semana (segunda-feira) — chave de idempotência.
    week_start_date     DATE NOT NULL,
    assigned_program_id UUID REFERENCES public.assigned_programs(id) ON DELETE SET NULL,
    program_week        INTEGER,
    completed_count     INTEGER NOT NULL,
    expected_count      INTEGER NOT NULL,
    achieved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_perfect_weeks_student
    ON public.perfect_weeks (student_id, week_start_date DESC);

ALTER TABLE public.perfect_weeks ENABLE ROW LEVEL SECURITY;

-- Aluno lê e grava só as próprias semanas.
CREATE POLICY "Student reads own perfect weeks" ON public.perfect_weeks
    FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "Student inserts own perfect weeks" ON public.perfect_weeks
    FOR INSERT WITH CHECK (student_id = public.current_student_id());

-- Treinador lê as semanas perfeitas dos seus alunos (read-only).
CREATE POLICY "Trainer reads students perfect weeks" ON public.perfect_weeks
    FOR SELECT USING (trainer_id = public.current_trainer_id());

-- Service role acesso total (jobs/admin).
CREATE POLICY "Service role full access perfect_weeks" ON public.perfect_weeks
    FOR ALL USING (auth.role() = 'service_role');
