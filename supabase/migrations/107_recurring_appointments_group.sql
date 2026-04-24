-- ============================================================================
-- Kinevo — 107 Grupo de rotinas recorrentes (pacotes multi-slot)
-- ============================================================================
-- Adiciona `group_id` opcional em `recurring_appointments` pra agrupar
-- rotinas do mesmo "pacote" — caso em que um aluno treina em múltiplos
-- dias/horários distintos na mesma semana (ex: Seg 7h + Qua 7h + Sex 18h).
--
-- Rotinas simples continuam com `group_id = NULL`. Rotinas criadas em
-- pacote compartilham o mesmo UUID.
--
-- Migration aditiva: não quebra nada das Fases 1-3. Helper de projeção
-- (shared/utils/appointments-projection.ts) e server actions existentes
-- continuam funcionando sem mudanças. Apenas novas actions e a UI
-- interpretam `group_id`.
-- ============================================================================

ALTER TABLE recurring_appointments
    ADD COLUMN group_id UUID;

CREATE INDEX idx_recurring_appointments_group
    ON recurring_appointments(group_id)
    WHERE group_id IS NOT NULL;

COMMENT ON COLUMN recurring_appointments.group_id IS
    'Agrupa linhas que fazem parte do mesmo pacote multi-slot. NULL quando a rotina é simples (1 dia/horário).';
