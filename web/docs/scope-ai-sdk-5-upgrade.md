# Escopo — Upgrade Vercel AI SDK v4 → v5

> **Motivação primária:** destravar **Gemini 3.x** no build (os 3.x exigem `thought_signature` no tool-calling, que só o `@ai-sdk/google@2` (= `ai@5`) suporta). **Motivação secundária (real):** v5 traz **UI message streams** (habilita o streaming de texto token-a-token, hoje deferido — task U-STREAM), `providerOptions`, e é a linha corrente (futuro). **Payoff do Gemini é INCERTO:** só sabemos que o 2.5-flash falhou; o 3.5 *pode* empatar/perder pro Sonnet. Não migrar só pelo Gemini.

> Data do escopo: 2026-06-23. Guia oficial consultado: ai-sdk.dev migration-guide-5-0.

## Superfície real (pequena — o motor de prescrição NÃO usa o SDK)
Só **6 arquivos** tocam o `ai`/`@ai-sdk/*`:

| # | Arquivo | Usa | Risco |
|---|---|---|---|
| 1 | `lib/programs/ai-canvas/run-canvas-turn.ts` | generateText, tool, CoreMessage, maxTokens/maxSteps | 🟢 baixo (isolado, meu) |
| 2 | `lib/assistant/command-engine.ts` | generateText, tool, ToolSet, onStepFinish, **lê `.args`/`.result`** | 🔴 alto (HITL hardened, force-cast) |
| 3 | `app/api/assistant/chat/route.ts` | streamText, **toDataStreamResponse** | 🟡 médio (protocolo de stream) |
| 4 | `components/communication/assistant-panel-content.tsx` (+ `unified-panel.tsx`) | **useChat** de `ai/react` | 🔴 alto (useChat v5 muda muito) |
| 5 | `lib/assistant/mcp-bridge.ts` | **experimental_createMCPClient**, client.tools() | 🟡 médio (verificar API v5) |
| 6 | `lib/assistant/evals/judge.ts` | generateText | 🟢 baixo (infra de teste) |

**INTACTO (não usa AI SDK):** `lib/prescription/**` (cliente HTTP à mão), forms, parse-text, insights. Isso de-risca MUITO — a prescrição core não é tocada.

## Breaking changes mapeados (v4 → v5)
**Mecânico (todos os arquivos):**
- `maxTokens` → `maxOutputTokens`
- `maxSteps: n` → `stopWhen: stepCountIs(n)` (import de `ai`)
- `tool({ parameters: z… })` → `tool({ inputSchema: z… })`
- `CoreMessage` → `ModelMessage`
- providers → v2 (`@ai-sdk/openai/anthropic/google/react@^2`), `ai@^5`, `@ai-sdk/provider@2`, `provider-utils@3`. zod 4 recomendado (opcional; v5 roda com zod 3).

**Arriscado:**
- **command-engine (#2):** processamento do resultado lê `tr.args`/`tr.result` e `tc.args` (linhas 578-761) → v5: `.input`/`.output`. Está em `as unknown as Raw…` → **tsc NÃO pega**, só runtime. Tocar o HITL (buildConfirmation, validateConfirmArgs, perguntar/propor, metering). `result.usage` agora é só do último passo → usar `result.totalUsage` no custo.
- **chat/route + useChat (#3/#4):** `toDataStreamResponse()` → `toUIMessageStreamResponse()` no servidor, casado com o client. `useChat` v5 REMOVE `input/handleInputChange/handleSubmit` (você gerencia o input + `sendMessage()`), `isLoading`→`status`, `messages` viram **UIMessage (parts)** — render muda de `message.content` p/ `message.parts`; `api`→`transport: new DefaultChatTransport({api})`. `ai/react` → `@ai-sdk/react`.
- **mcp-bridge (#5):** confirmar se `experimental_createMCPClient`/`client.tools()` mudaram no v5 (a ponte injeta as 55 tools MCP — crítico).

## Plano faseado
- **F0** — branch dedicada; bump dos pacotes (`ai@5` + providers@2). `tsc` passa a apontar os breaks mecânicos.
- **F1** — renames mecânicos nos 6 arquivos (params, inputSchema, ModelMessage, stopWhen) → `tsc` verde.
- **F2 (🔴)** — command-engine: `.args→.input`, `.result→.output`, `totalUsage`. Cobrir com os **evals** + QA manual do HITL (card de confirmação, send_message editável, perguntar/propor).
- **F3 (🔴)** — streaming: `toUIMessageStreamResponse` no chat/route + reescrita do `useChat` no assistant-panel-content + render por `parts`. QA do chat antigo (unified-panel).
- **F4 (🟡)** — mcp-bridge: verificar/ajustar createMCPClient + client.tools(); smoke do `tools/call` (MCP in-app E externo).
- **F5** — reativar `gemini-3.5-flash` no whitelist do canvas; rodar o **A/B Gemini 3.5 × Sonnet** (objetivo original).

## Validação (obrigatória — Assistente é receita)
- `tsc` 0 + `npm run lint`.
- Evals: `lib/assistant/evals/judge.ts`, `ai-platform-e2e.live.test.ts`.
- QA manual: Assistente (HITL: confirmar/cancelar, send_message editável, perguntar/propor, streaming), MCP `tools/call` (in-app + Claude/ChatGPT externo), canvas build, parse-text/forms (não tocados, mas conferir que nada regrediu por dep transitiva).

## Esforço & recomendação
- **Esforço:** ~1–2 dias focados. O grosso do risco/tempo está em **F2 (HITL do command-engine)** e **F3 (useChat)** — código hardened/load-bearing.
- **Recomendação:** fazer **isolado (branch própria), gated por evals + QA**, e **NÃO urgente**. Justificar por **v5 (streaming U-STREAM + futuro)**, com o Gemini 3.5 como bônus — não migrar só pelo Gemini (payoff incerto). **Sequenciar DEPOIS** de shippar o canvas no Sonnet (que já está pro-level). Se o único objetivo for o A/B do 3.5, o risco/retorno é marginal.
