-- ============================================================================
-- Migration 269: FCmáx do aluno — zonas de FC na prescrição aeróbia
-- ============================================================================
-- Pacote 1 da prescrição aeróbia completa (specs/active/aerobio-zonas-protocolos):
-- o alvo de intensidade estruturado ("Zona 2") resolve para uma faixa de bpm
-- usando a FCmáx do aluno. Nullable: sem FCmáx, as superfícies exibem %FCmáx.
-- Escrita pelo treinador (form de edição do aluno) — coberta pelas policies
-- de UPDATE existentes de students; nenhum RLS novo.

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS max_heart_rate_bpm INT NULL;

ALTER TABLE students
    DROP CONSTRAINT IF EXISTS students_max_heart_rate_bpm_check;

ALTER TABLE students
    ADD CONSTRAINT students_max_heart_rate_bpm_check
    CHECK (max_heart_rate_bpm IS NULL OR (max_heart_rate_bpm BETWEEN 100 AND 230));
