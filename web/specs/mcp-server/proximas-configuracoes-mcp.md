# Próximas configurações do MCP do Kinevo

> Documento de planejamento. Captura o estado atual do MCP, o padrão de
> implementação consolidado e as próximas features priorizadas por valor no dia
> a dia do treinador. Atualizado em 2026-06-15.

---

## Estado atual (entregue)

O MCP do Kinevo expõe **28 tools** (`web/src/lib/mcp/tools/`). Cobertura por domínio:

| Domínio | Tools | Cobertura |
|---|---|---|
| Alunos | list/get/create/update_student | leitura + escrita |
| Programas | list/get_program, create_program, **create_program_template**, assign, expire | leitura + escrita + template completo |
| Treinos | add/update/delete_workout_session, add/update/delete_workout_item, create_superset | escrita (template + assigned) |
| Exercícios | list_exercises, list_training_methods | **só leitura** |
| Progresso | get_student_progress, get_form_responses | leitura |
| **Agenda** | list/create/reschedule/cancel_occurrence/cancel_series/mark_status_appointment | leitura + escrita |
| **Formulários** | **list_form_templates, send_form** | leitura + envio |
| Mensagens | list/get_conversation, send_message | leitura + escrita |
| Financeiro | list_subscriptions, get_revenue_summary | **só leitura** |
| Dashboard | get_dashboard_summary | leitura |

Features recentes (jun/2026): **Templates de programa** (tool atômica + incremental),
**Agenda/Sessões** (6 tools), **Formulários/Check-ins** (enviar). Todas validadas
E2E no endpoint de produção.

---

## Padrão de implementação (seguir nas próximas)

Três aprendizados viraram padrão obrigatório:

### 1. Núcleo compartilhado (action ↔ MCP)
Quando uma operação tem efeitos colaterais (notificações, push, Google sync,
inbox), **não** reimplemente no handler do MCP. Extraia um núcleo server-only
(arquivo **sem** `'use server'`) com assinatura `xxxCore(supabase, trainerId, input)`:
- A server action (`'use server'`) vira wrapper de auth: resolve `trainer.id` e delega.
- A tool MCP chama o núcleo com `createAdminClient()` + o `trainerId` do token.
- Garante paridade total sem duplicar lógica. Ex.: `actions/appointments/core.ts`,
  `actions/forms/assign-form-core.ts`.

> Por que arquivo separado: um arquivo `'use server'` trata todo export como
> server action — params não-serializáveis (SupabaseClient) quebram.

### 2. Bug de service-role em RPCs `SECURITY DEFINER` (CRÍTICO)
O MCP grava com **service-role (sem JWT)**, então `auth.uid()` e
`current_trainer_id()` são **NULL**. Qualquer RPC ou trigger que derive o
treinador de `current_trainer_id()` **falha via MCP**. Já corrigidos:
- `set_trainer_id` (trigger de `program_templates`) — migration 200
- `create_program_template_tree` — recebe `p_trainer_id` (migration 200)
- `assign_form_to_students` — overload com `p_trainer_id` (migration 201)

**Antes de expor qualquer escrita nova, audite:**
```sql
-- triggers auth-dependentes na tabela alvo
SELECT c.relname, t.tgname, p.proname,
  (pg_get_functiondef(p.oid) ILIKE '%current_trainer_id%' OR pg_get_functiondef(p.oid) ILIKE '%auth.uid%') AS uses_auth
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND c.relname IN ('<tabela>');
```
Se a action chama um RPC que usa `current_trainer_id()`, crie um **overload com
`p_trainer_id`** e torne a versão antiga um wrapper que delega (backward-compatible).

### 3. Validação E2E sem depender do conector
A lista de tools do conector é **fixa por sessão** — tools novas só aparecem em
sessão nova pós-reconexão. Para validar antes disso, bata no HTTP MCP direto:
- `tools/list` é **público** (sem auth) → confirma deploy + tools no ar.
- Para `tools/call`: insira um token transitório em `mcp_oauth_tokens`
  (`access_token_hash` = sha256 do token, `client_id`, `trainer_id`, `expires_at`),
  chame via `curl` com `Authorization: Bearer`, **revogue/delete o token no fim** e
  limpe os dados de teste. Use o aluno-teste do próprio treinador para escritas que
  notificam.

### Checklist por feature nova
- [ ] Núcleo compartilhado se houver efeitos colaterais
- [ ] Auditar triggers/RPCs por dependência de `current_trainer_id()`
- [ ] Ownership por `trainerId` explícito (admin client bypassa RLS)
- [ ] `readOnlyHint`/`destructiveHint` corretos; confirmação para ações sensíveis
- [ ] Bloco de instruções no `server.ts`
- [ ] `tsc` limpo + suíte verde + E2E pelo endpoint real
- [ ] Migration versionada (mesmo que aplicada via MCP) + commit atômico

---

## Próximas configurações (priorizadas)

### 1. 💰 Financeiro — ações (ALTO valor · risco ALTO: dinheiro)
Hoje só leitura (`list_subscriptions`, `get_revenue_summary`). Actions disponíveis
em `actions/financial/`: `create-plan`, `update-plan`, `toggle-plan`, `delete-plan`,
`create-contract`, `update-contract`, `cancel-contract`, `generate-checkout-link`,
`mark-as-paid`, `toggle-block-on-fail`, `archive-student`.

**Tools propostas:**
- `kinevo_list_plans` (read) — pré-requisito para criar contrato/link.
- `kinevo_create_plan` / `kinevo_update_plan` — gerenciar planos.
- `kinevo_generate_checkout_link` — "gera o link de pagamento do plano X pra Maria".
- `kinevo_create_contract` — vincular aluno a um plano.
- `kinevo_mark_payment_as_paid` — baixa manual de mensalidade.

**Cuidados:** mexe com Stripe/Asaas e cobrança. `destructiveHint` onde fizer
sentido; **sempre confirmar** antes de cobrar/marcar pago. Auditar os RPCs por
`current_trainer_id()`. Não expor delete de plano sem trava. Considerar começar só
com `list_plans` + `generate_checkout_link` (menor risco, alto valor).

### 2. 📋 Formulários recorrentes — completar (MÉDIO valor · esforço BAIXO)
Complementa o `send_form` já entregue. Action: `actions/forms/form-schedules.ts`
(`createFormSchedules`, `getStudentFormSchedules`, `toggle`, `delete`).

**⚠️ Investigar antes:** `createFormSchedules` grava `trainer_id = user.id`
(auth uid, **não** `trainers.id`) — divergente do resto. Confirmar se
`form_schedules.trainer_id` referencia `auth.users` (intencional) ou é bug latente.
Resolver isso primeiro; depois expor `kinevo_schedule_form` / `kinevo_list_form_schedules`.

### 3. 📊 Avaliações físicas (MÉDIO-ALTO valor · esforço MÉDIO)
Zero cobertura. Actions em `actions/assessments/`: `create-session`,
`save-measurements`, `finalize-session`, `get-session(s)`, `cancel-session`,
`update-template`.

**Tools propostas:**
- `kinevo_create_assessment_session` — abrir avaliação para um aluno.
- `kinevo_save_assessment_measurements` — peso, circunferências, dobras.
- `kinevo_finalize_assessment` — fechar e gerar resultado.
- `kinevo_get_assessments` (read) — histórico/evolução.

**Cuidados:** modelo de medidas pode ser extenso (antropometria, dobras J&P) —
desenhar schema de input claro. Auditar triggers/RPCs.

### 4. 🏋️ Exercício custom + 🤝 Leads (MENOR valor · esforço BAIXO)
**Exercícios** (`actions/exercises/`): hoje só `list_exercises`. Adicionar
`kinevo_create_exercise` (catálogo próprio do treinador, `owner_id = trainerId`) e
talvez `kinevo_get_exercise_substitutes` (já há `get-substitutes`). Útil quando o
treinador quer um exercício que não está no catálogo antes de prescrever.

**Leads/CRM** (`actions/leads/`): `convert-lead-to-student`, `update-lead-status`.
Tools `kinevo_list_leads`, `kinevo_convert_lead`, `kinevo_update_lead_status`.
Valor depende de quanto o treinador faz captação/vendas pelo chat.

### 5. 🔔 Insights & check-ins de treino (BAIXO esforço · leitura)
- `kinevo_list_insights` — expor `assistant_insights` (alertas de IA: aluno em risco,
  queda de adesão) como leitura. Bom para "tem algum alerta importante hoje?".
- `kinevo_get_workout_checkins` — já há `actions/forms/get-workout-checkins.ts`.

---

## Recomendação de sequência

1. **Financeiro — versão mínima** (`list_plans` + `generate_checkout_link`): maior
   valor percebido, começando pelo subconjunto de menor risco.
2. **Avaliações físicas**: fecha um domínio inteiro hoje ausente.
3. **Formulários recorrentes** (após resolver o `trainer_id`).
4. **Exercício custom / Leads / Insights**: incrementais, conforme demanda.

> Regra de ouro: features que **enviam/cobram/notificam** o aluno ou mexem em
> dinheiro exigem confirmação explícita no fluxo e `destructiveHint` correto.
