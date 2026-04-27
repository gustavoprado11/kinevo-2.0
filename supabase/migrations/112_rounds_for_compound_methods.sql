-- Migration 112 — Rounds for compound methods (drop-set, cluster, rest-pause)
--
-- Adds two columns:
--   1. `rounds` on workout_item_templates and assigned_workout_items (1..20).
--   2. `round_number` on workout_item_set_templates and assigned_workout_item_sets
--      (NULL for linear methods / legacy rows; 1..N for compound methods after
--      materialization at save time).
--
-- Strategy A (materialize): saveAsTemplate (mobile) and assign-program (Edge
-- Function) expand the per-round scheme into N×phases physical rows, each with
-- a unique sequential `set_number` and a `round_number` for UI grouping. Set
-- numbers stay 1..N physical → preserves UNIQUE(item_id, set_number) and
-- compatibility with `set_logs`/`get_previous_exercise_sets`.
--
-- Backward compat: every existing row gets rounds=1 and round_number=NULL.
-- The runtime treats those exactly as today.

ALTER TABLE workout_item_templates
    ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1
    CHECK (rounds >= 1 AND rounds <= 20);

ALTER TABLE assigned_workout_items
    ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1
    CHECK (rounds >= 1 AND rounds <= 20);

ALTER TABLE workout_item_set_templates
    ADD COLUMN round_number INTEGER
    CHECK (round_number IS NULL OR round_number >= 1);

ALTER TABLE assigned_workout_item_sets
    ADD COLUMN round_number INTEGER
    CHECK (round_number IS NULL OR round_number >= 1);

COMMENT ON COLUMN workout_item_templates.rounds IS
    'Rodadas para métodos compostos (drop-set, cluster). 1 para métodos lineares. Quando > 1, set_scheme é materializado no save: o builder/Edge Function expande N rodadas × M fases em N*M linhas físicas em workout_item_set_templates.';

COMMENT ON COLUMN assigned_workout_items.rounds IS
    'Espelho de workout_item_templates.rounds copiado no momento da atribuição. Usado pela UI de execução para agrupar fases por rodada.';

COMMENT ON COLUMN workout_item_set_templates.round_number IS
    'Índice 1-based da rodada à qual esta fase pertence (apenas para métodos compostos). NULL para programas lineares e linhas legadas pré-Fase-4.3.';

COMMENT ON COLUMN assigned_workout_item_sets.round_number IS
    'Espelho de workout_item_set_templates.round_number copiado no momento da atribuição. Permite groupBy(round_number) na sala de treino sem cálculo derivado.';
