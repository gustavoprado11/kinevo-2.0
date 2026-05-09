# PROMPT — Milestone 17: Agenda Mobile

> Cole no Claude Code. Branch dedicada (m17-agenda-mobile). 4 sub-blocos com paradas obrigatórias.

---

## Goal

Mobile ganha tab "Agenda" com day view, criar/editar/cancelar/reagendar agendamentos (com recorrência), push notifications de lembrete configurável.

## Antes de começar

1. Leia: `docs/specs/agenda-mobile/00-milestone-17-agenda-mobile.md`
2. Examine web (referência):
   - `web/src/app/schedule/schedule-client.tsx`
   - `web/src/components/schedule/weekly-calendar.tsx`
   - `web/src/components/schedule/appointment-card.tsx`
   - `web/src/components/appointments/create-appointment-modal.tsx`
   - `web/src/components/appointments/edit-appointment-modal.tsx`
   - `web/src/actions/appointments/*.ts` (create-recurring-group, update-recurring, cancel-occurrence, reschedule-occurrence)
   - `shared/types/appointments.ts` (AppointmentOccurrence type)
3. Examine mobile (estado atual):
   - `mobile/app/(trainer-tabs)/` (tab structure)
   - `mobile/components/trainer/` (pattern de components)
   - `mobile/hooks/` (pattern de hooks)
   - `mobile/package.json` (verificar se expo-notifications já está)

## Workflow

- **Branch dedicada `m17-agenda-mobile`**
- **4 sub-blocos** (B1+B2+B3+B4)
- **PR final** após B4 merge em main

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~1 dia)
═══════════════════════════════════════════════════════════════════════

1. `git status --short`, `git log --oneline -5`
2. Cria branch `m17-agenda-mobile` + push
3. **Inspeção schema appointments**:
   - Tabelas: `appointments`, `recurring_appointments`, `appointment_occurrences`
   - Relacionamentos + RLS policies
   - Como web cria recorrência? (gera N occurrences ou só 1 row?)
4. **Inspeção actions web**:
   - createRecurringGroup, updateRecurring, cancelRecurring, rescheduleOccurrence, cancelOccurrence — quais reusáveis via API REST? Quais são `'use server'` only?
   - Decisão: replicar lógica no mobile via Supabase direto OU criar RPCs
5. **Mobile setup**:
   - expo-notifications instalado? Se não, adiciona via `npx expo install expo-notifications`
   - Tab navigation: 5 tabs já no bottom nav. Onde Agenda entra? (substitui "...", ou vira 6º com colapso, ou item interno do "...")
6. **trainer.notification_preferences**:
   - Estrutura JSON existente? Quais campos?
   - Plano: adicionar `appointment_reminder_minutes: 15 | 30 | 60` (default 30)

PARE e me reporte:
- Plano de tab navigation (onde Agenda fica)
- Plano de actions: replicar mobile-side ou wrap em RPC
- Lista exata de arquivos a criar/modificar
- Precisa de migration nova pra `notification_preferences`?

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — Day view + Listing (~5 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do diagnóstico.

### Mudanças

1. **Rota `mobile/app/(trainer-tabs)/agenda.tsx`** (ou onde decidido)
2. **`AgendaDayView.tsx`**:
   - Header: dia + nav (esquerda/direita) + botão "Hoje" se != hoje
   - Body: swipe horizontal entre dias (pan gesture)
   - Lista vertical de cards (cronológicos por horário)
3. **`AppointmentCard.tsx`**:
   - Avatar do aluno + nome
   - Horário (`HH:MM - HH:MM`)
   - Título / descrição
   - Status indicator (active / cancelled overrides)
   - Tap → abre AppointmentDetailSheet (placeholder em B1)
4. **Hook `useAgendaOccurrences`**:
   - Query Supabase: ocorrências em range `[date - 1, date + 1]`
   - Inclui ambas: occurrences inseridas + recurring_appointments expandidas pra range
   - Retorna `{ occurrences, isLoading, refresh }`
5. **Empty state**:
   - "Nenhum agendamento para [dia]" + CTA "Novo agendamento" (placeholder em B1)

### Critério B1
Trainer abre agenda mobile, vê hoje. Swipe pra próximo dia. Botão "Hoje" funciona. Cards mostram aluno + horário.

PARE e reporte com screenshots.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — Criar / Editar / Cancelar / Reagendar (~7 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do B1.

### Mudanças

1. **`CreateAppointmentSheet.tsx`** (`@gorhom/bottom-sheet`):
   - Aluno picker (StudentPicker do mobile) — single mode
   - DateTime picker (data + hora início + duração 30/60/90/120 min)
   - Recurrence picker:
     - Single (default) — uma ocorrência
     - Weekly — repete todas as semanas, end date opcional
     - Biweekly — repete a cada 2 semanas
     - Monthly — repete a cada mês (mesmo dia)
   - Notes textarea (opcional)
   - Submit:
     - Single: cria 1 row em `appointments`
     - Recurring: cria 1 row em `recurring_appointments` + N rows em `appointment_occurrences`

2. **`AppointmentDetailSheet.tsx`**:
   - Título + horário + recorrência info
   - Aluno (avatar + nome)
   - Notes
   - Botões: Editar / Cancelar / Reagendar
   - Editar:
     - Recurring → modal "Esta ocorrência" / "Esta e futuras" / "Toda a série"
     - Single → edit direto
   - Cancelar: confirm dialog → cancela
   - Reagendar (single occurrence): novo datetime picker

3. **Actions client-side ou RPC**:
   - Conforme decisão Bloco A
   - Ações: createSingle, createRecurring, updateOccurrence, updateSeries, cancelOccurrence, cancelSeries, rescheduleOccurrence

### Critério B2
Trainer cria agendamento recorrente quinzenal, vê em outras semanas. Reagenda 1 ocorrência, vê só ela movida. Cancela toda série, série some. Edita aluno em todas as ocorrências.

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — Push notifications + Settings (~5 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do B2.

### Mudanças

1. **expo-notifications setup**:
   - Verifica/instala `npx expo install expo-notifications`
   - Configura `app.json` (notification icon + permissions)

2. **Hook `useScheduleAppointmentReminder`**:
   - `scheduleReminder({ appointmentId, datetime, minutesBefore })` → cria push local
   - `cancelReminder(appointmentId)` → cancela push pendente
   - Persiste mapping `{ appointmentId → notificationId }` em MMKV pra cancel posterior
   - Lida com cancellation/reschedule (cancel + reschedule)

3. **Settings section** em `mobile/app/profile/settings.tsx`:
   - Card "Lembretes de agenda"
   - Toggle "Receber lembretes" (default ON)
   - Dropdown: 15 / 30 (default) / 60 minutos antes
   - Save persiste em `trainer.notification_preferences.appointment_reminder_minutes`
   - Tela de info "Você receberá lembretes X min antes de cada agendamento"

4. **Permission flow**:
   - Quando trainer cria primeiro agendamento, request permission
   - Se denied: silently OK (agendamento existe sem reminder)
   - Banner inline: "Ative notificações em Configurações pra receber lembretes"

5. **Edge cases**:
   - Cancelar agendamento → cancelReminder
   - Reagendar agendamento → cancelReminder + scheduleReminder com novo datetime
   - Mudar `appointment_reminder_minutes` em settings: NÃO retroativo (próximos só)

### Critério B3
- Settings mostra dropdown de lembretes
- Trainer cria agendamento pra +90 min, recebe push 30 min antes
- Cancelar agendamento → push é cancelado
- Permission flow funciona em primeiro agendamento

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B4 — Status doc + commit + PR
═══════════════════════════════════════════════════════════════════════

Após meu OK do B3.

1. `MILESTONE-17-STATUS.md`
2. Commit final em branch:
   ```
   feat(mobile): M17 agenda mobile com day view + recurring + push reminders

   - Tab Agenda nova com day view + swipe horizontal
   - CRUD completo: criar (single/recurring), editar (occurrence/series), cancelar, reagendar
   - Push notifications locais via expo-notifications
   - Settings: appointment_reminder_minutes configurável (15/30/60)
   - Permission flow + edge cases (cancel reschedule cancel)
   - Reusa schema web (appointments + recurring + occurrences)

   Sem drag-drop (UX duvidosa em phone). Sem sync calendário nativo.
   Sem mark presence (M18 ou backlog).

   Co-authored-by: Claude <claude@anthropic.com>
   ```
3. PR pra main com smoke test detalhado

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- Schema appointments difere do esperado (recurring_appointments + occurrences)
- Server actions web são impossíveis de reusar — RPC fica complexo
- expo-notifications exige rebuild nativo (não OTA-friendly)
- trainer.notification_preferences não existe ou não aceita appointment_reminder_minutes

═══════════════════════════════════════════════════════════════════════
ORDEM
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. B1 → reportar
3. B2 → reportar
4. B3 → reportar
5. B4 → PR + merge

COMECE PELO BLOCO A.
