# Inventário de MCP + Assistente e análise de custos de inferência

> **Tipo:** Auditoria / documentação (read-only — nenhum código foi modificado).
> **Data:** 2026-06-15.
> **Escopo:** `web/src/lib/mcp/**`, `web/src/lib/prescription/**`, `web/src/lib/assistant/**`, `web/src/actions/**`, `web/src/app/api/**`. Mobile auditado: **nenhuma chamada a LLM** (é cliente das rotas web).
> **Regra de evidência:** toda afirmação sobre o sistema cita `arquivo.ts:linha`. Estimativas estão marcadas com **[ESTIMATIVA]** e a premissa declarada.

---

## Revisão — 2026-06-15

Revisão crítica de 6 alegações da versão anterior. **Inventário (Fase 1), schemas e telemetria não foram tocados** — só o que os questionamentos afetam.

| # | Alegação anterior | Veredito | Mudança |
|---|---|---|---|
| Q1 | `gpt-4.1-mini` **e** `gpt-4o-mini` "deprecados / risco de descontinuação"; migração urgente | **CORRIGIDO** | `gpt-4.1-mini` é **modelo budget CORRENTE** a $0,40/$1,60 [VERIFICADO 2026-06-15, OpenRouter/pricepertoken]. `gpt-4o-mini` é **legacy mas disponível** (não removido). Seção "Risco de migração" virou "Planejamento de modelo" **sem urgência**. |
| Q2 | Cache modelado a $0,20/Mtok (valor do código) | **CORRIGIDO p/ baixo** | Cache read real do `gpt-4.1-mini` = **$0,10** (75% off) [VERIFICADO 2026-06-15]. O código (`llm-client.ts:100`) usa $0,20 → **superestima** custo. Tabelas recalculadas com $0,10 (real) e $0,20 (conservador). Custos **caíram**. |
| Q3 | Gemini 3.5 Flash no F9 = $0,119, "inviável" (modelado **sem** cache) | **CORRIGIDO** | Com cache read $0,15 (90% off): **~$0,055/tarefa**. Reclassificado de "inviável" → **"premium, ~2,6–3,3× o gpt-4.1-mini"**. Acrescentado que Gemini 3.5 Flash **lidera tool-calling** (MCP Atlas 83,6% vs 75,3% GPT-5.5 [VERIFICADO 2026-06-15]) — recomendação virou trade-off, não eliminação. |
| Q4 | DPA/zero-retention como nota de rodapé (premissa #9) | **ELEVADO** | Varredura do repo: **nenhuma** config de zero-retention/org-header/`store:false` existe (só API keys). Virou **item BLOQUEANTE** acima da escolha de modelo. |
| Q5 | F9 e preço R$79,90 tratados soltos | **ACOPLADO** | "Lançar F9" e "subir p/ R$79,90" são a **mesma decisão**. Adicionada tabela viabilidade F9 × tier de preço. |
| Q6 | Arquitetura e modelo misturados nas mitigações | **ORDENADO** | Nova seção "Ordem de prioridade": (1) arquitetura do F9 (subsetting+cache+gate), independente de modelo; (2) modelo, 2ª ordem e não-urgente. |

> **Nota sobre o "Achado que precede tudo" abaixo:** segue válido que o motor roda em **OpenAI, não Claude** (CLAUDE.md desatualizado). O que mudou é apenas o *status* dos modelos OpenAI: `gpt-4.1-mini` é corrente, não deprecado.

**Correções aritméticas (2 células, ambas estavam otimistas):**

| # | Erro | Conta correta | Efeito |
|---|---|---|---|
| E1 | Célula "Pesado com subsetting+cache (~$3,7) → 🟡 23%" na tabela Q5 era **impossível** (abaixo do piso não-F9 de $4,07) | Subsetting só afeta F9: $4,07 + 200·$0,007 = **$5,47**; /16 = **34% 🔴** (acima do teto vermelho de 30%). O $3,7/23% só se alcança com **3 pernas** (subsetting + F8→4o-mini + gate capando F9). | Linha decomposta em 3; conclusão acoplada **reforçada** (gate é obrigatório, não opcional). |
| E2 | Break-even "~27/~199 tarefas com subsetting" usava $0,007/tarefa (cache cheio) | Caso de planejamento (cache parcial, premissa #6) = $0,012/tarefa → $0,19/0,012 = **~16** (amarelo) / $1,39/0,012 = **~116** (vermelho). | Apresentados melhor-caso (27/199) e planejamento (16/116) lado a lado; **usar o de planejamento**. |

A conclusão estratégica **não muda** (pesado estoura a R$39,90; caminho = R$79,90 + arquitetura) — só a margem de conforto encolheu de 🟢 para 🟡, e o **gate de uso passou a perna obrigatória**.

---

## ⚠️ Achado que precede tudo: a doc do repositório está desatualizada

O `web/CLAUDE.md` afirma que a prescrição usa **Claude (`@anthropic-ai/sdk`)** e que formulários usam **`gpt-4o-mini`**. **O código vivo diverge:**

- Todas as features de LLM hoje rodam em **OpenAI `gpt-4.1-mini`** (default) com fallback **`gpt-4o-mini`** — ver `web/src/lib/prescription/llm-client.ts:122-123` (`DEFAULT_GENERATION_MODEL = 'gpt-4.1-mini'`, `FALLBACK_GENERATION_MODEL = 'gpt-4o-mini'`).
- O provider Anthropic **existe** no client (`llm-client.ts:143-194`) e os modelos `claude-haiku-4-5` / `claude-sonnet-4-6` estão na tabela de preço (`llm-client.ts:98-99`), mas **nenhuma feature seleciona um modelo `claude-*`**. A detecção de provider (`llm-client.ts:129-132`) só roteia para Anthropic se o nome do modelo começar com `claude`, o que não ocorre em nenhum call-site.
- Logo, **a dependência `@anthropic-ai/sdk` está presente mas inerte em produção**; o motor real é OpenAI.

Isso muda a base da análise de custo: o preço-referência de Claude/Gemini do enunciado serve só para o **comparativo de migração** (Fase 2), não para o estado atual.

---

# FASE 1 — Inventário do que já existe

## 1A. Servidor MCP

### Endpoint, transporte e autenticação

| Item | Valor | Evidência |
|---|---|---|
| Rota | `POST /api/mcp` (+ `GET` discovery, `OPTIONS` CORS, `DELETE` no-op) | `web/src/app/api/mcp/route.ts:65,85,8,173` |
| Transporte | **Streamable HTTP** (stateless), `WebStandardStreamableHTTPServerTransport`, `sessionIdGenerator: undefined`, `enableJsonResponse: true` | `route.ts:104-107,135-138` |
| Server MCP | `@modelcontextprotocol/sdk` `McpServer`, `name: kinevo`, `version: 1.0.0`, com `instructions: KINEVO_INSTRUCTIONS` | `web/src/lib/mcp/server.ts:46-54` |
| Métodos públicos (sem auth) | `initialize`, `notifications/initialized`, `tools/list` — usam `trainerId='__discovery__'` (schemas estáticos, sem acesso a dado) | `route.ts:79-83,101-111` |
| Auth | `Authorization: Bearer <token>` obrigatório em `tools/call` e demais | `web/src/lib/mcp/auth.ts:84-92` |
| Dois tipos de credencial | (1) **API key** `kinevo_trainer_*` validada por **bcrypt** contra `trainer_api_keys.key_hash` (lookup por `key_prefix`); (2) **OAuth token** `kinevo_at_*` validado por **sha256** contra `mcp_oauth_tokens.access_token_hash` | `auth.ts:24-54,57-79` |
| Validação extra | exige assinatura ativa (`subscriptions.status in active/trialing`); senão **403** | `auth.ts:102-117` |
| Rate limit | **30/min, 1000/dia** por credencial (`consumeRateLimit`) | `auth.ts:7,119-124` |
| Anti-DNS-rebinding | allowlist de `Origin` (claude.ai/.com, chatgpt.com, openai.com, kinevoapp.com, localhost); requests sem `Origin` (server-to-server) são permitidos | `route.ts:36-63,86-89` |
| OAuth (RFC 9728) | 401 retorna `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource"` | `route.ts:122-128` |
| Logging | `logToolUsage(trainerId, apiKeyId, toolName, durationMs, ok, err)` fire-and-forget → `mcp_tool_usage_logs` | `route.ts:156-168`; migrations `146`, `199` |

**Custo de contexto reinjetado por turno (system + tool defs):**

| Bloco | Caracteres | Tokens (≈ chars/3.9, PT) | Fonte |
|---|---|---|---|
| `KINEVO_INSTRUCTIONS` (system) | 7.858 | ~2.015 | `server.ts:4-43` (medido) |
| 55 tool defs — `description` strings | 10.462 | — | inventário abaixo (medido) |
| 55 tool defs — schemas (fonte zod) | 8.372 | — | inventário abaixo (medido) |
| **Subtotal defs (fonte)** | **18.834** | ~4.830 | |

> **[ESTIMATIVA] Tokens reais do payload de tools ≈ 7.000–8.000.** Premissa: o MCP serializa cada tool como JSON Schema (`{"name","description","inputSchema":{"type":"object","properties":{…},"required":[…]}}`), ~1,5–1,7× mais verboso que a fonte zod medida. 18.834 chars de fonte → ~30.000 chars serializados → ~7.500 tok.
>
> **Total fixo reinjetado a cada rodada agêntica ≈ 9.500 tokens** (system ~2.000 + tools ~7.500). **Esse é o número que domina o custo da futura tela de chat in-app** (Fase 2).

### Catálogo COMPLETO de tools (55)

Convenções: **R** = read · **W** = write · **W-GATE** = write com `confirm` obrigatório · **W-DESTR** = destrutivo. **[S]** = toca dado sensível de aluno (saúde/clínico/pessoal — LGPD).

| # | Tool | R/W | Parâmetros (tipo) | Tabelas / RPC Supabase | Evidência | [S] |
|--|--|--|--|--|--|--|
| 1 | `kinevo_ping` | R | — | `trainers`, `subscriptions`, `students` | `ping.ts:7` | |
| 2 | `kinevo_list_students` | R | search?, status?(enum), limit?(1-100), offset? | `students`, `assigned_programs`, `workout_sessions` | `students.ts:8` | |
| 3 | `kinevo_get_student` | R | student_id(uuid) | `students`, `student_prescription_profiles`, `assigned_programs`, `workout_sessions`, `student_contracts` | `students.ts:93` | **[S]** restrições médicas, nível, perfil clínico |
| 4 | `kinevo_create_student` | W | name, email, phone?, objective?, modality(enum), training_level?, medical_restrictions?[] | `auth.admin.createUser`, `students`, `student_prescription_profiles` | `students-write.ts:9` | **[S]** restrições médicas |
| 5 | `kinevo_update_student` | W | student_id, name?, phone?, objective?, modality?, trainer_notes?, status? | `students` | `students-write.ts:83` | **[S]** `trainer_notes` (obs. clínicas) |
| 6 | `kinevo_list_programs` | R | student_id?, status?, type?(def assigned), limit?, offset? | `program_templates`, `assigned_programs`, `assigned_workouts` | `programs.ts:8` | |
| 7 | `kinevo_get_program` | R | program_id, type? | `assigned_*` + `*_templates` (programs/workouts/items/sets), `exercises` | `programs.ts:82` | |
| 8 | `kinevo_create_program` | W | name, description?, duration_weeks?, student_id? | `assigned_programs`, `program_templates`, `students` | `programs-write.ts:14` | |
| 9 | `kinevo_create_program_template` | W | name, description?, duration_weeks?, sessions[]{name,scheduled_days,items[]} | RPC `create_program_template_tree`, `exercises` | `programs-write.ts:86` | |
| 10 | `kinevo_assign_program` | W | program_id, student_id?, start_date?, action(enum) | RPC `assign_program_to_student`, `program_templates`, `students`, `assigned_programs` | `programs-write.ts:256` | |
| 11 | `kinevo_expire_program` | W | program_id | `assigned_programs` | `programs-write.ts:358` | |
| 12 | `kinevo_list_training_methods` | R | — | `training_method_presets` | `exercises.ts:9` | |
| 13 | `kinevo_list_exercises` | R | search?, muscle_group?, equipment?, limit?, offset? | `exercises`, `muscle_groups`, `exercise_muscle_groups` | `exercises.ts:60` | |
| 14 | `kinevo_create_exercise` | W | name, equipment?, video_url?, instructions?, muscle_groups?[] | `exercises`, `muscle_groups`, `exercise_muscle_groups` | `exercises-write.ts:8` | |
| 15 | `kinevo_add_workout_session` | W | program_id, program_type?, name, order_index?, scheduled_days?[] | `assigned_workouts`/`workout_templates` | `workouts-write.ts:181` | |
| 16 | `kinevo_add_exercise_to_session` | W | workout_id, workout_type?, exercise_id, sets?, reps?, rest_seconds?, notes?, exercise_function?, method_key?, set_scheme?[], rounds? | `assigned_workout_items`/`*_templates`, `*_item_sets`, `exercises` | `workouts-write.ts:266` | |
| 17 | `kinevo_update_workout_session` | W | workout_id, workout_type?, name?, order_index?, scheduled_days?[] | `assigned_workouts`/`workout_templates` | `workouts-write.ts:404` | |
| 18 | `kinevo_delete_workout_session` | W-DESTR | workout_id, workout_type? | `assigned_workouts`/`workout_templates` (cascade) | `workouts-write.ts:459` | |
| 19 | `kinevo_update_workout_item` | W | item_id, workout_type?, exercise_id?, sets?, reps?, rest_seconds?, notes?, method_key?, set_scheme?[], rounds? | `assigned_workout_items`/`*_templates`, `*_item_sets`, `exercises` | `workouts-write.ts:495` | |
| 20 | `kinevo_create_superset` | W | workout_id, workout_type?, rest_seconds?, order_index?, exercises[]{…} (2+) | `assigned_workout_items`/`*_templates`, `exercises` | `workouts-write.ts:605` | |
| 21 | `kinevo_delete_workout_item` | W-DESTR | item_id, workout_type? | `assigned_workout_items`/`*_templates` (cascade) | `workouts-write.ts:740` | |
| 22 | `kinevo_get_student_progress` | R | student_id, days?(1-365), exercise_id? | `students`, `workout_sessions`, `set_logs`, `exercises` | `progress.ts:9` | **[S]** RPE/carga/esforço percebido |
| 23 | `kinevo_get_form_responses` | R | student_id, category?, trigger_context?, limit? | `students`, `form_submissions`, `form_templates` | `progress.ts:167` | **[S]** anamnese/check-in (dores, sensações) |
| 24 | `kinevo_get_dashboard_summary` | R | — | `students`, `assigned_programs`, `workout_sessions`, `messages`, `form_submissions` | `dashboard.ts:7` | |
| 25 | `kinevo_send_message` | W | student_id, content(1-2000) | `students`, `trainers`, `messages` (+push) | `messages.ts:10` | |
| 26 | `kinevo_list_subscriptions` | R | status?, limit? | `student_contracts`, `students`, `trainer_plans` | `billing.ts:8` | |
| 27 | `kinevo_get_revenue_summary` | R | month?(YYYY-MM) | `student_contracts`, `contract_events`, `students` | `billing.ts:62` | |
| 28 | `kinevo_list_plans` | R | only_active?, limit? | `trainer_plans` | `billing-write.ts:11` | |
| 29 | `kinevo_generate_checkout_link` | W | student_id, plan_id | action `generateCheckoutLinkCore`, Stripe | `billing-write.ts:56` | |
| 30 | `kinevo_create_plan` | W | title, price, interval(enum), description?, visibility?, with_online_payment?, allow_*?, max_installment_count? | `trainer_plans`, Stripe | `billing-write.ts:83` | |
| 31 | `kinevo_update_plan` | W | plan_id, title?, price?, interval?, … | `trainer_plans`, Stripe | `billing-write.ts:116` | |
| 32 | `kinevo_create_contract` | W-GATE | student_id, plan_id?, billing_type(enum), block_on_fail?, **confirm** | action `createContractCore`, `students`, `trainer_plans` | `billing-write.ts:163` | |
| 33 | `kinevo_mark_payment_as_paid` | W-GATE | contract_id, **confirm** | action `markAsPaidCore`, `student_contracts` | `billing-write.ts:210` | |
| 34 | `kinevo_cancel_contract` | W-GATE-DESTR | contract_id, cancel_at_period_end?, **confirm** | action `cancelContractCore`, Stripe/Asaas | `billing-write.ts:243` | |
| 35 | `kinevo_list_conversations` | R | limit? | `students`, `messages` | `conversations.ts:8` | |
| 36 | `kinevo_get_conversation` | R | student_id, limit?, before? | `students`, `messages` (auto-marca lido) | `conversations.ts:108` | |
| 37 | `kinevo_list_appointments` | R | range_start, range_end | action `listAppointmentsCore`, `students` | `appointments.ts:28` | |
| 38 | `kinevo_create_appointment` | W | student_id, starts_on, start_time, duration_minutes?, frequency?, ends_on?, notes? | action `createRecurringCore` | `appointments.ts:80` | |
| 39 | `kinevo_reschedule_appointment` | W | recurring_appointment_id, original_date, new_date, new_start_time, scope?, notes? | action `rescheduleOccurrenceCore` | `appointments.ts:117` | |
| 40 | `kinevo_cancel_appointment_occurrence` | W-DESTR | recurring_appointment_id, occurrence_date, notes? | action `cancelOccurrenceCore` | `appointments.ts:148` | |
| 41 | `kinevo_mark_appointment_status` | W | recurring_appointment_id, occurrence_date, status(enum), notes? | action `markOccurrenceStatusCore` | `appointments.ts:172` | |
| 42 | `kinevo_cancel_appointment_series` | W-DESTR | recurring_appointment_id, ends_on? | action `cancelRecurringCore` | `appointments.ts:198` | |
| 43 | `kinevo_list_form_templates` | R | category?, limit? | `form_templates` | `forms.ts:13` | |
| 44 | `kinevo_send_form` | W | template_id, student_ids[], due_at?, message? | action `assignFormCore` | `forms.ts:53` | **[S]** envia anamnese/avaliação |
| 45 | `kinevo_schedule_form` | W | template_id, student_ids[], frequency(enum) | action `createFormSchedulesCore` | `forms.ts:84` | **[S]** idem (recorrente) |
| 46 | `kinevo_list_form_schedules` | R | student_id | action `getStudentFormSchedulesCore` | `forms.ts:111` | |
| 47 | `kinevo_get_assessments` | R | session_id?, student_id?, status?, limit? | RPC `get_assessment_session(s)` | `assessments.ts:29` | **[S]** antropometria (peso, dobras, %gordura) |
| 48 | `kinevo_create_assessment_session` | W | student_id, template_id, scheduled_at?, notes?, subject_sex?, subject_age_years? | RPC `create_assessment_session`, `save_assessment_measurements` | `assessments.ts:67` | **[S]** sexo/idade + contexto de saúde |
| 49 | `kinevo_save_assessment_measurements` | W | session_id, measurements[]{…} | RPC `save_assessment_measurements` | `assessments.ts:121` | **[S]** medidas corporais |
| 50 | `kinevo_finalize_assessment` | W-DESTR | session_id, notes? | RPC `finalize_assessment_session`, `get_assessment_session` | `assessments.ts:145` | **[S]** métricas de saúde calculadas; compartilha c/ aluno |
| 51 | `kinevo_list_insights` | R | priority?, include_dismissed?, limit? | `assistant_insights`, `students` | `insights.ts:8` | |
| 52 | `kinevo_get_workout_checkins` | R | student_id, limit?(1-20) | `students`, `form_submissions`, `form_templates` | `insights.ts:57` | **[S]** dores, energia, sensações |
| 53 | `kinevo_list_leads` | R | status?, limit? | `trainer_leads` | `leads.ts:11` | |
| 54 | `kinevo_update_lead_status` | W | lead_id, status(enum) | `trainer_leads` | `leads.ts:52` | |
| 55 | `kinevo_convert_lead` | W-GATE | lead_id, modality(enum), **confirm** | action `convertLeadToStudentCore`, auth | `leads.ts:77` | **[S]** PII (nome, e-mail) → cria conta |

**Resumo:** 23 READ · 32 WRITE (dos quais 5 **W-GATE** com `confirm`: #32, #33, #34, #50, #55; e 6 **W-DESTR**). **14 tools tocam dado sensível [S]** — concentradas em alunos (#3,#4,#5), progresso/RPE (#22), formulários/check-ins (#23,#44,#45,#52), avaliação física (#47–#50) e conversão de lead (#55).

> **Implicação LGPD:** dado de avaliação física e check-in é **dado de saúde** (LGPD art. 5º, II + art. 11). Toda chamada a essas 14 tools envia esse dado para o provedor de LLM no contexto da tela in-app. Ver recomendação na Fase 2.

---

## 1B. Features que chamam LLM

Todas passam (ou deveriam passar) pelo client unificado `web/src/lib/prescription/llm-client.ts` (`callLLM`, `callWithRetry` em `:482-508`, `callWithModelFallback` em `:526-543`). Exceções: o chat usa Vercel AI SDK direto, e o gerador de formulários usa `fetch` cru.

### F1 — Assistente Chat (treinador ↔ IA)
- **Entrada:** `POST /api/assistant/chat` — `web/src/app/api/assistant/chat/route.ts:23-199`.
- **Modelo:** `gpt-4.1-mini` **hardcoded** — `route.ts:109` (`model: openai('gpt-4.1-mini')`). `maxTokens: 1500` (`:112`), **`maxSteps: 3`** (`:114` → loop agêntico de até 3 rodadas), 3 tools (`generateProgram`, `analyzeStudentProgress`, `getStudentInsights`) (`:115`).
- **Pipeline:** Vercel AI SDK `streamText()` + `toDataStreamResponse()` (streaming). Rate limit **15/min, 300/dia** (`route.ts:45`).
- **Prompt:** `buildChatContext()` em `web/src/lib/assistant/context-builder.ts:183-250`. Base ~800 chars (`:184-197`) + `TOOL_INSTRUCTIONS` ~400 chars (`:209-218`) + **snapshot dinâmico do aluno** (programa ativo, progressão de carga, padrões, check-ins, insights) quando `studentId` é passado — porção dinâmica é a maior.
- **I/O:** input = array de mensagens (máx 50, 8000 chars cada) + studentId?; output = texto streamado + tool calls (NDJSON), ~500–2000 chars.
- **Caching/retry/batch:** nenhum explícito (depende de cache automático do OpenAI). **[S]** quando há `studentId`.

### F2 — Prescrição: agente v1 (analyze + generate)
- **Entrada:** `web/src/lib/prescription/claude-agent.ts` — `analyzeContextAndAsk()` (`:73-123`) e `generateWithAgent()` (`:129-209`). *(O nome do arquivo é histórico; usa OpenAI.)*
- **Modelo:** `gpt-4.1-mini` constante — `claude-agent.ts:30` (`OPENAI_MODEL='gpt-4.1-mini'`).
- **Pipeline:** (1) **Analyze** — system `buildAgentSystemPrompt()` + `buildAgentContextMessage()`, `max_tokens 2048`, timeout 30s, JSON mode (`:82-93`); (2) **Generate** — multi-turn, `max_tokens 8000`, timeout 120s (`:138-168`). Prompts em `web/src/lib/prescription/prompt-builder.ts`.
- **I/O:** input = perfil + pool de exercícios + contexto enriquecido; output = JSON do programa, ~2000–5000 chars. **[S]** (perfil clínico do aluno).

### F3 — Prescrição: pipeline smart v2
- **Entrada:** `web/src/actions/prescription/generate-program.ts` — `generateProgram()` (`:128+`).
- **Modelo:** default via `resolveOpenAIModel()` lendo env **`OPENAI_PRESCRIPTION_MODEL`** (`:76`), default `gpt-4.1-mini`, fallback `gpt-4o-mini`. Flag `PRESCRIPTION_AI_LLM_ENABLED` (`:80`, default true). Timeout `OPENAI_PRESCRIPTION_TIMEOUT_MS` (def 25s) (`:85-89`).
- **Pipeline:** enriquecimento → rules-engine → `selectSmartExercises` → builder (heurístico/slot) → **AI optimizer** (F7) → prompt `buildSmartV2Prompt()`. Persistido em `prescription_generations`.
- **I/O:** output JSON ~5.000–15.000 chars. **retry** via `callWithRetry`, **fallback de modelo** via `callWithModelFallback`. Sem cache. **[S]**.

### F4 — "Texto para Treino" (parse de texto livre)
- **Entrada:** `POST /api/prescription/parse-text` — `route.ts:191-328`.
- **Modelo:** `MODEL_FALLBACKS = ['gpt-4.1-mini','gpt-4o-mini']` (`:20`), fallback por bloco (`:255-268`).
- **Pipeline:** split em blocos (máx 10, `MAX_TEXT_CHARS=12000` `:12-13`) → filtra catálogo por bloco (`:249`) → **N chamadas em paralelo** `Promise.all` (`:290`). `SYSTEM_PROMPT` definido inline ~2.200 chars (`:32-189`). Rate **5/min, 50/dia** (`:213-216`); timeout 26s/bloco (`:24`).
- **I/O:** input = texto livre + catálogo (id|nome); output = JSON de treinos. Sem cache. **[S]** (pode citar lesões/restrições no texto).

### F5 — Formulários IA: gerar rascunho
- **Entrada:** `web/src/actions/forms/generate-form-with-ai.ts` — `generateFormDraftWithAI()` (`:468+`), `tryOpenAIGeneration()` (`:353-360`).
- **Modelo:** env **`OPENAI_FORMS_MODEL`** default `gpt-4o-mini` (`:317`); flag `FORMS_AI_LLM_ENABLED` (`:320`). `fetch` cru à API (`:397`), `response_format: json_object` (`:407`), temp 0.2 (`:406`), timeout `OPENAI_FORMS_TIMEOUT_MS` def 12s (`:326-330`).
- **Pipeline:** 1 chamada; **fallback heurístico** se desligado/falha (`:509`). Rate **5/min, 20/dia** (`:482`).
- **I/O:** input = categoria/objetivo/contexto; output = JSON 5–15 perguntas ~1.500 chars. Sem retry/cache.

### F6 — Formulários IA: auditoria de qualidade
- **Entrada:** `web/src/actions/forms/audit-form-quality-ai.ts:38-122`. **Não usa LLM** — 100% heurístico (`:28-103`). Listado para completude.

### F7 — AI Optimizer (refino pós-builder)
- **Entrada:** `web/src/lib/prescription/ai-optimizer.ts` — `optimizeWithAI()` (`:480+`).
- **Modelo:** `gpt-4.1-mini` constante (`:94`). `max_tokens 1024` (`:95`), timeout 10s (`:96`), temp 0.3 (`:535`). Flag `ENABLE_AI_OPTIMIZER` (`:501`); **pulado** p/ iniciante de baixa adesão (`:500-509`).
- **I/O:** input = programa compacto + contexto + swap_candidates; output = 0–8 swaps + ajustes. Pós-validação descarta mudanças inválidas (`:600`). Sem cache/retry. **[S]**.

### F8 — Insights Enricher (cron/background)
- **Entrada:** `web/src/lib/assistant/insight-enricher.ts` — `enrichInsightsWithLLM()` (`:52-219`).
- **Modelo:** `gpt-4.1-mini` (`:133`), temp 0.7 (`:137`), timeout 15s (`:138`), `max_tokens` dinâmico `200 + findings*120` (`:128`).
- **Pipeline:** **batch de 3 alunos/chamada** (`:93`); `ENRICHMENT_SYSTEM_PROMPT` ~450 chars (`:31-48`). Sem retry (pula batch em erro `:141-144`). Disparado por geração de insights, não pelo usuário. **[S]**.

### Tabela-resumo (entregável Fase 1B)

| Feature | Modelo atual | Tipo | Dado sensível | Arquivo de entrada |
|---|---|---|---|---|
| F1 Assistente Chat | gpt-4.1-mini (hardcoded) | agêntico (maxSteps 3) | S (c/ studentId) | `app/api/assistant/chat/route.ts:109` |
| F2 Prescrição agente v1 | gpt-4.1-mini (const) | agêntico 2-fases | S | `lib/prescription/claude-agent.ts:30` |
| F3 Prescrição smart v2 | gpt-4.1-mini→4o-mini (env) | pipeline+LLM | S | `actions/prescription/generate-program.ts:76` |
| F4 Texto para Treino | gpt-4.1-mini→4o-mini | batch paralelo | S | `app/api/prescription/parse-text/route.ts:20` |
| F5 Formulários (gerar) | gpt-4o-mini (env) | chamada única | N | `actions/forms/generate-form-with-ai.ts:317` |
| F6 Formulários (auditar) | — (heurístico) | — | N | `actions/forms/audit-form-quality-ai.ts` |
| F7 AI Optimizer | gpt-4.1-mini (const) | chamada única | S | `lib/prescription/ai-optimizer.ts:94` |
| F8 Insights Enricher | gpt-4.1-mini (const) | batch (3 alunos) | S | `lib/assistant/insight-enricher.ts:133` |
| **F9 (futuro) Chat in-app via MCP** | a definir | agêntico (55 tools) | S | reusa `lib/mcp/tools/**` |

---

# FASE 2 — Análise de custos médios estimados

## Tabela de preços usada

**Preços REAIS dos modelos em produção** (fonte de verdade = `llm-client.ts:97-102`, US$/Mtok):

| Modelo | input | cached input | output |
|---|---|---|---|
| `gpt-4.1-mini` | **0,40** | 0,20 no código / **0,10 real** | **1,60** |
| `gpt-4o-mini` | 0,15 | 0,075 | 0,60 |
| `claude-haiku-4-5` | 1,00 | 1,00 | 5,00 |
| `claude-sonnet-4-6` | 3,00 | 3,00 (cache não consumido no código) | 15,00 |

> ⚠️ **Caching (corrigido com dado real — Q2):** o código não seta `cache_control`/`anthropic-beta` explicitamente, e o path Anthropic força `cached_input_tokens=0` (`llm-client.ts:169`). **Mas a telemetria mostra que o cache automático da OpenAI ESTÁ ativo:** uma geração real em `gpt-4.1-mini` logou **12.288 tokens cacheados** vs 7.061 novos. O desconto **real** é de **75% ($0,10/Mtok)** [VERIFICADO 2026-06-15], não os 50%/$0,20 que o código assume (`llm-client.ts:100`) — ou seja, o gasto real é **menor** que o logado. As tabelas abaixo trazem **duas colunas de cache**: $0,20 (código, conservador) e $0,10 (real).

**Preços reais VERIFICADOS nas páginas oficiais (consultado 2026-06-15, US$/Mtok)** — o enunciado errou feio em vários:

| Modelo | input | cache read | output | Fonte | vs. enunciado |
|---|---|---|---|---|---|
| `gpt-4.1-mini` (em uso) | 0,40 | **0,10**¹ | 1,60 | **CORRENTE** — modelo budget OpenAI [VERIFICADO 2026-06-15] | — |
| `gpt-4o-mini` (em uso) | 0,15 | 0,075 | 0,60 | **legacy mas disponível** (não removido) | — |
| `gpt-5.4-mini` (mini de produção atual) | 0,75 | 0,075 | 4,50 | developers.openai.com | enunciado dizia "$0,05–0,40 in" → **errado**, é $0,75 / $4,50 out |
| Claude Sonnet 4.6 | 3,00 | 0,30 (write 3,75) | 15,00 | claude.com — cache read 0,1× = **90% off** | ✅ confere ($3/$15) |
| Claude Haiku 4.5 | 1,00 | 0,10 | 5,00 | claude.com | — |
| Gemini 3 Flash | 0,50 | — | 3,00 | blog.google | — |
| Gemini 3.5 Flash | **1,50** | **0,15** (90% off) | **9,00** | metacto/eesel/devtk | enunciado dizia $0,30/$1,20 → **muito errado**, é 5–7,5× mais caro |
| DeepSeek V4 Flash | 0,14 (miss) | 0,0028 (hit) | 0,28 | deepseek.ai | ✅ confere; cache 1/10 do input |

¹ **[VERIFICADO 2026-06-15]** Cache read real do `gpt-4.1-mini` = **$0,10** (75% off do input), confirmado em OpenRouter ("60–80% cheaper") e pricepertoken. **O código usa $0,20** (`llm-client.ts:100`) → **superestima** o custo do componente cacheado. Logo o `cost_usd` gravado em `prescription_generations` está **acima** do gasto real (ver validação na telemetria). **Correção de Q1:** `gpt-4.1-mini` **NÃO está deprecado** — é o modelo budget corrente da OpenAI; `gpt-4o-mini` é legacy mas segue disponível. Não há prazo de incêndio → ver "Planejamento de modelo".

## 📊 Telemetria real de produção (projeto `lylksbtgrihzepbteest`, consultado 2026-06-15)

Substitui os volumes arbitrados por observação real. **Veredito: o uso hoje está NO PISO (beta, 1–4 contas ativas)** — os cenários médio/pesado são projeções de adoção futura, não realidade atual.

### MCP (`mcp_tool_usage_logs`)
- **144 chamadas totais**, **4 treinadores distintos**, janela 2026-05-20 → 2026-06-15 (todas nos últimos 30 dias — tabela recente).
- **Distribuição muito enviesada:** 1 conta = **120 calls (83%)** batendo cada uma das 55 tools ~1–5× — é o padrão da **conta de QA do MCP audit** (validação E2E), **não uso orgânico**. As outras 3 contas: **15, 7 e 2 chamadas** no período inteiro.
- **Uso orgânico real ≈ 2–15 chamadas MCP/treinador/mês** → bem **abaixo do cenário "leve"** (que assume 10 tarefas F9, cada uma com várias tool-calls).
- Tools mais chamadas (pela conta QA): `ping` 6, `get_assessments` 5, `convert_lead` 5, `create_contract`/`cancel_contract`/`list_appointments`/`add_exercise_to_session` 4. Spread quase uniforme confirma teste sintético, não comportamento real.

### Prescrição (`prescription_generations`)
- **25 gerações totais**, **1 único treinador**, janela 2026-02-25 → 2026-04-24. **Zero nos últimos 30 dias** → feature efetivamente **dormente** hoje.
- A tabela só passou a gravar tokens/custo recentemente: **3 linhas têm `cost_usd`/tokens reais**. Custo somado de todas as linhas = **$0,0228**.

**Custo real medido por geração (valida a estimativa de ~$0,013/op):**

| Data | Modelo | Modo | in novos | in cached | output | **custo real** |
|---|---|---|---|---|---|---|
| 2026-04-20 | gpt-4o-mini | copilot | 5.970 | 0 | 1.013 | **$0,0015** |
| 2026-04-20 | gpt-4.1-mini | copilot | 6.349 | 0 | 2.335 | **$0,0063** |
| 2026-04-24 | gpt-4.1-mini | assistant | 7.061 | **12.288** | 6.084 | **$0,0150** |

> **Conclusão da validação:** a estimativa da Fase 2 (~$0,012/prescrição em gpt-4.1-mini c/ cache) cai **exatamente** dentro do range real ($0,0063–$0,0150). A linha de 2026-04-24 confirma o cache (12.288 tok cacheados num call). **Porém (Q2):** o `cost_usd` gravado usou o `computeCost` com cache a $0,20 (`llm-client.ts:109-119,100`): 7.061·0,40 + 12.288·**0,20** + 6.084·1,60 = $0,0150. Com o **cache read real de $0,10**, o mesmo call custou de fato 7.061·0,40 + 12.288·**0,10** + 6.084·1,60 = **$0,01379** — ou seja, **a coluna `cost_usd` da tabela superestima o gasto real em ~8%** (mais, quanto maior a fração cacheada).

### Implicação para a análise de margem
- **Risco de margem é hoje TEÓRICO** — com 1–4 contas e prescrição dormente, o custo real de inferência/treinador/mês está em **centavos**, muito abaixo do teto amarelo ($1,20).
- O risco vira **real** quando: (a) a base de treinadores ativos crescer, e (b) a **tela in-app via MCP (F9)** entrar no ar — é ela, e não as features atuais, que carrega o custo perigoso (tool defs reinjetadas). Priorizar as mitigações de F9 **antes** do lançamento, não depois.

## Premissas de conversão e tokenização
- **[ESTIMATIVA]** Câmbio **R$ 5,00 / US$ 1,00**.
- **[ESTIMATIVA]** Tokenização: 1 token ≈ 3,9 chars (PT-BR + JSON).
- **[ESTIMATIVA]** ARPU bruto Kinevo = **R$ 39,90/mês ≈ US$ 8,00** (`landing-pricing.tsx:21,84`). Meta de reposicionamento **R$ 79,90 ≈ US$ 16** (`project_kinevo_branding_personal`). Hoje há **1 pagante grandfathered** — então estes números são de modelagem de unit economics, não de receita atual.

## Custo por operação (modelo gpt-4.1-mini, atual)

> Fórmula: `custo = (in_new·0,40 + in_cached·C + out·1,60) / 1e6`, com **C = 0,20 (código)** ou **C = 0,10 (real, Q2)**. Loop agêntico = contexto reenviado **inteiro** a cada rodada.

| Feature | Rodadas | Input (tok) | Output (tok) | $/op s/ cache | $/op cache $0,20 (código) | **$/op cache $0,10 (real)** |
|---|---|---|---|---|---|---|
| F1 Chat (por mensagem) | ~2 (de 3) | ~11.500 | ~700 | $0,0057 | ~$0,0051 | **~$0,0048** |
| F2/F3 Prescrição (programa) | 2–3 | ~10.500 | ~5.600 | $0,0132 | ~$0,0122 | **~$0,0117** |
| F4 Texto p/ Treino (parse) | ~3 blocos | ~7.000 | ~2.400 | $0,0066 | ~$0,0064 | **~$0,0063** |
| F5 Formulário (gpt-4o-mini) | 1 | ~250 | ~500 | $0,00034 | ~$0,0003 | **~$0,0003** |
| F7 AI Optimizer | 1 | ~3.000 | ~800 | $0,0025 | ~$0,0024 | **~$0,0023** |
| F8 Insights (batch 3 alunos) | 1 | ~1.300 | ~600 | $0,0015 | ~$0,0014 | **~$0,0014** |
| **F9 Chat in-app MCP (tarefa média)** | **~6** | **~71.900** | **~1.250** | **$0,0307** | **~$0,0213** | **~$0,0165** |

**Detalhe de F9 (o dominante).** Cada rodada reinjeta o bloco fixo system+55-tools ≈ **9.500 tok**. Numa tarefa de 6 rodadas, o input acumulado chega a ~14.350 tok na última rodada; soma das 6 ≈ 71.900 tok, dos quais ~47.500 são repetição do prefixo fixo (cacheável). **Conta com cache real $0,10:** in_new (71.900−47.500=24.400)·0,40 + in_cached 47.500·0,10 + out 1.250·1,60, /1e6 = 9.760 + 4.750 + 2.000 = **$0,0165**. **Premissa:** tool-results de leitura ~800 tok. Tarefas simples (2–3 rodadas) ≈ $0,008.

## Custo por treinador/mês (3 cenários)

**Premissas de volume/mês [ESTIMATIVA]:**

| Feature | Leve | Médio | Pesado |
|---|---|---|---|
| F1 Chat (mensagens) | 20 | 100 | 400 |
| F2/F3 Prescrições | 5 | 20 | 60 |
| F4 Parse texto | 3 | 15 | 50 |
| F5 Formulários | 2 | 8 | 20 |
| F7 Optimizer | (embutido em F3) | — | — |
| F8 Insights (batches/mês ≈ alunos/3 × frequência) | 4 (10 alunos, semanal) | 150 (30 alunos, diário) | 800 (80 alunos, diário) |
| F9 Chat in-app MCP (tarefas) | 10 | 50 | 200 |

**Custo resultante (US$/treinador/mês, gpt-4.1-mini, cache real $0,10 — Q2):**

| Feature | Leve | Médio | Pesado |
|---|---|---|---|
| F1 Chat | $0,10 | $0,48 | $1,92 |
| F2/F3 Prescrição | $0,06 | $0,23 | $0,70 |
| F4 Parse texto | $0,02 | $0,09 | $0,32 |
| F5 Formulários | ~$0,00 | ~$0,00 | $0,01 |
| F8 Insights | $0,01 | $0,21 | $1,12 |
| **F9 Chat in-app MCP** | **$0,17** | **$0,83** | **$3,30** |
| **TOTAL/treinador/mês** | **~$0,35** | **~$1,84** | **~$7,37** |
| **% do ARPU ($8,00)** | **~4%** | **~23%** | **~92%** |

> **Leitura (inalterada na direção, números um pouco menores com o cache real):** no cenário **pesado** a inferência ainda consome ~92% do ARPU de R$ 39,90 — margem efetivamente nula antes de Stripe/infra. O **F9** sozinho continua sendo ~45% do total pesado, por causa dos ~9.500 tok de tool defs reinjetados por rodada. (Com a coluna conservadora $0,20 do código: totais ~$0,39 / ~$2,07 / ~$8,27.)

## Comparativo de modelo para F9 (tarefa média ~71,9k in / 1,25k out, c/ cache) — preços REAIS

Todos os valores **com o cache read real** de cada modelo (in_new 24.400 / in_cached 47.500 / out 1.250):

| Modelo | $/tarefa | Pesado ($/treinador/mês, 200 tarefas) | Tool-calling | Observação |
|---|---|---|---|---|
| `gpt-4o-mini` (legacy) | ~$0,008 | ~$1,60 | fraco | mais barato; qualidade menor p/ agêntico multi-tool |
| **`gpt-4.1-mini` (atual, corrente)** | **~$0,0165** | **~$3,30** | ok | equilíbrio atual; **não deprecado** |
| `gpt-5.4-mini` | ~$0,0275 | ~$5,50 | bom | cache barato ($0,075) compensa; output $4,50 pesa pouco em F9 (output-light) |
| Gemini 3 Flash | ~$0,018¹ | ~$3,7¹ | bom | ¹cache estimada; exige Vertex c/ no-training p/ LGPD |
| Gemini 3.5 Flash | ~$0,055 | ~$11,0 | **líder** | **premium, ~2,6–3,3× o 4.1-mini** — não "inviável". **Lidera tool-calling: MCP Atlas 83,6% vs 75,3% GPT-5.5** [VERIFICADO 2026-06-15] |
| `claude-sonnet-4-6` (cache $0,30) | ~$0,106 | ~$21,2 | forte | premium; inviável no ARPU atual, só p/ tarefas de alto valor |
| DeepSeek V4 Flash | ~$0,004 | ~$0,80 | — | barato, **mas ❌ proibido p/ dados [S]** (jurisdição CN / treino no input) |

> **Conta Gemini 3.5 Flash c/ cache (Q3):** 47.500·0,15 + 24.400·1,50 + 1.250·9,00, /1e6 = 7.125 + 36.600 + 11.250 = **$0,055/tarefa** (vs $0,119 sem cache na versão anterior). Premium, **não eliminado** — especialmente porque é o **melhor em tool-calling**, que é exatamente o trabalho do F9.
>
> **Nuance:** F9 é **input-heavy / output-light** (1,25k out). `gpt-5.4-mini` (output $4,50 mas cache $0,075) fica só ~1,7× acima do `gpt-4.1-mini` em F9. **Já a prescrição (F2/F3) é output-heavy (~5,6k out)** → trocar p/ `gpt-5.4-mini` ~**2,5×** ($0,012 → ~$0,030/programa). Qualquer mudança de modelo dói mais na prescrição que no chat.

## Planejamento de modelo (sem urgência — Q1)
**Correção:** `gpt-4.1-mini` **é modelo corrente** da OpenAI ($0,40/$1,60) [VERIFICADO 2026-06-15]; `gpt-4o-mini` é legacy mas **disponível**. **Não há prazo de incêndio** — isto é planejamento prudente, não mitigação de risco iminente.
- **Opção (não-urgente) de upgrade:** `gpt-5.4-mini` — mesmo provider/SDK, só trocar a string e a entrada em `PRICING`/`LLMModel` (`llm-client.ts:97-102,23-26`). Custo: chat/F9 ~+70%; prescrição ~+2,5×. **Só justifica se a qualidade do 4.1-mini se mostrar insuficiente** — não há ganho de custo.
- **Para o F9 especificamente:** se o tool-calling do `gpt-4.1-mini` se mostrar instável com 55 tools, fazer **head-to-head real `gpt-4.1-mini` vs Gemini 3.5 Flash** (líder de tool-calling) antes de decidir — trade-off qualidade×custo, não escolha automática pelo mais barato.
- **Prioridade:** esta decisão é **2ª ordem** (ver "Ordem de prioridade") — depende da arquitetura do F9 e de telemetria de qualidade que ainda não existe.

## Recomendação por feature (qualidade × custo × LGPD)

LGPD: avaliação física e check-ins são **dado de saúde** (sensível). Evitar providers que (a) treinam no input por padrão ou (b) roteiam para jurisdição problemática. **DeepSeek/Qwen via hosts na China → descartados para qualquer feature [S].** OpenAI/Anthropic via API e Gemini via **Vertex AI** podem ser configurados com no-training — **mas isso é um pré-requisito a confirmar, não um dado** (ver "🚧 Portão LGPD bloqueante").

| Feature | Recomendação | Por quê |
|---|---|---|
| F1 Chat | manter **gpt-4.1-mini** | bom custo/qualidade agêntico |
| F2/F3 Prescrição | **gpt-4.1-mini** (manter); só trocar se qualidade exigir | dado clínico → provider c/ DPA |
| F4 Parse texto | **gpt-4o-mini** (rebaixar de 4.1) | tarefa estruturada simples; metade do custo |
| F5 Formulários | **gpt-4o-mini** (manter) | já é; custo desprezível |
| F7 Optimizer | **gpt-4.1-mini** (manter) | output pequeno (1024) |
| F8 Insights | **gpt-4o-mini** + batch maior | volume alto, texto simples; reduz ~70% do custo |
| **F9 Chat in-app MCP** | **subsetting + caching + gate** (1ª ordem); modelo `gpt-4.1-mini` ou Gemini 3.5 Flash conforme head-to-head | ver mitigações e "Ordem de prioridade" |

**Mitigações para F9 (ordem de impacto):**
1. **Subsetting dinâmico de tools** — não enviar as 55 defs sempre. Carregar por intenção (ex.: só financeiro, só prescrição) corta o bloco fixo de ~7.500 → ~1.500 tok ⇒ **−60% a −70% do input**.
2. **Consumir prompt caching de forma deliberada** — o cache automático da OpenAI **já funciona** (12.288 tok cacheados observados), mas depende de prefixo estável e frequência. Estruturar system+tools como prefixo fixo no início de toda chamada **maximiza o hit**; com Anthropic seria preciso setar `cache_control` explícito (hoje ausente).
3. **Cap de rodadas agênticas** + compressão de tool-results (paginar/resumir `get_student`, `list_students`).
4. **Encurtar descrições** das tools de maior peso (`workouts-write.ts` = 3.748 chars, `billing-write.ts` = 1.950, `appointments.ts` = 1.358).

## Break-even vs. margem

- ARPU bruto ≈ **US$ 8,00** (R$ 39,90). Após Stripe (~3,5% + R$0,39) e infra, a sobra para "custos variáveis de IA" é pequena.
- **Limiar de alerta [ESTIMATIVA]:** inferência **> 15% do ARPU** = amarelo; **> 30%** = vermelho. A R$39,90 ($8): amarelo $1,20 / vermelho $2,40. A R$79,90 ($16): amarelo $2,40 / vermelho $4,80.
- Pelo modelo acima (cache real $0,10): cenário **leve $0,35 (OK)**, **médio $1,84 (amarelo→vermelho a R$39,90)**, **pesado $7,37 (inviável a R$39,90)**.
- **Break-even em nº de tarefas F9** (baseline não-F9 médio ≈ $1,01/mês; headroom até o amarelo de R$39,90 = $0,19, até o vermelho = $2,40−$1,01 = $1,39):
  - **Sem subsetting** ($0,0165/tarefa): $0,19/0,0165 = **~11** (amarelo) / $1,39/0,0165 = **~84** (vermelho).
  - **Com subsetting — melhor caso, cache cheio** ($0,007/tarefa): **~27 / ~199**.
  - **Com subsetting — caso de PLANEJAMENTO, cache parcial** ($0,012/tarefa, coerente c/ premissa #6 — em baixo volume o cache frequentemente não acerta): $0,19/0,012 = **~16** (amarelo) / $1,39/0,012 = **~116** (vermelho).
  - **Usar o caso de planejamento (~16/~116), não o melhor caso (~27/~199), para decisão.** O $0,007 assume corte do bloco *e* cache cheio simultaneamente — otimista demais para a frequência real.

### Q5 — F9 e preço são a MESMA decisão (acoplados)
"Lançar o F9" e "subir para R$79,90" **não são escolhas independentes**: a viabilidade do F9 depende do tier. Tabela (custo total de inferência/treinador/mês vs. teto vermelho do tier):

| Cenário (total infra IA) | R$ 39,90 ($8 · vermelho $2,40) | R$ 79,90 ($16 · vermelho $4,80) |
|---|---|---|
| Leve (~$0,35) | ✅ folgado | ✅ folgado |
| Médio (~$1,84) | 🟡 no limite (23% do ARPU) | ✅ confortável (12%) |
| Pesado (~$7,37) | 🔴 inviável (92%) | 🔴 ainda estoura (46%) |
| Pesado + subsetting de tools só (F9 $1,4) → **$5,5** | 🔴 (68%) | 🔴 (34% — **ainda acima do teto vermelho de 30%**) |
| Pesado + subsetting + F8→gpt-4o-mini (−$0,7) → **$4,8** | 🔴 (60%) | 🟡 no limite (30%) |
| Pesado + subsetting + F8 + **gate** (F9 capado ~50/mês) → **$3,7** | 🔴 (46%) | 🟡 sustentável (23%) |

> **Contas (E1):** não-F9 pesado = $1,92+$0,70+$0,32+$0,01+$1,12 = **$4,07** (piso que o subsetting NÃO toca, pois só afeta o F9). Subsetting só: $4,07 + 200·$0,007 = **$5,47**. +F8→4o-mini: ($4,07−$0,70) + $1,40 = **$4,77**. +gate (F9→~50 tarefas): $3,37 + 50·$0,007 = **$3,72**. A célula antiga "$3,7 → 🟡 23%" estava **impossível** sozinha (abaixo do piso não-F9): o $3,7 só aparece com as **três** pernas (subsetting + F8 rebaixado + gate).

- **Conclusão acoplada (reforçada):** subsetting + cache **sozinhos não seguram o pesado nem a R$ 79,90** (ficam em 🔴 34%). Lançar o F9 de forma sustentável **pressupõe R$ 79,90 E subsetting E o gate de uso** — o gate é a **terceira perna obrigatória, não opcional**. No tier R$ 39,90, nem com as três pernas o pesado fecha (🔴 46%). Tratar o lançamento do F9 como gatilho do reposicionamento de preço — não decidir um sem o outro.

## 🚧 Portão LGPD bloqueante — DPA + zero-retention (Q4)

**Status no código (varredura 2026-06-15):** **nenhuma** configuração de proteção de dados encontrada. `grep` por `zero-retention`, `data-retention`, `OpenAI-Organization`, `OpenAI-Project`, `store:false`, `defaultHeaders`, `baseURL`, `dpa`, `opt-out` em `web/src` → **zero ocorrências**. Os clients são instanciados só com a API key: `new Anthropic({ apiKey })` (`llm-client.ts:149`) e o provider OpenAI via env `OPENAI_API_KEY`. **Conclusão: do código não dá para afirmar que há DPA/zero-retention** — a configuração, se existir, está fora do repo (conta OpenAI/console).

**Por que isto é bloqueante e não rodapé:** 14 das 55 tools tocam **dado de saúde [S]** (avaliação física, check-ins, restrições médicas), e o **F9 aciona quase todas**. Sob a LGPD (art. 11), dado de saúde exige base legal e garantias reforçadas. Enviar esse dado a um LLM sem DPA + zero-retention assinados = exposição regulatória direta.

**Ação BLOQUEANTE (precede a escolha de modelo):**
1. **Confirmar com a OpenAI (e qualquer provider futuro): DPA assinado + zero data retention (ZDR) + no-training** na org/projeto usados em produção. Sem isso, **nenhuma feature [S] deve escalar** além do beta atual.
2. Registrar a evidência (print do console / cláusula do DPA) num doc interno versionado.
3. Só depois de (1) decidir modelo/arquitetura.

> Ordem inviolável: **DPA/ZDR → arquitetura do F9 → escolha de modelo.** Modelo barato com dado de saúde vazando é o pior resultado possível.

## Ordem de prioridade (Q6)

Separar explicitamente o que é **arquitetura** (independente de modelo) do que é **modelo** (2ª ordem, não-urgente):

| Ordem | Item | Depende do modelo? | Urgência |
|---|---|---|---|
| **0** | **Portão LGPD**: DPA + zero-retention com a OpenAI | não | **bloqueante** antes de escalar features [S] |
| **1** | **Arquitetura do F9**: subsetting de tools + consumo deliberado de cache + gate de uso (créditos/limite por plano) | **não** — vale p/ qualquer modelo | alta (pré-requisito do lançamento do F9) |
| **2** | **Escolha/migração de modelo** (gpt-4.1-mini vs gpt-5.4-mini vs Gemini 3.5 Flash) | sim | **baixa** — 4.1-mini é corrente (Q1) e telemetria está no piso; decidir com head-to-head quando o F9 existir |

**Não inverter:** otimizar/trocar modelo antes de resolver subsetting+cache+gate é micro-otimização sobre a base errada — a arquitetura corta 60–70% do input em qualquer modelo, enquanto a troca de modelo, no melhor caso, não reduz custo (4.1-mini já é o mais barato corrente com tool-calling aceitável).

## Premissas e incertezas (tudo que tive de assumir)
1. **Tokens de tool defs serializados (~7.500)** — extrapolado de 18.834 chars de fonte zod × ~1,6 de overhead JSON Schema. Não medi a serialização real do SDK. **±30%.**
2. **Preços VERIFICADOS** nas páginas oficiais (OpenAI developers/OpenRouter, claude.com, blog.google, deepseek.ai, metacto/devtk) em 2026-06-15. O enunciado subestimou Gemini 3.5 Flash (~5–7,5×) e GPT-5.4 mini (~2×). **Correção Q1:** `gpt-4.1-mini` é **corrente** (não deprecado); `gpt-4o-mini` é legacy mas disponível. **Correção Q2:** cache read real do 4.1-mini = $0,10 (não $0,20 do código). Qwen 3.6 Plus não confirmado (host-dependente) — irrelevante, descartado por LGPD.
3. **Câmbio R$5,00** e **3,9 chars/token** são premissas fixas; variações movem os números proporcionalmente.
4. **Volumes leve/médio/pesado** são arbitrados como projeção de adoção. **A telemetria real (seção "Telemetria real") mostra uso no piso:** MCP 2–15 calls/treinador orgânico (1 conta QA distorce o total), prescrição dormente há 30+ dias com 1 treinador histórico. Logo, os cenários médio/pesado são *futuros*, não atuais.
5. **Rodadas agênticas** (F1 ~2 de 3; F9 ~6) e **tamanho médio de tool-result (~800 tok)** são estimativas; tarefas que listam muitos alunos ou leem programas grandes podem 3×–5× o input.
6. **Cache automático OpenAI (75% off, $0,10 — Q2)** — **confirmado por dado real** (12.288 tok cacheados numa geração de 2026-04-24), mas depende de prefixo > 1.024 tok e de janela de ~5–10 min entre chamadas; sob baixa frequência (caso atual) o cache frequentemente NÃO acerta (as 2 linhas de copilot têm `in_cached=0`). Em produção de baixo volume, o custo real fica entre a coluna "cache $0,10" e a "sem cache" das tabelas.
7. **F2 (claude-agent.ts) vs F3 (smart v2):** não confirmei qual pipeline está ativo em produção por feature flag em runtime; modelei como "uma geração = 2–3 chamadas" cobrindo ambos.
8. **ARPU**: usei o preço de tabela da landing; o único pagante real é grandfathered, então isto é unit-economics projetado, não receita.
9. **LGPD/no-training (elevado a bloqueante — Q4):** a varredura do repo **não achou nenhuma config** de DPA/zero-retention/org-header. Deixou de ser premissa de rodapé e virou o **"Portão LGPD bloqueante"** — nenhuma feature [S] escala antes de confirmar DPA + ZDR + no-training com a OpenAI (fora do código, no console da conta).
