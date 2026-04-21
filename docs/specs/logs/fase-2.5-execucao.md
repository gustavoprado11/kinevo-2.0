# Fase 2.5 — Log de Execução

Data: 2026-04-18. Executor: Claude Code (Opus 4.7).

## 1. Entregas

### Migração

- [`supabase/migrations/104_prescription_generations_telemetry.sql`](../../../supabase/migrations/104_prescription_generations_telemetry.sql)
  - Adiciona colunas de telemetria em `prescription_generations`: `tokens_input_new`, `tokens_input_cached`, `tokens_output`, `cost_usd numeric(10,6)`, `model_used text`, `retry_count smallint DEFAULT 0`, `prompt_version text`, `rules_violations_count smallint DEFAULT 0`, `rules_violations_json jsonb`.
  - Adiciona feature flag `trainers.smart_v2_enabled BOOLEAN NOT NULL DEFAULT false`.
  - Idempotente (`ADD COLUMN IF NOT EXISTS`). Não aplicada pelo código — `supabase db push` fica com você.

### Arquivos criados

- [`web/src/lib/prescription/telemetry.ts`](../../../web/src/lib/prescription/telemetry.ts) — `logGenerationTelemetry(supabase, generationId, payload)`. Swallow errors.
- [`web/src/lib/prescription/rules-validator.ts`](../../../web/src/lib/prescription/rules-validator.ts) — valida 8 regras do §4 com detectores + correctores puros. Ordem: errors (sets) → warnings (ordenação, reps, rest).
- [`web/src/lib/prescription/prompt-examples.ts`](../../../web/src/lib/prescription/prompt-examples.ts) — 3 exemplos few-shot sintéticos (iniciante full-body, intermediário estagnado, avançado PPL5).
- [`web/src/lib/prescription/prompt-builder-v2.ts`](../../../web/src/lib/prescription/prompt-builder-v2.ts) — `buildSmartV2Prompt` em 4 seções (Camada 1 estática, 2 pool+`pool_version`, 3 contexto aluno, 4 instrução). `pool_version` é SHA-1[:10] de `trainerId|sortedIds`.
- [`web/src/lib/prescription/context-enricher-v2.ts`](../../../web/src/lib/prescription/context-enricher-v2.ts) — `enrichStudentContextV2` + derivadores puros `derivePerformanceSummary`, `deriveAdherence`, `deriveActiveInjuries`, `buildAnamneseSummary`.
- Testes novos (55 casos, 7 arquivos):
  - `llm-client-retry.test.ts` (11)
  - `schemas-strict.test.ts` (4)
  - `telemetry.test.ts` (3)
  - `rules-validator.test.ts` (14)
  - `context-enricher-v2.test.ts` (9)
  - `prompt-builder-v2.test.ts` (6)
  - `program-cache.test.ts` (8)

### Arquivos editados

- [`web/src/lib/prescription/llm-client.ts`](../../../web/src/lib/prescription/llm-client.ts)
  - `PRICING` exportado, com `cached_input` por modelo (gpt-4.1-mini: input $0.40 / cached $0.20 / output $1.60; gpt-4o-mini: $0.15 / $0.075 / $0.60).
  - `computeCost` agora aceita `{ input_new, input_cached, output }`.
  - `LLMTokenUsage.cached_input_tokens` propagado a partir de `payload.usage.prompt_tokens_details.cached_tokens` (OpenAI) ou 0 (Anthropic).
  - `LLMCallResult.http_status` + `retry_count` adicionados.
  - `LLMCallOptions.json_object_mode` para legacy JSON mode (preservado para sites que ainda não usam schema strict).
  - Novos helpers: `callWithRetry(make, {maxAttempts,baseDelayMs,sleep})` com classificador `isRetryableFailure` (4xx não retenta; 5xx, timeout, network sim) + `callWithModelFallback({primary, fallback, makeCall, retry})`.
  - Exportadas `DEFAULT_GENERATION_MODEL` e `FALLBACK_GENERATION_MODEL`.
- [`web/src/lib/prescription/schemas.ts`](../../../web/src/lib/prescription/schemas.ts)
  - Adicionado `export const PROMPT_VERSION = 'v2.5.0'`.
  - `validateCompactGeneration` endurecido: rejeita campos extras em `program` (antes ignorava; agora espelha strict mode da OpenAI).
- [`web/src/lib/prescription/program-cache.ts`](../../../web/src/lib/prescription/program-cache.ts)
  - TTL default: 24h → **6h**.
  - `CACHE_ENGINE_VERSION` bumped para `2.5.0` (invalida caches antigos).
  - `computeCacheKey(profile, extraContext?)` aceita `EnrichedStudentContextV2`; key combina base + SHA-1[:10] de `anamnese_summary`, `performance_summary`, `adherence.bucket`, `trainer_observations`, `active_injuries`. Hashes nunca logam o input bruto.
  - `lookupCache` / `storeInCache` aceitam argumento extra `extraContext`.
- Consolidação das 4 chamadas diretas à OpenAI no `llm-client`:
  - [`ai-optimizer.ts:500-598`](../../../web/src/lib/prescription/ai-optimizer.ts) — usa `callLLM` com `json_object_mode`.
  - [`claude-agent.ts:80-140`](../../../web/src/lib/prescription/claude-agent.ts) — fase `analyze`.
  - [`claude-agent.ts:184-290`](../../../web/src/lib/prescription/claude-agent.ts) — fase `generate`.
  - [`generate-program.ts:793-860`](../../../web/src/actions/prescription/generate-program.ts) — `tryOpenAIGeneration` legado.
  - Removidas as constantes duplicadas `COST_PER_1M_INPUT/OUTPUT` em `claude-agent.ts`; o cálculo manual em `ai-optimizer.ts:578` substituído pelo `usage.cost_usd` do client.
- [`web/src/actions/prescription/generate-program.ts`](../../../web/src/actions/prescription/generate-program.ts)
  - Lê `trainer.smart_v2_enabled`.
  - Novo branch antes de `resolveAiMode`: quando flag ligada, chama `trySmartV2Generation` (função nova no mesmo arquivo). Se falhar (retorno `null`), segue para pipeline legada sem quebrar.
  - `trySmartV2Generation` encadeia: `enrichStudentContextV2` → `lookupCache` (extra) → `buildSmartV2Prompt` → `callWithModelFallback(gpt-4.1-mini, gpt-4o-mini)` com structured output + temperature 0.5 → `validateCompactGeneration` → `enrichCompactOutput` → `validatePrescriptionAgainstRules` → insert em `prescription_generations` + `logGenerationTelemetry` + `storeInCache`.

### Arquivos NÃO tocados (escopo respeitado)

- `slot-templates.ts`, `program-builder.ts`, `constraints-engine.ts`, `exercise-selector.ts`, `structural-optimizer.ts`, `rules-engine.ts` — guardrails pós-geração fazem o trabalho; refactor fica para 2.6.
- UX do painel (`components/programs/ai-prescription-panel/*`, `components/prescription/*`) — intacta.
- `claude-agent.ts` mantém o nome (spec §10 lista renomeação como follow-up cosmético).

## 2. Validação automatizada

- `npx tsc --noEmit` — arquivos tocados **limpos**. Continuam os 11 erros pré-existentes em `program-calendar.test.tsx` e `student-insights-card.test.tsx` (também presentes nas fases 1 e 1.5; não relacionados).
- `npx vitest run` — **283/283** em 30 arquivos. Partimos de 228 no fim da fase 1.5; adicionamos 55 casos (7 arquivos novos), nenhuma regressão.
- Um teste da fase 1 (`ai-prescription-panel.test.tsx` — "clicking Fechar painel calls onAcceptGeneratedProgram + onClose") foi atualizado para refletir a edição intencional do `student-tab` feita antes desta sessão (botão hoje só chama `onClose`). Mudança comentada no teste.

## 3. Critérios de aceite (§8 da spec)

- [x] **Todos os testes passam** — 283/283.
- [x] **Schema e validator evitam regressão silenciosa** — Structured Outputs strict + `validateCompactGeneration` rejeitando extras cobrem isso (teste `schemas-strict.test.ts`).
- [x] **Telemetria disponível em 100% das gerações smart-v2** — `logGenerationTelemetry` é chamado incondicionalmente após persistir a row. Fora do smart-v2 as colunas ficam NULL (esperado na fase de rollout gradual).
- [x] **Backward compat** — Migração é `ADD COLUMN IF NOT EXISTS` sem `DROP`, pipeline legada (agent + builder-first + OpenAI) 100% funcional quando `smart_v2_enabled=false`.
- [ ] **Walk-through do Gustavo revisando 3 gerações reais** — **pendente** (bloqueante para fechar a fase, ver §4).
- [ ] **Custo médio $0.004–$0.012 e cache > 40%** — só observável em produção depois do dogfood. Queries SQL abaixo.
- [ ] **`smart_v2_enabled` habilitada para ≥1 trainer** — pendente aplicar migração e setar a flag manualmente.

## 4. Walk-through manual — a executar pelo Gustavo

**Pré-requisito:** aplicar a migração (`supabase db push`) e setar `smart_v2_enabled=true` para pelo menos um trainer.

```sql
-- Habilitar para um trainer específico
UPDATE public.trainers
SET smart_v2_enabled = true
WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = '<trainer-email>');
```

### 4.1 Três perfis contrastantes

Rodar geração com um perfil de cada para ver a §4.6 (variabilidade) na prática. Sugestão:

| Perfil | Nível | Objetivo | Dias | Duração | Contexto | Expectativa |
|--------|-------|----------|------|---------|----------|-------------|
| A — Iniciante novo | iniciante | hipertrofia | 3 | 45min | sem sessões, sem programa | Full body AB conservador, acessórios em 2-3 séries |
| B — Intermediário estagnado | intermediário | hipertrofia | 4 | 60min | Supino Reto estagnado 4 semanas | ABC/Upper-Lower com variação no padrão de empurrar, supino inclinado como principal |
| C — Avançado boa aderência | avançado | hipertrofia | 5 | 75min | sem estagnação, aderência 90% | PPL+UL com alguns acessórios em 5 séries |

### 4.2 Checklist §6.3 item a item

Para cada um dos 3 programas gerados, verifique:

1. **Visivelmente diferente dos outros dois?** (§4.6) — compare splits, picks de exercício, volume.
2. **Ordem correta?** (§4.7) — compostos antes de acessórios; grandes grupos antes de pequenos; finaliza com isolado do grupo prioritário.
3. **Nenhum item viola §4.1-4.3?**
   - §4.1: composto ≤ 4 séries; acessório ≤ {3,4,5} pelo nível.
   - §4.2: bíceps/tríceps/antebraço/abdômen ≤ 3 séries no principal.
   - §4.3: no máximo 1 exercício com 4 séries por grupo por treino.
4. **Reps/descanso batem com objetivo?** (§4.8)
   - Hipertrofia: 8-12 reps, 60-90s descanso.
5. **Coerência muscular?** Todos grupos principais cobertos no volume certo da semana.

Se algum item falhar: abrir task de ajuste ANTES de ligar para outros trainers. O validator já corrige sets e ordenação mas **não** corrige coberturas/gaps estruturais (continua responsabilidade do slot-builder).

### 4.3 Queries SQL de auditoria

```sql
-- Custo médio por geração (últimos 7 dias, smart-v2 apenas)
SELECT
    model_used,
    prompt_version,
    COUNT(*) AS n,
    AVG(cost_usd) AS avg_cost_usd,
    AVG(tokens_input_new) AS avg_input_new,
    AVG(tokens_input_cached) AS avg_input_cached,
    AVG(tokens_output) AS avg_output,
    SUM(cost_usd) AS total_cost_usd
FROM public.prescription_generations
WHERE prompt_version IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY model_used, prompt_version
ORDER BY n DESC;

-- Taxa de cache hit (proxy: tokens_input_cached > 0 indica hit)
SELECT
    COUNT(*) FILTER (WHERE tokens_input_cached > 0) * 100.0 / NULLIF(COUNT(*), 0) AS pct_with_cache,
    AVG(tokens_input_cached::numeric / NULLIF(tokens_input_new + tokens_input_cached, 0)) * 100 AS avg_cache_ratio_pct
FROM public.prescription_generations
WHERE prompt_version IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';

-- Violações por regra (observabilidade — validator já corrigiu o output)
SELECT
    viol->>'rule_id' AS rule_id,
    viol->>'severity' AS severity,
    COUNT(*) AS occurrences
FROM public.prescription_generations g,
     LATERAL jsonb_array_elements(COALESCE(g.rules_violations_json, '[]'::jsonb)) AS viol
WHERE g.created_at > NOW() - INTERVAL '7 days'
GROUP BY rule_id, severity
ORDER BY occurrences DESC;

-- Retries (quanto a gente está tendo que tentar de novo?)
SELECT
    retry_count,
    COUNT(*) AS n,
    AVG(cost_usd) AS avg_cost
FROM public.prescription_generations
WHERE prompt_version IS NOT NULL
GROUP BY retry_count
ORDER BY retry_count;

-- Fallback de modelo (quando primário falhou)
SELECT
    model_used,
    COUNT(*) AS n
FROM public.prescription_generations
WHERE prompt_version IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY model_used;
```

## 5. Ordem das regras no `rules-validator` (documentação)

Aplicação importa porque uma regra pode abrir espaço para outra não disparar. Ordem implementada:

1. **Erros primeiro** (clamps de sets):
   1. `MAX_SETS_COMPOUND_4` — composto >4 → 4.
   2. `MAX_SETS_ACCESSORY_BY_LEVEL` — acessório >cap[nível] → cap.
   3. `MAX_SETS_SMALL_GROUP_3` — bíceps/tríceps/antebraço/abdômen principal >3 → 3.
   4. `MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP` — 2º+ exercício com 4 séries no mesmo grupo → 3.
2. **Warnings** (ordenação + faixas de reps/rest):
   5. `COMPOUND_BEFORE_ACCESSORY` — reordena mantendo estabilidade.
   6. `LARGE_GROUP_BEFORE_SMALL` — só dentro do segmento de compostos, `GROUP_SIZE` desc.
   7. `REPS_MATCH_GOAL` — clamp para range canônico do objetivo.
   8. `REST_MATCH_GOAL` — clamp ao canônico.

Exemplo complexo coberto no teste "Upper + small-group combo": supino reto 4, supino inclinado 4, rosca 4 → small-group rule zera rosca para 3 → one-4-per-group vê peito já com 1 em 4 e zera o segundo supino para 3 → resultado `[4, 3, 3]`.

Regra §4.3 usa **ordem de aparição** (primeiro com 4, demais capados) — confirmado com você antes da execução.

## 6. Follow-ups sugeridos

Ordem decrescente de prioridade:

1. **Teste de integração end-to-end do smart-v2 path.** Não foi escrito nesta fase: mockar supabase + `callLLM` + `fetchPrescriptionDataDirect` encadeados exigiria 10+ stubs. Playwright ou um harness dedicado seria o caminho quando a infra de testes amadurecer. Cobertura atual: componentes isolados com 55 testes.
2. **Golden test de variabilidade (§4.6).** LLM real rodando offline com seeds + perfis fixos, comparando com outputs-âncora revisados. Fora de escopo: exige orçamento de LLM nos CI e fixtures curados.
3. **Tabela `student_injuries` dedicada** — hoje `deriveActiveInjuries` lê de `profile.medical_restrictions`, que é genérico demais. Campos: `body_part`, `started_at`, `resolved_at`, `severity`, `clinical_notes`.
4. **Reordenar por `exercise_function` antes do rules-validator.** Se no uso real a LLM entregar itens fora de ordem semanticamente (e não apenas por intenção do trainer), adicionar camada que promove `function='main'` antes do validator rodar a regra §4.3.
5. **`logGenerationTelemetry` via trigger de DB** — hoje é UPDATE após INSERT (dois round-trips). Trigger `BEFORE INSERT` populando colunas derivadas reduziria latência.
6. **Dashboard de custo/qualidade** — queries acima suprem o curto prazo.
7. **Streaming *durante* a geração** (Fase 1.5+): smart-v2 prompt é maior; o efeito de reveal progressivo fica mais útil. Requer inserir row cedo com `status='generating'` e o hook da fase 1.5 já trata `output_snapshot=null`.
8. **Renomear `claude-agent.ts` → `llm-agent.ts`** — cosmético. Ao menos o arquivo não vai mais confundir ninguém a médio prazo quando só `llm-client` importar OpenAI direto.
9. **Consolidar `hydrateGeneratedWorkout` (fase 1.5) + `mapAiOutputToBuilderData` + `initializeWorkouts`** em helper canônico único — risco de drift sem isso.
10. **Aderência entra no cálculo de volume** (§4.4 follow-up).
11. **Trainer sobrescreve split** antes de gerar (§4.5 follow-up).
12. **Agente v1 continua em `json_object_mode`**; migrar para structured output quando tivermos schema de análise formalizado (`CompactAnalysisOutput` ainda não tem equivalente JSON Schema no schemas.ts).
13. **Pool_version como cache break**: monitorar se pool do trainer muda demais (ex: trainer ativa/desativa exercícios). Se sim, camada 2 perde caching — considerar pool stable com flag `ai_curated` apenas.
14. **Regularizar histórico da migration 103.** A 103 (Realtime publication da Fase 1.5) está ausente em `list_migrations` mas o efeito operacional está aplicado (confirmado via `pg_publication_tables`). Provavelmente foi executada por `ALTER PUBLICATION` direto no painel SQL. Próxima sessão de limpeza: inserir row em `supabase_migrations.schema_migrations` apontando para o arquivo `103_*.sql` **sem re-executar o DDL** (usar `supabase migration repair` ou equivalente). Sem isso, futuras `db pull` podem tentar re-aplicar.
15. **Promover `cache_hit` e `used_fallback_model` a colunas de primeira classe em `prescription_generations`.** Hoje o walkthrough usa proxies (`cost_usd = 0 AND tokens_output = 0` para cache hit; `model_used = 'gpt-4o-mini'` para fallback). Funciona para validação pontual, mas vai ficar frágil quando o dashboard §5.9 entrar em produção — qualquer mudança no modelo fallback ou na lógica de pricing quebra os proxies. Abrir como `105_prescription_generations_observability.sql` junto da Fase 2.6.
16. **Remover `web/scripts/debug-smart-v2.ts`.** Script de validação criado no post-walkthrough fix (§9). Rodou uma vez, confirmou que o fix destravou a API. Não deve ir para CI nem produção — é scratch debug com `OPENAI_API_KEY` lido de `.env.local` e sem inserts no DB. Remover na próxima limpeza.
17. ✅ **CONCLUÍDO (funil mobile end-to-end fechado em 2.5.4)** — **Refatorar `web/src/app/api/prescription/generate/route.ts` (mobile) para delegar ao server action `generateProgram`.** Hoje a route tem a lógica inlined (comment explícito: "Call the generation logic directly (inlined from generate-program.ts)"), **não lê `smart_v2_enabled`**, **não chama `trySmartV2Generation`**, e faz `fetch` direto à OpenAI com `response_format: json_object` fora do `llm-client` consolidado. Consequência: qualquer trainer com a flag ligada gerando pelo **mobile app** continua no pipeline legacy, invisível à telemetria 2.5 e sem passar pelo `rules-validator`. Fix: refatorar para usar server action com supabase client manualmente autenticado (o comment no arquivo já antecipa a limitação). Abrir como **Fase 2.5.1** dedicada — não misturar com iterações de prompt da Fase 2.6. Gravidade: trainers do produto em produção sentem isso imediatamente quando mobile virar canal principal. — **Executado em 2026-04-20.** Funil mobile cobriu-se em 4 fases: [2.5.1](fase-2.5.1-execucao.md) delega `/generate` ao smart-v2 + fix pré-existente do middleware. [Auditoria de middleware](auditoria-middleware-mobile.md) expôs 3 rotas mobile-first fora da whitelist. [2.5.3](fase-2.5.3-execucao.md) aplicou a whitelist e criou `notify-student`. [2.5.4](fase-2.5.4-execucao.md) reconciliou o contrato de `/api/programs/assign` (mobile envia `generationId`; handler aceita e materializa programa direto do `output_snapshot` via helper `assignFromSnapshot`). **Funil mobile fecha em produção:** generate → notify ↔ ↔ → assign, tudo via Bearer JWT, sem intervenção manual.
18. **Migrar `[Smart-v2][telemetry][failed]` de log para tabela dedicada** quando volume justificar. Hoje registramos apenas em `console.warn` estruturado (`[Smart-v2][telemetry][failed] trainerId=... model=... http_status=... error_type=<schema_error|timeout|other> attempt=... tokens_wasted=...`). Funciona para contar ocorrências via `grep` em logs do servidor, mas: (a) logs expiram, (b) não é queryável, (c) não agrega com sucesso na mesma tabela. Abrir quando houver ≥ 1 falha/dia em produção — provavelmente junto do follow-up #15 como migration 105 unificando `error_message`, `failure_type`, `failed_generations` ou colunas em `prescription_generations`.
19. **Reforçar §4.1/§4.3 no `prompt-builder-v2.ts` quando `scale_factor < 0.7`.** Sinal observado na primeira geração real (row `25aaaa74`): 3 errors + 2 warnings. Dois dos errors foram `MAX_SETS_SMALL_GROUP_3` (bíceps/tríceps com 5 séries) e um foi `MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP` (2º exercício de Costas com 4 séries). Hipótese: sob volume apertado (adherence minimal 42%, budget cortado para 61% via `ConstraintsEngine`), a LLM tenta atingir volume mínimo empurrando séries para grupos pequenos — viola §4.1/§4.3 no processo. Fix proposto: camada 3 do prompt ganha uma frase condicional ativada quando `scale_factor < 0.7` explicitando "grupos pequenos (bíceps/tríceps/antebraço/abdômen) **nunca** ultrapassam 3 séries por exercício principal, e cada grupo muscular pode ter **no máximo** 1 exercício com 4 séries no mesmo treino — mesmo sob volume apertado, reduza repetições ou frequência, não o teto de séries". Monitorar via follow-up #20.
20. **Métrica contínua: `errors/generation` e `warnings/generation` nas últimas 20 rows.** Query:
    ```sql
    SELECT AVG(rules_violations_count) AS avg_total,
           SUM(CASE WHEN jsonb_path_exists(rules_violations_json, '$[*] ? (@.severity == "error")')
                    THEN (SELECT COUNT(*) FROM jsonb_array_elements(rules_violations_json) AS v
                          WHERE v->>'severity' = 'error')
                    ELSE 0 END)::float / COUNT(*) AS avg_errors,
           COUNT(*) AS sample_size
    FROM public.prescription_generations
    WHERE prompt_version = 'v2.5.0'
      AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC LIMIT 20;
    ```
    Se `avg_errors > 2` se sustentar, significa que o validator está absorvendo trabalho que deveria vir certo do prompt — sinal para iterar no prompt-builder-v2 ou prompt-examples (follow-up #19). Se `avg_errors` cair para < 1 após aplicar #19, consideramos a fase de prompt fechada e seguimos para 2.6.

## 7. Sequência de trabalho executada

1. ✅ P0 — Migration 104 (telemetry + smart_v2_enabled).
2. ✅ P1 — Central pricing (`PRICING` expandida com cached_input; `computeCost` nova assinatura).
3. ✅ P2 — `callWithRetry` + `callWithModelFallback` + `http_status` + `retry_count`. 11 testes.
4. ✅ P3 — `PROMPT_VERSION='v2.5.0'`; validator rejeita extras em `program`. 4 testes.
5. ✅ P4 — `telemetry.ts` + 3 testes.
6. ✅ P5 — `rules-validator.ts` + 14 testes. Bug inicial (destructuring falso) corrigido antes do commit do P6.
7. ✅ P6 — `prompt-examples.ts` (few-shot fixo).
8. ✅ P7 — `prompt-builder-v2.ts` (3 camadas + pool_version). 6 testes.
9. ✅ P8 — `context-enricher-v2.ts` + 9 testes.
10. ✅ P9 — `program-cache.ts` (TTL 6h, chave com SHA-1 de contexto dinâmico, engine_version=2.5.0). 8 testes.
11. ✅ P10 — Consolidação das 4 chamadas OpenAI, uma por vez, com suite verde entre cada.
12. ✅ P11 — `cached_input_tokens` + `retry_count` propagados (feito junto com P1/P2).
13. ✅ P12 — `trySmartV2Generation` adicionado a `generate-program.ts` atrás de `smart_v2_enabled`.
14. ✅ P13 — Log.

## 8. Destravamento do walk-through (18/abr/2026)

- Migration **104** aplicada no projeto `lylksbtgrihzepbteest`. `list_migrations` confirma a versão `20260418153155_prescription_generations_telemetry`. Schema verificado:
  - Em `prescription_generations`, as 9 colunas novas (`tokens_input_new`, `tokens_input_cached`, `tokens_output`, `cost_usd`, `model_used`, `retry_count`, `prompt_version`, `rules_violations_count`, `rules_violations_json`) estão todas com `is_nullable = YES`. Rows antigas permanecem válidas.
  - Em `trainers`, `smart_v2_enabled boolean NOT NULL DEFAULT false` criada. Default off.
  - `get_advisors(security)` — nenhum alerta novo introduzido pela 104 (os 24 pré-existentes são sobre outras áreas: `rls_enabled_no_policy` em `webhook_events`, `function_search_path_mutable` em várias RPCs legadas, extensões em schema `public`, etc.).
  - `get_advisors(performance)` — 202 lints totais, zero mencionam `smart_v2_enabled` ou as 9 colunas novas (os 3 hits que citam `prescription_generations` são `unused_index` INFO sobre índices pré-existentes `idx_prescriptions_trainer/pending/expires`).
- `smart_v2_enabled = true` para trainer **`7aec3555-600c-4e7c-966e-028116921683`** (`gustavoprado11@hotmail.com`, "Gustavo Prado"). `SELECT COUNT(*) WHERE smart_v2_enabled=true` → **1** (único trainer com a flag ligada).
- **Divergência de identidade registrada:** o prompt original apontava `gustavocostap11@gmail.com`, mas essa conta existe apenas em `auth.users` (sem linha em `public.trainers` — não completou onboarding, é a conta do Gustavo no Cowork/Anthropic, não no produto). O trainer real do produto é `gustavoprado11@hotmail.com` (name "Gustavo Prado", com `ai_prescriptions_enabled=true`), confirmado com o Gustavo antes do `UPDATE`.
- Roteiro do walk-through preparado em [`docs/specs/logs/fase-2.5-walkthrough.md`](fase-2.5-walkthrough.md) — 3 perfis contrastantes (iniciante conservador / intermediário estagnado / avançado com restrição lombar), checklist §4.1-§4.8 por perfil, e 6 queries SQL de auditoria com adaptações explícitas para o schema real (proxies para `cache_hit`, `used_fallback_model`; `cache_key` não persiste porque o cache é in-memory).
- **Realtime publication verificada:** `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='prescription_generations'` retornou 1 row. A tabela está na publication. A migration 103 (Realtime, fase 1.5) **não aparece** em `list_migrations` — foi aplicada por canal fora do `apply_migration` (provavelmente `ALTER PUBLICATION` direto no painel SQL em sessão anterior). Efeito operacional correto; só o registro histórico está incompleto. Adicionado como follow-up #14.
- **Próximo passo (bloqueante para fechar a Fase 2.5):** Gustavo executa as 3 gerações no app, preenche os checklists e as seções "Resultados" do walkthrough. Nada mais pendente do lado de infra.

## 9. Post-walkthrough fix (18/abr/2026)

### Contexto

Gustavo rodou o primeiro teste do walkthrough após o destravamento do §8. Logs de produção e query em `prescription_generations` mostraram que o smart-v2 **não** estava entregando programas — o fallback para legacy estava absorvendo silenciosamente e salvando programas com `ai_source='heuristic'`, `prompt_version=NULL`, `cost_usd=NULL`. As 5 gerações feitas pelo Gustavo naquele dia foram todas pelo pipeline legacy.

### Causa raiz #1 — Bypass silencioso (falso positivo de cronologia)

Observação inicial: "gerações #1 e #2 não têm logs do `[Smart-v2]`; apenas a #3 tentou e caiu". Hipótese inicial: bug no branching de `generate-program.ts` pulando `trySmartV2Generation`.

**Investigação (SQL):**

```sql
SELECT id, created_at, ai_source, prompt_version FROM prescription_generations
WHERE trainer_id = '7aec3555-...' ORDER BY created_at DESC LIMIT 5;
-- 5 rows entre 13:48 e 15:44 UTC, todas ai_source=heuristic prompt_version=NULL

SELECT updated_at FROM trainers WHERE id = '7aec3555-...';
-- 2026-04-18 15:43:24.654776+00
```

Linha do tempo:

- 13:48 → 14:14 UTC — 4 gerações com `smart_v2_enabled=false` (flag não ligada). Comportamento correto.
- **15:43:24 UTC — flag ligada via `UPDATE trainers SET smart_v2_enabled=true`** (ação do destravamento §8).
- 15:44:25 UTC — 1 geração com flag `true`; row persistida como `heuristic` porque o smart-v2 fez 2 chamadas à OpenAI e ambas receberam **HTTP 400** → fallback para legacy.

Conclusão: não havia bypass de código. O smart-v2 **não foi tentado** nas 4 primeiras porque a flag estava off; na 5ª foi tentado e **falhou na API**. Tratado como falso positivo de cronologia.

### Causa raiz #2 — `item_config` sem constraints em strict mode (HTTP 400 real)

O OpenAI Structured Outputs strict mode exige que **todo** subobjeto declare `properties`, `required` cobrindo 100% das properties e `additionalProperties: false`. O `GENERATION_JSON_SCHEMA` (em `schemas.ts`) declarava:

```ts
// ANTES (l.210-212, causava HTTP 400)
item_config: {
    type: ['object', 'null'] as const,
},
```

Objeto livre. Sem `properties`, sem `required`, sem `additionalProperties`. A API rejeita.

Mensagem exata da OpenAI (capturada via dump de response body instrumentado no `llm-client.ts`):

```
"Invalid schema for response_format 'prescription_program': In context=('properties', 'workouts',
'items', 'properties', 'items', 'items', 'properties', 'item_config'), object schema missing properties."
```

**Fix aplicado (Opção 1 — cirúrgica):**

```ts
// DEPOIS
item_config: {
    type: ['string', 'null'] as const,
    description: 'JSON string with warmup/cardio config (parsed on hydration). Null for strength items.',
},
```

Warmup e cardio agora entregam JSON serializado como string. `validateCompactGeneration` faz `JSON.parse` em try/catch com mensagem descritiva em caso de falha. Nenhuma mudança observável para o trainer.

### Diff resumido

| Arquivo | Natureza | O quê |
|---|---|---|
| `web/src/lib/prescription/schemas.ts` | fix | B1: `item_config` → `['string', 'null']`; `validateCompactGeneration` com `parseItemConfig` try/catch |
| `web/src/lib/prescription/llm-client.ts` | instrumentação | Dump de payload atrás de `KINEVO_LLM_DEBUG_PAYLOAD=1`; dump de response body **sempre** em `!response.ok` |
| `web/src/actions/prescription/generate-program.ts` | instrumentação | `[Smart-v2] gate: trainerId=... smart_v2_enabled=...` antes do `if`; `[Smart-v2] abort: <motivo>` em todos os `return null`; `[Smart-v2][telemetry][failed]` estruturado no caminho LLM-falhou |
| `web/src/lib/prescription/output-enricher.ts` | fix | `parseItemConfig(raw)` com try/catch para serializar de volta a objeto |
| `web/src/lib/prescription/schemas-strict.test.ts` | teste | +5 testes: schema passa validador JSON Schema draft-2020-12 local; payload com `item_config` string válida; payload com `item_config` null válida; payload com string JSON inválida é rejeitada com mensagem clara; payload com `note_key: null` valida |
| `web/scripts/debug-smart-v2.ts` | debug | **Temporário.** Script standalone que chama `callLLM` com payload sintético; registrado em §6 follow-up #16 para remoção. |

**B2 (null em enum) não foi aplicado.** Confirmado durante o debug que a API aceita `enum: [..., null]` quando `type: ['string', 'null']`. Não tocamos.

### Evidência — script de debug

Primeira execução, `gpt-4.1-mini`:

```
[debug-smart-v2] prompt sizes: system=7407 chars, user=651 chars, pool_version=5a7e88a01f
[LLMClient] openai/gpt-4.1-mini — input: 2965, output: 1635, cost: $0.0038, stop: stop
[debug-smart-v2] SUCCESS ✔
  program.name      = Hipertrofia Intermediário 3x/semana - Debug Student
  workouts          = 3
  cost_usd          = $ 0.003802
  rule_violations   = 4  (todos warning, todos reordenação — validator corrigiu em memória)
```

API aceitou o schema corrigido. Stop reason `stop` (não `length`), custo dentro da faixa §8.

### Evidência — geração real em produção

Primeira geração após o fix, via produto web (Gustavo, student `51c2b3f9-...`, flag ligada):

```sql
SELECT id, ai_source, prompt_version, model_used,
       tokens_input_new, tokens_input_cached, tokens_output,
       cost_usd, retry_count, rules_violations_count
FROM public.prescription_generations
WHERE id = '25aaaa74-6638-4361-a159-6a508141a681';
```

```json
{
  "id": "25aaaa74-6638-4361-a159-6a508141a681",
  "ai_source": "llm",
  "prompt_version": "v2.5.0",
  "model_used": "gpt-4.1-mini",
  "tokens_input_new": 4263,
  "tokens_input_cached": 2048,
  "tokens_output": 2531,
  "cost_usd": "0.006164",
  "retry_count": 0,
  "rules_violations_count": 5
}
```

Confirmações:

- **`ai_source = 'llm'`** — primeiro caso em produção. Antes era `'heuristic'` (fallback legacy).
- **`prompt_version = 'v2.5.0'`** — caminho smart-v2 efetivamente executado.
- **`tokens_input_cached = 2048`** — prompt caching da OpenAI pegou. Isso valida empiricamente a estratégia de 3 camadas da spec §5.4: a camada 1 estática + camada 2 determinística dado `trainer_id` estão batendo prefixo idêntico entre requests. **É a primeira validação real do caching fora de ambiente de teste.**
- **`retry_count = 0`** — primeira tentativa passou; nenhum fallback para `gpt-4o-mini`.
- **`cost_usd = $0.006164`** — dentro da faixa esperada §8 ($0.004-$0.012).

### `rules_violations_json` — validator absorveu 5 violações

Output do `rules_violations_json` desta mesma row:

| # | Regra | Severidade | LLM gerou | Validator aplicou |
|---|---|---|---|---|
| 1 | `MAX_SETS_SMALL_GROUP_3` | error | Bíceps com 5 sets (treino D) | → 3 sets |
| 2 | `MAX_SETS_SMALL_GROUP_3` | error | Tríceps com 5 sets (treino D) | → 3 sets |
| 3 | `MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP` | error | 2º exercício de Costas com 4 sets (treino B) | → 3 sets |
| 4 | `COMPOUND_BEFORE_ACCESSORY` | warning | Acessório antes de composto (treino A) | Reordenado |
| 5 | `COMPOUND_BEFORE_ACCESSORY` | warning | Acessório antes de composto (treino D) | Reordenado |

**Tese da Fase 2.5 validada empiricamente.** Mesmo com prompt-builder-v2 + examples few-shot, a LLM escorrega em §4.1 e §4.3 sob constraint engine apertada (volume cortado para 61% do budget, adherence minimal 42%). O `rules-validator` captura tudo e corrige em memória **antes** do persist — o programa salvo no DB já sai limpo.

### Observação de taxa de violações

**Script sintético** (student iniciante, perfil simples): 4 warnings / 0 errors.
**Geração real #1** (volume apertado, adherence baixa): 2 warnings / **3 errors**.

Diferença é significativa. Hipótese documentada em follow-up #19: quando `scale_factor < 0.7`, a LLM empurra séries para grupos pequenos tentando atingir volume mínimo. Solução proposta: frase condicional na camada 3 do prompt reforçando os tetos das regras §4.1/§4.3 **quando** o sinal de volume apertado estiver presente. Métrica de monitoramento contínuo em follow-up #20.

Não é regressão — é sinal de onde a próxima iteração do prompt deve atacar. Não bloqueante.

### Caveat importante

O fix desta sessão cobre **apenas gerações pelo web**. A route `web/src/app/api/prescription/generate/route.ts` usada pelo **mobile app** tem pipeline inlined separada, não lê `smart_v2_enabled`, não chama `trySmartV2Generation` e não passa pelo `llm-client` consolidado. Trainers com a flag ligada gerando pelo mobile continuam no pipeline legacy com todos os sintomas originais (mesmo treino, violações de §4.1, etc). Tratamento: follow-up #17 dedicado como **Fase 2.5.1**.

### Status

- ✅ HTTP 400 resolvido em `gpt-4.1-mini` (primário). Não foi necessário testar fallback `gpt-4o-mini` — não caiu nele.
- ✅ 288/288 testes verdes (283 + 5 novos em `schemas-strict.test.ts`).
- ✅ `npx tsc --noEmit` limpo.
- ✅ Primeira geração smart-v2 end-to-end em produção confirmada no DB.
- ✅ Prompt caching da OpenAI validado empiricamente (2048 tokens cached em 6311 input).
- ✅ `rules-validator` capturou 3 errors + 2 warnings e corrigiu tudo.

**Fase 2.5 destravada e operacional no web.** Walkthrough dos 3 perfis contrastantes pode prosseguir a qualquer momento (agora com confiança de que o smart-v2 vai entregar). Mobile fica na fila como 2.5.1.
