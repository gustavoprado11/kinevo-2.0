# Fase 4 — Widget "Próximos agendamentos" no dashboard

**Objetivo:** substituir o placeholder "Em breve" pelo widget funcional de próximos agendamentos. Trainer vê as próximas ocorrências já na tela inicial.

**Pré-requisito:** Fase 3 concluída (modal de criação e de edição existem).

---

## Entregáveis

1. Componente `UpcomingAppointmentsWidget`
2. Extensão de `get-dashboard-data.ts` para incluir próximos agendamentos
3. **Componente `OccurrencePopover` reutilizável** (extração de popover de ações que vai ser reusado na Fase 7)
4. Testes de componente
5. **Débito técnico pendente da Fase 3**: banner "Essa rotina tem N ajustes individuais" no `EditAppointmentModal` (exige query de contagem de exceções futuras)

---

## Arquivos a criar

- `web/src/components/dashboard/upcoming-appointments-widget.tsx`
- `web/src/components/dashboard/__tests__/upcoming-appointments-widget.test.tsx`
- `web/src/components/appointments/occurrence-popover.tsx` — popover reutilizável de ações (3 itens: Remarcar, Cancelar essa, Abrir perfil). Usado no widget e, na Fase 7, nos cards do calendário
- `web/src/components/appointments/__tests__/occurrence-popover.test.tsx`
- `web/src/components/appointments/reschedule-occurrence-modal.tsx` — modal compacto pra remarcar uma única ocorrência (chamado a partir do popover)
- `web/src/components/appointments/__tests__/reschedule-occurrence-modal.test.tsx`

## Arquivos a modificar

- `web/src/lib/dashboard/get-dashboard-data.ts` — adicionar `upcomingAppointments: AppointmentOccurrence[]`
- `web/src/app/dashboard/dashboard-client.tsx` — substituir o componente placeholder no widget-grid pelo novo widget
- `web/src/stores/dashboard-layout-store.ts` — conferir se `'upcoming-schedules'` ainda é o WidgetId correto (pode renomear pra `'upcoming-appointments'` com migration silenciosa no store)
- `web/src/components/appointments/edit-appointment-modal.tsx` — adicionar banner "Essa rotina tem N ajustes individuais. Eles serão mantidos." (quebra técnica: fazer query de contagem de `appointment_exceptions` com `occurrence_date >= today` para o `recurring_appointment_id` em edição). Mostrar apenas quando N > 0

---

## Detalhamento

### Backend: `get-dashboard-data.ts`

Adicionar nova query paralela:

```typescript
// 13. Recurring appointments e exceptions pra computar próximos agendamentos
supabaseAdmin
    .from('recurring_appointments')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('status', 'active'),

supabaseAdmin
    .from('appointment_exceptions')
    .select('*')
    .eq('trainer_id', trainerId)
    .gte('occurrence_date', todayDate)
    .lte('occurrence_date', /* 90 dias à frente */),
```

Depois usar `getNextOccurrences` do helper da Fase 1:

```typescript
const upcomingAppointments = getNextOccurrences(
    recurring,
    exceptions,
    new Date(),
    5,
)
```

Incluir no `DashboardData` interface e no retorno.

### Widget: `UpcomingAppointmentsWidget`

```typescript
interface Props {
    appointments: AppointmentOccurrence[]
    studentsById: Map<string, { name: string; avatarUrl: string | null }>
}
```

**Layout** (seguir padrão dos outros widgets do dashboard):

- Card com header "Próximos agendamentos" + ícone calendar
- Lista de até 5 linhas, cada uma mostrando:
  - Avatar do aluno (esquerda)
  - Nome do aluno + data formatada ("Amanhã às 7h", "Terça às 7h", "03/05 às 7h" pra +7 dias)
  - Ação: popover com "Remarcar", "Cancelar essa", "Abrir perfil"
- Empty state (se `appointments.length === 0`):
  - Ícone + "Nenhum agendamento marcado"
  - CTA "Crie uma rotina no perfil de um aluno"

**Popover de ações (`OccurrencePopover` reutilizável):**
Extrair em componente dedicado porque vai ser reusado nos cards do calendário da Fase 7.

Props:
```typescript
interface Props {
    occurrence: AppointmentOccurrence
    studentName: string
    onRescheduled?: () => void      // refresh do widget/calendário
    onCanceled?: () => void
    children: React.ReactNode       // trigger (o card/linha a ser clicado)
}
```

Comportamento:
- 3 ações: "Remarcar", "Cancelar essa ocorrência", "Abrir perfil do aluno"
- "Remarcar" abre `RescheduleOccurrenceModal` (ver abaixo)
- "Cancelar essa" pede confirmação inline ("Tem certeza?") + chama `cancelOccurrence(recurringId, originalDate)`
- "Abrir perfil" → `router.push(/students/{studentId})`
- Após qualquer ação bem-sucedida, fecha popover e chama callback

**`RescheduleOccurrenceModal`:**
Modal pequeno com 2 campos (nova data + nova hora) e opção de escopo ("Apenas essa" / "Essa e as próximas"). Chama `rescheduleOccurrence` com o `scope` apropriado.

**Formato de data/hora amigável:** usa `Intl.DateTimeFormat` em pt-BR com timezone `America/Sao_Paulo`:
- Mesma data = "Hoje às HH:MM"
- +1 dia = "Amanhã às HH:MM"
- +2-6 dias = "{Dia da semana} às HH:MM"
- +7+ dias = "DD/MM às HH:MM"

**Ocorrências de pacote (multi-slot):** cada slot gera sua própria ocorrência (já comporta-se assim desde a Fase 3.5). O widget NÃO precisa agrupar ocorrências de pacote no dashboard — cada linha da lista é uma ocorrência distinta. Se o trainer tem pacote "Seg/Qua/Sex" e a próxima ocorrência é na Qua, aparece só "Qua às 7h — João", não "3 treinos de João essa semana". Motivo: a lista do widget mostra os próximos eventos em ordem cronológica, não agrupamentos por aluno.

Opcional: mostrar um pequeno badge/pill "pacote" ao lado do nome do aluno quando `occurrence.groupId !== null`, para diferenciar visualmente. Não obrigatório, mas útil semanticamente.

---

## Testes

### `upcoming-appointments-widget.test.tsx`

- Renderiza até 5 ocorrências corretamente ordenadas
- Formatação de data: "Hoje", "Amanhã", dia da semana, DD/MM
- Empty state aparece quando lista vazia
- Click no popover mostra 3 ações
- "Abrir perfil" dispara router.push correto
- "Cancelar essa" chama action `cancelOccurrence` com params corretos

---

## Critérios de aceite

- [ ] Widget aparece no dashboard no lugar do placeholder atual
- [ ] Mostra até 5 próximas ocorrências ordenadas por data/hora
- [ ] Formatação de data amigável funciona pra todos os casos
- [ ] Popover de ações funciona (todas as 3 opções)
- [ ] Empty state renderiza quando trainer não tem agendamentos
- [ ] Testes passam, tsc e eslint clean
- [ ] Nenhum warning no console

---

## Referências

- Widget de referência: `web/src/components/dashboard/expiring-programs.tsx` (estrutura similar)
- Helper: `shared/utils/appointments-projection.ts` (Fase 1)
- Actions: Fase 2
