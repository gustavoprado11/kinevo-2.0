-- ============================================================================
-- Migration 182: Índices nas FKs quentes (análise noturna 09/06/2026)
--
-- Fonte: advisors de produção (unindexed_foreign_keys, 33 no total) cruzados
-- com as queries reais do código (relatório 02-backend-dados.md). Aqui entram
-- só as QUENTES — FKs varridas por crons, telas principais e RPCs. As frias
-- (ambassador_events, feedback, etc.) ficam de fora de propósito: índice tem
-- custo de write e essas tabelas estão vazias/sem tráfego.
--
-- Inclui também: dedupe de payment_received no nível do banco (cinto e
-- suspensório do fix de código no webhook Asaas) e remoção do índice
-- duplicado de students apontado pelos advisors.
-- ============================================================================

-- Tonnage history, context-enricher, insights, perfil do aluno
create index if not exists idx_workout_sessions_assigned_program
    on workout_sessions (assigned_program_id);

-- Cron dispatch-scheduled-notifications roda a cada 5 min varrendo a tabela
create index if not exists idx_scheduled_notifications_student
    on scheduled_notifications (student_id);
create index if not exists idx_scheduled_notifications_trainer
    on scheduled_notifications (trainer_id);

-- Chat
create index if not exists idx_messages_sender
    on messages (sender_id);

-- get_financial_students (179) faz join por plan_id
create index if not exists idx_student_contracts_plan
    on student_contracts (plan_id);

-- Cálculo de semana perfeita no finishWorkout
create index if not exists idx_perfect_weeks_assigned_program
    on perfect_weeks (assigned_program_id);
create index if not exists idx_perfect_weeks_trainer
    on perfect_weeks (trainer_id);

-- Timeline do contrato no detalhe do aluno
create index if not exists idx_contract_events_contract
    on contract_events (contract_id);

-- Joins do assign-program e do builder
create index if not exists idx_assigned_workout_items_exercise
    on assigned_workout_items (exercise_id);
create index if not exists idx_workout_item_templates_exercise
    on workout_item_templates (exercise_id);

-- ----------------------------------------------------------------------------
-- Dedupe de payment_received por paymentId no nível do banco.
-- O webhook Asaas agora checa antes de inserir (código), mas dois eventos
-- simultâneos (RECEIVED+CONFIRMED) ainda poderiam passar pela checagem ao
-- mesmo tempo. O índice único parcial fecha a corrida; o logContractEvent
-- tolera o erro de unique violation (só loga, não propaga).
-- ----------------------------------------------------------------------------
-- Primeiro: remover duplicatas já existentes (mantém o evento mais antigo),
-- senão a criação do índice único falha.
delete from contract_events ce
using contract_events older
where ce.event_type = 'payment_received'
  and older.event_type = 'payment_received'
  and ce.contract_id = older.contract_id
  and ce.metadata->>'paymentId' is not null
  and ce.metadata->>'paymentId' = older.metadata->>'paymentId'
  and (older.created_at, older.id) < (ce.created_at, ce.id);

create unique index if not exists uq_contract_events_payment_received
    on contract_events (contract_id, (metadata->>'paymentId'))
    where event_type = 'payment_received' and metadata->>'paymentId' is not null;

-- ----------------------------------------------------------------------------
-- Índice duplicado (advisors duplicate_index): coach_id e trainer_id são a
-- mesma coluna; os dois índices são idênticos.
-- ----------------------------------------------------------------------------
drop index if exists idx_students_trainer_id;
