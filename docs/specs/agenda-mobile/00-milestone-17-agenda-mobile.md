# Milestone 17 — Agenda Mobile (Day View + CRUD + Push notifications)

**Pré-requisitos:** Agenda web em prod. Schema `appointments` + `recurring_appointments` + `appointment_occurrences` estabelecidos. Mobile com expo-router, MMKV, hooks pattern.

**Goal:** entregar agenda no mobile com paridade média ao web — visualizar (day view), criar (com recorrência), editar, cancelar, reagendar. Push notifications de lembrete configurável (15/30/60 min antes). **Sem drag-drop** (UX duvidosa em phone).

**Plataforma:** mobile only.

**Dura:** ~2-3 semanas em 4 sub-blocos.

**Branch:** `m17-agenda-mobile`.

---

## 1. Estado atual vs. desejado

### Hoje
- Web: agenda completa em `/schedule` (weekly calendar com drag-drop, recurring, groups, optimistic, sync status)
- Mobile: **nada**. Trainer móvel não vê seus agendamentos.

### Pós-M17
- Tab "Agenda" no bottom nav (ou item no `...` menu — decisão Bloco A)
- Day view padrão: cards verticais cronológicos do dia atual
- Swipe horizontal pra navegar entre dias
- FAB "+" pra criar agendamento (com recorrência opcional)
- Tap em card → bottom sheet com editar/cancelar/reagendar
- Settings: lembretes push configuráveis (15/30/60 min antes)
- Push notifications nativas via expo-notifications

---

## 2. Decisões registradas

### 2.1 Day view (não week, não month)
Pattern Apple Calendar / Google Calendar mobile. Phone portrait (width <500px) renderiza melhor lista vertical do que grid 7-col. Swipe horizontal pra navegação.

### 2.2 Sem drag-drop reschedule
UX de drag-drop em phone é duvidosa (target pequeno, conflito com swipe). Reschedule via tap → sheet → "Mover para outra data".

### 2.3 Reusa schema + actions web
Zero mudança de DB. Reusa `appointments`, `recurring_appointments`, `appointment_occurrences`. Actions web (`createRecurring`, `updateRecurring`, `cancelOccurrence`, `rescheduleOccurrence`) são server actions — mobile chama Supabase direto via RLS (pattern já estabelecido em M10A).

Detalhe: actions web são `'use server'` only. Mobile precisa replicar lógica via Supabase client direto, OU criar wrapper RPC. Decisão final no Bloco A.

### 2.4 Push notifications via expo-notifications + scheduled local
Quando trainer cria agendamento, mobile agenda **push local** com `Notifications.scheduleNotificationAsync({ trigger: { date: appointmentDate - X min } })`. Sem necessidade de cron server-side.

Trade-off: se trainer apaga o app ou troca de device, push some. Aceitável MVP. Server-side push fica como evolução.

### 2.5 Settings lembrete configurável
- 3 opções: 15 min / 30 min (default) / 60 min antes
- Persistido em `trainer.notification_preferences.appointment_reminder_minutes` (já existe coluna)
- Settings tab em `/profile/settings` ganha section "Lembretes de agenda"

### 2.6 Sem sync com calendário nativo do device
Não exporta pra iCal/Google Calendar. Fora de escopo.

---

## 3. Componentes a criar

### Telas
- `mobile/app/(trainer-tabs)/agenda.tsx` — tab nova ou rota
- `mobile/components/trainer/agenda/AgendaDayView.tsx` — day view scroll vertical
- `mobile/components/trainer/agenda/AppointmentCard.tsx` — card individual
- `mobile/components/trainer/agenda/CreateAppointmentSheet.tsx` — bottom sheet criar
- `mobile/components/trainer/agenda/AppointmentDetailSheet.tsx` — bottom sheet detalhes (editar/cancelar/reagendar)
- `mobile/components/trainer/agenda/RecurrencePicker.tsx` — picker recorrência (none/weekly/biweekly/monthly)

### Hooks
- `mobile/hooks/useAgendaOccurrences.ts` — query Supabase de ocorrências do range
- `mobile/hooks/useScheduleAppointmentReminder.ts` — wrapper expo-notifications

### Stores
- Não precisa store próprio (cache via TanStack Query ou state local)

### Server-side
- Possível RPC novo (`create_appointment_recurring_mobile`) se actions web não forem reutilizáveis. Decisão Bloco A.

---

## 4. Acceptance criteria

- ✅ Tab "Agenda" acessível no bottom nav ou via "..." menu
- ✅ Day view mostra agendamentos do dia atual (cards verticais cronológicos)
- ✅ Swipe horizontal navega ±1 dia
- ✅ Botão "Hoje" volta pro dia atual
- ✅ FAB "+" abre sheet de criação
- ✅ Criar agendamento single (data + hora + aluno + duração)
- ✅ Criar agendamento recorrente (semanal/quinzenal/mensal + data fim opcional)
- ✅ Tap em card abre detalhes (sheet com aluno + horário + recorrência + ações)
- ✅ Editar agendamento (single occurrence ou toda série)
- ✅ Cancelar agendamento (single occurrence ou toda série)
- ✅ Reagendar single occurrence (escolhe nova data/hora)
- ✅ Settings: trainer configura `appointment_reminder_minutes`
- ✅ Push notification dispara X min antes do agendamento
- ✅ Cancelar agendamento cancela push pendente
- ✅ TS clean

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Server actions web não reutilizáveis no mobile | Replicar lógica via Supabase client direto (pattern M10A) |
| Recurring appointments lógica complexa | Reusar tabelas + RLS existentes; reproduzir create flow client-side com cuidado |
| expo-notifications permission denial | Onboarding step explica + fallback graceful (agendamento existe sem reminder) |
| Push local some se trainer trocar device | Aceitável MVP; evolução server-side futura |
| Day view performa mal com 50+ agendamentos no dia | Improvável (trainer típico tem <15/dia). Limite 50 com lazy load |

---

## 6. Sub-blocos

### B1 — Day view + listing (~5d)
- Tab "Agenda" no bottom nav
- Day view com swipe horizontal
- AppointmentCard (avatar aluno + horário + título)
- Hook `useAgendaOccurrences` (query range D-1 a D+1 ao redor do dia atual)
- Empty state

**Critério:** trainer abre agenda mobile, vê agendamentos do dia, swipe pra próximo/anterior, hoje button funciona.

### B2 — Criar/Editar/Cancelar/Reagendar (~7d)
- CreateAppointmentSheet (aluno picker + datetime + duração + recurrência)
- AppointmentDetailSheet (editar / cancelar / reagendar)
- Lógica recurring: cria `recurring_appointments` + gera `appointment_occurrences`
- Edit: split entre "esta ocorrência" / "toda série"
- Reschedule single occurrence: cria override em `appointment_occurrences`

**Critério:** trainer cria agendamento recorrente, vê em outras semanas, reagenda 1 ocorrência, cancela toda série.

### B3 — Push notifications + Settings (~5d)
- Hook `useScheduleAppointmentReminder` que agenda/cancela push local
- Settings section em `/profile/settings` (ou novo) com toggle + dropdown 15/30/60
- Persiste em `trainer.notification_preferences`
- Permission flow: ao primeiro agendamento, pede permissão

**Critério:** trainer agenda compromisso pra +1h, recebe push 30 min antes (default).

### B4 — Status doc + commit + OTA setup (~3d)
- `MILESTONE-17-STATUS.md`
- Validação manual em emulador/dispositivo
- Commit + PR + merge
- Nota sobre OTA: M17 adiciona expo-notifications (já existe? se não, é dep nativa que exige rebuild EAS)

---

## 7. Validação

1. Trainer abre app → tab Agenda → vê hoje
2. Swipe esquerda → vê próximo dia
3. FAB "+" → cria recorrente quinzenal "Treino com Marina, terças 15h, 12 semanas"
4. Vê o evento aparecer todas as terças nas próximas 12 semanas
5. Tap em uma ocorrência → "Editar" → mudar duração só nessa → vê só ela alterada
6. Tap noutra → "Cancelar série" → confirm → série some
7. Settings → muda lembrete pra 60 min
8. Cria agendamento pra +90 min → recebe push 30 min antes ✓
9. Cancelar agendamento → push é cancelado

---

## 8. Fora de escopo

- ❌ Drag-drop reschedule
- ❌ Sync com calendário nativo (iCal/Google)
- ❌ Week view (toggle)
- ❌ Mark presence/no-show (web tem; M17 deixa de fora)
- ❌ Server-side push (local push só, MVP)
- ❌ Notificações pro aluno (M17 só pro trainer)
