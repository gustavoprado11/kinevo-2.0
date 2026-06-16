# Harness do Assistente Kinevo — Arquitetura

> Documento mestre. Define o que é o harness, o estado atual do código, a
> arquitetura-alvo, a ordem de implementação e como medimos qualidade.
> Escopo v1: prescrição, gestão de alunos, financeiro e agenda/leads.
> Superfícies v1: chat na aba `/assistente`, ⌘K, voz e modo proativo.

---

## 1. O que é o harness (e o que não é)

Harness **não** é "um prompt melhor". É toda a estrutura determinística em volta do
modelo que faz ele agir com precisão e segurança. O modelo é a parte não-confiável;
o harness é onde colocamos as garantias.

Regra de ouro: **toda regra crítica sai do prompt e vira código.** Se a correção de
uma ação depende do modelo "lembrar" de uma instrução em texto, ela vai falhar em
escala. O que não pode falhar (não cobrar errado, não apagar treino sem confirmação,
não vazar dados de outro treinador) precisa estar em validação de tool, gate de
confirmação ou teste automatizado — não no prompt.

O Kinevo já tem ~70% disso pronto. Este harness **estende**, não reconstrói.

---

## 2. Estado atual (o que já existe no código)

Mapeado em `web/src/lib/assistant/*`, `web/src/lib/mcp/*` e `web/src/lib/prescription/*`.

| Camada | Onde | Status |
|---|---|---|
| Motor de turno | `assistant/command-engine.ts` → `runAssistantTurn()` | ✅ Sólido |
| Ponte MCP in-memory | `assistant/mcp-bridge.ts` → `buildMcpTools()` | ✅ |
| Política de tools (read/write/confirm) | `assistant/tool-policy.ts` | ✅ Fonte de verdade |
| HITL (confirmação humana) | `tool-policy.ts` + `hitl-types.ts` + `tool-confirmation-card.tsx` | ✅ |
| Subsetting por intenção | `command-engine.ts` `resolveIntents()` + `tool-policy.ts` `TOOL_SUBSETS` | ✅ Corta 60–70% do input |
| Metering / créditos | `ai-usage/metering.ts`, `quota.ts`, `usage-summary.ts` | ✅ |
| Gate de tier + cota | `command-engine.ts` `gateAssistant()` | ✅ Defense-in-depth |
| Construção de contexto | `assistant/context-builder.ts`, `student-context.ts`, `home-data.ts` | ✅ Rico |
| Catálogo de tools MCP (55) | `mcp/tools/*.ts` | ✅ Zod em tudo |
| Sub-agente de prescrição | `prescription/claude-agent.ts` + rules/constraints/question engines | ✅ Avançado |
| Testes "live" de contrato | `assistant/*.live.test.ts` (gated por env) | ⚠️ Parcial |
| **Eval de qualidade do agente** | — | ❌ **Não existe** |

### Decisões técnicas já tomadas (respeitar)
- **Modelo:** `gpt-4.1-mini` (OpenAI via `ai` SDK). `temperature: 0.3`, `maxTokens: 900`, `maxSteps: 5`. (Nota: `claude-agent.ts` tem nome legado; hoje roda OpenAI.)
- **HITL:** as `CONFIRM_TOOLS` chegam ao modelo **sem `execute`** — o turno para e devolve `ToolConfirmationRequest`; a execução real acontece em `/api/assistant/execute-tool` após o clique humano.
- **Crédito:** todo turno custa ≥1; pesos em `CREDIT_WEIGHTS` (generateProgram=5, template=3, etc.).
- **Tools sempre passam UUID do aluno, nunca o nome.**

### Gaps encontrados (entram no roadmap)

1. **🔴 Bug de prompt — tool fantasma.** `context-builder.ts:197` instrui o modelo a
   "SEMPRE usar a tool `analyzeStudentProgress`". Essa tool **não existe** no registry
   (`ALL_MCP_TOOLS`). A tool real é `kinevo_get_student_progress`. O modelo recebe uma
   ordem impossível de cumprir → comportamento errático em perguntas sobre aluno.
   Corrigido na v2 do prompt (`01-system-prompt-referencia.md`).
2. **🟠 Dois prompts costurados sem dono único.** O `base` em `buildChatContext` +
   `ASSISTANT_INSTRUCTIONS` em `command-engine.ts` se sobrepõem e divergem (um diz
   "markdown quando útil", o outro "seja direto sem rodeios"). Consolidar em um lugar versionado.
3. **🔴 Sem suíte de eval.** Hoje a qualidade do agente é validada por testes de contrato
   (parsing de JSON, metering) e walk-throughs manuais. Não há como saber se uma mudança
   de prompt/modelo melhorou ou piorou. Esta é a maior lacuna do harness.
4. **🟠 Validação de argumentos perigosos é fraca.** O HITL protege a *execução*, mas
   não valida *semântica* dos args antes de mostrar o card (ex.: cancelar contrato de
   aluno errado, marcar pagamento com valor absurdo). Ver `03-guardrails.md`.
5. **🟠 `web_search_insights` referenciado mas não implementado** em `claude-agent.ts`.
6. **🟡 Superfícies voz/proativo** existem como enum de `surface`, mas o tratamento
   específico (respostas curtas para voz, disparo sem input para proativo) ainda não.

---

## 3. Arquitetura-alvo: as 7 camadas do harness

Pense no harness como um pipeline. Cada camada tem uma responsabilidade única e é
testável isoladamente.

```
            ┌─────────────────────────────────────────────────────┐
  entrada   │  (1) INGESTÃO & NORMALIZAÇÃO                          │
  do        │  texto / voz→texto / gatilho proativo → input limpo  │
  treinador │  + surface + route + studentId                       │
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (2) GATE          gateAssistant(): tier + cota       │  ← já existe
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (3) CONTEXTO      buildChatContext(): perfil aluno,  │  ← já existe
            │                    programa, progressão, insights     │     (consolidar prompt)
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (4) FERRAMENTAS   subsetting por intenção →          │  ← já existe
            │                    ToolSet (MCP + generateProgram)    │
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (5) MOTOR DE TURNO  generateText() loop (maxSteps)   │  ← já existe
            │                      reads/writes inline; confirm para│
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (6) GUARDRAILS    HITL + validação de args +         │  ⚠️ reforçar
            │                    rate-limit + auditoria             │
            └───────────────────────┬─────────────────────────────┘
                                     ▼
            ┌─────────────────────────────────────────────────────┐
            │  (7) OBSERVABILIDADE  metering + traces + eval offline│  ❌ eval falta
            └─────────────────────────────────────────────────────┘
```

### Camada 1 — Ingestão & normalização
Hoje o input chega cru. Para v1 multi-superfície, padronizar antes do gate:
- **Voz:** transcrição (Whisper/Deepgram) → mesmo `input`, mas marcar `surface:'voice'`
  para o prompt pedir resposta curta e falável (sem markdown, sem tabelas).
- **Proativo:** não há `input` do treinador; o "input" é um gatilho gerado
  (`"Resumo da manhã"`, `"Alunos sem treino há 7+ dias"`). Roda em job agendado.
- **⌘K vs aba:** já tratado (history vazio vs persistido).

### Camada 3 — Contexto (consolidar)
O contexto é o maior alavanca de *precisão útil*. Já é rico. Ações:
- Unificar o prompt em uma única função versionada (`buildSystemPrompt(version)`).
- Adicionar **data/hora atual e timezone do treinador** ao contexto (hoje ausente —
  crítico para agenda: "remarca pra amanhã" precisa saber que dia é hoje).
- Para modo proativo, injetar o "porquê" do disparo no contexto.

### Camada 6 — Guardrails (reforçar)
Detalhado em `03-guardrails.md`. Resumo: HITL cobre execução; falta validação
semântica de args, rate-limit por janela e trilha de auditoria imutável.

### Camada 7 — Observabilidade & eval (construir)
Metering já existe. Falta:
- **Traces por turno:** persistir (input, tools chamadas, args, confirmação, output,
  tokens) para depurar e alimentar evals com casos reais.
- **Eval offline:** suíte versionada que roda em CI. Detalhado em `02-estrategia-de-evals.md`.

---

## 4. Casos de uso v1 e o comportamento esperado

A precisão do agente é definida por **três decisões de roteamento**, não pelo modelo:

| Tipo de ação | Política | Exemplos |
|---|---|---|
| Leitura | Executa direto | listar alunos, ver progresso, resumo financeiro |
| Escrita reversível | Executa direto + informa | atualizar aluno, criar rascunho de programa, agendar form |
| Escrita irreversível / dinheiro | **HITL — para e pede confirmação** | registrar/cancelar pagamento, cancelar contrato, excluir treino, cancelar sessão, finalizar avaliação, converter lead |

### Prescrição
- "Cria um treino ABC pra hipertrofia 4x/semana pro João" → `generateProgram` (rascunho)
  → responde com link de revisão. **Nunca** atribui programa sem revisão humana.
- "Tira o agachamento do treino B" → `kinevo_get_program` (ler) → `kinevo_delete_workout_item` (HITL, é destrutivo).
- Sempre definir `scheduled_days` ao prescrever (regra do MCP server).

### Gestão de alunos
- "Como tá o João?" → `kinevo_get_student_progress` → resumo com progressão e aderência.
- "Quem sumiu?" → usa contexto geral (`days_since_last_session`) sem nem chamar tool.

### Financeiro
- "Quem tá inadimplente?" → `kinevo_list_subscriptions` / `kinevo_get_revenue_summary` (ler).
- "Marca o pagamento da Maria como pago" → `kinevo_mark_payment_as_paid` (HITL).

### Agenda & leads
- "Remarca a sessão do Pedro pra quinta 8h" → `kinevo_reschedule_appointment` (precisa
  de data atual no contexto!).
- "Converte o lead Ana em aluna" → `kinevo_convert_lead` (HITL).

---

## 5. Roadmap de implementação (ordem recomendada)

Ordenado por **risco × esforço**: primeiro o que destrava medição e corrige erros baratos,
depois o que aumenta capacidade.

### Fase A — Fundação de qualidade (1–2 semanas) — *faça isto primeiro*
1. **Corrigir o prompt fantasma** (`analyzeStudentProgress` → `kinevo_get_student_progress`) e consolidar os dois prompts em um só versionado. *(baixo esforço, alto impacto)*
2. **Construir a suíte de eval** (`02-estrategia-de-evals.md`): 30–50 casos cobrindo os 4 domínios, runner em vitest sobre `runAssistantTurn`, rodando em CI com `RUN_EVALS=1`.
3. **Adicionar data/hora + timezone ao contexto.** Sem isso, agenda erra silenciosamente.
4. **Trace por turno** persistido (tabela `assistant_turn_traces`) — vira o dataset dos evals.

### Fase B — Guardrails semânticos (1–2 semanas)
5. Validação de args nas `CONFIRM_TOOLS` antes do card (ver `03-guardrails.md`): existência do recurso, escopo do treinador, faixas de valor.
6. Rate-limit de escrita por janela (anti-loop / anti-engano).
7. Trilha de auditoria imutável de toda ação executada (quem, o quê, args, quando, confirmada por quem).

### Fase C — Multi-superfície (2–3 semanas)
8. ✅ **Voz:** rota `/api/assistant/voice` aceita áudio (transcreve via OpenAI, sem dep
   nova) ou texto (STT on-device), roda `runAssistantTurn` com `surface:'voice'`
   (resposta curta/falável do prompt v2) + gate + rate-limit. Código: `assistant/voice.ts`
   + `api/assistant/voice`. TTS da resposta fica como melhoria opcional (client-side).
9. ✅ **Proativo:** cron `morning-briefing` (após `generate-insights`) gera o resumo do dia
   via `runAssistantTurn` (input sintético, `surface:'proactive'`) só para Pro+ com algo a
   reportar, e entrega por notificação + push. Código: `assistant/proactive.ts` +
   `api/cron/morning-briefing`. O formato telegráfico já vem do system-prompt v2.
10. ✅ **Erro amigável / fallbacks:** quota estourada já degrada via gate (402); os
    catches das rotas agora usam `assistant/errors.ts` (`assistantErrorResponse` /
    `logAssistantError`) — logam o detalhe no servidor e devolvem mensagem genérica em
    PT, sem vazar stack/SQL. Aplicado em command, conversations, voice, execute-tool e chat.

### Fase D — Capacidade & loop de melhoria (contínuo)
11. Expandir evals com casos reais vindos dos traces (especialmente falhas).
12. A/B de prompt/modelo medido pela suíte de eval (decisão por dado, não por feeling).
13. Avaliar modelo maior só para prescrição se os evals mostrarem ganho que pague o custo.

---

## 6. Como testamos (visão; detalhe em 02)

Três níveis, do mais barato/rápido ao mais caro:

1. **Unit (determinístico, sempre roda):** classificação de tools, subsetting, pesos de
   crédito, parsing de prompts. Já existe (`tool-policy.test.ts` etc.). Mantém o esqueleto correto.
2. **Eval de comportamento (LLM real, roda em CI/nightly):** dado um input + estado de DB
   semeado, o agente chama a tool certa? Para na confirmação quando deve? Não inventa dado?
   Mistura de **asserts determinísticos** (tool X foi chamada, confirmação foi pedida) e
   **LLM-as-judge** (a resposta está correta e em PT claro). **É a peça que falta.**
3. **Live de contrato (gated por env):** integração ponta-a-ponta com OpenAI + Supabase real.
   Já existe (`*.live.test.ts`). Garante que o encanamento funciona.

Métrica-chave do harness: **task success rate** por domínio (% de casos em que o agente
faz a ação correta sem ação errada), além de *false-execute rate* (executou algo sensível
sem confirmação — deve ser 0) e *hallucination rate* (afirmou dado não presente).

---

## 7. Métricas de produção (o que instrumentar)

- **Task success / turn** (via thumbs up-down + heurística de retomada).
- **False-execute rate** = ações sensíveis executadas sem card. Alvo: 0.
- **Confirmação descartada** (treinador cancelou o card) — sinal de roteamento ruim.
- **Tools por turno** e **turnos por tarefa** (eficiência).
- **Custo/turno** (já no metering) e **latência p50/p95**.
- **Cobertura de contexto:** % de turnos sobre aluno em que o snapshot veio completo.

---

## 8. Resumo executivo

O Kinevo já tem o motor, as tools, o HITL e o metering. O que separa "demo boa" de
"assistente confiável para o dia a dia do personal" são três coisas que **ainda não
existem**: (a) uma suíte de eval que diga se mudanças melhoram ou pioram, (b) guardrails
semânticos nos args sensíveis, e (c) contexto temporal correto. Comece pela Fase A —
ela é barata e destrava todo o resto.
