# Prompt para o Claude Code — Chat-First Workspace, Fase 0 (Fundações)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia e siga, nesta ordem:

1. `web/CLAUDE.md` — contexto e regras invioláveis do app web. **Ler inteiro antes de qualquer coisa.**
2. `web/specs/active/chat-first-workspace/SPEC.md` — a spec do projeto. Leia **inteira**, mas você vai
   executar **somente a Fase 0 (Fundações)** descrita na seção "Plano Faseado".

Você **não** vai executar as Fases 1, 1.5, 2 ou 3. **Nenhuma UI nesta sessão.** Só as fundações sem interface.

## Objetivo da Fase 0

Deixar pronta toda a infraestrutura que as fases de UI vão consumir, com testes, sem tela. No fim desta
sessão deve existir e estar testado:

1. **Migration de metering:** tabelas `ai_usage_periods` e `ai_usage_events` + RPC `increment_ai_usage`
   + RLS (treinador lê só as próprias linhas; escrita via service role). DDL de referência está na seção
   "Metering & Planos" da spec — use-a como base, ajustando nomes/índices ao padrão das migrations existentes.
2. **Migration de tier:** coluna `trainers.ai_tier text` (null | 'pro' | 'premium') e
   `subscriptions.stripe_price_id text` (nullable, backward-compat). Ver seção de tier (✅) na spec.
3. **`web/src/lib/assistant/mcp-bridge.ts`** — ponte in-memory (`createMcpServer` + `InMemoryTransport` +
   `experimental_createMCPClient`) que devolve as 27 tools, **transformando** o conjunto: reads passam
   direto; tools em `CONFIRM_TOOLS` viram versões **sem `execute`** (client-side). Lembre dos achados ✅
   da spec: o `client.tools()` descarta annotations e entrega tudo com execute automático.
4. **`web/src/lib/assistant/tool-policy.ts`** — `READ_TOOLS`, `CONFIRM_TOOLS` e `CREDIT_WEIGHTS`
   (listas estáticas já esboçadas na spec). É a fonte de verdade da classificação.
5. **`web/src/lib/ai-usage/`** — `quota.ts` (`PLAN_AI_QUOTA` + função que decide allow/block dado o uso
   atual e o tier) e `metering.ts` (tokens→custo via a tabela `PRICING` de `lib/prescription/llm-client.ts`,
   custo→créditos via `CREDIT_WEIGHTS`, e chamada do RPC `increment_ai_usage`).
6. **`getAiTier(trainerId)`** — helper que lê o tier (coluna `trainers.ai_tier`; fonte de verdade do gate).
   Coloque junto de `lib/auth` ou `lib/ai-usage`, o que ficar mais coerente com o projeto.
7. **`web/src/app/api/assistant/execute-tool/route.ts`** — endpoint que executa uma tool de escrita
   **confirmada** (HITL): autentica, resolve trainer, **valida que a tool está em `CONFIRM_TOOLS`**,
   invoca a tool MCP real por nome via a ponte in-memory, e devolve o resultado. (A UI que chama isso vem
   na Fase 1 — aqui só o endpoint + teste.)
8. **Script de fumaça** (`web/scripts/`) que: monta a ponte para um `trainerId` de teste, lista as tools,
   executa **1 read** (ex.: `kinevo_list_students`) e **1 write via `execute-tool`** (ex.: `kinevo_send_message`
   em modo dry-run/stub), provando o caminho ponta a ponta sem UI.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde minha aprovação. O plano deve ter:

- Lista ordenada dos passos, cada um com os arquivos que vai tocar e o critério de pronto.
- Ordem que mantém o repo compilando entre passos (ex.: tool-policy e mcp-bridge antes do route que os usa;
  migrations + `gen:types` antes do código que tipa as novas tabelas).
- Pontos de risco/ambiguidade que você prevê. Em especial, confirme antes de assumir:
  - Como o **mecanismo HITL** do AI SDK 4.3.19 expõe tools sem `execute` ao cliente (a UI é da Fase 1, mas
    o formato das tools client-side precisa estar certo já aqui). Se houver dúvida, deixe a tool client-side
    no formato mais idiomático da versão e documente a decisão.
  - Padrão das migrations do projeto (numeração, RLS, `gen:types`) — siga o que já existe, não invente.
  - Como o `trainerId` de teste é obtido no script de fumaça sem subir UI (use um id real de dev ou um stub).
- Estratégia de testes por etapa (ver "Definição de pronto").

Só comece a editar **depois que eu aprovar o plano**. Se durante a execução algo contrariar o plano, **pare e reporte** antes de desviar.

## Regras para esta sessão

- **Não use git.** Nada de `add`/`commit`/`push`/branch. Eu gerencio commits (regra do `WORKFLOW.md`).
- **Não toque em `web/src/lib/prescription/`** (motor IA — protegido por CLAUDE.md). Você só **lê** a
  tabela `PRICING` de `llm-client.ts`; não altera nada lá.
- **Não crie tools novas de financeiro/forms/training-room/settings.** Fora do escopo (a spec define deep-link).
- **Migrations:** crie os arquivos `.sql`. Só **aplique** no Supabase (via MCP) se eu autorizar explicitamente;
  o DDL deve ser backward-compat (colunas nullable, sem quebrar o existente). Após aplicar, rode `npm run gen:types`.
- **Sem refactor oportunista.** Código feio vizinho: deixe como está e registre em "follow-ups sugeridos".
- **Sem `any`** (regra do CLAUDE.md). Tipos explícitos ou `unknown` com type guards.
- Se uma regra invariável estiver prestes a ser violada, **pare e me avise**.

## Premissas do ambiente

- Monorepo Kinevo em `~/kinevo`; app web em `web/`. **Gerenciador: npm workspaces** (não pnpm, não Turborepo —
  ver CLAUDE.md). Comandos a partir de `web/` ou da raiz conforme o script.
- Build/typecheck: `npm run build` / `npx tsc --noEmit` no `web/`. Testes: Vitest (`npx vitest run`).
- Supabase: prefira mocks já existentes no projeto para testes; não dependa de banco local subido.
- Versões já verificadas: `ai` 4.3.19 expõe `experimental_createMCPClient`; `@modelcontextprotocol/sdk`
  expõe `InMemoryTransport.createLinkedPair` em `@modelcontextprotocol/sdk/inMemory.js`.
- Eu falo português; comunique-se em pt-BR. Código/identificadores em inglês seguindo o padrão do projeto;
  strings user-facing em pt-BR.

## Definição de "pronto" (Fase 0)

- Os 8 itens do "Objetivo da Fase 0" entregues.
- **Testes unitários verdes (obrigatório):** `tool-policy` (classificação + cálculo de créditos por mix de
  tools), `ai-usage/metering` (tokens→custo→créditos, floor de 1), `quota` (allow/block + cálculo de reset).
- **Teste de query/route (recomendado):** `increment_ai_usage` (incremento atômico, upsert no período certo,
  isolamento por trainer) e `execute-tool` (rejeita tool fora de `CONFIRM_TOOLS`; rejeita sem auth) com Supabase mockado.
- `npx tsc --noEmit` verde no `web/`. Suite de testes verde.
- Script de fumaça rodando e demonstrando 1 read + 1 write-via-execute-tool, com saída registrada.
- Log de execução em `web/specs/active/chat-first-workspace/logs/fase-0-execucao.md`: o que foi feito, o que
  foi testado e o resultado, migrations criadas (e se foram aplicadas), e a lista de "follow-ups sugeridos".

Comece produzindo o plano. Aguarde aprovação.
