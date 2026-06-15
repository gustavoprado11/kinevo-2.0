# Configurações do MCP do Kinevo

> Documento de planejamento e registro do MCP. Captura o estado atual, o padrão
> de implementação consolidado e o histórico de entregas. Atualizado em 2026-06-15
> após a entrega completa dos blocos priorizados (1–7) e o sweep E2E das 55 tools.

---

## Estado atual (entregue)

O MCP do Kinevo expõe **55 tools** (`web/src/lib/mcp/tools/`). Cobertura por domínio:

| Domínio | Tools | Cobertura |
|---|---|---|
| Alunos | list/get/create/update_student | leitura + escrita |
| Programas | list/get_program, create_program, **create_program_template**, **assign_program**, expire | leitura + escrita + template + atribuição |
| Treinos | add/update/delete_workout_session, add/update/delete_workout_item, create_superset | escrita (template + assigned) |
| Exercícios | list_exercises, **create_exercise** | leitura + criação no catálogo do treinador |
| Progresso | get_student_progress, get_form_responses | leitura |
| Agenda | list/create/reschedule/cancel_occurrence/cancel_series/mark_status_appointment | leitura + escrita |
| Formulários | list_form_templates, send_form, **schedule_form, list_form_schedules** | leitura + envio + recorrência |
| Mensagens | list/get_conversation, send_message | leitura + escrita |
| Financeiro | list_subscriptions, get_revenue_summary, **list_plans, create_plan, update_plan, generate_checkout_link, create_contract, mark_payment_as_paid, cancel_contract** | leitura + escrita completa |
| Avaliações | **get_assessments, create_assessment_session, save_assessment_measurements, finalize_assessment** | leitura + escrita |
| Insights | **list_insights, get_workout_checkins** | leitura |
| Leads / CRM | **list_leads, update_lead_status, convert_lead** | leitura + escrita |
| Dashboard | get_dashboard_summary | leitura |

**Validação:** todas as 55 tools validadas E2E pelo endpoint de produção (sweep de
15/jun/2026, conta de teste "Trainer Carteira Teste") — **55/55 PASS**.

---

## Padrão de implementação (seguir nas próximas)

Quatro aprendizados são padrão obrigatório:

### 1. Núcleo compartilhado (action ↔ MCP)
Quando uma operação tem efeitos colaterais (notificações, push, Google sync,
inbox, Stripe/Asaas), **não** reimplemente no handler do MCP. Extraia um núcleo
server-only (arquivo **sem** `'use server'`) com assinatura
`xxxCore(supabase, trainerId, input)`:
- A server action (`'use server'`) vira wrapper de auth: resolve `trainer.id` e delega.
- A tool MCP chama o núcleo com `createAdminClient()` + o `trainerId` do token.
- Garante paridade total sem duplicar lógica. Ex.: `actions/appointments/core.ts`,
  `actions/forms/assign-form-core.ts`, `actions/financial/contracts-core.ts`,
  `actions/financial/plans-core.ts`, `actions/leads/convert-lead-core.ts`,
  `actions/create-student-core.ts`.

> Por que arquivo separado: um arquivo `'use server'` trata todo export como
> server action — params não-serializáveis (SupabaseClient) quebram.

### 2. Bug de service-role em RPCs `SECURITY DEFINER` (CRÍTICO)
O MCP grava com **service-role (sem JWT)**, então `auth.uid()` e
`current_trainer_id()` são **NULL**. Qualquer RPC ou trigger que derive o
treinador de `current_trainer_id()` **falha via MCP**. Já corrigidos via overload
com `p_trainer_id` (versão antiga vira wrapper / fica intacta, backward-compat):
- `set_trainer_id` (trigger `program_templates`) + `create_program_template_tree` — migration 200
- `assign_form_to_students` — migration 201
- `create/save/finalize/get_assessment_session(s)` (5 RPCs) — migration 202
- `assign_program_to_student` — migration 203 (encontrado pelo sweep; corrigiu também
  um bug latente: a RPC checava `students.trainer_id`, coluna inexistente → `coach_id`)

**Antes de expor qualquer escrita nova, audite triggers/RPCs auth-dependentes:**
```sql
SELECT p.proname, (pg_get_functiondef(p.oid) ILIKE '%current_trainer_id%') AS uses_cti, p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('<rpc>');
```
Se a action chama um RPC que usa `current_trainer_id()`, crie um **overload com
`p_trainer_id`** e passe o `trainerId` no handler.

### 3. Gate de confirmação (preview/dry-run) em ações sensíveis
Toda tool que **cobra/cancela/cria conta/mexe em dinheiro** recebe um parâmetro
`confirm: z.boolean().default(false)`. Sem `confirm`, a tool retorna uma
**pré-visualização** do efeito exato (aluno + valor + consequência) e **não muta
nada**; só executa com `confirm=true`. Instruções no `server.ts` proíbem o
assistente de auto-confirmar. Aplicado em: `create_contract`,
`mark_payment_as_paid`, `cancel_contract`, `convert_lead`. Combine com
`destructiveHint` correto.

### 4. Validação E2E sem depender do conector
A lista de tools do conector é **fixa por sessão** — tools novas só aparecem em
sessão nova pós-reconexão. Para validar antes disso, bata no HTTP MCP direto:
- `tools/list` é **público** (sem auth) → confirma deploy + tools no ar.
- Para `tools/call`: insira um token transitório em `mcp_oauth_tokens`
  (`access_token_hash` = sha256 do token, `client_id`, `trainer_id`, `expires_at`),
  chame via `curl` com `Authorization: Bearer`, **revogue/delete o token no fim** e
  limpe os dados de teste. Use o aluno-teste do próprio treinador para escritas que
  notificam. Para sweeps grandes, rotacione vários tokens (rate limit 30/min por key).

### Checklist por feature nova
- [ ] Núcleo compartilhado se houver efeitos colaterais
- [ ] Auditar triggers/RPCs por dependência de `current_trainer_id()`
- [ ] Ownership por `trainerId` explícito (admin client bypassa RLS)
- [ ] `readOnlyHint`/`destructiveHint` corretos; gate `confirm` em ações sensíveis
- [ ] Bloco de instruções no `server.ts`
- [ ] `tsc` limpo + suíte verde + E2E pelo endpoint real
- [ ] Migration versionada (mesmo que aplicada via MCP) + commit atômico

---

## Histórico de entregas (jun/2026)

Todas pushadas em `main` (deploy Vercel) e validadas E2E. **+27 tools** (de 28 → 55).

| Bloco | Entregue | Migration |
|---|---|---|
| 1. Financeiro mínimo | `list_plans`, `generate_checkout_link` (gate confirm) | — |
| 2. Avaliações físicas | `get_assessments`, `create_assessment_session`, `save_assessment_measurements`, `finalize_assessment` | 202 (overloads p_trainer_id) |
| 3. Formulários recorrentes | `schedule_form`, `list_form_schedules` + **fix bug** `form_schedules.trainer_id` (gravava auth uid contra FK→trainers; tabela tinha 0 linhas) | — |
| 4. Exercício custom | `create_exercise` (owner_id=trainerId, vincula grupos por nome) | — |
| 5. Insights & Leads | `list_insights`, `get_workout_checkins`, `list_leads`, `update_lead_status` | — |
| 6. Financeiro avançado | `create_plan`, `update_plan`, `create_contract`, `mark_payment_as_paid`, `cancel_contract` (gate confirm nas 3 que mexem em dinheiro) | — |
| 7. Conversão de lead | `convert_lead` (cria conta de aluno + credenciais; gate confirm; idempotente) | — |
| Sweep E2E + fix | Teste das 55 tools → encontrou e corrigiu `assign_program` | 203 (overload + fix coach_id) |

---

## Ideias futuras (sob demanda, fora do escopo original)

- **Financeiro:** `delete_plan`/`toggle_plan` (com trava), `archive_student`, `toggle_block_on_fail`.
- **Exercícios:** `get_exercise_substitutes` (existe `get-substitutes`, mas acoplado a item de programa atribuído).
- **Avaliações:** template de avaliação custom (hoje só usa templates existentes).
- **Mensagens/Insights:** marcar insight como lido/descartado; anexos em mensagens.

> Regra de ouro: features que **enviam/cobram/notificam** o aluno, **criam contas**
> ou mexem em dinheiro exigem gate `confirm` no input e `destructiveHint` correto.
