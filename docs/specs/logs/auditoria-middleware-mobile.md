# Auditoria — Middleware × Rotas Mobile-First

Data: 2026-04-20. Executor: Claude Code (Opus 4.7). Sessão: **somente leitura e análise**. Nenhum arquivo de código foi alterado.

Contexto: a Fase 2.5.1 (log em [fase-2.5.1-execucao.md](fase-2.5.1-execucao.md) §4) revelou que `api/prescription/generate` nunca funcionou em produção via mobile porque o middleware cookie-based interceptava o `fetch` Bearer com HTTP 307 → `/login`, e o `response.json()` do cliente mobile explodia silenciosamente com `SyntaxError` ao receber HTML. Esta auditoria mapeia **toda** a superfície de rotas sob [web/src/app/api/](../../../web/src/app/api/) e identifica outras rotas com o mesmo padrão.

---

## §1. Resumo executivo

- **39 route handlers** enumerados sob [web/src/app/api/](../../../web/src/app/api/).
- **Mobile consome 15 endpoints distintos** (grep de `fetch.*'/api/'` em `mobile/`).
- **3 bugs confirmados** (rotas Bearer-only consumidas pelo mobile, fora da whitelist do middleware): [`/api/programs/assign`](../../../web/src/app/api/programs/assign/route.ts), [`/api/messages/notify-trainer`](../../../web/src/app/api/messages/notify-trainer/route.ts), [`/api/stripe/portal`](../../../web/src/app/api/stripe/portal/route.ts) (branch mobile Bearer).
- **1 endpoint fantasma**: mobile chama `/api/messages/notify-student` ([mobile/hooks/useTrainerChatRoom.ts:119](../../../mobile/hooks/useTrainerChatRoom.ts#L119)), mas o handler **não existe** no web. Caller absorve o erro com `.catch(() => {})`. Feature de "push ao aluno quando trainer envia mensagem" não funciona em produção.
- **0 bugs inversos** (nenhuma rota cookie-based está erroneamente na whitelist).
- **1 inconsistência** entre o matcher em [web/src/middleware.ts:28](../../../web/src/middleware.ts#L28) e a cadeia de `!pathname.startsWith(...)` em [web/src/lib/supabase/middleware.ts:41-54](../../../web/src/lib/supabase/middleware.ts#L41-L54): o matcher exclui `api/financial` e `api/notifications`, mas o `updateSession` não. Ok na prática (matcher impede execução), mas quebra se o matcher mudar sem sincronizar o corpo da função. ✅ **Endereçado na [Fase 2.5.3](fase-2.5.3-execucao.md) — Etapa 1.**

---

## §2. Tabela completa

Legenda categorias:
- **A** = Bearer (mobile-first): lê `Authorization: Bearer <jwt>` via `supabaseAdmin.auth.getUser(token)` ou `createClient(..., { global: { headers: { Authorization } } })`.
- **B** = Cookies (web-first): usa `createClient()` de `@/lib/supabase/server`.
- **C** = Pública/webhook: sem auth de usuário (CRON_SECRET, stripe-signature).
- **D** = Ambígua: aceita Bearer **e** cookies.

Coluna **WL** = está na whitelist do middleware matcher ([middleware.ts:28](../../../web/src/middleware.ts#L28)). Coluna **Deveria?** = baseado na categoria, o comportamento desejado.

| Path | Cat. | WL? | Deveria? | Status |
|---|---|---|---|---|
| `/api/assistant/chat` | B | ❌ | ❌ | ✅ ok |
| `/api/cron/check-manual-overdue` | C | ✅ | ✅ | ✅ ok |
| `/api/cron/check-push-receipts` | C | ✅ | ✅ | ✅ ok |
| `/api/cron/expire-programs` | C | ✅ | ✅ | ✅ ok |
| `/api/cron/generate-insights` | C | ✅ | ✅ | ✅ ok |
| `/api/cron/process-form-schedules` | C | ✅ | ✅ | ✅ ok |
| `/api/cron/process-push` | C | ✅ | ✅ | ✅ ok |
| `/api/financial/cancel-contract` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/checkout-link` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/create-contract` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/mark-paid` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/plans/create` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/plans/delete` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/plans/toggle` | A | ✅ | ✅ | ✅ ok |
| `/api/financial/stripe-status` | A | ✅ | ✅ | ✅ ok |
| `/api/messages/notify-trainer` | A | ❌ | ✅ | 🔴 **BUG confirmado** |
| `/api/messages/notify-student` | — | ❌ | — | ⚠️ **endpoint fantasma** (mobile chama, web não implementa) |
| `/api/notifications/flush-pending` | A | ✅ | ✅ | ✅ ok |
| `/api/notifications/flush-student-pending` | A | ✅ | ✅ | ✅ ok |
| `/api/notifications/preferences` | A | ✅ | ✅ | ✅ ok |
| `/api/notifications/register-token` | A | ✅ | ✅ | ✅ ok |
| `/api/prescription/generate` | A | ✅ | ✅ | ✅ ok (corrigido na 2.5.1) |
| `/api/prescription/parse-text` | B | ❌ | ❌ | ✅ ok |
| `/api/programs/assign` | A | ❌ | ✅ | 🔴 **BUG confirmado** |
| `/api/reports/[id]/notes` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/cancel-subscription` | A | ✅ | ✅ | ✅ ok |
| `/api/stripe/checkout` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/balance` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/checkout` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/dashboard` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/onboard` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/status` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/connect/sync-contracts` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/portal` | D | ❌ | ✅ (para branch Bearer) | 🔴 **BUG confirmado** (branch mobile) |
| `/api/stripe/sync` | B | ❌ | ❌ | ✅ ok |
| `/api/stripe/webhook` | C | ✅ | ✅ | ✅ ok |
| `/api/trainer-notifications` | B | ❌ | ❌ | ✅ ok |
| `/api/trainer-notifications/mark-read` | B | ❌ | ❌ | ✅ ok |
| `/api/webhooks/stripe` | C | ✅ | ✅ | ✅ ok |
| `/api/webhooks/stripe-connect` | C | ✅ | ✅ | ✅ ok |

**Totais:** 39 rotas enumeradas · Categoria A = 14 · B = 13 · C = 9 · D = 1 · fantasma = 1. Whitelist atual cobre 20 rotas (corretamente), deixa de cobrir 3 que deveriam estar.

---

## §3. Bugs confirmados

> **Status pós-[Fase 2.5.3](fase-2.5.3-execucao.md) (2026-04-20):** os 4 bugs desta seção tiveram seu componente de middleware endereçado. Whitelist aplicada em [middleware.ts:28](../../../web/src/middleware.ts#L28) e [lib/supabase/middleware.ts:49-58](../../../web/src/lib/supabase/middleware.ts#L49-L58). Validação `401 ≠ 307` confirmada em 4 rotas. **Um bug adicional de contrato descoberto em `programs/assign` foi encaminhado para a Fase 2.5.4** (ver [2.5.3 §4.3](fase-2.5.3-execucao.md#43-handler-bearer-real--programsassign-bug-de-contrato-descoberto)). Histórico original preservado abaixo.

### 3.1 `/api/programs/assign` — Categoria A fora da whitelist
✅ **Contrato reconciliado + resiliente a snapshot ruim** ([Fase 2.5.4](fase-2.5.4-execucao.md)). Middleware endereçado na 2.5.3 (whitelist aplicada); contrato reconciliado na 2.5.4 (handler aceita `generationId` com helper `assignFromSnapshot`); funil mobile end-to-end fechado via Bearer JWT. Fix defensivo contra snapshot inválido (substitutos não-UUID + `exercise_id` ghost) encaminhou 2 bugs latentes do pipeline de geração como follow-up §6.5 da 2.5.4.


- **Arquivo:** [web/src/app/api/programs/assign/route.ts](../../../web/src/app/api/programs/assign/route.ts) (linhas 19-30 extraem Bearer token).
- **Consumidor mobile:** [mobile/app/student/[id]/prescribe.tsx:155](../../../mobile/app/student/[id]/prescribe.tsx#L155), função `handleApprove` — chamada quando o trainer aprova uma prescrição gerada por IA no mobile.
- **Feature quebrada:** **aprovar e atribuir programa IA-gerado via mobile**. O fluxo completo do mobile é: gerar via `/api/prescription/generate` (funciona desde 2.5.1) → usuário vê preview → clica "Aprovar" → chama `/api/programs/assign` → **redirect 307 para `/login`** → `response.json()` na linha 169 tenta parsear HTML → lança SyntaxError → caught em linha 175 → `Alert.alert("Erro", "Falha ao atribuir programa")`.
- **Dano:** trainers que geraram prescrição pelo mobile têm a geração persistida em `prescription_generations` mas **nunca conseguem atribuir o programa ao aluno**. Feature ficou parcialmente funcional a partir da 2.5.1 — `/generate` voltou, `/assign` continua morto. Correlato do bug original da 2.5.1, mas um degrau depois no funil.
- **Probabilidade:** **certa**. Mesmo padrão exato da `/generate`. Já reproduzível.

### 3.2 `/api/messages/notify-trainer` — Categoria A fora da whitelist
✅ **Endereçado na 2.5.3** (whitelist aplicada).


- **Arquivo:** [web/src/app/api/messages/notify-trainer/route.ts](../../../web/src/app/api/messages/notify-trainer/route.ts) (linhas 13-27 validam Bearer via `supabase.auth.getUser(token)`).
- **Consumidor mobile:** [mobile/hooks/useTrainerChat.ts:274](../../../mobile/hooks/useTrainerChat.ts#L274) e usos em [useTrainerChat.ts:180](../../../mobile/hooks/useTrainerChat.ts#L180) e [:241](../../../mobile/hooks/useTrainerChat.ts#L241). Chamado quando aluno envia mensagem para o trainer (texto ou imagem).
- **Feature quebrada:** **push notification ao trainer quando aluno envia mensagem**. O `fetch` é fire-and-forget com `.catch(() => {})` (linha 180, 241 do hook), então o erro é completamente silencioso. Trainer não recebe push; só vê a mensagem se abrir o app manualmente ou tiver o chat aberto via Realtime subscription.
- **Dano:** **silencioso mas significativo**. Trainers perdem latência de resposta. Piora o produto sem gerar alerta. Se houver relato ("alunos reclamam que treinador nunca responde rápido"), vem daqui. Também cria pressão para manter o trainer na `training-room` com o app sempre aberto.
- **Probabilidade:** **certa**. Mesmo padrão da 3.1.

### 3.3 `/api/stripe/portal` — Categoria D, branch Bearer quebrado
✅ **Endereçado na 2.5.3** (whitelist aplicada; ambos branches preservados).


- **Arquivo:** [web/src/app/api/stripe/portal/route.ts](../../../web/src/app/api/stripe/portal/route.ts) (linhas 10-22 tentam Bearer, senão caem em cookie).
- **Consumidor mobile:** [mobile/app/(trainer-tabs)/more.tsx:136](../../../mobile/app/(trainer-tabs)/more.tsx#L136) — "Gerenciar assinatura" abre o Stripe Billing Portal.
- **Feature quebrada:** **gerenciar assinatura pelo mobile**. O middleware intercepta **antes** da route chegar — a lógica de aceitar Bearer nem é executada, pois o redirect 307 acontece no passo anterior.
- **Dano:** trainers no mobile não conseguem cancelar, ver invoices ou atualizar método de pagamento pelo app. Provavelmente tem workaround via browser/web, então impacto moderado — mas dado que [`/api/stripe/cancel-subscription`](../../../web/src/app/api/stripe/cancel-subscription/route.ts) (só Bearer) está corretamente whitelisted, a inconsistência em `portal` é aberrante e confirma o padrão "adicionada uma por uma conforme o problema aparecia".
- **Probabilidade:** **certa**. Mesmo padrão.

### 3.4 `/api/messages/notify-student` — Endpoint fantasma
✅ **Endereçado na 2.5.3** — handler criado ([web/src/app/api/messages/notify-student/route.ts](../../../web/src/app/api/messages/notify-student/route.ts)) + 11 testes unitários + whitelist aplicada. `.catch(() => {})` do caller mobile agora loga em `__DEV__`.


- **Arquivo:** **não existe**. `find web/src/app/api/messages -name 'route.ts'` retorna apenas `notify-trainer`.
- **Consumidor mobile:** [mobile/hooks/useTrainerChatRoom.ts:119](../../../mobile/hooks/useTrainerChatRoom.ts#L119). Comentário explícito na linha 118: `// TODO: Create /api/messages/notify-student endpoint if it doesn't exist`.
- **Feature quebrada:** **push notification ao aluno quando trainer envia mensagem**. Caller absorve erro com `.catch(() => {})` na linha 127-129 do mesmo arquivo (`if (__DEV__) console.error(...)`).
- **Dano:** simétrico ao 3.2 mas em sentido inverso. Alunos não recebem push quando o trainer responde. Reduz engajamento com o chat, efeito cumulativo sobre retenção. Comportamento provavelmente não notado porque o Realtime subscription do chat cobre o caso de "aluno já com app aberto".
- **Categoria diferente dos bugs 3.1-3.3:** este não é um bug de middleware — é uma feature incompleta. Entra na auditoria porque o sintoma para o usuário é idêntico (notificação silenciosamente não chega) e o mobile já está codificado contra o endpoint. A correção aqui envolve **criar** o handler (espelhado de `notify-trainer`, adaptando `coach_id` → `student.id` e usando `sendStudentPush`), **e** depois adicionar à whitelist.

---

## §4. Bugs suspeitos (sem consumidor mobile direto)

**Nenhum identificado.** Após a classificação, toda rota categoria A está ou na whitelist (13 rotas) ou na lista de bugs confirmados (3 rotas). Não há rota categoria A órfã — sem consumidor mobile mas potencialmente esperando Bearer de outro cliente (ex: tooling externo, integração B2B futura).

Nota: `/api/prescription/generate` também é categoria A e está na whitelist — corrigido na 2.5.1.

---

## §5. Bugs inversos (na whitelist mas categoria B)

**Nenhum identificado.** Todas as 20 rotas excluídas pelo matcher são categoria A (14: financial/* e notifications/* e prescription/generate e stripe/cancel-subscription) ou C (9: cron/* e webhooks/stripe e stripe/webhook — hum, stripe/cancel-subscription é A, recontando: A = 11 na whitelist, C = 9. Total = 20 ✓). Nenhuma rota cookie-based está sendo servida sem o refresh de sessão do `updateSession`.

Portanto, o risco "sessão expira sem ser detectada" não se materializa no estado atual.

---

## §6. Inconsistências entre matcher e updateSession

[web/src/middleware.ts:28](../../../web/src/middleware.ts#L28) — matcher exclui:
```
api/webhooks, api/stripe/webhook, api/stripe/cancel-subscription,
api/cron, api/financial, api/notifications, api/prescription/generate
```

[web/src/lib/supabase/middleware.ts:41-55](../../../web/src/lib/supabase/middleware.ts#L41-L55) — cadeia `!pathname.startsWith(...)` exclui:
```
/api/webhooks, /api/stripe/webhook, /api/stripe/cancel-subscription,
/api/cron, /api/prescription/generate
```

**Delta:** `api/financial` e `api/notifications` estão no matcher mas **ausentes** na cadeia `!pathname.startsWith(...)`.

**Efeito prático atual:** nenhum. O matcher é avaliado pelo Next.js *antes* de chamar o middleware, então para requests a `/api/financial/*` e `/api/notifications/*` a função `updateSession` nunca roda, e a condição interna é irrelevante.

**Efeito em caso de regressão:** se alguém simplificar o matcher para `'/((?!_next/...).*)'` (o padrão "match tudo") achando que a lógica toda está em `updateSession`, os paths `api/financial/*` e `api/notifications/*` passam a ser redirecionados para `/login`. Volta o bug da 2.5.1, mas agora afetando 11 rotas de uma vez.

**Recomendação:** manter as duas listas **idênticas** como invariante. Qualquer fix estrutural (§8) deve unificar em uma única fonte de verdade.

---

## §7. Recomendação priorizada de fix

Ordem final (revista após discussão — razão em §7.1):

| Ordem | Ação | Justificativa |
|---|---|---|
| **1** | `/api/programs/assign` — add à whitelist | Completa o funil da 2.5.1. Sem esta, gerar IA pelo mobile ainda mata no passo final. Alto dano, alta visibilidade. |
| **2** | `/api/messages/notify-student` — **criar handler** (clone simétrico de `notify-trainer`) + add à whitelist | Dual do #3. Criar primeiro dá visibilidade pra bug em #3. |
| **3** | `/api/messages/notify-trainer` — add à whitelist | Trivial após #2 estar pronto. **Agrupar deploy de #2 e #3** evita janela de experiência assimétrica (se trainer é consertado primeiro, aluno continua sem push até o próximo deploy → loop de comunicação fica torto). |
| **4** | `/api/stripe/portal` — add à whitelist | Menor volume. Usuário tem workaround (abrir no navegador). |
| **5** | §6: sincronizar `lib/supabase/middleware.ts` com matcher (adicionar `api/financial` e `api/notifications`). 2 linhas, zero risco. Commit separado no início ou final do pacote. |

Além disso, no mesmo pacote, trocar os 3 `.catch(() => {})` silenciosos em [mobile/hooks/useTrainerChat.ts:180](../../../mobile/hooks/useTrainerChat.ts#L180), [:241](../../../mobile/hooks/useTrainerChat.ts#L241) e [mobile/hooks/useTrainerChatRoom.ts:106](../../../mobile/hooks/useTrainerChatRoom.ts#L106) pelo padrão com log já usado em [useTrainerChatRoom.ts:127-129](../../../mobile/hooks/useTrainerChatRoom.ts#L127-L129):
```ts
.catch((err) => {
    if (__DEV__) console.error('[hook-name] caller-name error:', err);
});
```
Motivo: `__DEV__` é tree-shaken em release, não cresce bundle em prod, e deixa rastro em dev/Sentry. Manter o catch preserva o contrato "push fail não quebra chat" sem continuar mascarando bugs.

### §7.1 Racional da mudança de ordem (vs. proposta original)

Proposta original: assign → notify-trainer → criar notify-student → stripe/portal.

Mudança: notify-student sobe pra posição #2, notify-trainer desce pra #3. Razão: os dois formam um **par de comunicação bidirecional**. Se consertar notify-trainer primeiro, no intervalo entre deploys o trainer recebe push mas o aluno não — experiência assimétrica. Criar notify-student antes (já que é o que exige mais trabalho: código novo) e depois deployar o par junto é mais honesto operacionalmente.

### §7.2 Plano de validação por rota

- **#1 `programs/assign`:** `curl -X POST` com Bearer JWT de trainer de dev + `studentId` + `templateId` válidos → esperar HTTP 200 e `assigned_programs` row criada. Smoke E2E mobile: fluxo completo "gerar → aprovar".
- **#2 `notify-student` (novo):** `curl -X POST` com Bearer JWT de trainer + `studentId` do aluno dele + `messageContent` → esperar 200 e push recebido no device do aluno. Validar também ownership: trainer A não pode notificar aluno do trainer B (esperar 403).
- **#3 `notify-trainer`:** `curl -X POST` com Bearer JWT de aluno + `studentId` (dele mesmo) + `messageContent` → esperar 200 e push no device do trainer.
- **#4 `stripe/portal`:** `curl -X POST` com Bearer JWT de trainer com `subscriptions.stripe_customer_id` populado → esperar 200 com `url` do billing portal.
- **#5 §6:** apenas `npm test` + `npx tsc --noEmit`. Mudança é redundante por construção (matcher já exclui), então não há comportamento observável a testar — a validação é literária.

**Plano de validação por rota corrigida:**
- `programs/assign`: `curl -X POST` com Bearer JWT de um trainer de dev + `studentId` + `templateId` válidos → esperar HTTP 200 e `assigned_programs` row criada. Smoke test pelo mobile no fluxo completo "gerar → aprovar".
- `notify-trainer`: `curl -X POST` com Bearer JWT do aluno + `studentId` + `messageContent` → esperar 200 e push log. Validar em prod monitorando `trainer_notifications` após deploy.
- `stripe/portal`: `curl -X POST` com Bearer JWT de trainer com `subscriptions.stripe_customer_id` → esperar 200 com `url`.
- `notify-student` (novo): copiar de `notify-trainer`, trocar `insertTrainerNotification`/`sendTrainerPush` por equivalentes de aluno (verificar se `sendStudentPush` existe em `lib/push-notifications.ts`; se não, criar). Testar via mobile em ambos os sentidos.

---

## §8. Follow-ups estruturais

Esta auditoria encontrou 3 bugs do tipo "rota A esquecida da whitelist" em um período de ~2 fases. A taxa de recorrência sugere que a raiz do problema é **arquitetural** — whitelist manual por path é frágil. Três opções concretas a considerar (ordem de preferência pessoal: Z > X > Y):

### Opção X — Inverter polaridade da whitelist

**Mudança:** o matcher deixa de excluir rotas API e passa a **incluir apenas** o que precisa de cookies. Pages continuam cobertas por padrão (que é o uso correto do middleware cookie-based).

- **Antes** (estado atual): `api/*` está dentro do matcher, com exceções enumeradas para rotas Bearer.
- **Depois:** `api/*` está **fora** do matcher por padrão. Rotas web-first cookie-based (categoria B) voltam ao matcher explicitamente OU convertem sua auth para cookies via server action (seria a 1a escolha se for um refactor consentido).

**Prós:** elimina toda a classe de bug. Nova rota Bearer não precisa lembrar do middleware. Semanticamente correto — `updateSession` é um refresh de cookie, faz sentido rodar só onde há cookies.

**Contras:** 13 rotas categoria B (todos os `stripe/connect/*`, `trainer-notifications`, `assistant/chat`, `reports/[id]/notes`, `prescription/parse-text`, `stripe/checkout|sync`, `trainer-notifications/mark-read`) precisam ser adicionadas explicitamente, OU o refresh de cookie delas precisa mudar de mecanismo. É refactor maior que as 3 linhas de fix pontual.

### Opção Y — Convention-based por path prefix

**Mudança:** criar convenção `api/mobile/**` (Bearer) vs `api/web/**` (cookies). Matcher decide baseado no prefixo.

**Prós:** self-documenting. Impossível esquecer.

**Contras:** **breaking change em path**, afeta mobile builds em produção via OTA/store. Rotas atuais misturadas (`stripe/portal` serve ambos) precisariam ser duplicadas ou split. Alto custo, baixa reversibilidade. Nunca faria sem uma boa justificativa, nessas dimensões atuais de escopo.

### Opção Z — Opt-in por export de config no próprio arquivo

**Mudança:** cada `route.ts` declara seu modo de auth via export, e o middleware lê essa config no startup (ou em runtime com cache).

```ts
// api/prescription/generate/route.ts
export const runtime = 'bearer'
```

O middleware carrega esses exports e constrói o matcher dinamicamente. Quem edita a route define o contrato ali mesmo.

**Prós:** co-localização da decisão com o código. Impossível escrever nova rota Bearer sem marcar. Zero esquecimento. Mais próximo de idiomas Next.js (similar a `export const dynamic`, `export const maxDuration`).

**Contras:** requer build-time scan ou startup scan. Next.js não suporta isso out-of-the-box no `middleware.ts` — matcher é estático. Pode ser contornado com um gerador (`scripts/generate-middleware-config.ts` rodando no `prebuild`) que lê os exports e cria o matcher. Um pouco de ferramentaria, mas contida.

**Escolha recomendada:** Opção Z se houver apetite para 1-2 dias de ferramentaria; Opção X como plano B pragmático. Opção Y descartada.

### Follow-ups táticos não-estruturais

- **Vitest para route handlers Bearer** — já levantado no log da 2.5.1 §5.3 ("barra atingida"). Um teste mínimo que faz `fetch()` sem Authorization e asserta 401 (não redirect 307) exercita o contrato "middleware respeita Bearer" no CI. Cobrir as 14 rotas A (as 11 corretas + as 3 fixadas) elimina regressões silenciosas.
- **Lint rule custom**: se uma `route.ts` importar `supabaseAdmin.auth.getUser` ou `createClient` de `@supabase/supabase-js` (não de `@/lib/supabase/server`), checar que seu path está na whitelist. Difícil de implementar em ESLint puro (exige cross-file), mas viável como script Node rodando no CI.
- **Smoke test E2E mobile pós-deploy** — mínimo "login + generate + assign + send message" rodando pelo menos 1x por deploy, idealmente via GitHub Actions com device virtual. Pega os 3 bugs desta auditoria na próxima recorrência.

---

## Apêndice — Comandos usados

```bash
find web/src/app/api -name 'route.ts' -type f | sort
# 39 resultados

grep -rn "fetch.*['\"]/api/" mobile/ --include='*.ts' --include='*.tsx'
# 15 endpoints distintos chamados pelo mobile

grep -rn "authorization|createClient.*lib/supabase/server|supabaseAdmin\.auth\.getUser" web/src/app/api/
# categorização A/B por arquivo
```

Contagem final: 39 rotas, 14 categoria A (11 ok + 3 buggy), 13 categoria B (todas ok), 9 categoria C (todas ok), 1 categoria D (branch Bearer buggy), 1 endpoint fantasma. Zero edições aplicadas.
