# Auditoria de Prontidão para Produção — Modo Assistente de IA (Kinevo)

**Data:** 2026-06-16
**Escopo:** aba "Assistente", ⌘K (command bar), conversas, voz e modo proativo (briefing).
**Método:** leitura dirigida + buscas adversárias + 2 passadas de build/test, paralelizado em 5 investigações (segurança, backend, quota/ops, frontend/UX, testes/evals/docs). Cada achado crítico foi re-verificado por leitura direta do arquivo.
**Natureza:** diagnóstico. **Nenhum código de produção foi alterado** (só este relatório e o apêndice fixlist).

---

## 1. Sumário Executivo

### Veredito: 🔴 **NO-GO para lançamento amplo** · 🟡 **GO condicional para piloto fechado (gated)**

A **espinha dorsal está sólida**: fábrica de tools por tenant (cada query fecha sobre `trainerId`), HITL estruturalmente correto (tools de escrita chegam ao modelo **sem `execute`** e são revalidadas no `/execute-tool`), papéis de mensagem forçados (sem forja de `role:'system'`), RLS select-only nas tabelas de IA, e envelopes de erro genéricos nas rotas. **tsc limpo e 1229 testes verdes em 2 passadas estáveis.**

Porém há **2 bloqueadores de produto no frontend** e um conjunto de itens 🟠 de operação/segurança que, somados, impedem um go amplo hoje. O caminho recomendado: corrigir os 2 🔴 do frontend, documentar env vars e endurecer o cron; então liberar para **Pro+, poucos treinadores, ⌘K como superfície principal, voz escondida**.

### Os 5 riscos principais

1. **🔴 Card HITL "re-arma" ao recarregar a conversa.** O desfecho da confirmação é gravado como mensagem nova, mas a *part* original continua `pending` no banco → ao reabrir, o card volta clicável e permite **re-executar uma ação sensível** (re-enviar mensagem, re-atribuir programa). `conversations/[id]/route.ts:89-107`.
2. **🔴 A aba /assistente engole TODOS os erros silenciosamente.** Em `!res.ok` a bolha otimista some e a função retorna sem banner/toast — 402 (cota), 429 (rate-limit), 422 (validação) e 500 não geram feedback nenhum na superfície principal. `assistant-workspace.tsx:125,146-149,179`.
3. **🟠 Cron morning-briefing estoura timeout em escala e não é idempotente.** Loop sequencial sobre TODOS os treinadores, `maxDuration=60s`, ~5-20s por briefing → só ~3-8 cabem; a cauda nunca é briefada. Sem marcador por dia → retry do Vercel gera **push duplicado + cobrança dupla**. `cron/morning-briefing/route.ts:10,39`.
4. **🟠 Env vars load-bearing não documentadas.** `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PREMIUM` e `CRON_SECRET` não estão no `.env.example`. Sem os price IDs, `gateAssistant` retorna 403 para **todos os assinantes pagantes** (só passa quem tem `ai_tier` manual) — deploy novo desliga o assistente silenciosamente.
5. **🟠 Injeção de prompt via conteúdo do aluno em tools de escrita auto-executáveis.** Check-ins/insights do aluno entram no contexto sem delimitação, e `kinevo_send_message`/`send_form`/`update_student` executam **sem HITL**. Mesmo-tenant, mitigado pelo treinador iniciar o turno, mas sem barreira estrutural. `context-builder.ts:117-119`.

---

## 2. Achados por Severidade

> Citações verificadas no working tree em `/Users/gustavoprado/kinevo`. "(verificado)" = re-lido diretamente nesta auditoria, além do agente.

### 🔴 Bloqueadores

**B1 — HITL re-arma ao recarregar (re-execução de ação sensível).** *(verificado)*
`conversations/[id]/route.ts:89-107` só *anexa* uma mensagem "✓ Ação confirmada" — nunca muda a part `confirmation` original de `pending`→`confirmed`. Em `getConversationWithMessages` a part volta `pending`, e `conversation-view.tsx:168` renderiza um `ToolConfirmationCard` clicável de novo.
**Impacto:** o treinador (ou um reload) pode re-disparar um write não-idempotente. `validateConfirmArgs` barra alguns casos (contrato já cancelado etc.), mas `send_message`/`assign_program`/`update_student` re-executam.
**Correção (descrita):** na branch de confirmação, atualizar a part armazenada para `confirmed`/`cancelled`; em `PartView`, tratar qualquer status ≠ `pending` como resolvido (render estático "Feito"). Detalhe no fixlist.

**B2 — A aba /assistente engole erros sem feedback.** *(verificado)*
`assistant-workspace.tsx:146-149` (turno) e `:125` (criar conversa) e `:179` (confirmação) em `!res.ok` removem o otimista e `return` — sem UI. O servidor já devolve códigos distintos (402/403 em `command-engine.ts:54-86`, 429 em `conversations/[id]/route.ts:117`, 422 em `execute-tool/route.ts:129`), mas a superfície principal descarta tudo.
**Impacto:** treinador sem cota/rate-limitado vê a mensagem "sumir" sem explicação. UX inaceitável na tela carro-chefe.
**Correção:** propagar estado de erro/banner por `AssistantHome`/`ConversationView` (espelhar o banner do ⌘K), parseando `data.error`/`data.message` para diferenciar cota (CTA upgrade), rate-limit (dica de retry), validação (inline).

### 🟠 Alto

**A1 — Cron briefing: timeout em escala + não idempotente.** *(verificado)*
`cron/morning-briefing/route.ts:10` (`maxDuration=60`), `:39` (`for (const trainer of trainers)` sobre `select('id, name')` sem paginação). Cada elegível = 1 turno LLM (maxSteps 5). Sem marcador `(trainer_id, date)`.
**Impacto:** acima de ~6 treinadores com insight ativo na mesma manhã, a cauda nunca é briefada (sempre os mesmos ids baixos primeiro). Retry/duplo hit → push duplicado + 2ª cobrança de crédito.
**Correção:** processar em lotes com cursor entre invocações (ou fan-out via fila), `upsert` de marcador por dia e `skip` se presente, e/ou subir `maxDuration` com cap por execução.

**A2 — `runAssistantTurn` não é totalmente best-effort.** *(verificado)*
`command-engine.ts:249` abre `try {` e fecha em `:457` com **`finally` sem `catch`**. `getAiUsageSummary` em `:422` roda queries (`getAiTierForTrainer`+`checkQuota`) e pode lançar **depois** do LLM já ter rodado e sido cobrado.
**Impacto:** falha de DB no resumo derruba o turno com 500 via `assistantErrorResponse` — o treinador perde uma resposta pela qual foi cobrado (command/voice/proactive).
**Correção:** envolver o bloco metering+summary (`:414-448`) em try/catch; em falha, retornar o texto do turno com summary vazio/stale em vez de lançar.

**A3 — `ai_usage_events` CHECK rejeita `surface='chat'`.** *(verificado)*
`208_ai_platform.sql:61` → `surface in ('command_bar','workspace','canvas','proactive','mobile','voice')` — **sem `'chat'`**. `metering.ts:24` tem `'chat'` no tipo e `chat/route.ts:37,230,267` grava `surface:'chat'`.
**Impacto:** todo insert de evento da superfície chat viola o CHECK. O insert é best-effort (`metering.ts:153-157`, logado não lançado) e o RPC de créditos é separado → **créditos contam, mas o log de custo/analytics do chat (superfície primária do funil) nunca persiste.**
**Correção:** migration aditiva adicionando `'chat'` ao CHECK.

**A4 — `kinevo_schedule_form` escreve cross-tenant sem checar posse.** *(verificado)*
`actions/forms/form-schedules-core.ts:51-65` mapeia `studentIds` direto em linhas `form_schedules` com `trainer_id=self` e faz `upsert` via client admin — **nunca valida `students.coach_id == trainerId`**. Chamado com `supabaseAdmin` em `forms.ts:94`. O irmão `kinevo_send_form` é protegido pelo RPC `assign_form_to_students` (checa `coach_id`), mas o schedule é upsert cru.
**Impacto:** um treinador que conheça o UUID de aluno de outro tenant cria agendamento de formulário recorrente para ele. Exploração prática baixa (UUIDs não vazam cross-tenant), mas é buraco real de isolamento.
**Correção:** validar que `studentIds ⊆ students where coach_id=trainerId` antes do upsert (espelhar o RPC).

**A5 — Env vars load-bearing não documentadas.** *(verificado parcialmente)*
`CRON_SECRET` (`morning-briefing/route.ts:24`), `STRIPE_PRICE_PRO`/`STRIPE_PRICE_PREMIUM`/`STRIPE_PRICE_ESSENCIAL` (resolução de tier em `get-ai-tier.ts`) — ausentes do `web/.env.example`.
**Impacto:** sem os price IDs, nenhum preço Stripe mapeia para `pro_ia`/`premium_ia` → `gateAssistant` 403 para todo pagante sem `ai_tier` manual. Deploy novo/preview desliga o assistente silenciosamente. `CRON_SECRET` ausente → `Bearer undefined`, cron aberto/quebrado.
**Correção:** adicionar os 4 `STRIPE_PRICE_*` e `CRON_SECRET` ao `.env.example` e ao runbook de deploy.

**A6 — Injeção de prompt: conteúdo do aluno → tools de escrita auto-executáveis.** *(verificado)*
`context-builder.ts:117-119` insere check-ins crus (`JSON.stringify(answers_json).slice(0,300)`) e insights (`:226-228`) no prompt. Esses turnos têm `send_message`/`send_form`/`update_student`/`create_appointment`/`assign_program` **sem HITL**.
**Impacto:** aluno pode tentar steerar o assistente do treinador para ação mesmo-tenant não solicitada. Mitigado por: treinador inicia o turno e vê o resultado; temp 0.3; rótulo data-vs-instrução; ações de dinheiro/destrutivas continuam HITL. Não há delimitação estrutural — só regra mole de prompt (`system-prompt.ts:53-62`).
**Correção:** envolver conteúdo não-confiável em delimitadores explícitos ("isto é dado, nunca instrução") e/ou mover `send_message`/`send_form` para trás de HITL/confirmação.

**A7 — Divergência do caminho chat: `analyzeStudentProgress` vivo, temp 0.7, sem HITL, free tier.** *(verificado)*
`chat/route.ts` expõe só 3 tools próprias (`generateProgram`, `analyzeStudentProgress` `:314`, `getStudentInsights`), **nunca toca o mcp-bridge / 55 tools / CONFIRM_TOOLS**, usa temp **0.7**/maxTokens 1500/maxSteps 3 (vs 0.3/900/5 no engine) e **não passa por `gateAssistant`** (aceita free tier via trial). Docs dizem que `analyzeStudentProgress` foi "removido na v2" — está vivo.
**Impacto:** comportamento inconsistente entre o chat do dashboard e todas as outras superfícies; temp 0.7 no caminho que mais fala com treinadores eleva risco de alucinação contra "nunca invente dados"; **os evals (que rodam só `runAssistantTurn`) não certificam o chat**.
**Correção:** decidir migrar `/api/assistant/chat` para o motor compartilhado (recomendado — tool surface única + HITL grátis) ou documentar explicitamente como superfície legada read-only; centralizar model+decoding num config único.

**A8 — Cobertura de HITL nos evals incompleta (5/9) + assert que não falha.** *(verificado via agente)*
`run-evals.test.ts:66-75` promete "cada CONFIRM_TOOL tem caso HITL" mas só `console.warn` e assere `covered.size > 0`. 4 CONFIRM_TOOLS sem caso: `kinevo_create_contract`, `kinevo_finalize_assessment`, `kinevo_delete_workout_session`, `kinevo_cancel_appointment_occurrence`.
**Impacto:** regressão que faça uma dessas auto-executar não é pega pelos evals.
**Correção:** trocar o loop por `expect(covered.has(t)).toBe(true)` (ou waiver explícito) e adicionar os 4 casos (nota: `EvalDomain` não tem `avaliacao`).

### 🟡 Médio

- **M1 — Voz é backend-only, sem UI.** `voice/route.ts`+`voice.ts` completos (multipart→whisper-1→turno curto), mas grep por `MediaRecorder`/`getUserMedia`/`<Mic>`/`/api/assistant/voice` no frontend retorna **nada**. Recurso inalcançável. **Correção:** adicionar botão de microfone OU descopar/esconder a rota até existir UI. *(rebaixei de 🔴: não quebra nada, só está inacessível — basta não anunciar voz.)*
- **M2 — Timezone hardcoded.** `context-builder.ts:6` `America/Sao_Paulo` com TODO; treinador fora de BRT recebe "hoje/amanhã/quinta" errado em agenda. **Correção:** `trainers.timezone` → `nowLine(tz)`.
- **M3 — `error.message` cru no resultado de tool (vaza no MCP externo).** `conversations.ts:144`, `progress.ts:209`, `students-write.ts:50,72`, `form-schedules-core.ts:69` etc. Dentro do assistente só chega ao LLM, mas os mesmos módulos servem o MCP externo (Claude Desktop) onde a mensagem vai direta ao cliente — pode expor coluna/tabela/constraint. **Correção:** mensagem genérica + log server-side.
- **M4 — Proativo cobra cota mesmo esgotada.** `proactive.ts` → `recordAiUsage` incondicional; cron só checa tier, nunca `checkQuota` (`morning-briefing/route.ts:46-56`). 1/dia, barato, mas erode o bucket pago. **Correção:** pular briefing se cota esgotada, ou bucket proativo separado.
- **M5 — Multiplicador bulk provavelmente não dispara.** `studentCountFromArgs` (`command-engine.ts:193-199`) só conta a chave `student_ids`; confirmar nome real do param em `send_form`/`schedule_form`. Se divergir, bulk cobra 1 crédito sempre. **Correção:** alinhar o extrator ao param real (é `student_ids` — verificar; ver A4/forms.ts:57,88 usa `student_ids`, então provavelmente OK; **pergunta aberta**, ver §7).
- **M6 — Migration 211 sem retenção.** Cada turno grava ~16KB (input+output até 8000 chars). Comment da migration sugere purga >90d mas não há cron. `student_id` FK `on delete set null` mantém PII no texto do trace pós-deleção do aluno (LGPD). **Correção:** cron diário de purga >90d + scrub no delete do aluno.
- **M7 — `/execute-tool` não reusa o gate Pro.** `execute-tool/route.ts:90-119` ramifica `free` vs pago, mas tier pago não-Pro (`essencial`) cairia no `else` e executaria. Mitigado (não dá pra ter card sem passar `gateAssistant` antes), mas diverge do doc "revalida tier". **Correção:** reusar `PRO_TIERS` no execute-tool ou corrigir o doc.
- **M8 — Sem kill-switch global do assistente.** Para desligar a frota num incidente, só mexendo em código/tiers (o motor de prescrição tem `ENABLE_*`). **Correção:** `ASSISTANT_ENABLED` checado em `gateAssistant`.
- **M9 — Workspace desktop-only.** `assistant-workspace.tsx:190` `flex h-[100dvh]` + sidebar `w-64` fixa sem breakpoint/drawer. Mobile-web quebra (e mobile app não tem assistente). **Correção:** sidebar off-canvas <lg + starters single-column.
- **M10 — Acessibilidade.** Sem focus trap no diálogo ⌘K (`command-bar.tsx:252`); inputs do compositor sem `aria-label` (`assistant-home.tsx:90`, `conversation-view.tsx:98`); banner do ⌘K sem `aria-live`; contraste `#AEAEB2`/`#86868B` falha WCAG AA. **Correção:** trap+restore de foco, labels, `role="alert"`, escurecer texto secundário.
- **M11 — Fixtures de eval não garantem o ESTADO necessário.** Casos como `financeiro-cancelar-contrato-09` precisam de contrato ativo em `pedro`; fixtures resolvem por atividade, não por estado → caso **falha** (não skipa) via supressão do card. **Correção:** seed determinístico (`evals/seed.sql`) ou resolver refs pelo estado requerido.

### 🟢 Baixo / limpeza

- **L1 — `analyzeStudentProgress` loga PII (nome do aluno) no console.** `chat/route.ts:320-338`. Remover/gate debug.
- **L2 — Card HITL não mostra args.** `tool-confirmation-card.tsx:99-103` só prosa + `toolName` cru; confirmar write confiando em 1 linha. Mostrar args-chave.
- **L3 — Home não reusa `CreditMeter`.** `assistant-home.tsx:127-130` rola linha própria sem barra/estado esgotado. Reusar `CreditMeter compact`.
- **L4 — `toolName` cru (em inglês) vaza ao usuário** no card e no ⌘K (`action-preview.tsx:69`). Map `toolName→label PT` compartilhado.
- **L5 — Docstring stale** em `assistant-workspace.tsx:5-7` (diz que renderiza dentro do AppLayout; não renderiza).
- **L6 — chat duplica constante de rate-limit** em vez de importar `TURN_LIMIT` (`chat/route.ts:93`). Drift risk.

---

## 3. Matriz de Segurança

| Dimensão | Status | Evidência / nota |
|---|---|---|
| **Isolamento de tenant (leitura)** | ✅ Seguro | Fábrica por tenant: `createMcpServer(trainerId)`→`registerAllTools` fecha cada query sobre `trainerId` (`server.ts:45-58`, `tools/index.ts:22-42`). Todas as leituras escopam por `coach_id`/`trainer_id`/`owner_id`. Nenhum caminho de leitura cross-tenant encontrado. |
| **Isolamento de tenant (escrita)** | 🟠 1 buraco | Writes verificam posse (`verifyWorkoutOwnership`, RPCs com `p_trainer_id` travados na migr 204) **exceto** `createFormSchedulesCore` (A4). |
| **HITL (impossível executar sem card)** | ✅ Seguro | CONFIRM_TOOLS chegam **sem `execute`** (`mcp-bridge.ts:60-65`); `/execute-tool` revalida auth→tier→cota→args→rate-limit→executa (`execute-tool/route.ts:55-137`); 4 tools de dinheiro têm 2º gate `confirm=true`. |
| **Injeção de prompt (forja de role:system)** | ✅ Prevenido | `chat/route.ts:132-142` coage toda msg do cliente a user/assistant; histórico tipado; coluna `role` com CHECK. `rg "role:'system'"` sem construção influenciável. |
| **Injeção via conteúdo do aluno** | 🟠 At-risk | A6: check-ins/insights crus no contexto + tools de escrita auto-executáveis (não-dinheiro). |
| **Vazamento (stack/SQL/tabela ao cliente)** | 🟡 Médio | Rotas usam `assistantErrorResponse` (genérico, log server-side) — sem stack. Mas `error.message` cru no resultado de tool vaza no **MCP externo** (M3). Sem segredos hardcoded. |
| **Validação de args (G5)** | ✅ Seguro | `arg-validation.ts` estrito e bloqueante para contrato/pagamento/lead; resto best-effort/fail-open **seguro** porque a tool checa posse na execução. |
| **Rate-limit (cobertura LLM)** | ✅ Completo | command/voice→`limitTurn`, chat→inline 15/min, execute-tool→`limitSensitive`. Único spender sem limit é o cron (CRON_SECRET, 1/dia). |
| **RLS tabelas de IA (208/209/211)** | ✅ Correto | Select-only, `trainer_id = current_trainer_id()`; writes só via service role; índices presentes. |

**Veredito de segurança:** GO condicional. Sem caminho de leitura cross-tenant e sem bypass de confirmação. Corrigir antes/logo após o launch: A4 (write cross-tenant em schedule_form) e A6 (injeção via conteúdo do aluno). M3 (vazamento no MCP externo) e a ausência de teste de isolamento automatizado são hardening de menor prioridade.

---

## 4. Checklist de Prontidão para Produção

**Migrations**
- [x] 208 (ai_platform), 209 (ai_conversations), 211 (assistant_turn_traces) aditivas e com RLS select-only correto *(211 verificado: `create ... if not exists`, índices `(trainer_id, created_at desc)` + parcial)*
- [ ] **Corrigir CHECK de `surface` em 208 para incluir `'chat'`** (A3) — migration aditiva
- [ ] Cron de retenção de traces >90d (M6) — não existe

**Env Vars (produção)** — lista completa abaixo
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (documentadas)
- [x] `OPENAI_API_KEY` (documentada; usada em turnos + whisper)
- [ ] **`CRON_SECRET`** — usada (`morning-briefing/route.ts:24`), **não documentada** (A5)
- [ ] **`STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_ESSENCIAL`** — load-bearing p/ tier, **não documentadas** (A5)
- [x] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (no CLAUDE.md, fora do escopo assistente)
- [n/a] `EVAL_TRAINER_ID` — só testes/evals

**Feature flag / rollout**
- [x] Gate por tier (`PRO_TIERS={pro_ia,premium_ia}`, `gateAssistant`); override manual `trainers.ai_tier`; toggle de home `trainers.home_style` (migr 210)
- [x] Degradação graciosa: free/esgotado → 402/403 amigável "continue pela interface normal" *(mas a aba /assistente não mostra — B2)*
- [ ] **Kill-switch global** (`ASSISTANT_ENABLED`) — não existe (M8)

**Monitoramento / logs**
- [x] Traces de turno best-effort (`turn-trace.ts`), audit de `confirmed_action` (211 índice parcial)
- [ ] Log de custo do **chat** não persiste (A3)
- [ ] Sem alerta de timeout do cron (A1)

**Custo estimado** (gpt-4.1-mini, $0.40/1M in · $1.60/1M out — constante em `lib/prescription/llm-client.ts:100`)
- [x] Turno típico (2-3 steps): **~$0.005–0.008**; turno pesado (5 steps): **~$0.012**. Driver é `maxSteps`, não preço base.
- [x] Proativo/dia: N=50 elegíveis → **~$0.30–0.60/dia** (~$9–18/mês); N=200 → **~$1.20–2.40/dia** (~$36–72/mês)

**Testes verdes**
- [x] `npx tsc --noEmit` — limpo (2 passadas)
- [x] `npx vitest run` (sem live) — **1229 passed / 25 skipped** (2 passadas, estável, sem flakiness)
- [x] Evals modo integridade — passam sem segredos
- [ ] Evals comportamentais (RUN_EVALS) — precisam de `EVAL_TRAINER_ID` com estado seeded (M11)
- [ ] Cobertura HITL 5/9 CONFIRM_TOOLS (A8)

**Produto / UX**
- [ ] **B1 (re-arm HITL)** — bloqueador
- [ ] **B2 (erros silenciosos na aba)** — bloqueador
- [ ] Voz sem UI (M1) — esconder ou implementar
- [ ] Responsividade mobile-web (M9), acessibilidade (M10)

---

## 5. Ações Priorizadas para Amanhã (ordenadas)

| # | Ação | Sev | Esforço |
|---|---|---|---|
| 1 | **B1** — persistir status da part HITL (`confirmed`/`cancelled`) e render estático no reload | 🔴 | M (~2h) |
| 2 | **B2** — propagar estado de erro/banner na aba /assistente (402/429/422 distintos) | 🔴 | M (~3h) |
| 3 | **A5** — documentar `CRON_SECRET` + `STRIPE_PRICE_*` no `.env.example` e validar em prod | 🟠 | S (~30min) |
| 4 | **A3** — migration aditiva: `'chat'` no CHECK de `ai_usage_events.surface` | 🟠 | S (~30min) |
| 5 | **A2** — try/catch no bloco metering+summary de `runAssistantTurn` | 🟠 | S (~1h) |
| 6 | **A1** — cron: marcador idempotente por dia + batch/cursor + alerta timeout | 🟠 | M (~3h) |
| 7 | **A4** — checar posse de `studentIds` em `createFormSchedulesCore` | 🟠 | S (~1h) |
| 8 | **A6** — delimitar conteúdo do aluno no contexto (data-not-instruction) | 🟠 | M (~2h) |
| 9 | **A8** — endurecer assert de cobertura HITL + 4 casos faltantes | 🟠 | M (~2h) |
| 10 | **M1** — esconder rota de voz (ou planejar UI de mic) p/ não anunciar incompleto | 🟡 | S |
| 11 | **A7** — decidir destino do caminho `/chat` (migrar p/ motor compartilhado vs documentar legado) | 🟠 | L (decisão + ~1d se migrar) |
| 12 | Seed determinístico de evals (M11) p/ rodar a suíte comportamental | 🟡 | M |

---

## 6. Resultados dos Loops de Verificação

### Loop build/test (2 passadas — estável)
| | Passada 1 | Passada 2 |
|---|---|---|
| `tsc --noEmit` | exit 0, **sem erros** | exit 0, **sem erros** |
| `vitest run` (excl. `*.live.test.ts`) | 120 files passed / 1 skipped · **1229 tests passed / 25 skipped** (15.98s) | idem · **1229 passed / 25 skipped** (13.23s) |

Sem flakiness; contagens idênticas. Live/eval **não** rodados (precisam de `OPENAI_API_KEY`/`EVAL_TRAINER_ID`/staging) — ver §7 como rodar.

### Loop de segurança (2 passadas independentes)
- **Passada A (leitura dirigida):** todas as 55 tools e rotas escopam por `trainerId`; HITL strip de `execute` confirmado; `/execute-tool` revalida 5 camadas.
- **Passada B (busca adversária):** `rg "from('"` enumerou todas as queries; `rg "role:'system'"` vazio; `rg "service"` → admin client sempre pareado com predicado de tenant **exceto** `createFormSchedulesCore` (A4 — A e B divergiram aqui, reconciliado: é buraco real de escrita cross-tenant). `rg "error.message"` → vaza só no MCP externo (M3).
- **Re-verificação direta nesta auditoria:** B1, B2, A1, A2, A3, A4 lidos linha-a-linha e confirmados.

### Loop doc×código (divergências)
1. 🟠 `analyzeStudentProgress` descrito como "bug corrigido na v2" (`00-arquitetura-harness.md:53-57`, `README.md:31`) — **ainda é tool viva** em `chat/route.ts:314`.
2. 🟠 Docs apresentam config único de decoding (`00:46`: 0.3/900/5) — código tem dois (chat usa 0.7/1500/3).
3. 🟡 Docs afirmam consolidação total do prompt; camada de tools do chat ainda diverge (A7).
4. 🟡 Citação `context-builder.ts:197` está stale (linha hoje é comentário).
5. 🟡 G4 doc diz "/execute-tool revalida tier" — na prática gateia free-vs-cota, não Pro (M7).
6. 🟡 Princípio #5 do guardrails ("cada guardrail tem eval") não cumprido p/ G6/G7/G8.
7. 🟢 C8/C9/C10 (voz/proativo/erros) marcados ✅ — presentes no código (mas voz sem UI, M1).

### Loop de revisão própria (red team)
- Rebaixei **voz sem UI de 🔴 para 🟡**: não quebra produção, só está inacessível; basta não anunciar/esconder.
- Mantive B1/B2 como 🔴: re-execução de write e ausência total de feedback na tela carro-chefe são bloqueadores de produto reais.
- A1 (cron) é 🟠 hoje (poucos treinadores) mas escala para 🔴 — sinalizado.
- A3: confirmei que créditos NÃO dependem do insert de evento (RPC separado), então não é bloqueador de cobrança — 🟠.

---

## 7. Perguntas Abertas

1. **Destino do caminho `/api/assistant/chat`** (A7): migrar para o motor compartilhado (ganha HITL+55 tools+evals) ou manter como superfície legada read-only documentada? Decisão de produto.
2. **Voz** (M1): implementar UI de microfone agora ou descopar para depois do launch?
3. **Multiplicador bulk** (M5): o param real de `send_form`/`schedule_form` é `student_ids` (forms.ts:57,88) — confirmar que `studentCountFromArgs` casa exatamente (parece OK; validar com 1 teste).
4. **Tier `essencial`** (M7): deve poder usar o assistente? Hoje passaria no `/execute-tool` mas não no `gateAssistant`.
5. **Orçamento do proativo** (M4): cobrar do bucket do treinador é aceitável a longo prazo ou precisa de bucket separado?

### Como rodar os evals comportamentais (amanhã)
```bash
cd web
RUN_EVALS=1 EVAL_TRAINER_ID=<uuid-staging-descartavel> \
  npx vitest run src/lib/assistant/evals/run-evals.test.ts
```
Pré-requisitos: `web/.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`; e o trainer de `EVAL_TRAINER_ID` precisa ter o **estado** que os casos HITL exigem (contrato ativo em `pedro`, pagamento aberto em `maria`, lead aberto) — senão esses casos **falham** (não skipam). Ver M11.

---

*Apêndice com patches propostos: `docs/harness/AUDITORIA-FIXLIST.md`.*
