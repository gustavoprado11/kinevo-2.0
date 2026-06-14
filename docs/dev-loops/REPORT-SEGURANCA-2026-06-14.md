# Loop de Segurança — 2026-06-14

## Resumo
- **5 verificadas, todas `confirmado`** (0 uncertain, 0 refutado). Cada uma teve tentativa de refutação.
- Por severidade: **1 alto** (IDOR cross-tenant em migrateContract), **2 medio** (oura-webhook-setup anônimo; rate limiter em memória), **2 baixo** (cron functions anônimas; leak name/equipment de exercício).
- **3 fixWorthy** (alto + 2 medio). Os 2 baixo são aceitos como risco residual.
- `liveProbe = OFF` — todas as conclusões por leitura de fonte; ausência de guard é textual e determinística em cada caso.
- Isolamento de tenant: **1 furo real** (migrate-contract, severidade alta). Demais confirmados são custo/abuso de recurso ou leak menor, não cross-tenant de PII.

## 🔴 Vulns confirmadas

| Sev | Área | Título | Evidência (file:line) | Exploit |
|-----|------|--------|-----------------------|---------|
| 🔴 alto | Financeiro / IDOR | `migrateContract` usa `studentId` do corpo sem validar posse | `web/src/actions/financial/migrate-contract.ts` valida só `fromContractId` (.eq trainer_id, L70); insere `{student_id: input.studentId}` via supabaseAdmin L199-219 (RLS bypass); branch stripe chama `generate-checkout.ts:29-33/71-75` sem coach_id. FK student_id não amarra coach_id↔trainer_id; sem trigger/RLS backstop | Trainer A passa studentId de aluno de trainer B → insere/muta `student_contracts` e `students.stripe_customer_id` de outro tenant |
| 🟠 medio | Edge fn / authn | `oura-webhook-setup` POST anônimo (verify_jwt=false, sem secret/assinatura) | `supabase/functions/oura-webhook-setup/index.ts:27-30` entra direto em `getOuraConfig(adminClient())` sem ler Authorization/x-push-secret/`verifyOuraSignature`. Contraste fail-closed: `send-push-notification/index.ts:23-29` | POST anônimo cria/renova subscriptions na Oura → churn/quota/rate-limit (sem cross-tenant; callback aponta p/ própria config) |
| 🟠 medio | LLM/MCP / abuso | Rate limiter em `Map` por instância não é global em serverless | `web/src/lib/rate-limit.ts:9` `new Map(...)` (header L3 "single-server"). Único limite em MCP `auth.ts:118-123`, chat `assistant/chat/route.ts:44-49`, DCR `oauth/register/route.ts:30-35`. `grep upstash\|kv\|redis` = 0; vercel.json sem WAF | Trainer autenticado dispara requests concorrentes → lambdas distintas com Map zerado; `perDay` (300/1000) nunca converge → orçamento LLM/MCP efetivamente ilimitado. Auth/tenant intactos |
| 🟡 baixo | Edge fn / authn | 4 cron functions invocáveis anonimamente | `dispatch-scheduled-notifications:33`, `extend-scheduled-notifications:49`, `renew-google-watch-channels:40`, `oura-token-refresh:12` ignoram `_req`; só service-role; verify_jwt=false; cron usa anon key pública (`migrations/154:4-5,26-28`) | POST anônimo → 200. Mitigado: input ignorado, idempotente (UNIQUE dispatch:128-133, onConflict extend:129-132), corrida Oura→skippedRace (oura-token-refresh:36-45). Pior caso: execução fora de hora |
| 🟡 baixo | MCP / leak | Lookup de exercício em tools de escrita não filtra `owner_id` | `workouts-write.ts:311-315/553-557/631-634` `.from('exercises')...eq('id', exercise_id)` via admin client, sem `.or(owner_id.is.null,owner_id.eq.trainerId)`. Read tool filtra (`exercises.ts:104`). Snapshot grava name/equipment de B (L364-366,565-566) e retorna (387,397-398) | Trainer A com UUID válido de exercício privado de B → vaza name+equipment no swap/add/superset. Não enumerável; sem PII de aluno |

## 🛠️ Prompts de fix (descritos — NÃO aplicar sem revisão)

**1. IDOR migrateContract (alto)** — Em `web/src/actions/financial/migrate-contract.ts`, após validar `currentContract` (pós L75), adicionar **duas** checagens antes de qualquer escrita: (1) consistência — rejeitar se `input.studentId !== currentContract.student_id`; (2) posse de tenant — buscar student por id via supabaseAdmin e rejeitar se `student.coach_id !== trainer.id` (padrão de `generate-checkout-link.ts:44` / `create-contract.ts:63` / `archive-student.ts:59`). Retornar `{ success: false, error: 'Aluno não encontrado' }` (genérico). Idealmente derivar o studentId de `currentContract.student_id` e descartar o parâmetro do corpo. Defense-in-depth: `generate-checkout.ts:generateCheckoutCore` também deveria validar que o student pertence ao `trainerId` antes de mutar `stripe_customer_id`. Outcome: chamada com studentId de outro trainer (ou divergente do contrato) falha sem inserir/mutar nada.

**2. oura-webhook-setup anônimo (medio)** — Em `supabase/functions/oura-webhook-setup/index.ts`, adicionar guard fail-closed logo após o OPTIONS (pós L27, antes de `getOuraConfig` L30), espelhando `send-push-notification/index.ts:23-29`: ler secret de `Deno.env` (ex. `OURA_SETUP_SECRET` ou reutilizar `PUSH_WEBHOOK_SECRET`), comparar contra header (ex. `x-setup-secret`) com `timingSafeEqual` (já em `_shared/oura.ts:269` — exportar e usar); se secret ausente OU header não bater → `json({ error: "unauthorized" }, 401)`. Atualizar a migration/cron que invoca a função p/ enviar o header. Manter `verify_jwt=false`. Não aplicar — revisão humana. Outcome: chamadas anônimas → 401, sem criar/renovar subscriptions nem consumir quota Oura.

**3. Rate limiter global (medio)** — Em `web/src/lib/rate-limit.ts`, trocar o `Map` por backend durável compartilhado entre lambdas mantendo a API (`checkRateLimit`/`recordRequest`): (a) Upstash Redis / Vercel KV com janela deslizante atômica (INCR+EXPIRE ou sorted-set por timestamp), ou (b) tabela Postgres (`rate_limit_events(key, ts)` / `rate_limit_counters`) via createAdminClient com check+increment atômico (função SQL transacional p/ fechar TOCTOU). Considerar unir as duas chamadas sequenciais num único `consume(key, opts)` atômico. Aplicar a todos os call sites (`mcp/auth.ts`, `assistant/chat/route.ts`, `oauth/register/route.ts`, `android/actions.ts`, `messages/notify-*`). Complementar (não substituto): regra de rate-limit no Vercel Firewall/WAF p/ `/api/mcp` e `/api/assistant/chat`. Atualizar comentário "single-server" (L3). Não aplicar — revisão humana. Outcome: limites perMinute/perDay valem globalmente em serverless; trainer autenticado não excede orçamento LLM/MCP via concorrência.

## 🟡 Incertos
Nenhum. Todas as 5 fecharam por leitura de fonte; nenhum probe ao vivo pendente é necessário para concluir (ausência de guard é textual em cada caso).

## 🗑️ Refutados
Nenhum. Nenhuma vuln foi refutada como mitigado/by_design/false_positive neste loop.

---
**Nota de risco residual** (fixWorthy=false, sem fix por design): os 2 itens baixo (cron functions anônimas; leak name/equipment) são aceitos — cron tem input ignorado + idempotência + corrida benigna tratada; leak exige UUID não enumerável e expõe só metadado de recurso secundário sem PII.
