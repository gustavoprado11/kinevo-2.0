# Mapa do Sistema Kinevo — Análise Noturna (Fase 1)

Data: 2026-06-09. Gerado por leitura estática do monorepo (`web/`, `mobile/`, `shared/`, `supabase/`). Migrations lidas em ordem 001→179; estado descrito é o **final** após todos os ALTERs/DROPs.

Estrutura geral:
- `web/` — Next.js App Router (painel do treinador + landing pública + API + MCP server). Auth Supabase SSR por cookie via `web/src/middleware.ts` → `web/src/lib/supabase/middleware.ts`.
- `mobile/` — Expo/React Native (expo-router). App **dual-role**: aluno `(tabs)` e treinador `(trainer-tabs)`.
- `shared/` — pacote `@kinevo/shared` (tipos, tokens de design, lógica de prescrição/avaliação).
- `supabase/` — 176 arquivos de migration (numeração 001–179 com lacunas 089, 116, 117, 157–160 e **duplicatas de número**: 092, 133, 145, 168), 19 edge functions, seeds.

---

## 1. Rotas Web (web/src/app)

### Páginas — painel do treinador (auth por cookie, protegidas pelo middleware)
| Rota | Propósito |
|---|---|
| `/` (`page.tsx`) | Redirect raiz (login/dashboard) |
| `/login`, `/signup` | Auth do treinador |
| `/auth/forgot-password`, `/auth/update-password` | Reset de senha (fluxo e-mail Supabase) |
| `/dashboard` | Home do treinador: stats, insights do assistente, ações pendentes |
| `/students`, `/students/[id]` | Lista e perfil 360º do aluno |
| `/students/[id]/prescribe` | Prescrição assistida por IA (wizard) |
| `/students/[id]/program/new`, `.../program/[programId]`, `.../edit` | Builder de programa atribuído |
| `/students/[id]/avaliacoes/[sessionId]` (+`/capture`, `/result`) | Sessão de avaliação física (coleta e resultado) |
| `/programs`, `/programs/new`, `/programs/[id]` | Templates de programa |
| `/exercises` | Biblioteca de exercícios (sistema + próprios + vídeos do trainer) |
| `/avaliacoes`, `/avaliacoes/templates`, `/avaliacoes/templates/new` | Avaliações físicas (sessões e templates) |
| `/forms`, `/forms/inbox`, `/forms/templates`, `/forms/templates/new` | Formulários (anamnese/check-in/survey) e inbox de respostas (realtime) |
| `/messages` | Chat treinador↔aluno (realtime) |
| `/schedule` | Agenda (recurring_appointments + exceções + Google Calendar) |
| `/training-room` | "Sala de treino" presencial: treinador executa o treino do dia do aluno |
| `/financial` (+`/plans`, `/subscriptions`, `/settings`, `/wallet`, `/pix-keys`) | Módulo financeiro: planos, contratos, carteira Asaas, chaves PIX |
| `/leads` | Pipeline de leads vindos da landing pública do trainer |
| `/marketing`, `/marketing/landing`, `/marketing/leads` | Hub de marketing: editor da landing pública do trainer e leads |
| `/settings` (+`/api-keys`, `/integrations/google-calendar`) | Perfil, branding, tema, API keys do MCP, integração Google Calendar |
| `/subscription/blocked` | Tela de bloqueio quando assinatura do treinador vence |
| `/checkout-bridge` | Ponte de retorno do Stripe Checkout (success/canceled), usada pelo mobile |
| `/onboarding` | (via actions/onboarding) estado guiado de onboarding em `trainers.onboarding_state` |

### Páginas públicas
| Rota | Propósito |
|---|---|
| `/landing` | Landing B2B do Kinevo (SaaS) |
| `/(public)/com/[slug]` | **Landing pública do personal** (campos `trainers.landing_*`, `public_slug`); captura leads → `trainer_leads` |
| `/privacy`, `/terms`, `/android` | Legais / página Android |
| `/docs/conector` | Documentação do conector MCP (Claude) |

### OAuth/MCP discovery
- `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openai-apps-challenge` — metadata OAuth do MCP.
- `/oauth/authorize` (página de consentimento), `/oauth/register` (dynamic client registration), `/oauth/token` (token endpoint) — fluxo OAuth+PKCE do MCP server, tabelas `mcp_oauth_*` (migration 147).

### Server Actions (web/src/actions/) — ~105 arquivos
Agrupadas por domínio (todas 'use server', auth via Supabase server client):
- `auth/signup-trainer.ts` — gate de signup: honeypot, Turnstile, rate-limit por IP (2/min, 10/dia), blocklist de domínio (espelha trigger da migration 118), HIBP password check, cria `trainers` via admin client.
- `create-student.ts` — cria aluno: admin client cria auth user com senha gerada, insere `students`, retorna credenciais para o trainer entregar (não há convite por e-mail; modelo "senha provisória").
- `appointments/*` — CRUD de agenda recorrente, exceções, grupos, status de ocorrência.
- `assessments/*` — sessões de avaliação física (create/save/finalize/cancel) sobre RPCs da migration 122.
- `financial/*` — contratos, planos, mark-as-paid, checkout link, bloqueio por inadimplência, arquivar aluno.
- `forms/*` — templates de formulário (inclui **geração por IA** `generate-form-with-ai.ts` e auditoria `audit-form-quality-ai.ts`, OpenAI `gpt-4o-mini`), atribuição, agendamentos, feedback.
- `prescription/*` — pipeline IA de prescrição: `analyze-context`, `generate-program` (núcleo, ~1200 linhas), `approve/reject-program`, `capture-post-assignment-edits` (feedback loop p/ `trainer_edits_diff`), perfil de prescrição, questionário.
- `trainer/*` — perfil, tema, branding (white-label), landing pública (slug, hero, planos, seções), preferências de prescrição.
- `training-room/*` — wrappers das RPCs `get_student_today_workout_for_trainer` / `trainer_finish_workout_session` / `get_training_room_students`.
- `leads/*`, `concierge/request-concierge.ts`, `insights.ts`, `api-keys/*` (chaves MCP), `google-calendar/*`, `onboarding/*`, `organizations/*` (resíduo do Kinevo Estúdios), `dashboard/*`, `exercises/*`, `programs/*`, `submit-feedback.ts`.

---

## 2. Telas Mobile (mobile/app)

### Auth / transversal
- `index.tsx` — roteador raiz: decide por `useRoleMode()` → aluno `(tabs)/home`, treinador `(trainer-tabs)/dashboard`, dual-role → `role-select.tsx`; treinador com assinatura inativa → `trainer-subscription-blocked.tsx` (gate **client-side**, reforçado no servidor pela migration 177).
- `(auth)/login.tsx`, `(auth)/forgot-password.tsx` (resetPasswordForEmail), `(auth)/enter-code.tsx` (verifyOtp por código), `(auth)/verify-email.tsx`. Login em `mobile/contexts/AuthContext.tsx` (signInWithPassword; sessão no keychain).
- `notifications/index.tsx`, `notification-settings.tsx`, `debug-logs.tsx`, `(dev)/*` showcases.

### Lado ALUNO — `(tabs)`
- `home.tsx` (treino do dia, streak, acesso bloqueado via `useStudentAccess`), `logs.tsx` (histórico), `inbox.tsx` + `inbox/[id].tsx` (formulários/feedback/avisos), `health.tsx` + `health/[metric].tsx` (HealthKit/Oura/Strava: sono, HRV, readiness), `profile.tsx` + `profile/*` (conquistas, conexões wearable, privacidade, assinatura, histórico de pagamento, suporte, termos).
- `workout/[id].tsx` — execução do treino (set logs, métodos avançados, Apple Watch espelhamento).
- `chat.tsx` — chat com o treinador.
- `payment.tsx` — tela de cobrança/checkout do aluno (Asaas).
- `report/[id].tsx` — relatório de programa publicado pelo treinador.
- `trainer-profile.tsx` — perfil/branding do personal.

### Lado TREINADOR — `(trainer-tabs)` e stacks
- Tabs: `dashboard.tsx`, `students.tsx`, `messages.tsx`, `forms.tsx`, `training-room.tsx`, `more.tsx`.
- `student/[id]/index.tsx`, `student/[id]/prescribe.tsx` — perfil e prescrição IA.
- `program-builder/` (index, preview, `edit/[assignedProgramId]`), `program-templates/`.
- `exercises/` (biblioteca), `assessments/` (sessões, medição por teste, resultado, novo template), `agenda/`, `leads/`, `messages/[studentId]`, `training-room.tsx` (stack), `financial/*` (dashboard, contratos, planos, settings, wallet Asaas com ativação/payout/pix-keys).

---

## 3. API routes e MCP server (web)

### Autenticação das rotas API
`web/src/middleware.ts` documenta o contrato: rotas mobile-first (`api/financial`, `api/wallet`, `api/notifications`, `api/student`, `api/messages/notify-*`, `api/prescription/generate`, `api/programs/assign`, `api/stripe/portal`) são **excluídas do middleware de cookie** e DEVEM validar `Authorization: Bearer <supabase_access_token>` via `supabaseAdmin.auth.getUser(token)` (`web/src/lib/supabase/server-from-token.ts`). `api/cron/*` protegidas por `CRON_SECRET`. Webhooks por assinatura.

### Endpoints
- **Assistente IA**: `api/assistant/chat` — streamText (AI SDK, `gpt-4.1-mini`) com tools `generateProgram`, `analyzeStudentProgress`, `getStudentInsights`.
- **Prescrição IA**: `api/prescription/generate`, `/analyze`, `/parse-text` (importar treino de texto livre).
- **Cron (Vercel, ver `web/vercel.json`)**: `activate-scheduled-programs` (07h), `check-manual-overdue` (11h), `process-push` (12h), `process-form-schedules` (08h), `check-push-receipts` (13h), `expire-programs` (10h), `generate-insights` (09h, regras heurísticas → `assistant_insights`), `cleanup-orphan-signups` (03h).
- **Financeiro**: `api/financial/*` (contratos, planos, settings, mark-paid, checkout-link, stripe-status) — espelho mobile das server actions.
- **Stripe (assinatura SaaS do treinador)**: `api/stripe/checkout`, `portal`, `sync`, `cancel-subscription`, `webhook`; **Stripe Connect (legado p/ alunos)**: `api/stripe/connect/*` (onboard, status, balance, dashboard, checkout, sync-contracts).
- **Asaas (carteira do treinador p/ cobrar alunos)**: `api/wallet/*` — activate (KYC subconta), balance, charges (+sync), documents, link, payouts (+sync), pix-keys, subscriptions, sync, setup-webhook, status. `api/student/payment` — lado do aluno. `api/diagnostic/asaas-fees`.
- **Webhooks**: `api/webhooks/stripe` (assinatura do treinador: checkout.session.completed, invoice.payment_succeeded/failed, customer.subscription.updated/deleted → tabela `subscriptions`), `api/webhooks/stripe-connect` (account.updated + eventos de cobrança de aluno → `student_contracts`/`financial_transactions`), `api/webhooks/asaas` (PAYMENT_RECEIVED/CONFIRMED/OVERDUE/REFUNDED/CHARGEBACK*, TRANSFER_* → payouts, ACCOUNT_STATUS_* → KYC; dedup via `webhook_events`), `api/webhooks/google-calendar` (push de watch channel).
- **Push/notificações**: `api/notifications/register-token`, `preferences`, `flush-pending`, `flush-student-pending`; `api/messages/notify-student|notify-trainer` (push de chat); `api/trainer-notifications` (+mark-read).
- **Outros**: `api/programs/assign`, `api/students/[id]/access` (block/unblock), `api/reports/[id]/notes`, `reports/program/[id]` (PDF/HTML do relatório).

### MCP server (`web/src/app/api/mcp/route.ts` + `web/src/lib/mcp/`)
- Transporte: `WebStandardStreamableHTTPServerTransport` (SDK MCP oficial). Allowlist de Origin (claude.ai/claude.com/kinevoapp.com/chatgpt.com — anti DNS-rebinding).
- Auth dupla: API key (`trainer_api_keys`, hash + prefixo) **ou** OAuth 2.1 + PKCE (`mcp_oauth_clients/codes/tokens`, dynamic client registration). Logging por chamada em `mcp_tool_usage_logs`.
- **27 tools** (`web/src/lib/mcp/tools/`): ping; students (list/get/create/update); programs (list/get/create/assign/expire); workouts-write (add/update/delete session, add exercise, update/delete item, create superset, list_training_methods); progress (get_student_progress, dashboard_summary); exercises (list); billing (get_revenue_summary, list_subscriptions); conversations (list/get/send_message); forms (get_form_responses).

---

## 4. Edge Functions (supabase/functions/)

| Função | Gatilho | Propósito |
|---|---|---|
| `create-student` | App (trainer autenticado) | Cria auth user + row `students` com senha gerada (admin API); rollback se falhar |
| `update-student`, `archive-student`, `reset-student-password` | App | Mutações administrativas no aluno via service-role (archive usa `trainer_student_links`) |
| `assign-program` | App | Atribui programa (chama RPC `assign_program_to_student`) |
| `parse-workout-text` | App (mobile) | LLM parse de treino em texto livre — OpenAI `gpt-4.1-mini` c/ fallback `gpt-4o-mini` |
| `send-push-notification` | Trigger DB via `pg_net` (098) + chamadas diretas | Envia push Expo; grava `push_tickets`/`push_errors` |
| `dispatch-scheduled-notifications` | pg_cron */5min | Lê `scheduled_notifications` pendentes → insere `student_inbox_items` (que dispara push) |
| `extend-scheduled-notifications` | pg_cron diário 05h | Materializa lembretes de agenda p/ próximos 30 dias (UPSERT) |
| `renew-google-watch-channels` | pg_cron diário 06h | Renova watch channels do Google Calendar que expiram em <2 dias |
| `generate-assessment-pdf` | App | PDF do relatório de avaliação (ownership checada em código, service-role) |
| `oura-oauth-exchange` / `oura-token-refresh` / `oura-sync` / `oura-webhook` / `oura-webhook-setup` / `oura-disconnect` | App / pg_cron 03h diário / webhook Oura / pg_cron semanal | Integração Oura: OAuth server-side, backfill 30d, webhook de novos dados → tabelas wearable |
| `strava-token-exchange` / `strava-token-refresh` | App (mobile) | OAuth Strava server-side (sem PKCE; client_secret em secrets) → `external_activities` |

---

## 5. Schema do banco — estado FINAL (após 001→179)

### Extensões
`pgcrypto` (001), `pg_trgm` + `unaccent` (023), `pg_net` (098/154), `pg_cron` (108/154).

### pg_cron jobs
`dispatch-scheduled-notifications` (*/5min), `extend-scheduled-notifications` (05h), `renew-google-watch-channels` (06h), `oura-token-refresh-daily` (03h), `oura-webhook-setup-weekly` (seg 03h30). **`block-overdue-daily` está apenas COMENTADO na migration 140** — o caminho ativo é o Vercel cron `check-manual-overdue` + webhook Asaas chamando `block_overdue_students()` via service-role.

### Buckets de storage
| Bucket | Público? (final) | Origem/policies |
|---|---|---|
| `avatars` | público; listagem restrita ao dono após 121 | 018/020 |
| `form-uploads` | privado | 026 (aluno CRUD nos próprios; trainer lê dos vinculados) |
| `messages` | privado após 101/121; caminho `{auth_uid}/...`; migração p/ signed URL (163: coluna `messages.image_path`) | 090 |
| `feedback-screenshots` | privado após 101/121 | (criado fora; policies em 101) |
| `trainer-videos` | público (leitura por URL), escrita só dono | 092 |
| `exercise-library-videos` | escrita service-role only, listagem authenticated | 135 |

### Tabelas (estado final, agrupadas)

**Identidade/tenancy**
- `trainers` — auth_user_id FK auth.users, name, email, avatar_url, theme, **muitos JSONB acumulados**: `onboarding_state` (039), `notification_preferences` (056), `prescription_patterns` (064), `prescription_preferences` (120), `landing_*` (167/169/170: public_slug UNIQUE, landing_published, headline, bio, stats, testimonials, faq, plans, sections, hero), branding (164: brand_name/color/logo/show_powered_by/branding_enabled), `financial_attention_seen_at`, `ai_prescriptions_enabled` (036), `smart_v2_enabled` (104), `instagram_handle` (133), `modality_focus` (131), `auto_publish_reports`.
- `students` — **`coach_id`** (renomeado de trainer_id na 025; pode ser NULL desde 084), auth_user_id, name/email/phone/avatar, status, modality (013), is_trainer_profile (031: perfil-aluno espelho do treinador, com triggers de sync de avatar 032), stripe_customer_id/subscription_id (028), notification_preferences (080), trainer_notes (040), objective + management_tags (092b), **access_blocked_at/access_blocked_reason** (139 — fonte do gate de inadimplência).
- `trainer_student_links` (084) — histórico de vínculo coach↔aluno (archive/re-link), is_current.

**Catálogo de exercícios**
- `exercises` — `owner_id` nullable (NULL = sistema; renomeado de trainer_id na 007), name, equipment, video_url/thumbnail, instructions, is_archived, difficulty_level/is_primary_movement/session_position (037), movement_pattern (061), movement_pattern_family + fatigue_class (070), is_ai_curated + prescription_notes (063), video_source_drive_id (135). Colunas legadas muscle_group* dropadas (011).
- `muscle_groups` — sistema (owner_id NULL) + do trainer (011); hierarquia parent_id (137). `exercise_muscle_groups` junção N:N.
- `exercise_relationships` (grafo: substitute/progression/regression/variation/equipment_alternative, weight, provenance), `exercise_synergies` (atribuição de volume entre grupos), `exercise_condition_constraints` (contraindicações por condição clínica) — 070, seeds 071–073.
- `trainer_exercise_videos` (092) — vídeo do trainer por exercício (upload ou URL), UNIQUE(trainer,exercise).

**Treino — templates e atribuídos (espelhados)**
- `program_templates` (trainer_id, name, duration_weeks, is_template 009, usage_count via RPC 151) → `workout_templates` (order_index, frequency[] 016) → `workout_item_templates` (item_type exercise|superset|note|**warmup|cardio** (079, item_config JSONB), parent_item_id p/ superset, sets/reps/rest, substitute_exercise_ids (022), exercise_function (054), method_key + rounds (111/112)) → `workout_item_set_templates` (111: prescrição por série — set_type warmup/normal/top/backoff/drop/failure/cluster/amrap, reps, weight kg/%1RM, RIR, tempo, round_number).
- `assigned_programs` (student, trainer, source_template, status active|completed|paused + scheduled (015) + draft/expired (036/086: starts_at agendado, expires_at, ai_generated, prescription_generation_id), UNIQUE ativo por aluno) → `assigned_workouts` (scheduled_days int[] 014) → `assigned_workout_items` (snapshot de exercício, mesmos campos do template) → `assigned_workout_item_sets`.
- `training_method_presets` (111) — métodos de sistema (trainer_id NULL) e do trainer.
- Função central `assign_program_to_student()` (003, reescrita em 012/054/079) copia template→assigned.

**Execução**
- `workout_sessions` — student/trainer/assigned_workout/program, status in_progress|completed|abandoned, started/completed_at, duration (trigger calc), scheduled_date, program_week, rpe+feedback (017), pre/post_workout_submission_id (078), device_id/sync_status offline-first, índice único de 1 sessão in_progress (041), cleanup_stale_sessions(). Trigger 101 força trainer_id = coach do aluno.
- `set_logs` — por série: weight/unit, reps, rpe, is_completed, planned/executed_exercise_id + swap_source (022), local_id/device_id (idempotência offline), upsert incremental (038). Delete pelo aluno permitido em 175.
- `workout_health_samples` (128) — agregados de FC do Apple Watch por sessão (1:1, série JSONB downsampled).
- `perfect_weeks` (156) — semanas perfeitas do aluno (idempotente por student+week_start_date, segunda-feira).

**Formulários/inbox/avaliações**
- `form_templates` — trainer_id **nullable** (062: templates de sistema com `system_key` UNIQUE — questionário de prescrição 062, avaliação inicial 065, templates de sistema 066), category anamnese|checkin|survey|assessment|feedback (122/124), schema_json, delivery_mode (122), versionamento, metadados de geração por IA.
- `student_inbox_items` — feed do aluno: type form_request|feedback|system_alert|text_message|**appointment_reminder** (069/108), status, payload JSONB, push_sent_at; realtime habilitado (026).
- `form_submissions` — snapshot do schema + answers_json, status draft|submitted|reviewed, trainer_feedback, trigger_context (manual|pre_workout|post_workout|scheduled 078), realtime (053). RPCs `assign_form_to_students`, `submit_form_submission`, `submit_inline_form`, `send_submission_feedback` (027/078).
- `program_form_triggers` (078) — formulário pré/pós-treino por programa (máx 1 de cada). `form_schedules` (078) — recorrência (daily→monthly) processada pelo cron `process-form-schedules`.
- `assessment_sessions` + `assessment_measurements` (122) — avaliação física conduzida pelo treinador: snapshot do template, métricas computadas (protocolos em `shared/lib/assessment-protocols/`), medições por metric_key/side/attempt. Seeds de templates em 123. RPCs get/create/save/finalize.

**Financeiro**
- `subscriptions` (019) — assinatura **SaaS do treinador** (Stripe direto): status trialing|active|past_due|canceled|incomplete, current_period_end.
- `payment_settings` (025) — Stripe Connect do treinador (legado).
- `trainer_plans` — planos de cobrança de aluno: price, interval, stripe_product/price_id, allow_pix/credit_card/boleto (132), max_installment_count (178).
- `student_contracts` — contrato do aluno: plan_id (nullable 030), amount, status (inclui 'expired' 082), billing_type ENUM stripe_auto|manual_recurring|manual_one_off|courtesy|asaas_auto (132)|asaas_auto_recurring (133b), block_on_fail, current_period_end, cancel_at_period_end, canceled_by/at (042), provider stripe|asaas, asaas_customer/subscription/payment/payment_link_id (132/142), installment_count (178).
- `financial_transactions` — coach_id, student_id, gross/net, type, status, stripe_payment_id, provider + asaas_payment_id (132, UNIQUE 144).
- `contract_events` (042) — timeline: student_registered…access_blocked/unblocked (+archived 084).
- `webhook_events` — dedupe de webhooks (service-role only 121).
- `trainer_payment_accounts` (132/134) — subconta Asaas: asaas_account_id/wallet_id, **api key criptografada (BYTEA, pgcrypto)**, status KYC (wallet_status ENUM), dados cadastrais snapshot, account_mode subaccount|own_account, webhook_configured_at (143).
- `pix_keys` (132) — chaves validadas via Asaas; `payouts` (132/145b) — saques PIX com snapshot da chave, status (inclui awaiting_authorization).
- `trainer_financial_settings` (138) — defaults de métodos, política de inadimplência (block_on_overdue, grace 1–30d), toggles de push.
- Funções: `get_financial_students()` (reescrita 7×: 043→045→074→082→085→141→149→**179** com installments), `get_financial_dashboard` (055/150), `check_student_access()` (025→043→075→076→**148** lê access_blocked_at), `block_overdue_students()/block_student_access()/unblock_student_access()` (140; EXECUTE revogado p/ só service_role em 161).

**Mensagens** — ver §9.

**Notificações/push**
- `trainer_notifications` (033, renomeada 094: body/is_read/data/category, push_sent_at 125), RPCs mark_read/mark_all/unread_count (094/099).
- `push_tokens` (056, role trainer|student), `push_tickets` (081, recibos Expo), `push_errors` (127), `scheduled_notifications` (108, lembretes de agenda).
- Triggers: workout completed → notificação (056/077/095), form submitted insert+update (126), pg_net → edge `send-push-notification` em INSERT de trainer_notifications/student_inbox_items (098).

**Agenda**
- `recurring_appointments` (106) — day_of_week, start_time, frequency weekly|biweekly|monthly|**once** (110), group_id (107), google_event_id + google_sync_status (109). `appointment_exceptions` (106) — rescheduled|canceled|completed|no_show por ocorrência. Realtime nas duas.
- `google_calendar_connections` (109) — tokens OAuth **em texto puro** protegidos só por RLS (sem leitura por client; nota na própria migration), watch channels.

**IA/prescrição**
- `student_prescription_profiles` (034 + 059/114/115) — nível, objetivo, dias, equipamento, restrições médicas JSONB, ai_mode, volume_overrides, agent_answers.
- `prescription_generations` (035 + 058/064/103/104) — snapshots input/output, status pending_review|approved|rejected|expired, agent_conversation, web_search_queries, trainer_edits_diff, telemetria (tokens, cost_usd, model_used, prompt_version, rules_violations), TTL 90d, realtime (103).
- `assistant_insights` (088/093) — insights do dashboard (rules|llm|forms; categorias alert/progression/suggestion/summary/**pinned_note**), UNIQUE(trainer, insight_key), realtime, `detect_training_gaps()` (fix IDOR em 171).

**Wearables/saúde**
- `daily_sleep_samples`, `daily_activity_samples`, `hr_resting_samples`, `hrv_samples`, `readiness_scores` (129; UNIQUE student+date; fonte healthkit|health_connect|**oura** 153 com triggers de prioridade de fonte), `wearable_connections` (+oura/strava 130/153), `external_activities` (130, Strava), `wearable_oauth_tokens` (153, tokens Oura server-side), `wearable_provider_config` (155, client_id/secret por provider — **service-role only**).

**MCP/API/leads/diversos**
- `trainer_api_keys` (145), `mcp_tool_usage_logs` (146), `mcp_oauth_clients/codes/tokens` (147).
- `trainer_leads` (166/168) — leads da landing pública, pipeline new→contacted→converted→archived, ip_hash/user_agent, converted_to_student_id.
- `concierge_requests` (165) — pedidos de "montamos sua biblioteca" via WhatsApp.
- `blocked_email_domains` (118/119) — blocklist de signup + trigger `check_email_signup_allowed` BEFORE INSERT em **auth.users**.
- `program_reports` (083) — relatório de fim de programa (snapshot de métricas, draft|published).

---

## 6. RLS — estado final (resumo por tabela)

Helpers (SECURITY DEFINER, search_path fixado em 077/172): `current_trainer_id()`, `current_student_id()`, `is_trainer()`, `is_student()`, `current_student_coach_id()` (101), `current_student_id_active()` (162 — NULL se aluno bloqueado), `current_trainer_id_active()` (177 — NULL se assinatura do treinador não está active/trialing).

**Duas policies RESTRITIVAS globais:**
1. **Gate de assinatura do treinador (177)** — INSERT/UPDATE/DELETE em 36 tabelas de treinador exigem `current_trainer_id_active()`; leitura intacta. Treinador inadimplente vê mas não escreve.
2. **Gate de inadimplência do aluno (162)** — policies student-self de `assigned_programs/workouts/items`, `workout_sessions`, `set_logs` trocadas para `current_student_id_active()`. Perfil, contratos e mensagens continuam acessíveis (p/ tela de pagamento funcionar).

Resumo por grupo (padrão dominante = "trainer dono ALL; aluno SELECT do que é seu"):
| Tabela(s) | Policies vigentes |
|---|---|
| `trainers` | self select/update/insert; aluno lê o próprio coach (091) |
| `students` | trainer ALL (coach_id); aluno SELECT self |
| `exercises` | SELECT: sistema (owner NULL) ou dono ou aluno; INSERT/UPDATE/DELETE: dono (075 endurece INSERT) |
| `muscle_groups`, `exercise_muscle_groups` | sistema visível a todos; CRUD só do dono |
| `exercise_relationships/synergies/condition_constraints` | SELECT authenticated; escrita service-role |
| templates (`program_templates`, `workout_templates`, `workout_item_templates`, `workout_item_set_templates`, `training_method_presets`) | trainer dono, separado por verbo (005); presets de sistema legíveis por todos |
| atribuídos (`assigned_*`) | trainer ALL (com ownership check encadeado, endurecido 102); aluno SELECT **se não bloqueado** (162) |
| `workout_sessions` | trainer SELECT; aluno select/insert/update separados (075) + bloqueio (162) + trigger anti-spoof de trainer_id (101) |
| `set_logs` | trainer SELECT; aluno select/insert/update (075) + delete (175) + bloqueio (162) |
| `subscriptions` | trainer SELECT only (escrita = webhook service-role) |
| financeiro (`trainer_plans`, `student_contracts`, `financial_transactions`, `contract_events`, `payment_settings`) | trainer select/insert/update com ownership (102); aluno SELECT do próprio contrato/transações/planos do coach; escrita de transações = service-role |
| Asaas (`trainer_payment_accounts`, `pix_keys`, `payouts`, `trainer_financial_settings`) | trainer dono (payouts só SELECT — criação via API service-role) |
| forms (`form_templates`, `student_inbox_items`, `form_submissions`, `program_form_triggers`, `form_schedules`) | trainer dono; aluno SELECT dos seus + update de status do inbox; templates de sistema (trainer_id NULL) legíveis (062); RLS forçada + corrigida em 047 |
| `assessment_sessions/measurements` | trainer dono ALL; aluno SELECT das suas |
| `messages` | trainer dos seus alunos (select/insert/update read_at); aluno dos seus; service-role full (090) |
| `trainer_notifications` | trainer select/update; insert restrito a triggers/service (099/101) |
| push (`push_tokens/tickets/errors`) | tickets/errors service-role only; tokens trainer select/update + service |
| agenda (`recurring_appointments`, `appointment_exceptions`, `scheduled_notifications`, `google_calendar_connections`) | trainer dono (em google_calendar **nenhuma policy de SELECT de token p/ client** — leitura só service-role); service-role full |
| wearables (todas de §5) | aluno dono read/insert/update; `wearable_provider_config` e `wearable_oauth_tokens` service-role only |
| IA (`student_prescription_profiles`, `prescription_generations`, `assistant_insights`) | trainer dono; aluno lê o próprio perfil; insights: trainer read/update + insert só pinned_note (174); service full |
| MCP (`mcp_*`, `trainer_api_keys`) | service-role only (api_keys: trainer gerencia as próprias) |
| `trainer_leads`, `concierge_requests`, `perfect_weeks`, `program_reports`, `trainer_student_links`, `webhook_events`, `blocked_email_domains` | dono/aluno conforme acima; leads INSERT via service (action pública); webhook_events/blocked_domains service-only |

Hardening relevante: 075 (split de policies ALL), 101/102 (ownership encadeado + storage privado), 121 (buckets/listagem), 161 (REVOKE em RPCs de bloqueio), 171 (IDOR em detect_training_gaps), 172 (search_path em todas SECURITY DEFINER), 173 (REVOKE anon EXECUTE em todas RPCs SECURITY DEFINER exceto helpers de RLS), 176 (RPCs de self-update do aluno).

---

## 7. Fluxos de autenticação

**Treinador (web)** — Signup em `/signup` → action `auth/signup-trainer.ts` (honeypot + Turnstile + rate-limit IP + blocklist de domínio + HIBP + `supabase.auth.signUp` server client + insert `trainers` via admin). Defesa em profundidade no banco: trigger `check_email_signup_allowed` BEFORE INSERT em auth.users (118/119). Login `/login` (cookie SSR). Reset: `/auth/forgot-password` → e-mail → `/auth/update-password`. Sessão renovada pelo middleware (`web/src/lib/supabase/middleware.ts`). Pós-signup: redirect a checkout Stripe (trial).

**Aluno (criado pelo treinador, sem self-signup)** — `web/src/actions/create-student.ts` e edge `create-student`: admin client cria auth.users com **senha gerada criptograficamente** e row em `students`; credenciais retornadas ao treinador para repassar. Reset administrado: edge `reset-student-password`. Não há fluxo de convite por e-mail/verificação própria.

**Mobile (ambos os papéis)** — `mobile/contexts/AuthContext.tsx` (signInWithPassword, sessão no keychain — fix recente do watch overhaul). `app/index.tsx` roteia por papel via `useRoleMode()`; dual-role → `role-select`. Esqueci-senha: `(auth)/forgot-password` (resetPasswordForEmail) → `(auth)/enter-code` (verifyOtp tipo recovery) → troca de senha. `verify-email.tsx` p/ confirmação.

**MCP/OAuth** — `/oauth/register` (DCR) → `/oauth/authorize` (consentimento logado, PKCE S256) → `/oauth/token`; tokens com hash em `mcp_oauth_tokens`. Alternativa: API key gerada em `/settings/api-keys`.

---

## 8. Pagamentos/assinaturas

**Stripe — assinatura SaaS do treinador.** Checkout em `api/stripe/checkout` → webhook `api/webhooks/stripe` mantém `subscriptions`. Gates: web `getTrainerWithSubscription` → `/subscription/blocked`; mobile `trainer-subscription-blocked.tsx` (client-side); **servidor**: migration 177 (RLS restritiva de escrita em 36 tabelas). Portal: `api/stripe/portal`.

**Stripe Connect — cobrança de aluno (LEGADO).** `payment_settings` + `api/stripe/connect/*` + webhook `stripe-connect`. Mantido com flag `show_stripe_legacy` em `trainer_financial_settings`.

**Asaas — cobrança de aluno (ATUAL).** Treinador ativa carteira (`api/wallet/activate` → subconta Asaas + KYC; tabela `trainer_payment_accounts`, api key criptografada; lib `web/src/lib/asaas/*` com encryption.ts/fees.ts). Contratos `student_contracts` (billing_type asaas_auto / asaas_auto_recurring; parcelamento 178). Cobranças via payment links/subscriptions; aluno paga em `mobile/app/payment.tsx` ↔ `api/student/payment`. Webhook `api/webhooks/asaas` (token + dedupe em `webhook_events`): PAYMENT_* → `financial_transactions` + status do contrato + bloqueio/desbloqueio; TRANSFER_* → `payouts`; ACCOUNT_STATUS_* → KYC. Saque: `api/wallet/payouts` → PIX p/ `pix_keys` validada.

**Inadimplência** — `block_overdue_students()` (140, service-role only após 161) marca `students.access_blocked_at` respeitando `trainer_financial_settings.overdue_grace_days`; chamado pelo cron Vercel `check-manual-overdue` e pelo webhook Asaas. Enforcement: client (`useStudentAccess` → PaymentBlockedScreen) **e** servidor (RLS 162 + `check_student_access` 148). Mobile financeiro consome RPCs (`get_financial_dashboard`, `get_financial_students`, 055/179).

---

## 9. Mensagens

- Tabela `messages` (090): student_id como "thread", sender_type trainer|student, content e/ou image_url (constraint), read_at. Coluna `image_path` (163) prepara migração de URL pública → signed URL (bucket `messages` ficou privado em 101/121).
- Realtime: `messages` na publication supabase_realtime (090). Web: `web/src/components/messages/chat-panel.tsx`, `conversation-list.tsx`, `use-unread-messages-count.ts`. Mobile: aluno `app/chat.tsx` + `components/chat/ChatView.tsx`; treinador `app/(trainer-tabs)/messages.tsx` + `app/messages/[studentId].tsx`, hooks `useTrainerConversations/useTrainerChatRoom/useTrainerChat/useUnreadCount`.
- Push de mensagem: `api/messages/notify-student` / `notify-trainer` (Bearer token), enviando via Expo. MCP também envia/lê mensagens (`kinevo_send_message`, `kinevo_get_conversation`).

---

## 10. shared/ (@kinevo/shared)

Centraliza:
- `types/` — database.ts (tipos gerados Supabase — atenção ao gotcha de truncamento do gen:types), appointments, asaas, assessments, exercise, google-calendar, healthInsights, onboarding, prescription, workout-items.
- `lib/prescription/` — núcleo de prescrição por série: set-scheme, presets de métodos, labels, volume, builder-mapper, snapshot-from-draft, extract-frequency (com testes).
- `lib/assessment-protocols/` — fórmulas/classificações/derivações de avaliação física (com testes).
- `lib/asaas/fees.ts`, `lib/http/parseFilename.ts`, `constants/notification-messages.ts`.
- `tokens/` — design tokens v2 + legacy (convergência web↔mobile).
- `utils/` — appointments-projection, schedule-projection, format-br-date.

Possíveis duplicações a investigar (apenas apontadas): projeção de agenda também existe em código web (`web/src/lib/appointments/`); helpers de financeiro/fees no web (`web/src/lib/asaas/fees.ts`) vs `shared/lib/asaas/fees.ts`; formatação de datas/streak/semana repetida em `mobile/lib` e `web/src/lib/utils`; tipos de treino redeclarados localmente em hooks mobile; cálculos de aderência existem em RPC SQL (get_trainer_stats 105/168) e em TS.

---

## 11. Integrações de IA

| Feature | Onde | Modelo |
|---|---|---|
| Prescrição IA (gerar programa) | `web/src/actions/prescription/generate-program.ts` + `web/src/lib/prescription/llm-client.ts` | Cliente multi-provider: Anthropic SDK (`claude-haiku-4-5`, `claude-sonnet-4-6` na tabela de preço) e OpenAI; default por env `OPENAI_PRESCRIPTION_MODEL` (fallback `gpt-4o-mini`); telemetria de custo/token em `prescription_generations` (104) |
| Assistente do dashboard (chat) | `web/src/app/api/assistant/chat/route.ts` | AI SDK `streamText` + `@ai-sdk/openai` `gpt-4.1-mini`, tools: generateProgram, analyzeStudentProgress, getStudentInsights; nota de prompt-injection no código |
| Gerar/auditar formulário | `web/src/actions/forms/generate-form-with-ai.ts`, `audit-form-quality-ai.ts` | OpenAI `gpt-4o-mini` (env `OPENAI_FORMS_MODEL`) |
| Parse de treino em texto | `api/prescription/parse-text` (web) e edge `parse-workout-text` (mobile) | `gpt-4.1-mini` → fallback `gpt-4o-mini` |
| Insights diários | `api/cron/generate-insights` | Heurísticas/regras (fase 2 LLM planejada) → `assistant_insights` |
| Conhecimento de exercícios | `exercise_relationships/synergies/condition_constraints` (070–073) | Grafo curado usado pela prescrição (não chama LLM em runtime) |
| MCP server | `api/mcp` + 27 tools | Expõe o Kinevo a Claude/ChatGPT (o LLM é o cliente) |

Dependências: `@anthropic-ai/sdk@^0.39`, `ai@^4.3`, `@ai-sdk/openai`, `@ai-sdk/react` (apenas no web; mobile chama edge/API).

---

## Surpresas estruturais / notas para outros analistas

1. **Numeração de migrations com lacunas (089, 116, 117, 157–160) e 4 pares duplicados** (092 student_objective_tags × trainer_exercise_videos; 133 asaas_recurring × instagram_handle; 145 api_keys × payout_awaiting_authorization; 168 leads_status_read × trainer_stats_revenue). Ordenação lexicográfica decide a aplicação — risco de drift entre ambientes.
2. `get_financial_students()` foi reescrita 8 vezes (043→179) — qualquer mudança no financeiro precisa olhar só a 179.
3. O bloqueio diário por inadimplência via pg_cron está **comentado** (140); o caminho real é Vercel cron + webhook.
4. Tokens OAuth do Google Calendar e do Oura ficam **em texto puro** no banco (protegidos apenas por RLS service-only); a API key do Asaas é a única criptografada (pgcrypto BYTEA).
5. Contrato de segurança do middleware: rotas excluídas do matcher DEVEM autenticar Bearer manualmente — superfície fácil de regredir ao criar rota nova.
6. Aluno não tem self-signup: senha gerada pelo treinador (sem fluxo de convite por e-mail).
7. `organizations/*` em actions e coluna `studio_id` em exercises são resíduos do abandonado "Kinevo para Estúdios".
8. Bucket `messages` ainda é referenciado por `image_url` pública em mensagens antigas; `image_path` (163) é a fundação da migração p/ signed URLs.
9. Realtime habilitado em: `student_inbox_items`, `form_submissions`, `assistant_insights`, `messages`, `prescription_generations`, `recurring_appointments`, `appointment_exceptions`.
