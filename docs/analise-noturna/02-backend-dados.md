# 02 — Backend e Dados (análise noturna, somente leitura)

Data: 2026-06-09. Escopo: `supabase/` (migrations, functions, crons), queries do web/mobile, consistência transacional. Projeto real Supabase introspeccionado via MCP read-only: `lylksbtgrihzepbteest` ("Kinevo 2.0").

Método: cruzei o estado final das migrations locais com as queries quentes do código E com os advisors de performance do banco em produção (`get_advisors`, 33 FKs sem índice, 45 índices não usados, etc.) e a tabela `cron.job` real. Onde o banco real diverge do repositório, está sinalizado.

---

## RESUMO POR SEVERIDADE

- **Crítico: 3** — drift migrations local↔prod; `send-push-notification` sem auth (verify_jwt=false) e sem dedupe atômico; assign-program não-atômico.
- **Alto: 6** — webhook Asaas com janela de duplicação no upsert de transação; N+1 grave em tonnage-history; FKs quentes sem índice (workout_sessions, assigned_workout_items, messages); cron `block-overdue-students-daily` x Vercel `check-manual-overdue` (dupla cobertura + buraco de bloqueio); secrets (anon JWT) embutidos em `cron.job`; `DELETE FROM` em massa em RPC de exclusão de conta sem transação explícita.
- **Médio: 8** — índice duplicado em `students`; 45 índices nunca usados; 507 multiple_permissive_policies + 68 auth_rls_initplan (RLS reavaliando `auth.uid()` por linha); over-fetching `select('*')` em tabelas largas; falta paginação em leituras de `set_logs`/`financial_transactions`; numeração de migrations duplicada/lacunas; realtime sem checagem de payload; perfect_weeks/finishWorkout em múltiplos writes não atômicos.
- **Baixo: 5** — colunas/índices de resíduo "Estúdios" (`exercises.studio_id`), índices GIN não usados, naming inconsistente, `it_type` cardio coalesce, etc.

---

## 1. Qualidade do schema

### [CRÍTICO] Drift entre `supabase/migrations/` (repo) e o schema de produção
Evidência: a tabela `supabase_migrations.schema_migrations` em produção (via `list_migrations`) contém entradas que **não existem como arquivo local**: `019_professionals`, `020_student_professionals`, `022_nutrition_module`, `024_physio_module`, `116_ambassadors`, `studios_foundation/rls/classes`, `create_curso_waitlist`, `117_security_hardening_buckets_webhooks` (local chama isso de `121`). Os advisors confirmam que as tabelas `ambassadors`, `ambassador_events`, `commissions`, `referrals`, `organizations`, `organization_members` **existem no banco real** — mas `ls supabase/migrations | grep -iE 'ambassad|nutrition|physio|studio|professional'` retorna **nada**.
Impacto concreto: um `supabase db reset` ou subir um ambiente novo a partir do repo gera um schema **diferente da produção** — faltariam tabelas inteiras (ambassadors/nutrition/physio/studios/professionals) e a numeração 116/117 mapeia para conteúdo diferente. RLS, FKs e RPCs que dependem dessas tabelas quebrariam. O repositório **não é fonte da verdade** do banco.
Correção sugerida: rodar `supabase db pull` para reconciliar o repo com o estado real, ou marcar formalmente o repo como "parcial" e nunca usar `db reset`. Definir um único caminho de verdade.

### [MÉDIO] Numeração de migrations: 4 duplicatas e lacunas
Evidência: arquivos duplicados em número — `092` (`student_objective_tags` + `trainer_exercise_videos`), `133` (`trainer_instagram_handle` + `asaas_recurring`), `145` (`create_trainer_api_keys` + `payout_awaiting_authorization`), `168` (`trainer_leads_status_read` + `trainer_stats_revenue_from_transactions`). Lacunas: `089`, `116`, `117`, `120` (presente), `157`–`160`.
Impacto: a ordem de aplicação local entre dois arquivos de mesmo número é indefinida (alfabética por nome). Se um depender do outro, um `db reset` pode falhar. As lacunas mascaram migrations que só existem em prod (ver item Crítico). Risco operacional alto se alguém tentar reproduzir o ambiente.
Correção: como o `db push` em prod já usa timestamps (não os números), os números locais são cosméticos — mas perigosos. Padronizar via `supabase migration new` (timestamp) e parar de renumerar à mão.

### [ALTO] FKs quentes sem índice de cobertura (33 no total, prod)
Evidência (advisors `unindexed_foreign_keys`): as mais críticas pelo padrão de query do código:
- `workout_sessions.assigned_program_id` — usada em `getWorkoutTonnageHistory`, `context-enricher`, insights cron, perfil do aluno. Sem índice → seq scan ao filtrar por programa.
- `assigned_workout_items.exercise_id` e `workout_item_templates.exercise_id` — joins no assign-program e no builder.
- `messages.sender_id` — chat.
- `scheduled_notifications.student_id` / `.trainer_id` — cron `dispatch-scheduled-notifications` roda a cada 5 min.
- `perfect_weeks.assigned_program_id` / `.trainer_id`, `contract_events.contract_id`, `student_contracts.plan_id` (join em `get_financial_students`).
Lista completa (33): ambassador_events (3), appointment_groups.coach_id, assessment_sessions (2), assigned_programs.source_template_id, assigned_workout_items (2), assigned_workouts.source_template_id, contract_events.contract_id, exercise_synergies.secondary_group_id, feedback.coach_id, form_schedules.form_template_id, mcp_oauth_codes.trainer_id, mcp_tool_usage_logs.api_key_id, messages.sender_id, payouts.pix_key_id, perfect_weeks (2), program_form_triggers.form_template_id, push_errors.push_token_id, push_tickets.push_token_id, push_tokens.trainer_id, recurring_appointments.appointment_group_id, scheduled_notifications (2), student_contracts.plan_id, trainer_leads.converted_to_student_id, workout_item_templates.exercise_id, workout_sessions (3: assigned_program_id, pre/post_workout_submission_id).
Impacto: degradação conforme `workout_sessions`/`set_logs`/`messages` crescem. `scheduled_notifications` é varrida a cada 5 min.
Correção: criar índices b-tree nas colunas FK acima; priorizar `workout_sessions.assigned_program_id`, `scheduled_notifications.*`, `messages.sender_id`, `student_contracts.plan_id`, `perfect_weeks.*`.

### [MÉDIO] Índice duplicado e 45 índices nunca usados
Evidência (advisors): `students` tem dois índices idênticos `{idx_students_coach_id, idx_students_trainer_id}` (duplicate_index) — `coach_id` e `trainer_id` são a mesma coluna semântica. 45 índices `unused_index`, incluindo GINs caros: `idx_form_templates_schema_gin`, `idx_inbox_payload_gin`, `idx_submissions_answers_gin`, mais os de resíduo Estúdios (`idx_exercises_studio`, `idx_exercises_org`, `idx_program_templates_org`, `idx_recurring_appts_org`) e financeiros Asaas (`idx_transactions_asaas`, `idx_transactions_provider`, `idx_contracts_asaas_sub`).
Impacto: cada índice penaliza writes (set_logs/workout_sessions são write-heavy) e ocupa espaço. Os GIN em JSONB são especialmente caros de manter.
Correção: dropar o duplicado de `students`; reavaliar os GIN não usados; os "unused" recentes (Asaas, perfect_weeks) podem ainda não ter tráfego — confirmar antes de dropar.

### [BAIXO] Resíduo "Kinevo Estúdios" no schema
Evidência: `exercises.studio_id` + `idx_exercises_studio` (007), `idx_exercises_org`, `idx_program_templates_org`, `idx_recurring_appts_org`, tabelas `organizations`/`organization_members` em prod com RLS (advisors). Projeto abandonado (memória `project_kinevo_estudios`).
Impacto: superfície morta, colunas/policies sem uso, confundem auditoria.
Correção: planejar remoção em migration dedicada (com cuidado, RLS depende delas).

---

## 2. Queries

### [ALTO] N+1 grave em `getWorkoutTonnageHistory`
Arquivo: `web/src/app/students/[id]/actions/get-workout-tonnage-history.ts:42-103`.
Evidência: loop por workout (`for (const workout of workouts)`) → por workout uma query de até 8 sessões → **por sessão** uma query a `set_logs` (linha 63). Para um programa com 4 treinos × 8 sessões = até **32 round-trips sequenciais** a `set_logs`, mais 4 a `workout_sessions`. Sem índice em `set_logs.workout_session_id`? (existe `idx_set_logs_session`, ok), mas o número de round-trips é o gargalo.
Impacto: latência multiplicativa; a tela de progresso do aluno fica lenta com histórico.
Correção: coletar todos os `session.id` e fazer **uma** query `set_logs ... .in('workout_session_id', allIds)` agrupando em memória (o padrão correto já é usado em `context-enricher.ts:189` com `.in()`).

### [MÉDIO] Over-fetching `select('*')` em tabelas largas (35 ocorrências)
Evidência: 35 `select('*')`. Os piores em tabelas largas:
- `program_templates` `select('*')` em `duplicate-program.ts:23` e `assign-program/index.ts:97` (template tem muitas colunas; só `name/description/duration_weeks` são usados).
- `workout_item_templates` `select('*')` em `duplicate-program.ts:64` e no edge assign (linha 197, aí com joins aninhados pesados).
- `student_contracts` `select('*')` em `wallet-service.ts`, `migrate-contract.ts`.
- `trainers` `select('*')` (tabela com vários JSONB grandes: onboarding, branding, landing_*, prescription_preferences) em `financial/page.tsx`, `(public)/com/[slug]/page.tsx`.
Impacto: tráfego e serialização desnecessários; `trainers.*` puxa JSONBs pesados.
Correção: enumerar colunas. Em `trainers` é especialmente importante por causa dos JSONB.

### [MÉDIO] Leituras sem paginação em tabelas que crescem
Evidência: `messages` JÁ tem paginação (`limit+1` em `web/src/app/messages/actions.ts:193`, `mobile/hooks/useTrainerChat.ts:102`) — OK. Mas `set_logs` é lido sem limite em vários pontos analíticos: `get-sessions-tonnage.ts:22`, `generate-insights/route.ts:268,514`, `context-enricher.ts:191` (limitado a 8 semanas, ok). `financial_transactions` lido sem range no dashboard/wallet. Conforme `set_logs` cresce (write-heavy, 1 linha por série), os jobs de insights varrem volumes grandes.
Impacto: cron de insights e leituras analíticas ficam progressivamente mais pesados.
Correção: limitar por janela temporal explícita e/ou paginar; agregar via RPC SQL em vez de trazer linhas cruas.

### [MÉDIO] Realtime: filtros server-side OK, mas payload não validado
Evidência: 7 superfícies realtime. Os filtros são server-side e por tenant (bom): `student_id=eq.${studentId}` (chat), `trainer_id=eq.${trainer.id}` (inbox/notifications/insights), `id=eq.${generationId}` (prescription stream). Exceção: `web/src/hooks/use-unread-messages-count.ts:34` usa `filter: 'sender_type=eq.student'` **sem filtro de tenant** — depende 100% da RLS de `messages` para não vazar contagens entre treinadores.
Impacto: se a RLS de `messages` regredir, esse canal vaza eventos de outros tenants. Hoje protegido pela RLS, mas é o único canal sem filtro de tenant explícito.
Correção: adicionar `student_id`/`trainer_id` ao filtro do canal como defesa em profundidade.

---

## 3. Edge functions

### [CRÍTICO] `send-push-notification` exposta sem autenticação (verify_jwt=false) e processa payload arbitrário
Arquivo: `supabase/functions/send-push-notification/index.ts`; confirmado em prod `verify_jwt:false` (`list_edge_functions`). É chamada via `pg_net` pelos triggers da migration 098 **sem header de Authorization** (`headers := '{"Content-Type": "application/json"}'`).
Evidência: a função lê `payload.table` e `payload.record` direto do body (linhas 20-36) e dispara push para `record.trainer_id`/`student_id`. Não há verificação de assinatura/secret. Qualquer um que conheça a URL pública `.../functions/v1/send-push-notification` pode POSTar `{table:'trainer_notifications', record:{trainer_id:<uuid>, title, body}}` e **enviar push spam** para qualquer treinador/aluno (os tokens são resolvidos no banco por id).
Impacto: vetor de spam/phishing via push para usuários reais; sem rate-limit.
Correção: exigir um shared-secret no header (validado dentro da função) e incluí-lo no `net.http_post` dos triggers; ou usar a verificação de webhook do Supabase. A dedupe via `push_sent_at` (linha 65) reduz reenvio mas não impede o abuso externo.

### [ALTO] `send-push-notification`: dedupe `push_sent_at` tem race (check-then-set não atômico)
Evidência: linhas 59-65 (`select push_sent_at`) e 169-172 (`update push_sent_at`) são duas operações separadas. Dois disparos concorrentes (trigger pg_net + chamada de API route `messages/notify-*`) podem ambos ler `push_sent_at = null` e enviar dois pushes.
Impacto: notificação duplicada ocasional.
Correção: usar update condicional atômico (`UPDATE ... SET push_sent_at=now() WHERE id=? AND push_sent_at IS NULL RETURNING id`) e só enviar se retornou linha.

### [MÉDIO] Tratamento de erro nas edge functions: silencioso por design, sem retry
Evidência: `send-push-notification` engole erros de log (`catch (logErr)`), retorna 200 mesmo sem enviar; trigger 098 tem `EXCEPTION WHEN OTHERS THEN RAISE WARNING` — falha de push é **silenciosa**. Não há retry no envio Expo; só o cron `check-push-receipts` valida tickets depois.
Impacto: pushes perdidos passam despercebidos (alinha com `Diagnostico_Push_Notifications.md`: token nunca gerado em prod).
Correção: contabilizar falhas (já existe `push_errors`); alertar quando taxa de erro sobe.

### [VERIFICADO OK] `assign-program`, `parse-workout-text`, etc. com `verify_jwt:true`
`assign-program` (v7), `parse-workout-text` (v12), `generate-assessment-pdf`, `oura-*` autenticados e ainda revalidam ownership manualmente. `create-student`/`update-student`/`reset-student-password` têm `verify_jwt:false` mas validam o Bearer manualmente dentro (padrão documentado).

---

## 4. Consistência transacional

### [CRÍTICO] `assign-program` não é atômico — falha no meio deixa programa parcial
Arquivo: `supabase/functions/assign-program/index.ts:138-338`.
Evidência: cria `assigned_programs` (138), depois faz N inserts em loop para `assigned_workouts` → `assigned_workout_items` → `assigned_workout_item_sets` (166-336), cada um com `throw` no erro. **Não há transação** (Supabase client não abre BEGIN/COMMIT). Antes disso, em fluxo "imediato", já marcou o programa ativo anterior como `completed` (122-130). Se o loop falhar no meio (ex.: erro no 3º treino), o aluno fica com: programa anterior **já encerrado** + programa novo **incompleto** (alguns treinos/itens criados, outros não). Existe uma RPC antiga atômica `assign_program_to_student` (migration 003) que **não é mais usada** por este caminho.
Impacto: corrupção de estado de treino do aluno; difícil de detectar/reverter manualmente.
Correção: mover a cópia inteira para uma função SQL (`plpgsql`, transação implícita) — reaproveitar/estender a 003 — ou ao menos só encerrar o programa anterior **após** a cópia completar com sucesso.

### [ALTO] Webhook Asaas: janela de duplicação no upsert de `financial_transactions` para parcelas
Arquivo: `web/src/app/api/webhooks/asaas/route.ts`.
Evidência: a idempotência por `webhook_events` (event_id único, linhas 50-67) está correta e protege reprocessamento. Porém o `upsert` de transação usa `onConflict: 'asaas_payment_id'` (235-247) — a migration 144 garante `unique_asaas_payment_id`. OK para o caso normal. Risco real: a estratégia de **resolução de contrato** (linhas 142-220) faz vários `UPDATE ... .in('status', [...]).select()` em sequência sem transação; em eventos concorrentes (PAYMENT_RECEIVED + PAYMENT_CONFIRMED chegando juntos, comum no Asaas) duas execuções podem ambas casar o contrato antes da 1ª commitar status, gerando dois `logContractEvent('payment_received')` para o mesmo pagamento (contract_events **não** tem dedupe por payment_id).
Impacto: timeline do aluno com evento de pagamento duplicado; métricas de receita podem contar em dobro se lidas de `contract_events`. (A receita "oficial" vem de `financial_transactions`, que é deduplicada — mitiga o pior.)
Correção: dedupe de `contract_events` por `(contract_id, event_type, metadata->>paymentId)` ou processar o resolve+log dentro de uma RPC transacional.

### [ALTO] Cobertura de bloqueio de inadimplentes: dupla execução + buraco
Evidência: existem **dois** caminhos simultâneos ativos em produção:
1. `cron.job` id=4 `block-overdue-students-daily` (`0 6 * * *`) → `SELECT public.block_overdue_students()` — **está ATIVO em prod** (apesar do comentário na migration 140 sugerir que seria o caminho "comentado").
2. Vercel cron `check-manual-overdue` (`0 11 * * *`) → marca contratos `manual_*` como `past_due` (mas **não bloqueia acesso**, só notifica).
Buraco: `block_overdue_students()` (140) só bloqueia quem está em `status IN ('past_due','overdue')`. Contratos manuais só viram `past_due` às 11h (Vercel). Mas `block_overdue_students` roda às 06h. Logo, no mesmo dia o aluno é marcado past_due (11h) e só pode ser bloqueado no dia **seguinte** às 06h — há ~19h de defasagem. Para contratos Asaas, o `past_due` vem do webhook (imediato), então funciona; para manuais há atraso sistemático de um ciclo.
Impacto: aluno manual inadimplente mantém acesso ~1 dia a mais que o esperado pelo `grace_days`.
Correção: ou rodar `block_overdue_students` **após** o `check-manual-overdue` (ex.: 12h), ou o próprio `check-manual-overdue` chamar `block_student_access` quando passar do grace. Documentar que o caminho real do cron NÃO é o "comentado".

### [MÉDIO] `finishWorkout` (mobile): sessão + set_logs + perfect_weeks em writes separados
Arquivo: `mobile/hooks/useWorkoutSession.ts:1131-1328`; perfect_weeks em `usePerfectWeek.ts:47-63`.
Evidência: `finishWorkout` faz update/insert da `workout_sessions` (1193/1217), depois `upsert` de `set_logs` (1287). Há mitigação **boa** (C3, 1295-1306): se o upsert de set_logs falhar, reverte a sessão para `in_progress` e relança — o upsert é idempotente por `onConflict`. Mas `perfect_weeks` é um upsert **separado**, em outro hook, fora dessa transação lógica. Se a sessão concluir mas o cálculo de perfect_week falhar, fica inconsistente (sem semana perfeita registrada). Não é atômico, mas o impacto é cosmético (badge), não financeiro.
Impacto: badge de "semana perfeita" pode não refletir uma sessão concluída.
Correção: aceitável como está; idealmente disparar o recálculo de perfect_week via trigger no INSERT de `workout_sessions completed`.

### [BAIXO] `delete_account` RPC com `DELETE FROM` em massa sem transação explícita
Arquivo: `supabase/migrations/018_avatars_and_account_deletion.sql:72-90`.
Evidência: deleta `workout_sessions`, `assigned_programs`, storage.objects, `auth.users` em sequência dentro de uma função `plpgsql` (que roda em transação implícita — OK), mas é um `DELETE` em cascata amplo. Se rodado por engano (não é destrutivo num reset pois é só `CREATE FUNCTION`), apaga dados do aluno irreversivelmente.
Impacto: baixo (função, não executada em reset). Citado por completude.

---

## 5. Migrations arriscadas / Seeds

### [VERIFICADO — baixo risco] Migrations destrutivas
Evidência: único `DROP TABLE` real é `011_exercise_governance_v2.sql:219 DROP TABLE IF EXISTS exercise_categories` (tabela de transição, intencional). Os `DELETE FROM` em 018 estão dentro de uma função (não executam no reset). Nenhum `UPDATE` em massa destrutivo não-guardado encontrado nas migrations finais.
Risco num `db reset`: o problema NÃO são migrations destrutivas, e sim o **drift** (item 1 Crítico) — o reset produz um schema incompleto vs produção.

### [VERIFICADO OK] Seeds sem PII
Evidência: `supabase/config.toml` aponta `sql_paths = ["./seed.sql"]` mas **`seed.sql` não existe** (`ls` confirma). O único seed real é `supabase/seeds/037_exercise_metadata_seed.sql` (metadados de exercícios — sem PII). Migrations de seed (071/072/073 grafo de exercícios, 123 templates de avaliação, 066 formulários de sistema) contêm apenas dados de catálogo, sem dados pessoais. **Nenhuma conta QA/PII embutida em seed.** (A conta QA `qa-teste-kinevo` citada no comparativo, se existir, está no banco, não em seed versionado.)

---

## 6. pg_cron e Vercel crons

### [ALTO] Secrets (anon JWT) hardcoded dentro de `cron.job` em produção
Evidência (`cron.job` real, jobs 5 e 6 — oura): o comando SQL embute o **anon JWT completo** em `apikey` e `Authorization: Bearer ...` em texto puro dentro de `cron.job.command`. Qualquer um com acesso de leitura à tabela `cron.job` (ou a dumps) lê a chave.
Impacto: vazamento da anon key via metadados do cron; embora seja a anon key (menos sensível que service_role), é má prática e dificulta rotação.
Correção: usar `vault`/`current_setting` para o token, ou Database Webhooks gerenciados. Os jobs 1-3 (notifications/google) usam `net.http_post` **sem** apikey — funcionam porque as edge functions têm `verify_jwt:false` (o que reabre o ponto Crítico do item 3).

### [VERIFICADO] Inventário de crons (sem órfãos óbvios)
pg_cron real (6 jobs ativos): `dispatch-scheduled-notifications` (*/5min), `extend-scheduled-notifications` (5h), `renew-google-watch-channels` (6h), `block-overdue-students-daily` (6h), `oura-token-refresh-daily` (3h), `oura-webhook-setup-weekly` (seg 3h30). Vercel (8 jobs): activate-scheduled-programs (7h), check-manual-overdue (11h), process-push (12h), process-form-schedules (8h), check-push-receipts (13h), expire-programs (10h), generate-insights (9h), cleanup-orphan-signups (3h).
Sobreposição relevante: `block-overdue-students-daily` (pg_cron 6h) vs `check-manual-overdue` (Vercel 11h) — ver item 4 Alto (buraco de defasagem). Sem jobs claramente órfãos. Nota: a migration 140 documenta o cron como "comentado", mas em produção ele **está ativo** (id=4) — o repositório está desatualizado quanto a isso.

---

## 7. `get_financial_students` (versão final 179)

Arquivo: `supabase/migrations/179_get_financial_students_installments.sql`.
Reescrita 8× (074→141→149→150→...→179). A 179 é `DROP+CREATE` (necessário porque muda o `RETURNS TABLE`).

### [VERIFICADO — boa] Segurança e correção
- Tenant guard correto (linhas 22-26): retorna vazio se `p_trainer_id` ≠ `current_trainer_id()` e não for service_role. `STABLE SECURITY DEFINER SET search_path=public`. Grants resetados corretamente (REVOKE anon/public, GRANT authenticated/service_role) — importante porque DROP zera grants.
- `LEFT JOIN LATERAL ... LIMIT 1` (80-95) escolhe **um** contrato por aluno com prioridade por status — evita duplicação de alunos quando há múltiplos contratos. Correto.

### [MÉDIO] Performance da 179
Evidência: o `LATERAL` roda uma subconsulta ordenada por aluno; o `ORDER BY` externo (100-130) é um `CASE` gigante reavaliando status/datas. Filtra `WHERE s.coach_id = p_trainer_id AND s.status='active'`. Depende de índice em `student_contracts(student_id, trainer_id)` (existe `idx_contracts_student` + `idx_contracts_trainer`, mas **não** um composto `(student_id, trainer_id)`) e o join `trainer_plans tp ON tp.id = sc.plan_id` usa `student_contracts.plan_id` que **está na lista de FK sem índice** (item 3 Alto).
Impacto: para treinadores com muitos alunos, o LATERAL faz lookup por aluno sem índice composto ideal; o join de planos faz seq scan em `trainer_plans` (tabela pequena, mitiga).
Correção: índice em `student_contracts.plan_id`; avaliar composto `student_contracts(student_id, trainer_id, status)` para acelerar o LATERAL. A lógica de classificação é cara mas roda sobre poucas linhas (alunos do trainer) — aceitável.

### [BAIXO] Lógica de status duplicada entre SQL e código
O mesmo `CASE` de `display_status` (manual overdue = past 3 dias) está replicado no cron `check-manual-overdue/route.ts:16` (`threeDaysAgo`) e na 179 (`interval '3 days'`). Constante "3 dias" duplicada em SQL e TS — risco de divergência futura.

---

## Verificado e OK (resumo)
- Idempotência do webhook Asaas via `webhook_events` (UNIQUE) + retorno sempre 200: correto.
- Paginação de `messages` (limit+1, hasMore): presente em web e mobile.
- `context-enricher.ts` usa `.in()` para evitar N+1 (padrão correto).
- Filtros realtime são server-side e por tenant (exceto `use-unread-messages-count`, item 2 Médio).
- Edge functions sensíveis com `verify_jwt:true` e revalidação de ownership.
- Seeds versionados sem PII; `seed.sql` referenciado não existe (reset não semeia dados pessoais).
- `finishWorkout` tem reversão idempotente para set_logs (C3) — bom padrão de recuperação.
- RPC `get_financial_students` com tenant guard e grants corretos.
