# Fase 8 — Agendamento único (não-recorrente)

**Objetivo:** permitir que o trainer crie agendamentos que acontecem uma única vez (aula experimental, reposição, consulta avulsa), sem precisar pensar em "rotina".

**Status:** pós-MVP, primeira feature V2.

**Pré-requisito:** MVP completo (Fases 1-7) e fixes pós-MVP aplicados.

---

## Decisões fechadas

| Decisão | Escolha |
|---------|---------|
| Modelagem | Novo valor `'once'` em `frequency` da `recurring_appointments` (não tabela separada) |
| Entrada UI | 4° botão de frequência no modal ao lado de Semanal/Quinzenal/Mensal |
| Visual no calendário | Igual aos recorrentes (sem ícone/cor diferente) |
| Notificações push | Mesmos textos que recorrente |
| Operações permitidas | Criar, cancelar, remarcar, marcar concluído/faltou |
| Google Calendar | Sincroniza como single event (não recurring) |

---

## Mudanças de modelo

### 1. Schema

Migration nova (número livre próximo):

```sql
ALTER TABLE recurring_appointments
    DROP CONSTRAINT IF EXISTS recurring_appointments_frequency_check;

ALTER TABLE recurring_appointments
    ADD CONSTRAINT recurring_appointments_frequency_check
    CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly'));
```

Nenhuma nova coluna. `day_of_week` e `start_time` continuam sendo usados mesmo pra `once` (o dia da semana da `starts_on` + o horário escolhido).

### 2. Types

Em `shared/types/appointments.ts`:

```typescript
export type AppointmentFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly'
```

Atualiza o Zod schema em `web/src/actions/appointments/schemas.ts` pra aceitar `'once'`.

### 3. Helper de projeção

`shared/utils/appointments-projection.ts`:
- Quando `frequency === 'once'`, gera **exatamente 1 ocorrência** na data `starts_on`
- Ignora `day_of_week` e `ends_on` pra esse caso
- Exceções continuam funcionando igual (se a ocorrência única for remarcada ou cancelada, cria linha em `appointment_exceptions` como sempre)

### 4. Server actions

Nenhuma action nova. As existentes precisam aceitar `'once'`:

- `createRecurringAppointment` / `createRecurringAppointmentGroup`:
  - Validação: se `frequency === 'once'`, forçar `day_of_week` ao dia da semana de `starts_on` (mesmo padrão que `monthly`)
  - Validação: se `frequency === 'once'`, `ends_on` deve ser NULL ou igual a `starts_on`
  - Pacote multi-slot com `'once'` deve ser rejeitado (agendamento único é sempre 1 ocorrência em 1 dia)

- `updateRecurringAppointment`:
  - Se mudar pra/de `'once'`, revalidar mesmas regras

- Lembretes push: apenas 1 linha em `scheduled_notifications` (não 30 dias de extensão)

### 5. Sync Google

Em `web/src/lib/google-calendar/event-mapper.ts`:
- Se `frequency === 'once'`, mapear como **single event** (sem `recurrence` array)
- Delete event direto ao cancelar (não instance override)

Resto do sync service opera normalmente.

---

## Mudanças de UI

### 1. `CreateAppointmentModal`

Adicionar 4° botão "Única" ao segmented control de frequência.

Quando `frequency === 'once'`:
- Seção "DIAS E HORÁRIOS" muda de label pra "HORÁRIO"
- Mostrar apenas **1 slot** (não permite adicionar mais — igual ao `monthly`)
- `day_of_week` fica readonly (derivado de `starts_on`)
- Botão "+ Adicionar dia" desabilitado com tooltip "Agendamento único tem apenas 1 dia"
- Botão de submit vira "Criar agendamento" (não "Criar pacote" mesmo que hipoteticamente houvesse mais slots)

### 2. `EditAppointmentModal`

Mesmas regras quando a rotina editada é `'once'`.

### 3. Calendário `/schedule`

Nenhuma mudança visual (decisão: cards idênticos aos recorrentes).

---

## Testes

Atualizar testes existentes + novos:

- `appointments-projection.test.ts` — casos de `frequency='once'`: gera 1 ocorrência na data correta, aplica exceções, respeita exceção de cancelamento
- `create-recurring.test.ts` — validações `'once'`: day_of_week consistente, ends_on consistente, rejeita multi-slot
- `event-mapper.test.ts` — `'once'` gera single event no Google
- `create-appointment-modal.test.tsx` — 4° botão funciona, campos readonly corretos, submit envia frequency correto

---

## Critérios de aceite

- [ ] Trainer consegue criar agendamento único pelo modal (selecionando "Única")
- [ ] Agendamento aparece no calendário como card normal
- [ ] Push imediato chega ao aluno ("Novo agendamento")
- [ ] Lembrete 1h antes funciona
- [ ] Remarcar funciona (cria exceção `rescheduled`)
- [ ] Cancelar funciona (cria exceção `canceled`, dispara push)
- [ ] Marcar concluído/faltou funciona
- [ ] Sync Google: single event criado, deletado ao cancelar
- [ ] Testes passam, tsc e eslint clean

---

## Casos edge

- **Criar "once" com data passada**: permitir (trainer pode registrar aula que já aconteceu). Push não dispara. Lembrete não cria.
- **Editar rotina recorrente pra `'once'`**: permitido. Mantém exceções compatíveis (cancelled/no_show/completed), rejeita se já houve mais de 1 ocorrência registrada.
- **Pacote com mix de `'once'` e recorrente**: não permitido. Modal desabilita "+ Adicionar dia" assim que trainer escolhe `'once'`.
