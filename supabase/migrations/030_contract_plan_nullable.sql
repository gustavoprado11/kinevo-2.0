-- Migration 030: Fix student_contracts FK constraints + make plan_id nullable
--
-- Problem: student_contracts was created WITHOUT foreign key constraints.
-- PostgREST requires FK constraints to resolve JOINs in select queries.
-- This caused the subscriptions list to return empty (the JOIN query fails silently).
--
-- Also makes plan_id nullable for "Acesso Gratuito" (courtesy) contracts.

-- 1. Add missing FK constraints (needed for PostgREST JOINs to work)
ALTER TABLE student_contracts
    ADD CONSTRAINT student_contracts_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_contracts
    ADD CONSTRAINT student_contracts_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES trainer_plans(id) ON DELETE SET NULL;

-- 2. Make plan_id nullable for courtesy contracts
ALTER TABLE student_contracts ALTER COLUMN plan_id DROP NOT NULL;
