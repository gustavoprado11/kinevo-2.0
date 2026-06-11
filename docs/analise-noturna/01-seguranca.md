# Análise Noturna — Segurança (prioridade máxima)

> Auditoria defensiva SOMENTE LEITURA do monorepo Kinevo. Data: 2026-06-09.
> Escopo: RLS, API routes, edge functions, segredos, auth, IA/MCP, dependências.
> Foco em achados **NOVOS** (não repetir o que as auditorias de mai/2026 já corrigiram).
> Nenhum arquivo de código/config/migration foi alterado.

Resumo da postura: **a base de segurança do Kinevo é madura**. A maioria dos vetores clássicos
(IDOR, cross-tenant, prompt injection, webhook spoofing, segredos hardcoded) já está fechada e bem
documentada no código. Os achados abaixo são, na maior parte, **defense-in-depth** e
**inconsistências de hardening** — nada Crítico aberto encontrado na revisão estática **dentro do
escopo deste relatório** (a exposição da edge `send-push-notification` sem auth, com impacto de
segurança, está classificada como Crítico no relatório 02-backend §3; ver nota em §3.1).

---

## 1. RLS (Row-Level Security)

### 1.1 [OK com ressalva] Todas as tabelas têm RLS habilitado
Comparando `CREATE TABLE` × `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em todas as 176 migrations,
**não há tabela criada sem RLS habilitado**. As policies `USING (true)` encontradas são todas
legítimas:
- Catálogo global compartilhado: `muscle_groups` (010), `exercise_relationships`/`synergies`/
  `condition_constraints` (070) — leitura pública para `authenticated`, escrita só `service_role`.
- Policies escopadas a `service_role` (que ignora RLS de qualquer forma): `push_tokens` (056),
  `trainer_student_links` (084), `blocked_email_domains` (118).

### 1.2 [Médio] Tokens OAuth do Google Calendar em texto puro E legíveis pelo treinador via RLS
**Arquivo:** `supabase/migrations/109_google_calendar_integration.sql:22-24, 83-85`
**Evidência:**
```sql
access_token  TEXT NOT NULL,
refresh_token TEXT NOT NULL,
...
CREATE POLICY "Trainer can read own google connection"
    ... USING (trainer_id = current_trainer_id());
```
Diferente das chaves Asaas (AES-256-GCM, ver §4.1) e dos tokens Oura (apenas `service_role`,
ver 1.3), os tokens do Google ficam em **texto puro** e a policy de SELECT permite que o próprio
treinador (sessão `authenticated`, via anon key) leia `access_token`/`refresh_token`.
**Cenário de exploração:** um XSS na dashboard (ou qualquer código client-side malicioso/extensão)
pode rodar `supabase.from('google_calendar_connections').select('*')` e exfiltrar o token OAuth do
treinador, ganhando acesso de leitura/escrita ao Google Calendar dele fora do app. Em caso de
vazamento de backup/dump do banco, **todos** os tokens de calendário ficam expostos em claro.
**Correção sugerida:** (a) cifrar em repouso com o mesmo padrão AES-256-GCM já usado em `asaas/encryption.ts`,
ou usar Supabase Vault/pgsodium; e (b) **remover a policy de SELECT para o treinador** (o app só
precisa dos tokens server-side via `service_role`) ou restringir as colunas sensíveis via view.

### 1.3 [Baixo] Tokens de wearables (Oura/Whoop) em texto puro
**Arquivo:** `supabase/migrations/153_oura_integration.sql:75-90`
RLS habilitado **sem nenhuma policy** → só `service_role` lê/escreve (bom). Porém `access_token`/
`refresh_token` ficam em `text` puro. A própria migration reconhece: *"Hardening futuro: cifrar via
Supabase Vault/pgsodium."* Risco real só se o `service_role` key vazar ou houver dump do banco.
**Correção:** cifrar como em §1.2; menor prioridade que Google por já estar atrás do service_role.

### 1.4 [Baixo/Médio] 6 funções SECURITY DEFINER criadas após o hardening 077 sem `SET search_path`
A migration `077_fix_security_definer_search_path.sql` corrigiu o problema para as funções da época,
mas funções **posteriores** reintroduziram a omissão:
- `get_student_detail_v2` — `086_program_expiration.sql:33`
- `mark_notification_read`, `mark_all_notifications_read`, `get_unread_notification_count` —
  `094_create_trainer_notifications.sql` / redefinidas em `099_fix_notification_rls_and_rpcs.sql:37,45,53`
- `notify_push_on_trainer_notification`, `notify_push_on_student_inbox_item` —
  `098_realtime_push_notifications.sql:18,49` (triggers)

Nenhuma delas declara `SET search_path = public`.
**Cenário de exploração:** escalonamento de privilégio se um papel conseguir criar objetos
(função/tabela com nome colidente) em um schema que apareça antes de `public` no `search_path` do
chamador — a função DEFINER passaria a executar o objeto malicioso com privilégios do owner. No
Supabase moderno o `CREATE` em `public` costuma ser revogado de `authenticated`/`anon`, o que
**mitiga** o risco (daí a severidade baixa), mas é exatamente o gap que o projeto priorizou em 077.
**Correção:** adicionar `SET search_path = public` (ou `= ''` com nomes totalmente qualificados) a
essas 6 funções, via nova migration `CREATE OR REPLACE`.

### 1.5 [OK] Vetores clássicos já fechados
- `trainer_notifications` INSERT: o `WITH CHECK (true)` aberto de 094/099 (qualquer `authenticated`
  inseria notificação para qualquer treinador) **foi corrigido em** `101_security_hardening_rls_and_storage.sql:47`
  → `TO authenticated WITH CHECK (trainer_id = current_trainer_id())`. Não é mais um achado.
- `workout_sessions`: trigger `enforce_workout_session_trainer_id()` (101) impede o aluno de forjar
  `trainer_id`.
- Camadas RESTRITIVAS globais 162 (aluno bloqueado perde leitura) e 177 (treinador sem assinatura
  ativa não escreve em 36 tabelas) presentes e coerentes.
- Hashing de `x-user-id` no middleware: `middleware.ts:9-10` apaga qualquer `x-user-id` vindo do
  cliente antes de setar o valor autoritativo da sessão verificada — bom.

---

## 2. API routes (web) e Server Actions

### 2.1 [OK] Contrato do middleware honrado em TODAS as rotas fora do matcher
O middleware (`web/src/middleware.ts:30`) exclui do cookie-auth as rotas mobile-first, que precisam
autenticar o Bearer manualmente. Verifiquei **uma a uma**:

| Pasta excluída | Auth verificada |
|---|---|
| `api/webhooks/*` | assinatura/segredo (ver §2.3) |
| `api/stripe/webhook` | `stripe.webhooks.constructEvent` |
| `api/stripe/cancel-subscription` | Bearer → `supabaseAdmin.auth.getUser(token)` + valida `contract.student_id === student.id` |
| `api/cron/*` (8 rotas) | `authHeader === 'Bearer ' + CRON_SECRET` em todas |
| `api/financial/*` (10 rotas) | Bearer `getUser` ou `requireTrainer(request)` |
| `api/notifications/*` (4) | Bearer `getUser` |
| `api/prescription/generate` | Bearer JWT injetado no client |
| `api/programs/assign` | Bearer JWT injetado no client |
| `api/messages/notify-{trainer,student}` | Bearer `getUser` |
| `api/stripe/portal` | Bearer **ou** cookie |
| `api/wallet/*` (~18 rotas) | `requireTrainer(request)` (cookie ou Bearer) |
| `api/student/payment` | Bearer `getUser` + resolve student por `auth_user_id` |
| `api/mcp` | `authenticateRequest` (OAuth/API key) — ver §6 |
| `oauth/register`, `oauth/token`, `.well-known/*` | públicos por design (OAuth/discovery) |

**Nenhuma rota excluída do matcher ficou sem autenticação.** O contrato frágil documentado no
comentário está, de fato, cumprido hoje. (Risco residual: é um contrato manual — qualquer rota nova
criada nessas pastas que esqueça o Bearer vira buraco. Recomendação em §8.)

### 2.2 [OK] Autorização/IDOR nas rotas sensíveis
Amostras representativas confirmam checagem de propriedade antes de agir:
- `stripe/cancel-subscription/route.ts:62` — `if (contract.student_id !== student.id) → 403`.
- `students/[id]/access/route.ts:53-55` — `.eq('id', studentId).eq('coach_id', trainer.id)`.
- `student/payment/route.ts` — resolve o aluno pelo `auth_user_id` do token e só busca contratos
  com `student_id` dele (sem IDOR por parâmetro).
- Wallet usa `requireTrainer` + `getDecryptedApiKey(trainer.id)` (chave Asaas sempre do próprio dono).

### 2.3 [OK] Webhooks com verificação forte
- **Stripe** (`webhooks/stripe/route.ts:42`): `constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`;
  idempotência via `webhook_events`.
- **Asaas** (`webhooks/asaas/route.ts` + `lib/asaas/webhook.ts:26`): shared-secret no header
  `asaas-access-token` comparado com **timing-safe** (`timingSafeEqual`, checa length + XOR acumulado).

### 2.4 [Baixo] `api/diagnostic/asaas-fees` — endpoint de diagnóstico
`diagnostic/asaas-fees/route.ts:58` retorna 404 a menos que `ENABLE_DIAGNOSTICS === 'true'`. Bom
design (não vaza existência). Está **fora** do matcher? Não — `api/diagnostic` não está na lista de
exclusão, então roda sob cookie-auth, e ainda chama `requireTrainer(request)`. Defesa em camadas OK.
Só garanta que `ENABLE_DIAGNOSTICS` **nunca** seja `true` em produção.

### 2.5 [Baixo] Webhook do Google Calendar valida token de forma condicional
**Arquivo:** `web/src/app/api/webhooks/google-calendar/route.ts:50`
```js
if (channelToken && channelToken !== conn.trainer_id) { ... ignora ... }
```
Se o header `X-Goog-Channel-Token` vier **ausente**, a checagem é pulada e o sync prossegue.
**Cenário:** quem conhecer um `watch_channel_id` (UUID aleatório do Google) consegue **disparar um
re-sync** do calendário do treinador sem fornecer token. Impacto baixo: o endpoint **não retorna**
dados do calendário (só agenda sync server-side), e o channel_id é difícil de adivinhar.
**Correção:** exigir `channelToken` presente E igual a `conn.trainer_id` (rejeitar quando ausente).

---

## 3. Edge Functions (Supabase)

### 3.1 [OK] Padrão de autorização correto nas funções privilegiadas
`reset-student-password` e `create-student` seguem o padrão seguro:
1. Cria `userClient` com a **anon key** + JWT do chamador → `getUser()` valida identidade.
2. Cria `adminClient` **separado** com `service_role` (sem header de usuário) para operações admin.
3. **Valida propriedade** antes de agir:
   - `reset-student-password/index.ts:74` — `if (student.coach_id !== trainer.id) → 403`.
   - `create-student/index.ts:102` — `coach_id: trainer.id` forçado (sem mass assignment do tenant).

Funções `dispatch/extend-scheduled-notifications`, `send-push-notification`, `oura-*`,
`renew-google-watch-channels` rodam server-side com `service_role` e são acionadas por cron/webhook
(`verify_jwt=false` documentado nas migrations 108/154). As `oura-*` que recebem chamada do usuário
(`oura-sync`, `oura-disconnect`, `oura-oauth-exchange`) validam o JWT via `admin.auth.getUser(jwt)`.
**Exceção que NÃO está OK:** `send-push-notification` não valida nenhum secret/assinatura
internamente e o trigger da migration 098 a chama sem header de Authorization — com
`verify_jwt=false` ela aceita POST anônimo de qualquer origem (spam de push). Achado classificado
como **CRÍTICO no relatório 02-backend §3** (mantido lá por ser infra de backend; registrado aqui
para a leitura de segurança não passar batida).

### 3.2 [Baixo] Senha gerada e devolvida em claro no corpo da resposta
`create-student/index.ts:71-74` e `reset-student-password/index.ts:90-93` geram 8 bytes aleatórios
(~64 bits, base64url) e **retornam a senha no JSON** para o treinador repassar ao aluno. É o fluxo
de produto intencional (aluno não faz self-signup). Entropia adequada e transporte HTTPS. Ressalva
de produto, não de código: a senha trafega para a UI e pode acabar em logs/print/WhatsApp. Aceitável,
mas considere forçar troca no primeiro login.

### 3.3 [Baixo] `create-student` sem rate limit
Um treinador autenticado pode chamar `create-student` em loop e criar muitos `auth.users` +
`students`. Sem limite, é vetor de abuso de recurso (e custo no GoTrue). Baixa prioridade (exige
conta de treinador válida com assinatura). Considere um teto por treinador/dia.

---

## 4. Segredos

### 4.1 [OK] Chaves Asaas cifradas em repouso (AES-256-GCM)
`web/src/lib/asaas/encryption.ts` — AES-256-GCM, IV de 12 bytes aleatório por registro, authTag de
16 bytes, chave de 32 bytes derivada de `ASAAS_ENCRYPTION_KEY` (valida tamanho). Layout
`[iv|tag|ciphertext]` em BYTEA. Implementação correta.

### 4.2 [OK] Sem segredos versionados / sem chaves hardcoded
- `git ls-files | grep .env` → **vazio**; `.gitignore` cobre `.env`, `.env.*`, `*.env`.
- Único arquivo "sensível" rastreado: `mobile/google-services.json.example` (template, sem segredo
  real).
- Busca por `sk_live_`/`sk_test_`/`sk-…`/JWT `eyJ…` em `web/src`, `mobile/src`, `shared` → nada.
- Variáveis públicas conferidas e **todas legítimas**: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`,
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`;
  `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`, `EXPO_PUBLIC_WEB_URL`, `EXPO_PUBLIC_EAS_PROJECT_ID`. Nenhum
  `SERVICE_ROLE`/`STRIPE_SECRET`/`ASAAS_*`/`OPENAI`/`ANTHROPIC` exposto via `*_PUBLIC_*` ou em
  `app.json`/`eas.json`.

### 4.3 Tokens OAuth em texto puro — ver §1.2 (Google, Médio) e §1.3 (Oura, Baixo).

---

## 5. Autenticação

### 5.1 [OK] `bcryptjs` usado corretamente
- `web/src/actions/api-keys/generate-api-key.ts` — gera a API key do treinador e **armazena o hash
  bcrypt** (`key_hash`), guardando só o prefixo em claro.
- `web/src/lib/mcp/auth.ts:41` — `bcrypt.compare(token, key.key_hash)` na validação. Uso correto
  (segredo de alta entropia, hash em repouso).

### 5.2 [OK] OAuth 2.1 do MCP com PKCE
`oauth/token/route.ts` valida `code_verifier` contra `code_challenge`
(`base64url(sha256(code_verifier))`), suporta `authorization_code` + `refresh_token`,
`token_endpoint_auth_method: none` (cliente público + PKCE, correto para o padrão MCP).

### 5.3 [OK] Sessão mobile no keychain; signup web endurecido
Conforme mapa: signup web com honeypot + Turnstile + rate-limit + HIBP + blocklist de domínio
(trigger em `auth.users`, 118/119). Token mobile no keychain. Sem self-signup de aluno.

---

## 6. Integrações de IA / MCP

### 6.1 [OK] Assistente da dashboard resistente a prompt injection
`web/src/app/api/assistant/chat/route.ts`:
- `role` forçado para `'user'|'assistant'` (linha 68) — bloqueia injeção de `role:'system'`.
- Conteúdo clampado a `MAX_MESSAGE_CHARS=8000` e array a `MAX_MESSAGES=50` (anti-custo).
- `resolveStudentId` valida **propriedade** tanto no caminho UUID quanto no nome
  (`.eq('coach_id', trainer.id)`, linhas 93/101) → uma tool-call injetada com UUID de aluno de outro
  treinador é rejeitada. Excelente.
- Rate limit por treinador (15/min, 300/dia) — mas ver §6.4.

### 6.2 [OK] Tools do MCP escopadas por `trainerId`
Todas as 17 famílias de tools (`web/src/lib/mcp/tools/*`) filtram por `trainerId` derivado do token
autenticado (`coach_id`/`trainer_id`). Os write-tools verificam propriedade antes de mutar:
`workouts-write.ts:127-176` tem helpers `verify…Ownership` que checam a cadeia
session→program→trainer; `programs-write`, `students-write`, `messages`, `billing` filtram por
`trainerId`/`coach_id` em todo update/delete/insert. Como o MCP usa `supabaseAdmin` (bypassa RLS), o
escopo por tenant é **manual** — o padrão está correto e consistente na amostra; recomendo um teste
automatizado de propriedade (ver §8).

### 6.3 [OK] MCP: autenticação, gate de assinatura, anti-DNS-rebinding, DCR controlado
`lib/mcp/auth.ts`: OAuth token (sha256) **ou** API key (bcrypt), checa assinatura ativa
(`active`/`trialing`) → 403 se inativa, rate-limit por key. `api/mcp/route.ts:35-57` allowlist de
Origin (anti DNS-rebinding); só `initialize`/`tools/list` são públicos (catálogo não sensível) —
`tools/call` exige auth. `oauth/register` (DCR aberto por design do MCP) tem rate-limit por IP
(5/min, 50/dia) e valida `redirect_uris` (só https/localhost). Postura sólida.

### 6.4 [Médio] Rate limiting in-memory é ineficaz em serverless (Vercel)
**Arquivo:** `web/src/lib/rate-limit.ts:1-9` — *"Simple in-memory sliding window... Suitable for
single-server Next.js deployments."* O store é um `Map` em memória do processo.
**Problema:** o web roda na Vercel (serverless/edge), com **múltiplas instâncias efêmeras**. Cada
invocação pode cair em um worker diferente, e o estado se perde a cada cold start. Logo, os limites
de `assistant/chat` (15/min), MCP (30/min), `oauth/register` (5/min) e o rate-limit do signup são
**facilmente contornáveis** (basta distribuir requests entre instâncias) e não duráveis.
**Cenário:** abuso de custo no LLM (chat/prescrição) e brute-force/DB-fill no DCR, ultrapassando os
tetos pretendidos porque o contador não é compartilhado.
**Correção:** mover o rate-limit para um store compartilhado (Upstash Redis/`@vercel/kv`, ou uma
tabela Postgres com janela deslizante via `service_role`). É defesa de custo/abuso, não de
confidencialidade — daí Médio.

### 6.5 [Baixo] Dados do aluno entram no contexto do LLM
`buildChatContext` e `enrichStudentContext` injetam nome/progressão/insights do aluno no prompt
(esperado para a função). Como o contexto é montado **server-side e filtrado por `trainer.id`**, não
há vazamento cross-tenant. O risco residual é conteúdo do próprio aluno (ex.: nome/observações)
conter instruções que o modelo siga — mitigado por `maxSteps:3`, tools com parâmetros tipados e
ownership revalidada em cada tool. Aceitável; sem ação obrigatória.

---

## 7. Dependências (npm audit)

### 7.1 [Alto — runtime] Web: `next` com múltiplos CVEs, incluindo **bypass de middleware/proxy**
`audit-web.txt`: `next` (HIGH) acumula vários advisories, e os mais relevantes para o Kinevo são os
de **Middleware/Proxy bypass** (GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv) e
**cache poisoning de RSC** (GHSA-vfv6/GHSA-wfc6) — porque a **autenticação do app depende do
middleware** (`updateSession` redireciona não-autenticados). Um bypass de middleware poderia, em
teoria, alcançar rotas protegidas sem cookie. Também há DoS (Image Optimization, Server Components) e
SSRF via WebSocket upgrade.
**Explorabilidade:** depende da versão exata instalada (CLAUDE.md cita Next 16.1.6) e de quais
correções já entraram; vários desses advisories têm fix em patch. **Há `fix available via npm audit
fix`** (não-breaking).
**Correção:** rodar `npm audit fix` no workspace web (atualiza `next`, `fast-uri`, `postcss`, `ws`,
`brace-expansion` sem breaking change) e validar build. Não rodar `--force` (puxaria `ai@6`, breaking).

### 7.2 [Alto — transitivo] `fast-uri` (path traversal / host confusion) — web e mobile
GHSA-q3j6 / GHSA-v39h. Transitivo (via toolchain de validação/JSON schema). Baixa probabilidade de
caminho explorável direto na app, mas tem fix não-breaking → incluir no `npm audit fix`.

### 7.3 [Moderado] `@ai-sdk/*` / `ai` (DoS por consumo de recurso) + `jsondiffpatch` XSS — web
GHSA-866g (provider-utils) e GHSA-33vc (jsondiffpatch). O fix exige `ai@6.0.199` (**breaking** —
o web está no AI SDK 4.x). Avaliar upgrade planejado; o XSS do jsondiffpatch só afeta o HtmlFormatter
(provavelmente não usado em runtime de produção). Não bloquear, mas agendar.

### 7.4 [Crítico/Alto — somente build/dev] Mobile: `shell-quote` (CRITICAL), `@xmldom/xmldom` (HIGH)
`audit-mobile.txt`: a CRITICAL (`shell-quote`, GHSA-w7jw) e a maioria das HIGH (`@xmldom/xmldom`,
`@expo/plist`, `@bacons/xcode`) vêm **exclusivamente do toolchain do Expo** (`@expo/cli`,
`config-plugins`, `prebuild-config`, `metro-config`). Esses pacotes **não são empacotados no binário
do app** — só rodam em build/prebuild local/CI.
**Avaliação de risco real:** **baixo** no produto enviado ao usuário; relevante apenas se um atacante
controlar inputs do processo de build (ex.: nomes de arquivos/manifests maliciosos no CI). As
HIGH/CRITICAL **não são exploráveis pelo app em produção**. `npm audit fix` resolve `shell-quote`,
`@xmldom/xmldom`, `fast-uri`, `ws`, `brace-expansion` sem breaking; `uuid`/`postcss` exigiriam
`expo@56` (breaking) — adiar.

**Resumo dependências:** o número assustador do mobile (1 critical/4 high) é quase todo dev-time. O
ponto que merece ação **runtime** é o `next` no web (auth depende de middleware). Rodar `npm audit
fix` (não-force) em web e mobile fecha a maioria sem quebrar nada.

---

## 8. O que verifiquei e está OK (para confiança)

- **Matcher do middleware**: todas as ~50 rotas fora do matcher autenticam Bearer/CRON/assinatura.
  Nenhuma rota órfã sem auth.
- **IDOR**: rotas sensíveis (cancel-subscription, students/access, student/payment, wallet/*)
  validam propriedade por `coach_id`/`student_id`.
- **Webhooks**: Stripe (assinatura), Asaas (shared-secret timing-safe), idempotência em
  `webhook_events`.
- **Edge functions**: separação correta userClient(anon+JWT) × adminClient(service_role); checagem de
  `coach_id` antes de operar; cron com `verify_jwt=false` documentado.
- **Segredos**: nenhum `.env` versionado; nenhuma chave hardcoded; nenhum service_role/secret em
  `*_PUBLIC_*` ou `app.json`/`eas.json`. Chaves Asaas cifradas (AES-256-GCM).
- **Auth**: bcrypt para API keys; PKCE no OAuth do MCP; signup web com Turnstile/HIBP/blocklist;
  `x-user-id` saneado no middleware.
- **IA/MCP**: prompt injection mitigada (role forçado, ownership revalidada); tools escopadas por
  `trainerId`; gate de assinatura; allowlist de Origin; DCR com rate-limit + validação de redirect.
- **RLS**: todas as tabelas com RLS habilitado; `trainer_notifications` INSERT já corrigido (101);
  camadas restritivas 162/177 presentes; `search_path` corrigido em massa em 077 (exceto as 6 de §1.4).
- **Migrations duplicadas (092/133/145/168)**: são pares de arquivos com **nomes/objetos distintos**
  (ex.: `092_student_objective_tags` vs `092_trainer_exercise_videos`) — não se sobrescrevem; o risco
  é apenas de **ordenação/drift** (mesmo prefixo numérico), não de segurança. Sem conflito de policy
  observado.

## 9. Verificações que exigem banco/produção (não dá para concluir por análise estática)

1. **Conta QA em produção** `qa-teste-kinevo@example.com` (trainer `b7787ab5-…`): confirmar se foi
   removida (pendência herdada do comparativo). Exige query no banco.
2. **Teste cross-tenant real via signup** (auditoria RLS de mai/2026 deixou B/C pendentes): criar 2
   treinadores + 2 alunos e tentar leitura/escrita cruzada em cada tabela. Não reproduzível
   estaticamente.
3. **Privilégio `CREATE` no schema `public`** para `authenticated`/`anon`: se estiver revogado (default
   Supabase), o risco de §1.4 (search_path) é praticamente nulo; se aberto, sobe para Médio. Verificar
   com `\dn+` / `has_schema_privilege`.
4. **Exposição efetiva dos tokens do Google (§1.2)**: confirmar via PostgREST com sessão de treinador
   se `select access_token from google_calendar_connections` retorna o valor (esperado: sim, pela
   policy).
5. **Ownership exaustivo dos write-tools do MCP**: revisão estática cobriu a amostra; um teste de
   integração (API key do treinador A tentando mutar recurso do treinador B) fecharia 100%.
6. **Advisors do Supabase** (`get_advisors security`) e versão exata do `next` em prod para casar com
   os CVEs de §7.1.

---

### Anexo — Achados Crítico/Alto/Médio (condensado)

| Sev | Achado | Local |
|---|---|---|
| Alto | `next` com CVEs de bypass de middleware (auth depende dele) + SSRF/DoS; fix não-breaking disponível | `audit-web.txt` |
| Alto | `fast-uri` path traversal (web+mobile, transitivo); fix não-breaking | `audit-{web,mobile}.txt` |
| Médio | Tokens OAuth do Google em texto puro **e** legíveis pelo treinador via RLS (XSS/dump → takeover do calendário) | `migrations/109:22-24,83-85` |
| Médio | Rate limit in-memory ineficaz em serverless → abuso de custo LLM / bypass do DCR | `lib/rate-limit.ts:1-9` |
| Médio/Baixo | 6 funções SECURITY DEFINER pós-077 sem `SET search_path` | `migrations/086,094,098,099` |
| Baixo | Tokens de wearables (Oura) em texto puro (atrás de service_role) | `migrations/153:75-90` |
| Baixo | Webhook Google: token pulado quando ausente → re-sync forçável com só channel_id | `api/webhooks/google-calendar/route.ts:50` |
| Baixo | `create-student` sem rate limit (mass-create de auth users) | `functions/create-student/index.ts` |
| Info | mobile CRITICAL `shell-quote` + HIGH `xmldom` são dev/build-time, fora do binário | `audit-mobile.txt` |
