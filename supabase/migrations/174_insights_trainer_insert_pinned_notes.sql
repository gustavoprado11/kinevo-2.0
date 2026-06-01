-- ============================================================================
-- Kinevo — 174 Allow trainers to INSERT their own pinned notes
-- ============================================================================
-- Bug: criar nota manual no card "Insights & Notas" falhava em silêncio.
-- A migration 093 liberou category='pinned_note' / source='trainer' nas CHECK
-- constraints, mas a tabela só tinha policies de SELECT/UPDATE para o treinador
-- (INSERT era exclusivo do CRON via service_role). Sem policy de INSERT, o RLS
-- bloqueava o createPinnedNote (client com RLS) → success:false silencioso.
--
-- Fix: policy de INSERT escopada à própria conta e ao tipo de registro da
-- feature (pinned_note + trainer), evitando que o treinador forje insights de IA.
-- Aditiva e backward-compatible.
-- ============================================================================

CREATE POLICY "Trainer can insert own pinned notes" ON public.assistant_insights
    FOR INSERT WITH CHECK (
        trainer_id = current_trainer_id()
        AND category = 'pinned_note'
        AND source   = 'trainer'
    );
