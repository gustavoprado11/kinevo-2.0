# Loop de Produção/Runtime — 2026-06-14

## Resumo
- **real:** 4 (todos severity=med) — os 4 viraram fix (fixWorthy=true)
- **by_design:** 3
- **false_positive:** 3
- **low_value:** 4
- **stale:** 0
- **uncertain:** 0

**Total fixWorthy:** 4. Produção não está "limpa", mas o único risco de segurança ativo é 1 (RPCs de block/unblock sem escopo de tenant); os outros 3 reais são performance de banco (índices/RLS initplan), sem impacto funcional. Todo o restante (10) é ruído filtrado: hardening intencional, dois sistemas Stripe distintos, ou falha de token de ferramenta.

---

## 🔴 Falhas reais (verdict=real)

| Sev | Título | Fonte | Evidência (timestamp) |
|-----|--------|-------|------------------------|
| med | RPCs `block_student_access`/`unblock_student_access` SECURITY DEFINER sem escopo de tenant — qualquer logado bloqueia/desbloqueia qualquer aluno por UUID | DB prod `lylksbtgrihzepbteest` (pg_proc); guard só em `web/src/app/api/students/[id]/access/route.ts:51-64` | Defs ao vivo 2026-06-14: ambas SECURITY DEFINER, EXECUTE p/ `authenticated`, `UPDATE students WHERE id=p_student_id` sem filtro coach_id; chamável direto via `/rest/v1/rpc/...` |
| med | 20 foreign keys sem índice de cobertura (joins/cascades lentos) | DB prod (pg_constraint × pg_index); advisor `0001_unindexed_foreign_keys` | Introspecção ao vivo 2026-06-14: exatamente 20 FKs `has_index=false` (push_tickets/push_errors.push_token_id, *.source_template_id, push_tokens.trainer_id, etc.) |
| med | RLS re-avalia `auth.uid()/auth.jwt()` por linha em 63 policies (~32 tabelas) — `auth_rls_initplan` | DB prod (pg_policies); advisor `0003_auth_rls_initplan` | 2026-06-14: 63 ocorrências; tabelas quentes messages (8 policies), trainers (4); chamadas nuas sem `(select ...)` |
| low | 8 funções public com `search_path` mutável — advisor `0011` | DB prod (pg_proc.proconfig=null); advisor `0011_function_search_path_mutable` | 2026-06-14: 8 fns sem SET search_path (update_updated_at, guard_*, get_*); **todas SECURITY INVOKER** (prosecdef=false), sem escalonamento |

> Nota: o achado das 8 fns search_path é `real` mas `fixWorthy=false` (todas INVOKER, WARN de higiene) — não recebe prompt de fix abaixo.

---

## 🛠️ Prompts de fix prontos (fixWorthy=true)

### 1. Segurança — escopar block/unblock_student_access (med)
```
As funções SQL public.block_student_access(p_student_id uuid, p_reason text) e
public.unblock_student_access(p_student_id uuid) são SECURITY DEFINER com EXECUTE
concedido a `authenticated` e não validam o chamador: fazem UPDATE students WHERE
id = p_student_id sem checar dono. Como SECURITY DEFINER ignora RLS e a RPC é exposta
via PostgREST (/rest/v1/rpc/...), qualquer usuário logado pode bloquear qualquer aluno
por UUID (reason arbitrário exibido ao aluno) e qualquer aluno bloqueado pode chamar
unblock_student_access(seu_id) para restaurar o próprio acesso, derrotando o bloqueio
por inadimplência. A rota web/src/app/api/students/[id]/access/route.ts já valida
coach_id antes de chamar via service role, então o caminho legítimo continua.

Correção (nova migration SQL, aplicar via Supabase MCP só com autorização):
  REVOKE EXECUTE ON FUNCTION public.block_student_access(uuid, text) FROM authenticated, anon;
  REVOKE EXECUTE ON FUNCTION public.unblock_student_access(uuid) FROM authenticated, anon;
service_role tem bypass e não é afetado. Defesa em profundidade opcional: adicionar
AND coach_id = current_trainer_id() no UPDATE. Após aplicar, re-rodar get_advisors(security)
e testar PATCH /api/students/[id]/access (bloquear/desbloquear) para garantir que funciona.

Outcome: block_student_access e unblock_student_access deixam de ser executáveis por
usuários logados via PostgREST; só a rota autenticada (service role, com checagem de
coach_id) consegue bloquear/desbloquear, eliminando o write cross-tenant e o auto-desbloqueio
de inadimplentes, sem quebrar o fluxo legítimo do treinador.
```

### 2. Performance — índices nas 20 FKs (med)
```
Criar índices de cobertura para as 20 foreign keys sem índice no schema public do
projeto lylksbtgrihzepbteest, eliminando o lint 0001_unindexed_foreign_keys. Sem índice,
todo DELETE/UPDATE na tabela-pai faz seq scan na tabela-filha p/ validar a FK, e joins
por essas colunas ficam lentos. Prioridade por crescimento/cascata: push_tickets.push_token_id
e push_errors.push_token_id, push_tokens.trainer_id, e os três *.source_template_id.

Aplicar via nova migration em supabase/migrations usando CREATE INDEX CONCURRENTLY (fora
de transação); se a ferramenta exigir transação, índices normais bastam (volume pequeno).
Uma instrução por FK, ex.:
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tickets_push_token_id
    ON public.push_tickets(push_token_id);
Repetir para as 20 colunas (nome idx_<tabela>_<coluna>): appointment_groups.coach_id,
assessment_sessions.template_id/inbox_item_id, assigned_programs/assigned_workout_items/
assigned_workouts.source_template_id, exercise_synergies.secondary_group_id, feedback.coach_id,
form_schedules.form_template_id, mcp_oauth_codes.trainer_id, mcp_tool_usage_logs.api_key_id,
payouts.pix_key_id, program_form_triggers.form_template_id, push_errors.push_token_id,
push_tickets.push_token_id, push_tokens.trainer_id, recurring_appointments.appointment_group_id,
trainer_leads.converted_to_student_id, workout_sessions.pre_workout_submission_id/
post_workout_submission_id. Após aplicar, rodar get_advisors(performance) e confirmar
0001 zerado.

Outcome: as 20 FKs passam a ter índice de cobertura, o lint 0001_unindexed_foreign_keys
some, e deletes/cascades nas tabelas-pai não fazem mais seq scan nas filhas.
```

### 3. Performance — wrap auth.* em subselect nas 63 policies (med)
```
Corrigir o anti-pattern auth_rls_initplan (advisor 0003) em 63 policies de ~32 tabelas
em lylksbtgrihzepbteest. As policies chamam auth.uid()/auth.jwt()/auth.role() nuas no
qual/with_check, fazendo o Postgres re-avaliar por LINHA escaneada em vez de uma vez por
query. Em messages (8 policies) e trainers (4) isso degrada throughput.

Gerar nova migration que recria CADA policy afetada trocando chamada nua por subselect:
  auth.uid() -> (select auth.uid()); auth.jwt() -> (select auth.jwt()); auth.role() -> (select auth.role()).
Semântica preservada (mesmo valor por query), segurança inalterada.

Passos:
1. Enumerar via pg_policies (schemaname='public') qual/with_check com auth.(uid|jwt|role)()
   sem 'select auth.' — as 63 confirmadas: messages(8), trainers(4), e 3 cada em
   daily_activity_samples/daily_sleep_samples/external_activities/feedback/hr_resting_samples/
   hrv_samples/readiness_scores/trainer_financial_settings/wearable_connections/
   workout_health_samples; push_tokens(2); 1 cada em android_tester_queue, appointment_exceptions,
   appointment_groups, assistant_insights, exercises, google_calendar_connections,
   mcp_oauth_clients, mcp_oauth_codes, mcp_oauth_tokens, mcp_tool_usage_logs,
   organization_members, organizations, perfect_weeks, recurring_appointments,
   scheduled_notifications, students, trainer_api_keys, trainer_exercise_videos, trainer_plans.
2. Para cada policy, capturar def atual (pg_get_expr de qual/with_check, roles, cmd) e
   reemitir DROP POLICY + CREATE POLICY com expressões wrapadas, mantendo roles/USING/
   WITH CHECK/nome idênticos.
3. Em policies com EXISTS/subquery, wrappar só as chamadas nuas; não alterar joins.
4. Aplicar e rodar get_advisors(performance): 0003 deve ir de 63 para 0.

Outcome: as 63 policies avaliam auth.* uma vez por query (initplan) em vez de por linha;
advisor 0003 zera; semântica e segurança inalteradas; ganho em messages e demais tabelas quentes.
```

---

## 🟡 Incertos (verdict=uncertain)
Nenhum. Todos os 14 achados foram resolvidos para um verdict definitivo.

---

## 🗑️ Descartados

| Título | Verdict | Motivo |
|--------|---------|--------|
| anon tem EXECUTE em 24 fns SECURITY DEFINER | low_value | Nenhuma explorável: triggers não-RPC, predicados gateiam em `auth.uid()` (NULL p/ anon → false), mutadores fazem `WHERE auth_user_id = NULL` → 0 linhas. WARN defense-in-depth, alinha com "helpers abertos por design" |
| RLS sem policy em wearable_oauth_tokens/provider_config | by_design | Comentário explícito nas migrations 153/155: service-role-only; RLS ON sem policy = deny-by-default p/ anon/authenticated; edge fns usam service key. Tokens guardados server-side por design |
| WITH CHECK true em android_tester_queue/curso_waitlist | by_design | Lead-capture público intencional (rota /android); write-only, sem PII; insert real via supabaseAdmin com rate-limit+validação; volume trivial (1 e 0 linhas) |
| Buckets públicos exercise-library-videos/public-assets SELECT amplo | by_design | Biblioteca GLOBAL compartilhada (owner_id IS NULL), não por-tenant; sem PII; único "extra" é enumerar nomes de vídeos que o user já pode assistir. Intenção documentada (migration 135) |
| 507 multiple-permissive-policy warnings (38 tabelas) | low_value | Camadas de policy intencionais (multi-tenant + ownership + aluno + gate inadimplência); warnings de role anon são artefato de TO public; overhead puro, zero impacto de usuário |
| 8 fns search_path mutável | low_value (fix) | Real mas não fixWorthy: todas SECURITY **INVOKER**, sem escalonamento; trigger/RPC triviais; WARN de higiene |
| pg_trgm/unaccent no schema public | low_value | WARN de higiene; uso real em shared/utils/search-text.ts; sem falha funcional |
| Leaked Password Protection desabilitada | low_value | Config global de Auth (Dashboard), sem caminho de código; WARN |
| Coleta Vercel bloqueada (403) | false_positive | Falha de escopo do token do conector MCP, não defeito de runtime do app (suspectedCodePath N/A) |
| Webhook Stripe invoice.payment_succeeded sem financial_transactions | false_positive | Dois sistemas distintos: handler é assinatura DA PLATAFORMA (treinador paga SaaS), grava só `subscriptions`; FT é ledger Connect/Asaas aluno→treinador. 23/24 eventos são plataforma, processados 200, sem retry suprimido |
| Contratos Stripe ativos sem financial_transaction | false_positive | Os 24 são TODOS billing_type='courtesy', amount=0, sub_id NULL; 0 contratos Stripe pagos ativos. Zero FT é correto. (nota latente não relacionada: insert Connect omite contract_id, mas 0 contratos exercitam o caminho) |

---
_Gerado pelo `production-runtime-loop.js`. Limitação desta run: coleta de runtime logs da Vercel bloqueada por escopo do token MCP (403) — runtime de serverless/edge da Vercel ficou SEM cobertura; revisar escopo do conector p/ a próxima._
