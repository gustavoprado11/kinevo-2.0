# Loop de Retenção — MVP do rascunho de mensagem (Assistente Kinevo)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O Assistente Kinevo já **detecta** problemas de retenção em background (alunos
ausentes, cargas estagnadas, programas vencendo, dores reportadas) e os exibe
como cards no painel "Assistente Kinevo" do dashboard. O que falta é a **camada
de ação**: hoje, ao ver um card de "estagnação", o treinador clica em "Mensagem"
e é jogado para o chat com o aluno com a tela em branco — ele tem que pensar e
escrever a mensagem do zero.

Este MVP entrega a primeira fatia do loop **detectar → rascunhar → treinador
revisa/aprova → enviar**: ligar o botão "Mensagem" de um card a um agente que
gera um rascunho de mensagem personalizada (na voz do treinador, ancorada em
dados reais do aluno), que o treinador edita e aprova antes de enviar. A IA
propõe; o treinador nunca sai do controle.

**Metade já existe.** A detecção NÃO será construída — é o cron/enricher de
insights que já roda
(`web/src/app/api/cron/generate-insights/route.ts`,
`web/src/lib/assistant/insight-enricher.ts`). Construímos só o gerador de
rascunho e a UI de revisão.

## Objetivo

Ao clicar em "Mensagem" no card de um insight com `student_id`, o treinador
recebe em ~2s um rascunho de mensagem que cita um dado real do aluno
(check-in, sessão, carga), pode editar livremente, e ao aprovar dispara o envio
reusando a mesma mecânica de `kinevo_send_message` (insere em `messages` +
push). O insight é marcado como tratado (`status='acted'`).

---

## Fase 1 — Validação contra o código (achados + divergências)

### 1. A detecção já existe ✅ (confirmado)

- **Enricher:** `web/src/lib/assistant/insight-enricher.ts` — Fase 2 que
  reescreve título/corpo com `gpt-4.1-mini` via `callLLM`
  (`insight-enricher.ts:132`) e consolida estagnações. É best-effort.
- **Disparo:** cron diário `GET /api/cron/generate-insights`
  (`web/src/app/api/cron/generate-insights/route.ts:17-22`), com 6 detectores:
  `detectTrainingGaps` (`:229`), `detectLoadStagnation` (`:264`),
  `detectExpiringPrograms` (`:399`), `detectPainReports` (`:446`),
  `detectReadyToProgress` (`:493`), `detectFormInsights` (`:680`).
- **Tabela `assistant_insights`:** criada em
  `supabase/migrations/088_assistant_insights.sql:9-27`. Colunas relevantes:
  `trainer_id`, `student_id` (nullable), `category`
  (`alert|progression|suggestion|summary|pinned_note`), `priority`, `title`,
  `body`, `action_type`, `action_metadata` (JSONB),
  **`status` (`new|read|dismissed|acted`)**, `source` (`rules|llm|trainer`),
  `insight_key` (UNIQUE com `trainer_id`), `expires_at`.
  Estendida em `093` (pinned notes) e `174` (RLS insert).
- **CTAs por tipo** (hard-coded no card):
  `web/src/components/dashboard/assistant-action-cards.tsx:71-104` —
  `gap_alert`→Mensagem; `stagnation`→Mensagem + Novo programa;
  `program_expiring`→Novo programa + Mensagem; `pain_report`→Mensagem.

> **Divergência 1 — não há coluna "treated/handled":** o "marcar como tratado"
> usa o enum existente `status='acted'`
> (`088_assistant_insights.sql`; tipo em `web/src/actions/insights.ts:33`).
> O feed do dashboard só carrega `status IN ('new','read')`
> (`web/src/actions/insights.ts:67`), então setar `'acted'` já remove o card.

### 2. Painel e card ✅ (confirmado, com divergência no botão)

- **Painel:** `web/src/components/dashboard/assistant-action-cards.tsx`
  (header "Assistente Kinevo" em `:282`); lazy-loaded em
  `web/src/app/dashboard/dashboard-client.tsx:34,181-192`.
- **Cards:** renderizados em `assistant-action-cards.tsx:310-415`.
- **Botão "Mensagem" hoje:** handler `handleDirectAction`
  (`assistant-action-cards.tsx:236-246`) → `openPanel('messages')` +
  `openConversation(studentId)` (abre o painel de mensagens com a conversa, **tela
  em branco**) via `web/src/stores/communication-store.ts`.
- **Botão "Analisar"/primário hoje:** `handleInsightAction`
  (`assistant-action-cards.tsx:216-228`) → `openChat({...})` abre o chat do
  assistente. **NÃO mexer neste botão** (escopo).
- **Streaming existente:** só dentro do painel do assistente
  (`web/src/components/communication/assistant-panel-content.tsx:95`,
  `useChat` de `ai/react` contra `/api/assistant/chat`). **Não há UI de rascunho
  nos cards hoje.**
- **Dados do insight no client:** `InsightItem` em
  `web/src/actions/insights.ts:23-37` (carrega `id`, `student_id`,
  `insight_key`, `action_type`, `action_metadata`).

> **Divergência 2 — "Mensagem" abre o painel de mensagens, não um compositor.**
> Hoje o botão leva ao chat aluno↔treinador vazio. O MVP intercepta esse
> clique para abrir um **compositor de rascunho** (ver UI abaixo) antes de cair
> no envio.

### 3. Peças para buscar contexto do aluno ⚠️ (divergência estrutural)

- **`get_student_progress`:** lógica **inline** no handler da tool MCP em
  `web/src/lib/mcp/tools/progress.ts:17-163` (params `student_id`, `days`,
  `exercise_id`). Retorna `summary` (`total_sessions`, `avg_rpe`…), `sessions[]`
  (com **`rpe` [S]**) e `exercise_progression[]` (cargas/1RM — **[S]**).
  Escopo: `createAdminClient()` + checagem `coach_id === trainerId`
  (`progress.ts:23-28`).
- **`get_workout_checkins`:** lógica **inline** em
  `web/src/lib/mcp/tools/insights.ts:64-101` (params `student_id`, `limit`).
  Retorna `checkins[]` com `trigger_context`, `submitted_at` e **`answers` [S]**
  (humor, energia, dor, sono…). Escopo via `coach_id` (`insights.ts:69-74`).

> **Divergência 3 — NÃO existem "cores" reutilizáveis `progress.ts`/`insights.ts`.**
> A ideia assume funções de domínio prontas; na verdade a lógica está **embutida
> nos handlers das tools MCP** usando `createAdminClient()`. O plano portanto
> inclui **extrair** essa lógica para funções de lib puras e fazer tanto as tools
> MCP quanto o novo endpoint chamarem-nas (padrão já adotado em
> `web/src/lib/insights/upsert.ts:50` e `web/src/lib/dashboard/get-dashboard-data.ts`).

### 4. Client de LLM ✅ (confirmado)

- `web/src/lib/prescription/llm-client.ts`:
  - `callLLM(options): Promise<LLMCallResult<string>>` (`:336`).
  - `callWithRetry<T>(makeCall, opts)` (`:482`).
  - `LLMCallOptions` (`:56-78`): `model`, `system`, `messages`, `max_tokens`,
    `timeout_ms`, `temperature?`, **`structured_output?`** (JSON Schema p/ OpenAI),
    `json_object_mode?`.
  - `LLMTokenUsage` (`:48-54`): `input_tokens`, `output_tokens`,
    `cached_input_tokens`, **`cost_usd`** (calculado em `computeCost` `:109-119`).
  - **`gpt-4.1-mini` suportado** (`:22-26`).

> **Divergência 4 — `callLLM` NÃO faz streaming.** Retorna o resultado completo.
> O requisito de "textarea streamado" só seria possível com `streamText`
> (`@ai-sdk/openai`, como em `/api/assistant/chat`). Como a saída é **JSON
> estruturado** (`message`+`references`+`confidence`), streamar token-a-token de
> um JSON é frágil. **Decisão do MVP:** chamada única não-streaming (~2s) com
> estado de loading no card; streaming fica como melhoria futura (ver Riscos).

### 5. Envio ✅ (confirmado, com divergência estrutural)

- `kinevo_send_message` é **inline** em
  `web/src/lib/mcp/tools/messages.ts:8-87` (params `student_id`, `content`).
  Efeitos: insere em `messages` (`sender_type:'trainer'`), depois
  `insertStudentNotification` + `sendStudentPush` (fire-and-forget,
  `messages.ts:61-79`).

> **Divergência 5 — também não há "core" extraído de envio.** Mesmo padrão da
> Divergência 3: extrair `sendTrainerMessage(...)` para lib e reusar.

### 6. Medidor de custo ⚠️ (confirma a auditoria, com nuance)

- O custo **é computado** pelo client (`cost_usd` em `LLMTokenUsage`).
- **É persistido por treinador apenas para PRESCRIÇÃO**, na tabela
  `prescription_generations` (`supabase/migrations/035` + telemetria em
  `104`), via `logGenerationTelemetry`
  (`web/src/lib/prescription/telemetry.ts:28-57`).
- **NÃO há ledger genérico de uso de LLM por treinador/por chamada.** O enricher,
  por exemplo, só faz `console.log` do custo
  (`web/src/lib/assistant/insight-enricher.ts:157-158`) — nada é gravado.
- O chat do assistente também não loga custo; protege-se só com rate-limit
  per-trainer (`/api/assistant/chat` `:43-48`, `consumeRateLimit` em
  `web/src/lib/rate-limit.ts:13`).

> **Conclusão:** a auditoria está correta — não existe log de token/custo
> amarrado a `trainer_id` por chamada fora da prescrição. **O medidor nasce
> aqui:** este MVP cria a primeira tabela genérica de uso
> (`assistant_llm_usage`) e o endpoint de rascunho é seu primeiro escritor.

---

## Fase 2 — Especificação do MVP

### Contrato do endpoint

```
POST /api/assistant/draft-message
auth: sessão do treinador (cookie Supabase)
body: { insight_id: string, student_id: string }
resposta 200: {
  draft: {
    message: string,
    references: string[],   // âncoras factuais usadas (ex.: "Check-in 12/06: energia 2/5")
    confidence: "high" | "low"
  },
  cost_usd: number
}
erros: 401 (não autenticado) · 404 (trainer/insight/aluno não encontrado)
       · 403 (insight/aluno não pertence ao treinador) · 429 (rate limit)
       · 502 (LLM falhou após retries)
```

**Fluxo do servidor** (espelha auth/rate-limit de `/api/assistant/chat`):

1. **Auth:** `createClient()` → `getUser()`; resolver `trainer` por
   `auth_user_id` (`chat/route.ts:24-40`). 401/404 se faltar.
2. **Rate limit per-trainer:** `consumeRateLimit('assistant:draft:${trainer.id}',
   { perMinute: 10, perDay: 100 })` (`rate-limit.ts:13`). 429 se estourar.
3. **Validar `insight_id`/`student_id`** (regex UUID) e **carregar o insight**
   de `assistant_insights` filtrando por `trainer_id` (ownership). 403/404 se
   não bater. Ler `category`, `action_type`, `action_metadata`, `title`, `body`.
4. **Buscar contexto do aluno** reusando os cores extraídos (ver Divergência 3):
   `getStudentProgress(supabaseAdmin, trainerId, { student_id, days: 30 })` +
   `getWorkoutCheckins(supabaseAdmin, trainerId, { student_id, limit: 5 })`.
   Os cores já validam `coach_id === trainerId`.
5. **Montar o bloco de contexto** (texto curto e factual): nome do aluno, o que
   o insight detectou (do `title`/`body`/`action_metadata`), últimos check-ins
   (data + respostas-chave), dado de progresso relevante (ex.: última sessão,
   carga estagnada). Se não houver dado → contexto pobre → sinalizar para o
   prompt produzir mensagem genérica + `confidence:"low"`.
6. **Chamar o LLM:** `callWithRetry(() => callLLM({ model: 'gpt-4.1-mini',
   system: SYSTEM_PROMPT, messages: [{ role:'user', content: contextBlock }],
   structured_output: true, max_tokens: 400, timeout_ms: 15000, temperature: 0.5 }))`.
   Parsear `{ message, references, confidence }`.
7. **Logar uso por treinador** (o medidor): inserir em `assistant_llm_usage`
   `{ trainer_id, feature:'draft_message', model:'gpt-4.1-mini', input_tokens,
   output_tokens, cost_usd, insight_id }` a partir de `result.usage`.
   Best-effort (não derruba a resposta).
8. **Responder** `{ draft, cost_usd }`. **O endpoint NÃO envia** — o envio é
   ação separada após edição/aprovação do treinador.

> Nota: o **envio** reusa o core extraído `sendTrainerMessage(supabaseAdmin,
> trainerId, { student_id, content })` (Divergência 5) com o texto final
> (possivelmente editado). Via a server action `sendMessageAction` que o painel
> de mensagens já usa, ou — se o compositor estiver no painel de mensagens — o
> próprio fluxo de envio existente.

### System prompt (não-negociável)

```
Você é o assistente de retenção de um personal trainer. Escreva UMA mensagem
curta de WhatsApp, em português do Brasil, na VOZ DO TREINADOR (1ª pessoa,
"eu"/"você"), para reconectar com o aluno.

REGRAS INVIOLÁVEIS:
- Você PERGUNTA, não conclui. PODE perguntar sobre algo que o aluno relatou
  (ex.: "vi que marcou energia baixa no último check-in, como você tá?"),
  mas NUNCA afirma fato médico, diagnóstico ou causa.
- Só referencie o que está no CONTEXTO abaixo. Se o contexto não trouxer um
  dado concreto, escreva uma mensagem genérica e calorosa — NUNCA invente
  números, datas, dores, exercícios ou check-ins.
- NÃO prescreva treino, carga, série ou exercício.
- Tom de WhatsApp: 2 a 4 frases, caloroso e direto, sem formalidade.
- Reconecte, não cobre. Convide, não pressione.

SAÍDA: responda SOMENTE com JSON válido, sem markdown:
{
  "message": "<a mensagem pronta para enviar>",
  "references": ["<cada dado do contexto que você usou para ancorar>"],
  "confidence": "high" | "low"   // "low" se o contexto for pobre/genérico
}
```

(Reforçar `structured_output: true` para travar o schema no lado OpenAI.)

### Mudanças no painel/card

Arquivo: `web/src/components/dashboard/assistant-action-cards.tsx`
(+ componente novo de compositor).

- **No clique em "Mensagem"** (`handleDirectAction`, `:236-246`): em vez de só
  `openPanel('messages')`, abrir um **compositor de rascunho** para aquele
  insight/aluno e **disparar o fetch** `POST /api/assistant/draft-message`.
- **Estado de loading** no compositor enquanto o rascunho gera (~2s); o card que
  originou fica com indicador de "gerando".
- **Textarea editável já preenchido** com `draft.message` (não-streaming — ver
  Divergência 4). Treinador pode editar à vontade.
- **Linha de referências:** renderizar `draft.references[]` como chips/lista
  discreta ("ancorado em: …").
- **Aviso se `confidence:"low"`:** banner leve ("contexto limitado — revise com
  atenção antes de enviar").
- **Ações:** **Enviar** (dispara o envio com o texto atual do textarea →
  `sendTrainerMessage`/server action existente → ao sucesso, `markInsightActed`)
  e **Descartar** (fecha sem enviar; não marca o insight).
- **Após envio:** chamar nova action `markInsightActed(insightId)` →
  `status='acted'` (some do feed); toast de confirmação.
- **NÃO mexer no botão "Analisar"/primário** (`handleInsightAction`, `:216-228`).

### Critérios de aceite

- [ ] **Principal:** clico em "Mensagem" no card de estagnação de um aluno → em
  ~2s aparece um rascunho que cita um check-in/sessão/carga **real** dele →
  edito → Enviar → o aluno recebe a mensagem (linha em `messages` + push).
- [ ] O rascunho nunca cita dado que não está no contexto (testar aluno sem
  check-ins → mensagem genérica + `confidence:"low"` + banner de aviso).
- [ ] A mensagem pergunta/reconecta, não afirma fato médico nem prescreve treino.
- [ ] "Descartar" fecha sem enviar e o card continua no feed.
- [ ] Após "Enviar", o insight sai do feed (`status='acted'`).
- [ ] Cada geração grava uma linha em `assistant_llm_usage` com `trainer_id`,
  `cost_usd`, tokens.
- [ ] Endpoint rejeita insight/aluno de outro treinador (403) e respeita
  rate-limit (429).
- [ ] O botão "Analisar" continua abrindo o chat do assistente, inalterado.
- [ ] Sem novos erros de TypeScript; retrocompatível.

### Arquivos a tocar

**Criar:**
- `web/src/app/api/assistant/draft-message/route.ts` — o endpoint do rascunho.
- `web/src/lib/students/progress-core.ts` — extrai a lógica de
  `mcp/tools/progress.ts:17-163` numa função `getStudentProgress(supabase,
  trainerId, params)` reutilizável.
- `web/src/lib/students/checkins-core.ts` — extrai
  `mcp/tools/insights.ts:64-101` numa função `getWorkoutCheckins(...)`.
- `web/src/lib/messages/send-core.ts` — extrai
  `mcp/tools/messages.ts:8-87` numa função `sendTrainerMessage(...)`
  (insert + notification + push).
- `web/src/lib/assistant/draft-prompt.ts` — system prompt + montagem do bloco de
  contexto + parser/validação do JSON de saída.
- `web/src/components/dashboard/draft-message-composer.tsx` — UI do compositor
  (textarea, referências, aviso, Enviar/Descartar).
- `supabase/migrations/NNN_assistant_llm_usage.sql` — tabela do medidor de
  custo por treinador (RLS: treinador lê o seu; service role escreve).

**Editar:**
- `web/src/lib/mcp/tools/progress.ts` — passar a chamar `getStudentProgress`
  (sem duplicar lógica).
- `web/src/lib/mcp/tools/insights.ts` — passar a chamar `getWorkoutCheckins`.
- `web/src/lib/mcp/tools/messages.ts` — passar a chamar `sendTrainerMessage`.
- `web/src/components/dashboard/assistant-action-cards.tsx` — redirecionar o
  clique de "Mensagem" para o compositor; renderizar o compositor.
- `web/src/actions/insights.ts` — adicionar `markInsightActed(insightId)`
  (`status='acted'`), espelhando `dismissInsight` (`:122`).

### Fora de escopo (futuras fases)

- Batch de múltiplos alunos / "gerar rascunhos para todos".
- Acompanhamento de "quem voltou" depois da mensagem.
- Aprendizado/calibração da voz do treinador.
- A nova aba de chat dedicada.
- O loop agêntico completo das 55 tools do MCP.
- Geração no carregamento da página (este MVP é **lazy, no clique**).
- Streaming token-a-token do rascunho.

---

## Fase 3 — Riscos e bloqueios

- **🚧 Bloqueio LGPD / dados [S] (pré-condição de lançamento):** o MVP envia ao
  OpenAI dados sensíveis de saúde — `rpe` e `exercise_progression`
  (`progress.ts`) e `answers` de check-ins (`insights.ts`: humor, dor, sono).
  Ir ao ar com **alunos reais** pressupõe DPA + zero-retention confirmados com a
  OpenAI. Em **beta fechado com dados de teste**, o desenvolvimento pode
  prosseguir antes. Registrar como gate explícito de release.
  - Mitigação parcial: enviar ao LLM só o **mínimo necessário** (resumir
    check-ins/progresso no bloco de contexto, não despejar JSON cru).

- **Latência e tom:**
  - *Latência:* `callLLM` é não-streaming; com `gpt-4.1-mini` + `max_tokens:400`
    a chamada fica em ~1–2s. Estado de loading cobre a espera; `timeout_ms:15000`
    + `callWithRetry` para falhas transitórias.
  - *Tom:* o **passo de edição é a rede de segurança** — nada é enviado sem o
    treinador revisar. `confidence:"low"` + banner reforçam a revisão quando o
    contexto é pobre. O system prompt proíbe afirmações médicas e prescrição.

- **Premissas e incertezas:**
  - **Premissa:** a extração dos cores (progress/checkins/send) é puramente
    mecânica (a lógica inline é autocontida e já usa `createAdminClient`); não há
    efeito colateral escondido. *Validar ao extrair.*
  - **Premissa:** o feed do dashboard re-renderiza ao chamar `markInsightActed`
    (mesmo padrão de `dismissInsight`); confirmar como o `useState` local em
    `assistant-action-cards.tsx:144` é atualizado após a ação.
  - **Incerteza:** onde ancorar a UI do compositor — inline no card vs. dentro do
    painel de comunicação (`communication-store.ts`). Recomendação: compositor
    leve **inline/modal a partir do card**, mantendo o painel de mensagens
    intocado para o MVP. Decisão final na implementação.
  - **Incerteza:** `structured_output` no `callLLM` para `gpt-4.1-mini` aplica
    JSON Schema (`llm-client.ts:228-231`); confirmar o schema exato aceito para
    `references[]`/`confidence` (enum). Fallback: `json_object_mode` + validação
    no servidor.
  - **Premissa:** rate-limit 10/min, 100/dia por treinador é suficiente; calibrar
    após beta.

## Referências
- Idea/escopo: prompt do loop de retenção (jun/2026).
- Padrões espelhados: `/api/assistant/chat/route.ts` (auth + rate-limit +
  anti-prompt-injection), `lib/insights/upsert.ts` (core extraído reutilizável),
  `lib/prescription/telemetry.ts` (modelo de telemetria de custo).

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação.)
