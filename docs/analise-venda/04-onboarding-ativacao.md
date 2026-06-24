# Front D — Onboarding + Ativação (do cadastro ao paywall)

Auditoria de prontidão para venda. Caminho do NOVO treinador: signup → primeira experiência de IA → paywall → conversão.
Marcação: **[CONFIRMADO]** = lido no código; **[HIPÓTESE]** = inferência fundamentada (config externa não verificável no repo).

---

## TL;DR

- **Bloqueador de venda (NO-GO):** o cap de alunos do plano Free — a principal trava de monetização — é **totalmente burlável pelo app mobile**. A Edge Function `create-student` não chama `assertCanCreateStudent`. Web e MCP travam; mobile não.
- O treinador Free **ganha um gosto real de IA** (chat contextual via dock), mas é o "lite" — o Assistente agêntico (a "mágica" que ele pagaria) fica 100% escondido.
- A superfície de IA que o Free alcança (o dock) **engole erros em silêncio** e **não tem CTA de upgrade** — o muro de pagamento não converte ali.
- O `query` (conversa) do Free é **efetivamente ilimitado** (custo de LLM real), porque `exhausted` nunca dispara pelo dock.

---

## Tabela de Achados

| # | Sev | Arquivo:linha | Evidência | Impacto | Fix (descrito) | Conf/Hip |
|---|-----|---------------|-----------|---------|----------------|----------|
| D1 | **Crítico** | `supabase/functions/create-student/index.ts:96-110` (insert sem cap); call-sites `mobile/hooks/useCreateStudent.ts:37` e `mobile/hooks/useTrainerLeads.ts:218` | A Edge Function valida que o caller é treinador (passo 3) e insere o aluno (passos 6-7) **sem nunca chamar `assertCanCreateStudent`/`STUDENT_CAP`**. Web (`create-student-core.ts:43`) e MCP (`students-write.ts:32`) travam; o caminho mobile não. | Trava central de receita ("Free=1 aluno, 2º exige plano pago") **burlada pelo mobile**. Treinador Free adiciona alunos ilimitados pelo `AddStudentModal` e pela conversão de lead. O gate de UI (`studentsLocked`) é só client-side e a conversão de lead nem o consulta. | Portar o gate pro servidor: na Edge Function, após resolver o treinador, replicar `getAiTierForTrainer` + `assertCanCreateStudent` (contar `students` por `coach_id` e barrar se `>= STUDENT_CAP[tier]`), retornando o mesmo `StudentCapError.message`. Idealmente extrair o cap p/ uma RPC `assert_can_create_student(trainer)` chamada por todos os caminhos (web/MCP/edge). | **CONFIRMADO** |
| D2 | **Alto** | `web/src/app/api/assistant/chat/route.ts:106-119` + `web/src/lib/ai-usage/usage-summary.ts:51,89,105` | `exhausted` do Free = `creditsUsed >= 4` onde as 4 classes são `query/write/prescription/bulk`. O dock só expõe `query` (conversa/análise/insights) e `prescription` (generateProgram). `write` e `bulk` **nunca** são testados pelo dock → `exhausted` **nunca** vira `true`. Só `generateProgram` tem trava por-classe (`:290-295`); conversa (`query`) **não tem trava nenhuma**. | Treinador Free conversa com a IA (gpt-4.1-mini, custo real) **ilimitadamente**, limitado só pelo rate-limit (15/min, 300/dia — `chat/route.ts:93`). Valor entregue de graça + amplificação de custo por conta Free. | Adicionar trava por-classe no topo do dock: `checkFreeTrial('query')` (espelhando o que `generateProgram` já faz p/ `prescription`), OU redefinir `exhausted` do Free como "qualquer classe alcançável esgotada" em vez de "todas as 4". Mostrar upsell ao esgotar o `query`. | **CONFIRMADO** |
| D3 | **Alto** | `web/src/components/communication/assistant-panel-content.tsx:106` | O dock (única superfície de IA que o Free alcança) faz `const { messages, sendMessage, status } = useChat(...)` — **não desestrutura `error`** nem trata `onError`. Respostas 402 (`ai_quota_exhausted`), 429 (rate-limit) e 500 (`internal_error`) do `chat/route.ts` **não viram UI nenhuma**: o treinador manda a mensagem e nada aparece. O banner correto (`assistant-banner.tsx:26-37`, trata 402/403/429/500 com CTA) existe mas só é usado na superfície agêntica (Pro+). | Primeira experiência de IA "quebra silenciosa" quando há erro/cota. E no momento do muro **não há CTA de upgrade** na superfície do Free → conversão zero ali. | Reutilizar `assistant-banner.tsx` (ou equivalente) no dock: desestruturar `error` do `useChat`, e renderizar banner com mensagem + CTA de upgrade quando `status==='error'` / payload 402/403. | **CONFIRMADO** |
| D4 | **Alto** | `web/src/components/dashboard/dashboard-header.tsx:44-52,79-90`; `web/src/components/search/search-results.tsx:115-119`; vs. `web/src/components/assistant/assistant-launcher.tsx:33` e `web/src/components/layout/sidebar.tsx:49-61,238` | **Assimetria confirmada.** O botão "Assistente" do header do dashboard e a linha "Abrir Assistente IA" do ⌘K-palette chamam `openChat()` **sem gate de tier** → Free abre o dock → `/api/assistant/chat` (que trava só por `usage.exhausted`, não por tier). Já a bolha flutuante (`assistant-launcher`) e o item "Assistente IA" da sidebar **só aparecem se `aiAllowed`** (Pro+, via `fetchAiAccess`→`/api/assistant/command` GET→`PRO_TIERS`). O Assistente agêntico (⌘K command-bar POST, aba `/assistente`) é Pro+-only (`command-engine.ts:118 gateAssistant`). | O Free **prova** a IA, mas só o chat "lite" e por entradas pouco descobríveis (header/insights/palette). As entradas mais visíveis (bolha, sidebar) ficam ocultas, e a "mágica" agêntica (que ele pagaria) ele **nunca sente**. O gosto não demonstra o produto pago. | Decidir o produto: (a) dar ao Free um teaser controlado do agêntico (N turnos), OU (b) tornar o dock-lite uma demo deliberada com CTA claro "isto é o lite; o Assistente completo está no Pro". Hoje é um meio-termo acidental (escondido + sem narrativa de upgrade). | **CONFIRMADO** (gating) / **HIPÓTESE** (impacto em conversão) |
| D5 | **Médio** | `web/src/app/signup/page.tsx:143-160,311`; `web/src/app/api/stripe/checkout/route.ts:97-121`; `web/src/app/subscription/blocked/page.tsx:43-58` + `blocked-client.tsx:7-32` | O signup **força** o Stripe Checkout logo após criar a conta (`trial_period_days:7`, `payment_method_types:['card']` → cartão obrigatório). Cancelar o checkout → `cancel_url` `/subscription/blocked?checkout=canceled`, cuja UI principal só oferece "Assinar/Reativar" ou "Sair da conta". O caminho Free existe só como **link de texto de baixo contraste** no rodapé ("Continuar no plano Gratuito (limitado)", `page.tsx:52-58`). | Topo do funil pede cartão antes de qualquer valor entregue. Quem não quer cartão cai numa tela que parece beco-sem-saída (pagar ou sair). O escape Free é fácil de não ver. | Oferecer entrada Free explícita já no `/signup` (ou um passo "Explorar grátis primeiro"). Promover o link de escape de `/subscription/blocked` a botão secundário visível. | **CONFIRMADO** |
| D6 | **Médio** | `web/src/components/assistant/workspace/assistant-banner.tsx:37` | A única tela de upsell de IA com CTA (`{ label: 'Fazer upgrade', href: '/settings' }`) aponta pra `/settings`, **não** pra checkout em 1 clique — e essa banner só roda na superfície agêntica (Pro+), que o Free não vê. Logo o ramo `tier_locked` é praticamente morto (Pro+ nunca recebe 403 de tier). | Atrito de upgrade (hop extra a /settings) e CTA na superfície errada. O Free, que é quem precisa converter, não tem essa banner em lugar nenhum. | CTA de upgrade → `POST /api/stripe/checkout` direto (como `blocked-client.tsx:49` faz). Garantir presença do banner na superfície que o Free alcança (ver D3). | **CONFIRMADO** |
| D7 | **Baixo** | `web/src/actions/auth/signup-trainer.ts:130-167` | `signup` faz `supabase.auth.signUp(...)` sem `emailRedirectTo` e, em seguida, o cliente chama `POST /api/stripe/checkout` que depende de `supabase.auth.getUser()` (sessão). Isso só funciona se a confirmação de email estiver desabilitada no projeto (auto-confirm); caso contrário o checkout daria 401. | Se um dia ligarem "confirm email" no Supabase, o fluxo de checkout pós-signup quebra (401 silencioso). Hoje, aparentemente, não há barreira de confirmação no web. | Tornar explícito: ou confiar no auto-confirm (documentar), ou tratar o caso `session==null` no signup redirecionando a uma tela "confirme seu email". | **HIPÓTESE** (config do projeto não está no repo) |
| D8 | Info | `supabase/migrations/031_trainer_self_student.sql:14-53` | Trigger `trg_create_trainer_self_student` cria, no INSERT do treinador, um self-student (`is_trainer_profile=true`) + contrato cortesia. O treinador pode prescrever pra si e treinar no app mobile imediatamente (banner `trainer-profile-banner.tsx`). | Positivo p/ ativação. **Porém**: esse self-student consome a única vaga do Free (`STUDENT_CAP.free=1`) → na prática Free = **0 alunos reais** (`studentsLocked=true` já com 1/1). Trava afiada (bom p/ monetizar), desde que não vaze (ver D1). | — (decisão de produto; só registrar que "1 aluno grátis" = o próprio treinador). | **CONFIRMADO** |

---

## Paywall Map (cada limite → trigger → mensagem → CTA → veredito)

| Limite Free | Trigger (arquivo:linha) | Mensagem ao usuário | CTA → destino | Veredito |
|---|---|---|---|---|
| 2º aluno (web/MCP) | `create-student-core.ts:43`; `students-write.ts:32` → `student-cap.ts:35` | "O plano Gratuito permite apenas 1 aluno (você mesmo, como aluno-teste). Assine um plano para adicionar mais alunos." | depende da UI chamadora (retorna `error` string) | **clear/enforced** |
| 2º aluno (mobile) | **nenhum** — `create-student/index.ts` não trava | nenhuma no servidor; UI mostra "Assine para adicionar alunos" (`students.tsx:295,335`) só se `studentsLocked` | `students.tsx:300` → `/profile/subscription` (client-side, contornável) | **LEAK (crítico)** — conversão de lead nem checa `studentsLocked` |
| Gerar programa (dock) | `chat/route.ts:290-295` `checkFreeTrial('prescription')` | "No plano Gratuito você já testou a geração de programa. Assine um plano para gerar mais." | narrada pelo LLM como tool-result (sem botão) | **clear gate, CTA fraco** |
| IA esgotada (todas 4 classes) | `chat/route.ts:106-119` → 402 | "Você já testou os recursos de IA do plano Gratuito. Assine um plano para continuar..." | **nenhum** (dock não renderiza erro — D3) | **friction (silencioso)** + quase nunca dispara (D2) |
| Assistente agêntico (⌘K/aba/bolha/sidebar) | `command-engine.ts:118` `gateAssistant` → 403 `tier_locked` | "O Assistente com IA está disponível nos planos Pro e Premium. Faça upgrade..." | `assistant-banner.tsx:37` → `/settings` (só em superfície Pro+) | **hidden from free** |
| Signup → pagamento | `signup/page.tsx:147` → checkout; cancelar → `/subscription/blocked` | "Complete sua assinatura. Para acessar o Kinevo... 7 dias grátis!" | `blocked-client.tsx:49` → `/api/stripe/checkout` | **clear, mas escape Free quase oculto** |

---

## Respostas às 5 perguntas

### 1. Signup
- **Tier inicial:** `trainers` é inserido em `signup-trainer.ts:163-167` **sem `ai_tier`** → resolve para `free` (`get-ai-tier.ts:92-95`: sem assinatura ativa → free). **[CONFIRMADO]**
- **Test student auto-criado?** **Sim**, mas não no signup action — via trigger DB `trg_create_trainer_self_student` (`031_trainer_self_student.sql:32-34,50-53`) no INSERT do treinador: cria self-student `is_trainer_profile=true` + contrato cortesia. O treinador já pode prescrever pra si e usar o app mobile. **[CONFIRMADO]**
- **Onboarding quebrado/placeholder?** Nada quebrado no caminho crítico. O signup vai **direto pro Stripe Checkout** com cartão obrigatório (`checkout/route.ts:100,107`); o plano Free só é alcançado abandonando o checkout (ver D5). **[CONFIRMADO]**
- **Confirmação de email antes do 1º uso?** Aparentemente **não** no web — o checkout pós-signup depende da sessão criada por `signUp()`, o que exige auto-confirm ligado. **[HIPÓTESE]** (config do projeto fora do repo — D7).

### 2. Primeiro gosto de IA
- **Sim, o Free prova a IA** — mas só o **chat contextual "lite"** (dock), via 3 entradas **não-gated**: botão "Assistente" do header (`dashboard-header.tsx:79-90`), cards de insight "Analisar/Gerar programa" (`assistant-action-cards.tsx:211,228`) e ⌘K-palette "Abrir Assistente IA" (`search-results.tsx:118`). Todas chamam `openChat()` → `/api/assistant/chat`, que trava por `usage.exhausted` (não por tier). **[CONFIRMADO]**
- **O agêntico fica escondido:** bolha flutuante e item de sidebar só com `aiAllowed`/Pro+ (`assistant-launcher.tsx:33`, `sidebar.tsx:238`); ⌘K command-bar e aba `/assistente` Pro+-only (`gateAssistant`). **[CONFIRMADO]**
- **Implicação de conversão (assimetria dock vs workspace):** o Free experimenta o produto **lite** por portas discretas e **nunca sente a "mágica" agêntica** que justifica o Pro. O gosto existe, mas (a) é pouco descoberto e (b) não demonstra o que ele pagaria. Recomenda-se transformar isso em demo deliberada com narrativa de upgrade (D4). **[HIPÓTESE]** no impacto.

### 3. Momento do paywall
- **Onde o Free bate:** (i) ao tentar o **2º aluno** (`assertCanCreateStudent` — web/MCP) — mas **vaza no mobile** (D1); (ii) ao **gerar o 2º programa** pelo dock (`checkFreeTrial('prescription')`, `chat/route.ts:291`); (iii) ao tentar o **Assistente agêntico** (403 `tier_locked`). **[CONFIRMADO]**
- **Mensagem clara / roteia pro checkout?** As mensagens são claras em texto, mas o **roteamento é fraco**: o gate de prescrição vem como tool-result narrado (sem botão); o gate de tier manda pra `/settings` e só na superfície Pro+ (D6); o dock não renderiza erro/cota (D3). **[CONFIRMADO]**
- **Valor dado sem gate (leak)?** **Sim, dois:** (a) **mobile cria alunos ilimitados** sem cap (D1, crítico); (b) **chat `query` ilimitado** no Free porque `exhausted` nunca dispara pelo dock (D2). **[CONFIRMADO]**
- **Cross-check dos caminhos de criação de aluno:** `createStudentCore:43` ✓, `convertLeadToStudentCore` (chama o core, `convert-lead-core.ts:82`) ✓, MCP `kinevo_create_student` (`students-write.ts:32`) ✓, **Edge `create-student` ✗ (sem cap)**. **[CONFIRMADO]**

### 4. Espelho mobile
- `ai-status` reflete corretamente `tier`, créditos e `studentsLocked` (`ai-status/route.ts:56-67`), consumido por `useAiStatus.ts` e por `students.tsx:132-133`. O gate de UI esconde o FAB e mostra "Assine para adicionar alunos" quando `studentsLocked`. **[CONFIRMADO]**
- **É só UX, revalidado no servidor?** O comentário do route (`ai-status/route.ts:13`) afirma "revalidado no backend (assertCanCreateStudent)". **Isso é FALSO para o caminho mobile** — a ação real (`create-student` edge fn) **não revalida** (D1). O comentário de segurança descreve uma proteção que não existe nesse caminho.
- **Mobile muta estado além do cap?** **Sim** — `useCreateStudent`/`AddStudentModal` e `useTrainerLeads` (conversão de lead, `:218`) escrevem alunos via a edge fn ungated. A conversão de lead nem consulta `studentsLocked`. **[CONFIRMADO]**

### 5. Estados vazios/erro
- **Cota acabou (dock):** o dock **não trata erro** (`assistant-panel-content.tsx:106` não pega `error`) → 402/429/500 viram falha silenciosa, sem mensagem nem CTA (D3). **[CONFIRMADO]**
- **IA falha:** idem — 500 `internal_error` (`chat/route.ts:378-384`) não aparece pro usuário no dock. **[CONFIRMADO]**
- **Sem assinatura:** o app **não brica** — `get-trainer.ts:92-112` removeu o hard-block; sem plano ativo cai no Free e entra limitado (degrade-to-GUI respeitado nesse nível). **[CONFIRMADO]**
- **Erro/500 cru pro usuário?** No dock, não há vazamento de stacktrace, mas há o oposto — **silêncio total** (pior p/ confiança/conversão). Nas superfícies agênticas (Pro+) o `assistant-banner` trata 402/403/429/422/500 corretamente. **[CONFIRMADO]**

---

## O que falta no onboarding/ativação para vender? (punch-list)

1. **[NO-GO] Fechar o vazamento do cap no mobile** — `assertCanCreateStudent` (ou RPC equivalente) dentro de `supabase/functions/create-student/index.ts`, cobrindo `AddStudentModal` **e** conversão de lead. Sem isso, o plano pago é opcional p/ quem usa mobile.
2. **Tampar o `query` ilimitado do Free** — trava por-classe no dock (espelhar o que `generateProgram` já faz) ou redefinir `exhausted` como "classe alcançável esgotada".
3. **Dar erro+CTA na superfície do Free** — reusar `assistant-banner` no dock (tratar `error`/402/403) e converter o muro em upgrade de 1 clique (→ `/api/stripe/checkout`, não `/settings`).
4. **Decidir a narrativa de gosto-de-IA** — ou um teaser do agêntico, ou demo explícita do "lite" com upsell; e tornar as entradas de IA do Free descobríveis.
5. **Suavizar o topo do funil** — entrada Free explícita no `/signup` ou escape Free visível em `/subscription/blocked` (hoje é link de baixo contraste).
6. **Confirmar política de confirmação de email** (D7) para não quebrar o checkout pós-signup se mudarem a config.

---

## Apêndice — arquivos-chave (caminhos absolutos)

- `/Users/gustavoprado/kinevo/supabase/functions/create-student/index.ts` (D1 — leak)
- `/Users/gustavoprado/kinevo/mobile/hooks/useCreateStudent.ts`, `/Users/gustavoprado/kinevo/mobile/hooks/useTrainerLeads.ts`
- `/Users/gustavoprado/kinevo/web/src/actions/create-student-core.ts`, `/Users/gustavoprado/kinevo/web/src/lib/mcp/tools/students-write.ts`, `/Users/gustavoprado/kinevo/web/src/lib/limits/student-cap.ts`
- `/Users/gustavoprado/kinevo/web/src/app/api/assistant/chat/route.ts`, `/Users/gustavoprado/kinevo/web/src/lib/ai-usage/usage-summary.ts`, `/Users/gustavoprado/kinevo/web/src/lib/ai-usage/quota.ts`
- `/Users/gustavoprado/kinevo/web/src/components/communication/assistant-panel-content.tsx`, `/Users/gustavoprado/kinevo/web/src/components/assistant/workspace/assistant-banner.tsx`
- `/Users/gustavoprado/kinevo/web/src/components/dashboard/dashboard-header.tsx`, `/Users/gustavoprado/kinevo/web/src/components/assistant/assistant-launcher.tsx`, `/Users/gustavoprado/kinevo/web/src/components/layout/sidebar.tsx`
- `/Users/gustavoprado/kinevo/web/src/lib/assistant/command-engine.ts`, `/Users/gustavoprado/kinevo/web/src/app/api/assistant/command/route.ts`
- `/Users/gustavoprado/kinevo/web/src/app/signup/page.tsx`, `/Users/gustavoprado/kinevo/web/src/actions/auth/signup-trainer.ts`, `/Users/gustavoprado/kinevo/web/src/app/api/stripe/checkout/route.ts`
- `/Users/gustavoprado/kinevo/web/src/app/subscription/blocked/page.tsx`, `/Users/gustavoprado/kinevo/web/src/lib/auth/get-trainer.ts`
- `/Users/gustavoprado/kinevo/web/src/app/api/trainer/ai-status/route.ts`, `/Users/gustavoprado/kinevo/mobile/app/(trainer-tabs)/students.tsx`
- `/Users/gustavoprado/kinevo/supabase/migrations/031_trainer_self_student.sql`
</content>
</invoke>
