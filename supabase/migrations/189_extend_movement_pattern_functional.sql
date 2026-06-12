-- Estende o enum movement_pattern para padrões de treino funcional.
-- Caso de uso: biblioteca do treinador Bernardo (SBS Training), organizada por
-- Padrão de Movimento. Adiciona: mobility, locomotion, jump, integrated.
-- Aditivo e backward-compat: apenas amplia o conjunto permitido. Idempotente.

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_movement_pattern_check;

ALTER TABLE public.exercises ADD CONSTRAINT exercises_movement_pattern_check
  CHECK (movement_pattern = ANY (ARRAY[
    'squat'::text, 'hinge'::text, 'lunge'::text,
    'push_h'::text, 'push_v'::text, 'pull_h'::text, 'pull_v'::text,
    'isolation'::text, 'core'::text, 'carry'::text,
    'mobility'::text, 'locomotion'::text, 'jump'::text, 'integrated'::text
  ]));
