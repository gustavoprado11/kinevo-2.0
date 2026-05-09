# Milestone 17 — Agenda Mobile (STATUS)

**Branch:** `m17-agenda-mobile`
**Período:** Bloco A → B4 (sessão única)
**Plataforma:** mobile only (iOS + Android via Expo)
**Schemas tocados:** zero. Reusa `recurring_appointments` + `appointment_exceptions` + projeção shared.

---

## Sumário

Mobile ganha tab "Agenda" com day view, CRUD completo de agendamentos (single + recorrente: weekly/biweekly/monthly), reagendamento por escopo (esta ocorrência / esta e futuras / toda série), cancelamento por escopo e push notifications locais configuráveis (15/30/60 min antes, default 30).

Trainer móvel agora pode:

- Ver agendamentos do dia com swipe horizontal entre dias
- Criar agendamento (single ou recorrente) via FAB ou empty-state CTA
- Tap em card → editar notas / reagendar / cancelar
- Configurar lembretes em Settings → Notificações → "Lembretes de agenda"
- Receber push local antes de cada atendimento

---

## Cobertura por bloco

### Bloco A — Diagnóstico
- Branch criada e push (sem deploy — feature branch).
- Inspeção schema: schema real é `recurring_appointments` + `appointment_exceptions` (NÃO `appointment_occurrences` como spec original mencionou — ver "Schema diff" abaixo).
- Decisão: replicar lógica das server actions web (`'use server'`) client-side via Supabase direto, com RLS scoping. Pattern já estabelecido em M10A.
- Decisão tab nav: "Mais → Atendimentos → Agenda" + atalho em "Acesso Rápido" do dashboard. Bottom nav ficou cheio (5 tabs ocupados); substituir Formulários (que tem badge ativo) seria regressão.
- Decisão migration: nenhuma. `trainers.notification_preferences` é JSONB extensível.
- Decisão push: local via `expo-notifications`. Server-side push fica como evolução futura.

### Bloco B1 — Day view + listing
- `useAgendaOccurrences`: query `recurring_appointments` + `appointment_exceptions` + projeção via `shared/utils/appointments-projection.ts`. Resolve `students` em batch.
- `AppointmentCard`: time block, avatar/iniciais, nome, duração, status accent strip + badges.
- `AgendaDayView`: header com título dinâmico (Hoje/Ontem/Amanhã/dia), botão "Hoje" condicional, day nav strip, pan gesture horizontal (Reanimated + react-native-gesture-handler), pull-to-refresh, empty state.
- `app/agenda/index.tsx`: tela principal, range D-1..D+1, FAB violet.
- Integração: linha "Agenda" em `Mais` (seção "Atendimentos") + card no carrossel "Acesso rápido" do dashboard.

### Bloco B2 — CRUD completo
- `useAppointmentMutations`: `createAppointment`, `updateRecurring`, `cancelSeries`, `cancelOccurrence`, `rescheduleOccurrence`. Replica fielmente as 5 server actions web (insert/upsert/update direto). Skip Google Calendar / scheduled_notifications / inbox.
- `CreateAppointmentSheet`: gorhom bottom sheet, aluno picker com search, date strip (60 dias), time chips (06:00–22:45 cada 15 min), duration (30/60/90/120), recurrence (4 opções), notes.
- `AppointmentDetailSheet`: 3 modos (`view` / `reschedule` / `edit_notes`). View tem InfoRows + 3 ações. Reschedule reusa pickers do create.
- `EditScopeDialog`: modal com 3 opções (only_this / this_and_future / whole_series), `excludeThisAndFuture` flag pro fluxo de cancel.
- Validações `monthly`/`once` (dow == weekday(starts_on)) espelham web. Defense-in-depth ownership check (`coach_id`/`trainer_id`) em todas as mutations.
- Para `frequency='once'` reagendado, espelha behavior web: também faz patch do rule (starts_on/start_time/day_of_week) pra projeção ficar coerente.
- Group note propagation copiada do web (se `group_id != null`, propaga notes).

### Bloco B3 — Push notifications + Settings
- `lib/appointment-reminders.ts`: mapa MMKV `ruleId → notificationId[]`. Fallback no-op em Expo Go.
- `useTrainerNotificationPreferences`: read/write `appointment_reminders_enabled` + `appointment_reminder_minutes` em `trainers.notification_preferences` (JSONB), preservando outras keys.
- `useScheduleAppointmentReminder`: agendamento local. `rescheduleRuleReminders` cancela pushes da rule + reagenda **até 12 ocorrências futuras** respeitando `appointment_exceptions` (skip canceled/completed/no_show, aplica `new_date/new_start_time` em rescheduled). Trigger via `Notifications.SchedulableTriggerInputTypes.DATE`. Skip silencioso se `triggerAt <= now+5s`.
- Integração com B2: `CreateAppointmentSheet` chama `scheduleForRule` após sucesso (com permission flow). `AppointmentDetailSheet` chama `cancelForRule`/`refreshForRule`/`scheduleForRule` no ponto certo de cada mutation. `updateRecurring(whole_series)` reagenda do zero.
- Permission flow: pede no 1º create se ainda não granted + canAskAgain. Banner amber inline se permanentemente denied. Schedule funcs viram silent no-op sem permission.
- `notification-settings.tsx` ganha section "Lembretes de agenda" (toggle + dropdown 15/30/60). Mudança de minutes/toggle dispara `syncAllRuleReminders` pra reagendar pushes existentes com novo offset.

### Bloco B4 — Status doc + PR
- Este documento.
- Commit + push + PR pra `main`.

---

## Decisões críticas registradas

### 1. Cap de 12 ocorrências futuras por rule
**Razão:** iOS tem limite de 64 pushes pendentes total. 12 × ~5 rules ativos = 60 (margem). Próximas chamadas de `scheduleForRule` re-rodam projeção e re-preenchem.
**Trade-off:** trainer com 50+ rules ativos perde pushes do "fim da fila". Aceitável MVP — uso típico é 5-15 rules simultâneos.

### 2. Horizonte de 180 dias na projeção
**Razão:** cobre cap de 12 mensais (~12 meses), mas o cap pega antes em weekly/biweekly. Lookahead generoso evita perda de pushes em rules de baixa frequência.

### 3. Timezone local do device
**Razão:** triggers usam `new Date(y, m-1, d, hh, mm)` em local TZ. Trainer marca "10:00" → push 9:30 no relógio dele. Coerente com pickers da UI (que também usam local TZ).
**Trade-off:** se trainer viajar pra outra TZ, pushes existentes podem disparar no horário "antigo". Reagendar manualmente resolve.

### 4. Edit de minutes retroage pros pushes existentes
**Razão:** comportamento mais previsível pro trainer ("agora todos os meus lembretes são 60 min antes"). `syncAllRuleReminders` re-agenda tudo tracked localmente.
**Trade-off:** se trainer trocar de 30 → 60 às 9:35 e o appointment é às 10:00, push novo já passou (skip silencioso). Aceitável.

### 5. Server actions web não reusáveis no mobile
**Razão:** `'use server'` + deps Next-only (`revalidatePath`, `supabaseAdmin`, web-only services). Replicação client-side é + simples que criar RPCs.
**Skips intencionais (web-only, fora de escopo M17):**
- Google Calendar sync (`@/lib/google-calendar/sync-service`)
- Server-side `scheduled_notifications` (substituído por push local)
- `student_inbox_items` (M17 só notifica trainer)

### 6. Tab navigation: "Mais → Agenda" + atalho no Acesso Rápido
**Razão:** bottom nav já tinha 5 tabs (Dashboard / Alunos / Mensagens / Formulários / Mais); todos justificados, com Formulários portando badge ativo. "Mais" é o slot certo HIG-wise. Atalho no carrossel "Acesso rápido" garante 1-tap pro uso diário.

### 7. Sem migration
**Razão:** `trainers.notification_preferences` (migration 056) já é JSONB. Adicionar `appointment_reminders_enabled` + `appointment_reminder_minutes` é literalmente `jsonb_set` no client — zero DDL.

---

## Schema diff registrado

A spec do M17 (`docs/specs/agenda-mobile/00-milestone-17-agenda-mobile.md`) menciona `appointment_occurrences` em vários pontos. **Esse nome não existe no banco.** O schema real (migrations 106/107/110) é:

| Spec dizia | Schema real |
|---|---|
| `appointment_occurrences` (tabela) | `appointment_exceptions` (apenas desvios) |
| Gera N rows ao criar recorrência | Guarda só a regra; ocorrências são computadas via `shared/utils/appointments-projection.ts` |

Implementação seguiu o real (validado em Bloco A). Spec deve ser atualizada retroativamente fora deste milestone.

---

## Limitações conhecidas (out-of-scope intencional)

| Limitação | Razão |
|---|---|
| Sem device migration (rules antigos não recebem push em novo device) | MVP. Server-side push (cron + scheduled_notifications) fica como evolução futura — base já existe na web. |
| Sem deep-link no tap do push | `data.recurring_appointment_id` + `occurrence_date` já são incluídos no payload — pronto pra `usePushNotifications` rotear pra `/agenda?date=...` em iteração futura. |
| Sem mark presence (completed / no_show) | Schema suporta (`appointment_exceptions.kind`), web já tem `mark-occurrence-status.ts`. Não estava no escopo M17. |
| Sem week view / month view | Decisão arquitetural: phone portrait performa melhor com day view + swipe (pattern Apple/Google Calendar). |
| Sem drag-drop reschedule | UX duvidosa em phone (target pequeno, conflito com swipe). Reschedule via tap → sheet. |
| Sem sync com calendário nativo (iCal/Google) | Fora de escopo. |
| Cap 12 perdidas além do horizonte | Próxima chamada `scheduleForRule` re-preenche. Trainer não percebe. |

---

## Lista exaustiva de arquivos

### Novos
```
mobile/
├── app/agenda/
│   └── index.tsx                                          (~140 LOC)  Tela principal
├── components/trainer/agenda/
│   ├── AgendaDayView.tsx                                  (~280 LOC)  Day view com swipe
│   ├── AppointmentCard.tsx                                (~150 LOC)  Card individual
│   ├── CreateAppointmentSheet.tsx                         (~480 LOC)  Sheet criar (+ permission flow B3)
│   ├── AppointmentDetailSheet.tsx                         (~590 LOC)  Sheet view/reschedule/edit_notes (+ reminders B3)
│   └── EditScopeDialog.tsx                                (~110 LOC)  Modal scope picker
├── hooks/
│   ├── useAgendaOccurrences.ts                            (~180 LOC)  Query + projeção + frequency lookup
│   ├── useAppointmentMutations.ts                         (~310 LOC)  CRUD client-side (replica web actions)
│   ├── useScheduleAppointmentReminder.ts                  (~270 LOC)  Local push scheduling com cap 12
│   └── useTrainerNotificationPreferences.ts               (~165 LOC)  Read/write JSONB prefs
└── lib/
    └── appointment-reminders.ts                           (~70 LOC)   MMKV map ruleId → notificationIds
```

### Modificados
```
mobile/app/(trainer-tabs)/more.tsx                         +14/-2     Linha "Agenda" em seção "Atendimentos"
mobile/components/trainer/QuickActions.tsx                 +11/-1     Card "Agenda" no carrossel (1º)
mobile/app/notification-settings.tsx                       +135/-12   Section "Lembretes de agenda"
```

### Inalterados (mas referenciados)
```
shared/types/appointments.ts                               Tipos completos já existentes
shared/utils/appointments-projection.ts                    Projeção pure (expandAppointments + iterateValidDates)
```

**Total novo:** ~2900 LOC. **Total modificado:** ~160 LOC.

---

## Validações

- ✅ `tsc --noEmit` no mobile: zero erros nos arquivos M17. Erros pré-existentes (useLiveActivity, useTrainerChat, expo-file-system) seguem fora do escopo.
- ✅ Sem deps novas — `expo-notifications`, `react-native-mmkv`, `@gorhom/bottom-sheet`, `react-native-gesture-handler`, `react-native-reanimated` já presentes.
- ✅ RLS scoping: queries filtram por `trainer_id = trainerId` (defense-in-depth com policies).
- ✅ Sem `any` (exceto cast `as never` no update do `notification_preferences` JSONB — necessário pelos tipos restritivos do Supabase, mesmo workaround do `usePushNotifications` existente).
- ✅ Sem `'use server'`, sem deps Next-only — código limpo do mobile.
- ✅ Sem migration, sem RPC novo — backward-compat absoluto.

### Não validado (precisa device real)
- Push local disparando no horário correto.
- Permission flow real (alert do iOS).
- Pan gesture em device touchscreen (testado por código mas não em hardware).
- Snap points do bottom sheet em diferentes alturas de device.

---

## Próximos passos (post-merge)

1. **OTA push** após merge: `eas update --branch production`. Sem rebuild nativo necessário (`expo-notifications` + `react-native-mmkv` já estavam linked nas builds anteriores).
2. **Smoke test em device real:**
   - Login trainer
   - Dashboard → Acesso rápido → Agenda
   - Criar agendamento quinzenal
   - Aceitar permission prompt
   - Aguardar push local disparar (pode-se trocar `minutesBefore=1` em dev pra teste rápido)
   - Tap card → cancelar série → confirmar push some
3. **Atualizar spec** `docs/specs/agenda-mobile/00-milestone-17-agenda-mobile.md` retroativamente com nomenclatura correta (`appointment_exceptions` ao invés de `appointment_occurrences`).

## Roadmap pós-M17

- **Deep-link no tap do push** (~1 dia): rotear pra `/agenda?date=YYYY-MM-DD` usando `data.occurrence_date` que já é enviado no payload.
- **Server-side push** (~3 dias): consumir `scheduled_notifications` server-side via cron + Expo Push API. Resolve "device migration" + permite reminders pro aluno.
- **Mark presence (completed / no_show)** (~2 dias): adicionar ações no `AppointmentDetailSheet` que chamam `mark-occurrence-status` (action web já existe; replicar mobile-side).
- **Week view toggle** (~3 dias): segmented control no header (Day/Week). Week view já requer scroll vertical de horas.
