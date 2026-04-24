-- Fase 8 — Agendamento único (não-recorrente).
--
-- Adiciona o valor 'once' ao CHECK constraint de `recurring_appointments.frequency`
-- pra permitir agendamentos que acontecem em uma data específica sem recorrência.
--
-- Modelagem: reaproveita `recurring_appointments` em vez de criar tabela separada.
-- A projeção (`shared/utils/appointments-projection.ts`) interpreta 'once' como
-- "gera 1 ocorrência em `starts_on`, ignora day_of_week e ends_on".

ALTER TABLE recurring_appointments
    DROP CONSTRAINT IF EXISTS recurring_appointments_frequency_check;

ALTER TABLE recurring_appointments
    ADD CONSTRAINT recurring_appointments_frequency_check
    CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly'));
