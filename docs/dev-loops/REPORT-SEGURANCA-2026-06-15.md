# Loop de Segurança — 2026-06-15

## Resumo
- **Por verdict:** confirmado **4** · false_positive **2** · uncertain **0** (total 6)
- **Confirmadas por severidade:** crítico 0 · alto 0 · médio **2** · baixo **2**
- **liveProbe:** OFF (todas as conclusões por leitura de código + topologia de deps; nenhum exploit ao vivo executado)

## 🔴 Vulns confirmadas

| Sev | Área | Título | Evidência (file:line) | Exploit |
|---|---|---|---|---|
| Médio | Edge / cron | dispatch-scheduled-notifications sem guard de secret (verify_jwt=false) → disparo anônimo + duplicação de push por corrida | `supabase/functions/dispatch-scheduled-notifications/index.ts:33` (`Deno.serve(async (_req)` ignora o request; sem checagem em 33-71); insert inbox 99-109 ANTES do UPDATE status='sent' 121-124; UNIQUE 128-129 é em `scheduled_notifications`, não em `student_inbox_items` | POST anônimo dispara o job; sob invocações concorrentes, sem claim atômico, o trigger 098 empurra push duplicado e polui o inbox |
| Médio | MCP / auth | key_prefix constante `kinevo_train` faz validateApiKey rodar N×bcrypt(cost12) por token inválido, antes do rate-limit → amplificação de custo/DoS | `generate-api-key.ts:31-33` (slice(0,12) de `kinevo_trainer_`+uuid = sempre `kinevo_train`); `auth.ts:29-36` `.eq('key_prefix',prefix)` casa TODAS as keys ativas; loop bcrypt 40-41; consumeRateLimit só em 121, depois do auth | token `kinevo_trainer_<inválido>` força N comparações bcrypt em série antes de qualquer throttle; `isAllowedOrigin` (route.ts:36-38) passa sem header Origin → atacante server-side |
| Baixo | Edge / cron | 3 crons internos (oura-token-refresh, renew-google-watch-channels, extend-scheduled-notifications) acionáveis sem autenticação | `oura-token-refresh/index.ts:12`, `renew-google-watch-channels/index.ts:40`, `extend-scheduled-notifications/index.ts:49` — todos `_req` nunca lido; verify_jwt=false (list_edge_functions); usam SERVICE_ROLE (bypassa RLS) | POST anônimo aciona refresh de tokens/watch channels/batch; impacto restrito a consumo de quota de APIs terceiras e trabalho de batch; sem leak cross-tenant |
| Baixo | MCP / write | Lookup de exercise_id nas tools de escrita não filtra owner_id (gap cross-tenant) | `workouts-write.ts:311-318` e `:631-642` (`.eq('id',exercise_id)` sem owner_id); `programs-write.ts:128-137` (`.in('id',...)`); owns check 286 cobre só o workout | exige UUIDv4 privado de outro trainer já vazado (não exposto por list/read — `exercises.ts:104` e `exercises-write.ts:44` filtram owner); revela só name+equipment |

## 🛠️ Prompts de fix (descritos — NÃO aplicar sem revisão)

### 1. dispatch-scheduled-notifications — guard fail-closed + claim atômico (médio)
Em `supabase/functions/dispatch-scheduled-notifications/index.ts`, espelhar `send-push-notification`: trocar `_req`→`req`, ler `expected = Deno.env.get("DISPATCH_WEBHOOK_SECRET")` e `provided = req.headers.get("x-dispatch-secret")`; se `!expected || provided !== expected` (idealmente timing-safe) retornar **401** antes de qualquer query. Configurar o secret no projeto e fazer o job pg_cron enviar o header (mecânica das migrations 180/oura). Manter verify_jwt=false. Para a corrida: antes de inserir no inbox, `UPDATE scheduled_notifications SET status='processing' WHERE id=row.id AND status='pending'` e só prosseguir se afetou 1 linha (rowCount/returning); então inserir em `student_inbox_items` e marcar `sent`. **Outcome:** rejeita POST anônimo com 401 e cada notification é processada/empurrada exatamente uma vez sob concorrência, eliminando spam de push e poluição de inbox.

### 2. key_prefix seletivo + throttle pré-bcrypt (médio)
Em `web/src/actions/api-keys/generate-api-key.ts`, derivar o prefixo de bytes APÓS o literal constante `kinevo_trainer_` (15 chars) — ex.: `keyPrefix = rawKey.slice(0,23)` ou sufixo dedicado `kinevo_trainer_${shortId}_${secret}` — para que o trecho indexado varie por key. Atualizar o slice em `web/src/lib/mcp/auth.ts:29` para o MESMO trecho, com retrocompat para keys antigas (`kinevo_train`: migrar/rotacionar ou fallback temporário). Defensivamente, mover um `consumeRateLimit` barato por IP/prefixo para o INÍCIO de `authenticateRequest`, antes de `validateApiKey`, e/ou limitar candidatos carregados (cap + ordenação por last_used); considerar rate-limit pré-auth por IP em `web/src/app/api/mcp/route.ts`. **Outcome:** token inválido casa no máximo 0-1 key, custo por request inválido para de crescer com o total de keys, e inválidos repetidos são limitados antes de qualquer bcrypt.

> Os dois confirmados de severidade baixo (#3 crons, #4 exercise lookup) foram marcados `fixWorthy=false` — sem prompt de fix.

## 🟡 Incertos
Nenhum item `uncertain`. Onde o liveProbe (desligado) ainda agregaria certeza: cronometrar o tempo real `~N×250ms` do path bcrypt (#2) e provar o POST anônimo + duplicação em ambiente real (#1) — mas o comportamento do código já está confirmado por leitura.

## 🗑️ Refutados

| Título | Verdict | Guard / razão (file:line) |
|---|---|---|
| form-data 4.0.5 (CVE CRLF) transitivo do @anthropic-ai/sdk | false_positive | Codepath multipart nunca exercido — `llm-client.ts:149-152` só usa `messages.create` (JSON); os `FormData` do repo (`message-input.tsx:63`, `asaas/documents.ts:49`, `wallet-client.tsx:1365`) são o global Web-standard, não o pacote npm vulnerável. Caminho inalcançável |
| Vulns high/critical do mobile (shell-quote/xmldom/ws) | false_positive | São tooling de build/dev: `shell-quote` só via react-devtools-core; `ws` vulnerável só em Metro/dev-middleware (runtime usa ws@8.21.0 via supabase-js, fora da faixa); `@xmldom/xmldom` só via @expo/cli/prebuild. Nenhum entra no bundle de produção nem em superfície de rede |
