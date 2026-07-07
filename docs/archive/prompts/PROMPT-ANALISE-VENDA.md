# Análise de Prontidão para Venda — Modo Assistente + Tokens (SOMENTE LEITURA)

## Contexto

Você está no monorepo do **Kinevo**, plataforma para personal trainers gerenciarem alunos, programas, mensagens e financeiro. Estrutura:

- `web/` — Next.js 16 (App Router, React 19, Supabase SSR, Vercel AI SDK v5, servidor MCP)
- `mobile/` — Expo / React Native (consome as rotas web; **não chama LLM diretamente**)
- `shared/` — pacote `@kinevo/shared` (tipos, domínio, testes vitest)
- `supabase/` — migrations, edge functions, seeds
- `docs/`, `_planning/` — documentação e planejamento

**A missão desta noite é específica.** Estamos prestes a **abrir o Modo Assistente ao público e monetizá-lo com tokens/créditos**. O Modo Assistente é o chat agêntico onde o treinador opera o app por linguagem natural (texto + voz), via motor `runAssistantTurn` + ponte MCP in-memory (~57 tools) + HITL. Hoje é 100% dogfooding (só o Gustavo tem tier pago; os demais ~24 treinadores são `free`).

Seu trabalho é **auditar tudo que separa o produto de "começar a vender"** e produzir um **relatório + checklist de lançamento (go/no-go)** para o Gustavo executar na manhã seguinte. **Você NÃO implementa nada** — só analisa, verifica e reporta.

## Regras invioláveis

1. **NÃO altere nenhum arquivo de código, configuração, env ou migration.** Esta tarefa é 100% análise. Os únicos arquivos que você pode criar são os relatórios em `docs/analise-venda/` (crie a pasta).
2. **NÃO execute** nada que mude estado: sem `git commit`/`push`, sem deploy, sem `supabase db push`/`apply_migration`, sem escrita no banco de produção, sem instalar dependências, sem rotacionar/gravar env no Vercel.
3. **PODE executar** leitura/verificação: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run test:coverage`, `npm audit`, `git log`, grep/glob, e **consultas SELECT read-only** ao banco (apenas leitura — jamais INSERT/UPDATE/DELETE) se ajudar a confirmar um achado (ex.: distribuição de `ai_tier`, existência das tabelas `ai_usage_periods`/`ai_free_trials`/`ai_credit_topups`).
4. O computador fica ligado a noite toda — **seja exaustivo, não superficial.** Leia arquivos inteiros em vez de amostrar. Use subagents (Task tool) em paralelo para as 4 frentes independentes.
5. **Leia o baseline ANTES de tudo** e não repita o que já está documentado — verifique o que **continua pendente** e foque em achados novos e na lente "isto está pronto para receber dinheiro de cliente real?":
   - `docs/analise-modo-assistente-2026-06-22.md` (auditoria ponta-a-ponta do Modo Assistente — 3 frentes críticas: segurança de ações/injeção, integridade de billing, "texto e voz" ~25%)
   - `docs/relatorio-noturno-2026-06-23.md` (última rodada de fixes em produção — o que já foi corrigido e os 2 itens pendentes: rotacionar `ANTHROPIC_API_KEY`, streaming de texto)
   - `docs/analise-mcp-assistente-custos.md` (economia de inferência: modelos, custo por tarefa, gate de uso obrigatório, viabilidade por tier de preço)
   - `docs/analise-noturna/RESUMO-EXECUTIVO.md` e `docs/landing-specs/` (specs da landing rumo ao polish)
6. Distinga sempre **"confirmado por leitura de código"** de **"hipótese a verificar"**. Toda afirmação leva `arquivo:linha`.

## Fase 0 — Mapa do dinheiro (antes de tudo)

Construa e registre em `docs/analise-venda/00-mapa-monetizacao.md` o circuito completo de monetização, de ponta a ponta, com `arquivo:linha`:

- **Tiers e cotas.** Os 4 tiers (`free`, `essencial`, `pro_ia`, `premium_ia`) e suas cotas mensais de crédito: `web/src/lib/ai-usage/quota.ts` (`PLAN_AI_QUOTA` = free→null, essencial→20, pro_ia→300, premium_ia→1000). Confirme que esses números batem com a landing/pricing, com a SPEC mestra citada no arquivo, e com a economia de custo de `docs/analise-mcp-assistente-custos.md` (margem por tier).
- **Resolução de tier.** `web/src/lib/auth/get-ai-tier.ts` (override `trainers.ai_tier` → price do Stripe → free; pagante ativo com price desconhecido → essencial). Os envs `STRIPE_PRICE_ESSENCIAL/PRO/PREMIUM` e o legado `STRIPE_PRICE_ID`.
- **Contabilização (metering).** `web/src/lib/ai-usage/metering.ts`, `usage-summary.ts`; tabelas `ai_usage_periods`, `ai_free_trials`, `ai_credit_topups`; RPC `consume_ai_usage` (migration `216` — clamp atômico) e idempotência (`217`).
- **Gate de cota nos call-sites.** `chat/route.ts`, `programs/ai-canvas/route.ts`, `command-engine.ts`, `execute-tool/route.ts` (free-trial "1× cada ação" vs balde mensal; teto por turno; `ai_quota_exhausted`).
- **Stripe.** `webhooks/stripe/route.ts`, `api/financial/checkout-link`, `subscription/blocked`, fluxo de assinatura do treinador.
- **Espelho mobile.** `api/trainer/ai-status/route.ts` (medidor de créditos + `studentsLocked`).
- **Travas de produto adjacentes.** `web/src/lib/limits/student-cap.ts` (free=1 aluno, pago=∞).

Diagrama em texto/mermaid do fluxo "treinador free → usa free-trial → bate paywall → assina (Stripe) → vira tier pago → consome cota mensal → estoura → topup/reset". Marque cada ponto de falha.

## Fase 1 — As 4 frentes (paralelize com subagents)

Para cada frente, classifique achados **Crítico / Alto / Médio / Baixo** com `arquivo:linha`, evidência (trecho), impacto concreto em receita/experiência e correção sugerida (**descrita, não implementada**). E para cada uma, responda explicitamente: **"o que falta para vender com isto ligado?"**

### A. Travas de plano e tokens (coração)
- **Enforcement real do gate**: a cota é checada em **todos** os caminhos que consomem IA (chat, voz, canvas de build, command/⌘K, execute-tool, drafts/winback)? Existe algum caminho que chama LLM **sem passar pelo gate**? (vaza custo.)
- **Atomicidade e race**: o `consume_ai_usage`/clamp impede gastar além do teto sob concorrência (vários turnos simultâneos)? TOCTOU? O "teto por turno" (12 créditos, citado no relatório) está realmente aplicado em todo lugar?
- **Cobrança correta**: tool/turno que **falha** ainda é cobrado? (o baseline apontou esse bug — confirme se foi corrigido em todos os caminhos.) Build com Sonnet vs custo cobrado (margem negativa?).
- **Free-trial "1× cada ação"**: as `action_class` cobrem o que precisam? Dá para burlar (resetar, repetir, ID manipulável)? O degrade para GUI quando estoura é claro pro usuário?
- **Topups**: `ai_credit_topups` está realmente plugado (compra → crédito disponível → consumo)? Ou é tabela órfã? Há fluxo de compra de tokens avulsos?
- **Reset de período**: `ai_usage_periods` reseta certo na virada de mês? Fuso/UTC? Upgrade no meio do mês prorrateia ou zera?

### B. Fluxo de pagamento Stripe
- **Checkout → assinatura → tier**: rastreie o caminho inteiro. `checkout-link` cria a sessão certa? O `webhook/stripe` mapeia `stripe_price_id` → tier corretamente (e o gap conhecido do `stripe_price_id` NULL no primeiro evento — ver comentário em `get-ai-tier.ts`)?
- **Estados de assinatura**: `active`, `trialing`, `past_due`, `canceled`, `incomplete` — cada um leva ao tier/acesso certo? O que acontece quando o pagamento falha (dunning)? `subscription/blocked` cobre os casos?
- **Upgrade / downgrade**: muda o tier na hora? A cota acompanha? Proration?
- **Segurança do webhook**: verificação de assinatura do Stripe, idempotência (evento duplicado não duplica efeito), tratamento de eventos fora de ordem.
- **Envs de produção**: os `STRIPE_PRICE_*` necessários para os 3 tiers pagos estão **configurados**? (Sem `STRIPE_PRICE_PRO`/`PREMIUM` setados, esses planos não resolvem — bloqueante de venda.) Liste o que precisa existir no Vercel **sem expor valores**.
- **Confirme o que NÃO consegue testar sem pagar de verdade** e proponha um roteiro de teste em modo de teste do Stripe para o Gustavo rodar de manhã.

### C. Landing + pricing
- **Página**: `web/src/app/page.tsx` + `web/src/components/landing/*` (foco em `landing-pricing.tsx`, `landing-stripe.tsx`, `landing-ai-assistant.tsx`, `landing-hero.tsx`, FAQ).
- **Coerência de números**: os preços, cotas de crédito/tokens e limites mostrados na landing batem **exatamente** com `PLAN_AI_QUOTA`, `STUDENT_CAP` e os tiers reais? Qualquer divergência é risco de promessa falsa.
- **Clareza dos tokens**: um treinador entende o que é um "crédito/token", quanto rende, o que acontece quando acaba? A tabela de pricing comunica os 3 tiers pagos + free?
- **CTA e conversão**: o CTA leva ao signup/checkout certo? Estados quebrados, links mortos, copy placeholder, seções marcadas "criar" nas specs que não existem.
- **Confronte com `docs/landing-specs/`**: o que estava planejado já foi feito, e o que falta para o pricing/FAQ ficarem "prontos para vender".
- **Performance/acessibilidade** só na medida do que impacta conversão (LCP, CLS, erro visível).

### D. Onboarding + ativação
- **Signup**: `web/src/app/signup/page.tsx` — fluxo de cadastro do treinador, criação do registro `trainers`, tier inicial, criação do "aluno-teste".
- **Primeiro uso do chat**: a experiência de partida (cards "Precisa de atenção" / "Comece por aqui" / conversas recentes) leva o treinador a experimentar o Assistente rápido? O free-trial deixa ele sentir valor antes do paywall?
- **Momento do paywall**: onde e como o treinador free bate a trava (2º aluno, free-trial esgotado, cota)? A mensagem é clara e leva ao checkout? Há fricção desnecessária ou, ao contrário, falta de gate (uso ilimitado de graça)?
- **Espelho mobile**: `ai-status` reflete tier/créditos/lock corretamente no app? O gate é só de UX (revalidado no backend)?
- **Estados vazios/erro**: o que o treinador vê quando a cota acaba, quando a IA falha, quando não tem assinatura.

## Fase 2 — Riscos transversais de lançamento

Em `docs/analise-venda/05-riscos-lancamento.md`, cobertura rápida do que pode estourar quando entrar gente de fora pagando:
- **Custo/abuso**: rate-limit por credencial e por treinador; um usuário consegue gerar custo desproporcional? O custo real por tier mantém margem (cruze com `docs/analise-mcp-assistente-custos.md`)?
- **Segurança de ações + injeção de prompt**: as ações que saem para o aluno (`kinevo_send_message`, `send_form`/`schedule_form`, `generate_checkout_link`) estão em HITL/rascunho-primeiro (o baseline apontou gap)? Confirme o estado atual.
- **LGPD/privacidade**: dado de saúde indo para OpenAI/Anthropic com ZDR/DPA? Senha em texto puro? (apontados no baseline — verifique se persistem.)
- **Pendências conhecidas ainda abertas**: `ANTHROPIC_API_KEY` válida em prod, streaming de texto — status e impacto na venda.
- **Multi-tenant**: nenhum furo cross-tenant nos caminhos de billing/cota (cota de um treinador contaminando outro).

## Entregáveis (em `docs/analise-venda/`)

- `00-mapa-monetizacao.md` — o circuito do dinheiro com diagrama e pontos de falha.
- `01-travas-tokens.md`
- `02-stripe-pagamento.md`
- `03-landing-pricing.md`
- `04-onboarding-ativacao.md`
- `05-riscos-lancamento.md`
- `RESUMO-EXECUTIVO.md` — **no topo, o CHECKLIST DE LANÇAMENTO (GO/NO-GO)**: uma tabela com cada item necessário para vender, status (✅ pronto / ⚠️ risco / ❌ bloqueante), severidade, o que falta e esforço estimado (P/M/G). Em seguida: top 10 achados por impacto em receita e a ordem de ataque sugerida para a sessão de implementação da manhã.

Cada achado: severidade, `arquivo:linha`, evidência (trecho), impacto concreto e correção sugerida (descrita, não implementada). Marque claramente "confirmado por leitura" vs "hipótese a verificar em runtime/Stripe-test".

## Critério de conclusão (verificação obrigatória)

Antes de finalizar:
1. Releia o `RESUMO-EXECUTIVO` e confirme que **cada item GO/NO-GO tem evidência em `arquivo:linha`**; remova especulação não confirmada.
2. Rode `npm run typecheck`, `npm run lint` e `npm run test:run` e **inclua os números reais** no resumo (servem de baseline de saúde antes de mexer no código de manhã).
3. Confirme a coerência numérica landing ↔ código ↔ Stripe (preços e cotas) — esta é a checagem de maior risco de "promessa falsa".
4. Se sobrar tempo, aprofunde na frente **A (travas de tokens)** e no **fluxo Stripe**, que são onde dinheiro real entra e vaza.
