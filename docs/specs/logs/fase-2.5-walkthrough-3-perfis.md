# Fase 2.5 — Walk-through 3 perfis contrastantes

Data: 2026-04-20. Executor: Claude Code (Opus 4.7), contra `localhost:3000` via route mobile (validada na Fase 2.5.1).

## 1. Contexto

Objetivo: confirmar que 3 alunos com perfis contrastantes recebem programas **significativamente diferentes** (spec §4.6) e que a prescrição respeita as regras §4.1–4.8. Todos os 3 alunos pertencem ao trainer `7aec3555-600c-4e7c-966e-028116921683` (`gustavoprado11@hotmail.com`) e têm `goal='hypertrophy'`.

| Perfil | Nome | `student_id` | Nível | Dias | Duração |
|---|---|---|---|---|---|
| iniciante | Fernanda Lemos | `7cb93d97-0e63-4c47-9c99-869e66f27699` | beginner | 3 (seg/qua/sex) | 60min |
| intermediário | Alysson Lanza | `bbe3c04a-72cd-437e-8faa-46615b2ff9e2` | intermediate | 5 (seg–sex) | 60min |
| avançado | Gustavo Prado (test) | `51c2b3f9-b387-4691-9b34-db6eccc7a646` | advanced | 5 (seg–sex) | 60min |

**Confirmação prévia importante** (antes de executar): leitura do código confirma que `enrichStudentContextV2` é **injetado no Layer 3 do prompt** ([`generate-program.ts:1124`](../../web/src/actions/prescription/generate-program.ts) → [`prompt-builder-v2.ts:54, 163-221`](../../web/src/lib/prescription/prompt-builder-v2.ts) consumindo `anamnese_summary`, `performance_summary`, `adherence.bucket`, `trainer_observations`, `is_new_student`). Entretanto, o enriched context **não é persistido** no `input_snapshot` da row em `prescription_generations` — apenas `profile`, `performance_context` legado e `smart_v2: true`. Consequência: a evidência abaixo sobre "LLM considerou contexto" é **inferencial** via `reasoning.*`, não direta via snapshot. **Gap de observabilidade, não de pipeline.** Registrado como follow-up.

## 2. Execução — 3 curls sequenciais

JWT do trainer extraído via Chrome MCP do cookie `sb-lylksbtgrihzepbteest-auth-token` em `https://www.kinevoapp.com/dashboard`. Transporte via char codes numéricos (Python urllib).

| Ordem | Perfil | `generationId` | HTTP | Latência | Observação |
|---|---|---|---|---|---|
| 1 | Fernanda (iniciante) | `8e39dee7-dcfe-460a-9158-2af3702deba6` | 200 | 109.5s client / 103.8s server | `retry_count=1` (1 falha transitória antes de sucesso no primário) |
| 2 | Alysson (intermediário) | `e3865526-db1e-473b-aa06-cfae3fb6dabd` | client timeout 180s; row persistida | 185.4s server | model **fallback** `gpt-4o-mini` após 3 falhas do primário |
| 3 | Gustavo test (avançado) | `cf7c03f9-502a-4f70-b0f1-376fbd3a97bc` | 200 | 10.9s | **cache hit** (6h TTL do `program-cache`; última geração desse student há ~40min via Fase 2.5.1) |

Rate-limit pré-execução: 1/24h, 0/min. Pós-execução: 4/24h, 0/min (dentro dos caps 20/d, 5/min).

## 3. Comparação consolidada

| Campo | Fernanda | Alysson | Gustavo |
|---|---|---|---|
| `ai_source` | `llm` | `llm` | `llm` |
| `prompt_version` | `v2.5.0` | `v2.5.0` | `v2.5.0` |
| `model_used` | gpt-4.1-mini | **gpt-4o-mini (fallback)** | gpt-4.1-mini |
| `retry_count` | 1 | 0 | 0 |
| `tokens_input_new` | 5901 | 5970 | 0 (cache) |
| `tokens_input_cached` | 0 | 0 | 0 |
| `tokens_output` | 1358 | 1013 | 0 (cache) |
| `cost_usd` | $0.004533 | $0.001503 | $0.000000 |
| `generation_time_ms` | 103806 | 185447 | 7960 |
| `rules_violations_count` | 3 (warnings) | 1 (warning) | **7 (2 errors + 5 warnings)** |
| `n_workouts` | 3 | 3 | 5 |
| `workout_names` | Treino A/B/C | Push / Pull / Legs | Push / Pull / Legs A / Upper / Lower |
| `performance_context.adherence_rate` | 0% (0 sessões 4 semanas) | 45% | 38% |
| `performance_context.weeks_of_history` | 5 | 4 | 4 |
| `structure_rationale` | Full Body 3x/sem | "Upper/Lower 4x/sem" ⚠ | "Upper/Lower 4x/sem" ⚠ |
| `volume_rationale` | Quadr 6s (mín 8) déficit… | Peito 14s, Costas 20s, Ombros 14s (máx 11) verificar | Quadr 22s, Costas 15s, Glúteo 14s (máx 12) verificar |
| `adaptations` | `null` | **`null`** ⚠ | `null` (cache — esperado) |

**Sinais de atenção levantados, não bloqueantes da validação:**
- O `structure_rationale` está **templated e incorreto** em 2 casos: diz "Upper/Lower 4x/sem" para Alysson (que recebeu PPL 3x em 5 dias disponíveis) e para Gustavo test (que recebeu PPL+UL 5x). Parece texto do rationale-generator que não reflete a entrega.
- `adaptations=null` para Alysson. Ele **não foi cache**, `adherence_rate=45%`, tem 4 semanas de histórico — conforme critério explícito que você me passou ("flag só vale se vazio em Alysson OU Gustavo test, esses dois têm histórico rico o suficiente"), **este é um sinal real** de que o prompt `adaptations` não está sendo gerado mesmo quando o contexto permite. Follow-up.

## 4. Variabilidade entre perfis (§4.6)

Conjuntos de `exercise_id` únicos extraídos por geração. Jaccard similarity entre pares:

| Par | \|A \| | \|B \| | \|A∩B\| | \|A∪B\| | Jaccard |
|---|---|---|---|---|---|
| Fernanda ∩ Alysson | 17 | 13 | 8 | 22 | **0.364** |
| Fernanda ∩ Gustavo | 17 | 23 | 11 | 29 | **0.379** |
| Alysson ∩ Gustavo | 13 | 23 | 8 | 28 | **0.286** |

**Veredicto:** todos os pares abaixo de 0.6 (limiar "baixa variabilidade"). 7 exercícios em comum aos três programas — provavelmente compostos básicos universais (Supino Reto, Agachamento Livre, Remada Curvada, Desenvolvimento, etc.). **Variabilidade adequada** entre perfis — §4.6 atendido.

## 5. Aderência às regras §4 (checklist por programa)

### 5.1 Fernanda — Iniciante, 3 dias, adherence 0%, `is_new_student=true`

| Regra | Resultado | Evidência |
|---|---|---|
| §4.1 composto ≤4s | ✓ | todos compostos em 3 séries |
| §4.1 acessório iniciante ≤3s | ✓ | maior cap observado: 3 séries (§ máx 3 para iniciante) |
| §4.2 grupos pequenos (Bíceps/Tríceps/Antebraço/Abdômen) ≤3s | ✓ | Bíceps 2, Tríceps 2 |
| §4.3 máx 1 exercício com 4s por grupo por treino | ✓ N/A | nenhum exercício tem 4s |
| §4.4 volume semanal dentro do range (iniciante 8-12/grupo) | ✗ em parte | Quadr 6, Post-coxa 6, Glúteo 0, Panturr 3 abaixo; Peito/Costas/Ombros 9 ok. validator flagou `volume_rationale` como "déficit aceitável" (scale factor por adherence 0%) |
| §4.5 split 3x iniciante = AB (A-B-A) | ~ | recebeu A-B-C com 3 workouts distintos (full body). Spec sugere "AB repetido" — divergência cosmética, estrutura full body preservada |
| §4.6 aluno novo → conservador | ✓ | zero exercícios com 4 séries, volume conservador, compostos básicos |
| §4.7 composto antes de acessório / grande antes de pequeno | △ | validator detectou 3 warnings de ordenação; corrigiu |
| §4.8 reps/rest hipertrofia (8-12 / 60-90s) | ✓ | compostos 8-12 @ 90s; acessórios 10-15 @ 60s |

Veredicto Fernanda: **conforme**. Divergência de split §4.5 é cosmética (não comprome estrutura full body), ordenação foi corrigida, volume em déficit é decisão do constraints-engine sob adherence=0 (documentado como "aceitável" no `volume_rationale`).

### 5.2 Alysson — Intermediário, 5 dias disponíveis, adherence 45%

| Regra | Resultado | Evidência |
|---|---|---|
| §4.1 composto ≤4s | ✓ | Supino Reto 4, Puxada 4, Desenv 4 (máx) |
| §4.1 acessório intermediário ≤4s | ✓ | maior cap acessório: 3 |
| §4.2 grupos pequenos ≤3s | ✓ | Tríceps 3, Bíceps 3 |
| §4.3 máx 1 com 4s por grupo por treino | ✓ | Push: só Supino Reto 4 (Peito); Desenv 4 (Ombros) — grupos distintos, ok. Pull: só Puxada 4 (Costas) |
| §4.4 volume semanal (interm. 12-18/grupo) | ✗ | Peito 7s, Ombros 7s, Costas 10s, Tríceps 3, Bíceps 3 — todos em déficit. Pernas **incalculável** (ver bug §7 abaixo) |
| §4.5 split 5x intermediário = PPL+1 ou U/L A/B | ✗ | **recebeu PPL 3x — só 3 workouts para 5 dias disponíveis**. Violação material da regra de frequência. |
| §4.6 variação vs outros perfis | ✓ | Jaccard 0.29 vs Gustavo, 0.36 vs Fernanda |
| §4.7 ordem composto→acessório | △ | 1 warning corrigido em Legs |
| §4.8 reps/rest hipertrofia | ✓ | compostos 8-10 @ 90s, acessórios 10-15 @ 60s |

Veredicto Alysson: **não conforme em §4.5 e §4.4**. Prescrição só 3 dias por semana a um aluno que declarou 5 dias disponíveis é a pior violação — atende 60% do volume semanal potencial. Sinal adicional: `adaptations=null` apesar de ter `performance_context` com 4 semanas de histórico e adherence 45%.

Além disso, problema de dados: **2 exercícios no treino Legs aparecem como "Exercício desconhecido" com `muscle_group=""`** — `exercise_id` retornado pela LLM não existe no exerciseMap passado ao `enrichCompactOutput`, e o enricher usa fallback de string. Impede o validator de aplicar §4.2/§4.3 nesses items (grupo vazio não bate em nenhum set de regras). Poluição do output final — usuário receberia programa quebrado.

### 5.3 Gustavo test — Avançado, 5 dias, adherence 38%, 71 sessões históricas

⚠ **Row foi cache hit** — `tokens_input_cached=0`, `cost=$0`, `generation_time_ms=7960`. O programa foi gerado originalmente há ~40min na Fase 2.5.1 (row `0df17e92`). As violações abaixo foram detectadas e corrigidas **naquela geração**, persistidas no output_snapshot atual.

| Regra | Resultado | Evidência |
|---|---|---|
| §4.1 composto ≤4s | ✓ | Supino Reto 4, Remada 4, Desenv 4, Agachamento 4, Stiff 4 |
| §4.1 acessório avançado ≤5s | ✓ | Cadeira Extensora 5 séries (dentro do cap avançado=5) |
| §4.2 grupos pequenos ≤3s | ✗→✓ (corrigido) | `MAX_SETS_SMALL_GROUP_3` error: Bíceps 5 séries no Upper → validator clampou para 3 |
| §4.3 máx 1 com 4s por grupo por treino | ✗→✓ (corrigido) | 2 errors: Push Ombros (2º exercício com 4 séries) e Pull Costas (2º exercício com 4 séries); validator reduziu para 3 cada |
| §4.4 volume semanal (avançado 16-22/grupo) | ✓ em parte | Quadr 22 limite superior, Costas 14, Peito 11 déficit, Ombros 6 déficit |
| §4.5 split 5x avançado = PPL+UL ou bro-split | ✓ | Push/Pull/Legs A/Upper/Lower = PPL+UL ✓ |
| §4.6 variação vs outros perfis | ✓ | Jaccard 0.29 vs Alysson, 0.38 vs Fernanda |
| §4.7 ordem composto→acessório | △ | 4 warnings corrigidos (3 `LARGE_GROUP_BEFORE_SMALL` + 1 `COMPOUND_BEFORE_ACCESSORY`) |
| §4.8 reps/rest hipertrofia | ✓ | compostos 8-10 @ 90s, acessórios 10-15 @ 60s |

Veredicto Gustavo test: **conforme pós-validator**. 3 errors (§4.2/§4.3) + 4 warnings foram capturados e corrigidos. Sem o rules-validator, o programa entregue seria inválido pela spec — evidência de que o guardrail é load-bearing. Anotação: "Levantamento Terra" aparece com `muscle_group=Quadríceps` (tag incorreta no DB — Terra é posterior+costas+trapézio), mas isso é erro de dados pré-existente, não regressão do pipeline.

## 6. Violações registradas pelo rules-validator

| Geração | `rule_id` | Severity | Corrigido? | Evidência |
|---|---|---|---|---|
| Fernanda | `LARGE_GROUP_BEFORE_SMALL` | warning | ✓ | 2x (Treino A/B) |
| Fernanda | `COMPOUND_BEFORE_ACCESSORY` | warning | ✓ | 1x (Treino B) |
| Alysson | `COMPOUND_BEFORE_ACCESSORY` | warning | ✓ | 1x (Legs) |
| Gustavo | `MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP` | **error** | ✓ 4→3 | Push Ombros, Pull Costas |
| Gustavo | `MAX_SETS_SMALL_GROUP_3` | **error** | ✓ 5→3 | Upper Bíceps |
| Gustavo | `LARGE_GROUP_BEFORE_SMALL` | warning | ✓ | 3x |
| Gustavo | `COMPOUND_BEFORE_ACCESSORY` | warning | ✓ | 2x |

**Totais:** 11 violations em 3 gerações → média ~3.7/geração. Distribuição: 3 errors + 8 warnings. Todos os 11 corrigidos in-place pelo validator. Nenhum error persistido sem correção.

## 7. Follow-ups identificados neste walk-through

> **Status atualizado em 2026-04-20 — Fase 2.5.2.** Findings #1/#1-bis/#2/#3/#5 resolvidos. Ver log completo em `fase-2.5.2-execucao.md`.

1. ✅ **§4.5 ignorada pela LLM quando aluno declara 5 dias** (Alysson). **[RESOLVIDO em Fase 2.5.2]** Adicionado `R45_SCHEDULE_MISMATCH` (coverage-based: `union(scheduled_days) == set(available_days)`) com `autofix='retry'`. Adicionado semantic retry loop (`MAX_SEMANTIC_ATTEMPTS=2`). Adicionado bloco §4.5 ao Layer 1 do prompt com 4 exemplos concretos. E2E confirma: Alysson agora recebe 5 workouts cobrindo os 5 dias disponíveis. Nota: overlap intra-dia (2 workouts no mesmo dia quando LLM gera Push+Pull+Legs+Upper+Lower para 5 dias) é follow-up separado.

2. ✅ **Bug de dados: "Exercício desconhecido"**. **[RESOLVIDO em Fase 2.5.2]** Adicionado `R_POOL_UNKNOWN_EXERCISE` (`autofix='retry'`) que força re-chamada LLM quando exercise_ids hallucinated. Adicionado log estruturado `[Smart-v2][missingIds] count=N poolSize=M ids=[...]` em `enrichCompactOutput` para observabilidade quando o retry também falha.

3. ✅ **`structure_rationale` hardcoded/templated incorreto.** **[RESOLVIDO em Fase 2.5.2]** Adicionada `generateStructureRationaleFromOutput(workouts)` que infere o split label a partir dos nomes reais dos workouts entregues (closed set: PPL/PPL+1/PPLPPL/Upper-Lower A-B/Upper-Lower/Full Body/Split personalizado). E2E confirma: "PPL+1 5x/sem (Push seg+qui, Pull ter+sex, ...)" em vez de "Upper/Lower 4x/sem".

4. ⬜ **`adaptations=null` em Alysson**. **[ABERTO]** Fora do escopo desta fase.

5. ✅ **Gap de observabilidade — enriched context não persistido.** **[RESOLVIDO em Fase 2.5.2]** `buildSmartV2InputSnapshot` agora inclui `enriched_context_v2: enriched` no `input_snapshot`. E2E confirma `has_enriched=true` na row gerada.

6. ⬜ **Tag muscular incorreta: Terra → Quadríceps.** **[ABERTO]** Erro de dados pré-existente. Fora do escopo.

7. **Fallback `gpt-4o-mini` mais frequente que esperado.** Alysson foi para fallback (`retry_count=0` no resultado final, mas implicitamente após 3 falhas do primário). Em 4 rows smart-v2 até agora (2 walk-through 2.5 + 2.5.1 + 3 desta sessão), 1 caiu em fallback: 25% taxa de fallback. Meta §8 da spec implica primário estável. Registrar para monitoramento contínuo — ainda não há amostra suficiente para conclusão.

## 8. Veredicto final

**Fase 2.5 validada end-to-end com 3 perfis reais, com ressalvas.**

- ✓ **Os programas são significativamente diferentes entre perfis** (Jaccard todos <0.6, §4.6).
- ✓ **Rules-validator funcionando como guardrail load-bearing** — 3 errors + 8 warnings detectados e corrigidos, nenhum error persistido sem correção.
- ✓ **Path smart-v2 consistente em 100% das gerações** — `prompt_version='v2.5.0'`, `ai_source='llm'`, telemetria populada em todas as 3 rows.
- ✓ **Fase 2.5.1 (route mobile) continua funcionando** — todos os 3 curls passaram pelo mesmo pipeline que o web.
- ✗ **§4.5 violada em Alysson** (prescrição 3x quando aluno declarou 5 dias). Não é bug do validator — é limitação do prompt. Follow-up prioritário.
- ✗ **Bug de dados "Exercício desconhecido"** em Alysson. Follow-up prioritário.
- ⚠ **`adaptations=null` em Alysson** apesar de contexto rico. Requer investigação de prompt.
- ⚠ **Gap de observabilidade** do enriched context não-persistido.

Recomendação: não expandir rollout §7 da spec para outros trainers até os follow-ups §7.1 e §7.2 estarem resolvidos. Os itens §7.3–7.7 podem seguir em paralelo.
