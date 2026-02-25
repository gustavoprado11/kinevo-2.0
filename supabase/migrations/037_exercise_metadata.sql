-- 037_exercise_metadata.sql
-- Metadados de adequação para seleção inteligente pelo motor de prescrição

ALTER TABLE public.exercises
  ADD COLUMN difficulty_level TEXT NOT NULL DEFAULT 'intermediate'
    CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN is_primary_movement BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN session_position TEXT NOT NULL DEFAULT 'middle'
    CHECK (session_position IN ('first', 'middle', 'last'));

COMMENT ON COLUMN public.exercises.difficulty_level IS
  'Nível de adequação: beginner=movimentos livres simples, intermediate=barras/polias, advanced=alta técnica';
COMMENT ON COLUMN public.exercises.is_primary_movement IS
  'True para compostos que devem abrir a sessão (Supino, Remada, Agachamento, etc.)';
COMMENT ON COLUMN public.exercises.session_position IS
  'Posição recomendada: first=compostos pesados, middle=acessórios, last=isolados leves/finalizadores';
