# Fase 5 — Lembretes push

**Objetivo:** aluno recebe pushes nos 5 eventos-chave: criação de rotina, lembrete 1h antes, remarcação, cancelamento de ocorrência, cancelamento de rotina.

**Pré-requisito:** Fase 2 concluída.

---

## Entregáveis

1. Migration criando `scheduled_notifications`
2. Edge Function `dispatch-scheduled-notifications` (cron a cada 5 min)
3. Edge Function `extend-scheduled-notifications` (cron diário — estende janela de 30 dias)
4. Integração nas server actions da Fase 2 (gera/atualiza/cancela linhas)
5. Constantes de mensagens em `shared/constants/notification-messages.ts`
6. Testes

---

## Arquivos a criar

- `supabase/migrations/107_scheduled_notifications.sql`
- `supabase/functions/dispatch-scheduled-notifications/index.ts`
- `supabase/functions/extend-scheduled-notifications/index.ts`
- `shared/constants/notification-messages.ts`
- `shared/constants/__tests__/notification-messages.test.ts`

## Arquivos a modificar

- Todas as server actions da Fase 2 (gerar/atualizar/cancelar linhas em `scheduled_notifications`)
- Adicionar testes de integração pras mudanças

---

## Detalhamento

### Migration `107_scheduled_notifications.sql`

```sql
CREATE TABLE scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,

    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,

    source TEXT NOT NULL CHECK (source IN ('appointment_reminder')),
    recurring_appointment_id UUID REFERENCES recurring_appointments(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'canceled', 'failed')),
    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (recurring_appointment_id, occurrence_date, source)
);

CREATE INDEX idx_scheduled_notifications_dispatch
    ON scheduled_notifications(scheduled_for)
    WHERE status = 'pending';

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainer can read own scheduled notifications"
    ON scheduled_notifications FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY "Service role full access scheduled_notifications"
    ON scheduled_notifications FOR ALL
    USING (auth.role() = 'service_role');

-- pg_cron: agenda a edge function a cada 5 min
SELECT cron.schedule(
    'dispatch-scheduled-notifications',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/dispatch-scheduled-notifications',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        )
    )
    $$
);

-- pg_cron: agenda extend diariamente às 2h da manhã
SELECT cron.schedule(
    'extend-scheduled-notifications',
    '0 2 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/extend-scheduled-notifications',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        )
    )
    $$
);
```

**Nota:** conferir como o Kinevo hoje usa settings `app.*` — se não usar, substituir por env vars do Edge Function direto.

### Edge Function: `dispatch-scheduled-notifications`

Rodando a cada 5 min:

1. Busca até 100 linhas com `scheduled_for <= now()` e `status = 'pending'`
2. Pra cada linha:
   - Verifica `student_notification_preferences` do aluno — se reminders desligados, marca `status='canceled'` e pula
   - Insere em `student_inbox_items` (dispara o pipeline existente de push)
   - Marca linha como `status='sent', sent_at=now()`
   - Se inserção falhar, marca `status='failed'` e loga
3. Retorna count de enviadas/puladas/falhas

### Edge Function: `extend-scheduled-notifications`

Rodando diariamente:

1. Pra cada rotina ativa:
   - Calcula próximas ocorrências nos dias 30-60 à frente
   - Pra cada uma que ainda não tem linha em `scheduled_notifications`, cria uma
2. Útil pra manter sempre 30 dias de lembretes agendados

### Mensagens: `shared/constants/notification-messages.ts`

```typescript
export const appointmentMessages = {
    rotinaCriada: (diaSemana: string, hora: string) => ({
        title: 'Novo agendamento',
        body: `Seu treinador agendou treinos toda ${diaSemana} às ${hora}`,
    }),
    lembrete1hAntes: (trainerName: string, hora: string) => ({
        title: 'Treino em 1 hora',
        body: `Seu treino com ${trainerName} é às ${hora}`,
    }),
    ocorrenciaRemarcada: (data: string, hora: string) => ({
        title: 'Treino remarcado',
        body: `Seu treino foi remarcado para ${data} às ${hora}`,
    }),
    ocorrenciaCancelada: (dataHora: string) => ({
        title: 'Treino cancelado',
        body: `Seu treino de ${dataHora} foi cancelado`,
    }),
    rotinaCancelada: (diaSemana: string) => ({
        title: 'Agendamento encerrado',
        body: `Os treinos que aconteciam toda ${diaSemana} foram encerrados`,
    }),
} as const
```

Helpers de formatação de dia/hora ficam em `shared/utils/format-appointment-date.ts`.

### Integração nas server actions da Fase 2

Cada action agora faz 2 coisas:

**`createRecurringAppointment`:**
1. Insere em `recurring_appointments` (já fazia)
2. Insere 30 dias de linhas em `scheduled_notifications` (1h antes de cada ocorrência)
3. Insere 1 linha em `student_inbox_items` com mensagem `rotinaCriada` (push imediato)

**`rescheduleOccurrence` (escopo `only_this`):**
1. Upsert em `appointment_exceptions` (já fazia)
2. Atualiza linha correspondente em `scheduled_notifications`: novo `scheduled_for`
3. Insere 1 linha em `student_inbox_items` com mensagem `ocorrenciaRemarcada`

**`cancelOccurrence`:**
1. Upsert exceção `kind='canceled'` (já fazia)
2. Atualiza `scheduled_notifications` correspondente: `status='canceled'`
3. Insere 1 linha em `student_inbox_items` com mensagem `ocorrenciaCancelada`

**`cancelRecurringAppointment`:**
1. Atualiza `status='canceled'` na regra (já fazia)
2. Marca `scheduled_notifications` pendentes da rotina como `canceled`
3. Insere 1 linha em `student_inbox_items` com mensagem `rotinaCancelada`

---

## Testes

### `notification-messages.test.ts`

- Cada helper gera title e body corretos
- Escapa adequadamente nomes com caracteres especiais

### Testes de integração nas actions da Fase 2

Atualizar os testes existentes (Fase 2) para verificar que:
- Após `createRecurringAppointment`, há 4-5 linhas em `scheduled_notifications` (uma por ocorrência em ~30 dias)
- Após `rescheduleOccurrence`, a linha correspondente foi atualizada
- Após `cancelOccurrence`, a linha está como `canceled`
- Cada action dispara o push imediato apropriado

### Edge Functions

Testar manualmente via curl:
```bash
curl -X POST http://localhost:54321/functions/v1/dispatch-scheduled-notifications \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

---

## Critérios de aceite

- [ ] Ao criar rotina, aluno recebe push imediato "Novo agendamento"
- [ ] 1h antes de cada ocorrência, aluno recebe lembrete
- [ ] Ao remarcar, aluno recebe push "Remarcado"
- [ ] Ao cancelar ocorrência ou rotina, aluno recebe push apropriado
- [ ] Se aluno tem `reminders` desligado, lembretes não chegam mas outros eventos sim
- [ ] Edge Functions rodam sem erro manualmente
- [ ] pg_cron agendado corretamente
- [ ] Testes passam

---

## Referências

- Edge Function de referência: `supabase/functions/send-push-notification/index.ts`
- Migration de referência: `supabase/migrations/081_push_tickets.sql` e `098_realtime_push_notifications.sql`
- Actions integradas: Fase 2
