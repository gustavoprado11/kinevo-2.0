# Fase 2.5 — Walk-through manual (roteiro + queries)

**Status:** pronto para execução pelo Gustavo. Preparado em 2026-04-18.

Este arquivo é o que você (Gustavo) vai seguir passo a passo. Mantenha aberto num painel ao lado do app enquanto roda as 3 gerações. As caixas `✅/❌` e os campos "Observação" são para você preencher conforme for revisando.

---

## Pré-condições (já destravadas)

- Migration **104** aplicada no projeto `lylksbtgrihzepbteest` (verificado via `list_migrations` — versão `20260418153155_prescription_generations_telemetry`).
- Coluna `trainers.smart_v2_enabled` criada (`BOOLEAN NOT NULL DEFAULT false`).
- Colunas de telemetria em `prescription_generations` — todas **NULLABLE**, rows antigas intactas.
- Flag **ligada apenas** para o trainer `7aec3555-600c-4e7c-966e-028116921683` (`gustavoprado11@hotmail.com`). Default global continua `false`.
- Zero alertas novos introduzidos pela 104 (checados `get_advisors` de security + performance).

Se você reiniciou o servidor ou fez deploy entre a aplicação da flag e as gerações, não precisa fazer nada — a flag é lida a cada request.

---

## Perfis a gerar

Crie os 3 perfis abaixo como alunos-teste (ou reutilize alunos já existentes ajustando o `student_prescription_profile`). Os três foram desenhados para **exercitar regras diferentes do §4** da spec — se algum critério falhar, o walk-through não fecha.

### Perfil A — Iniciante conservador

| Campo | Valor |
|---|---|
| Nome | Aluno Teste A — Iniciante |
| Nível | iniciante |
| Objetivo | hipertrofia |
| Dias disponíveis | 3 (seg / qua / sex) |
| Duração sessão | 45 min |
| Equipamento | academia completa |
| Restrições | nenhuma |
| Histórico | **nenhum** — sem sessões, sem programa anterior (`is_new_student = true`) |

**Expectativa** (§4.1, §4.2, §4.6):
- Split Full Body A/B alternado.
- Volume no **limite inferior** (~8-10 séries/grupo/semana).
- Zero exercícios com 4 séries (iniciante conservador).
- Exercícios básicos, compostos primeiro, reps 8-12 / 10-15.
- Descansos 60-90s.

### Perfil B — Intermediário com estagnação

| Campo | Valor |
|---|---|
| Nome | Aluno Teste B — Intermediário estagnado |
| Nível | intermediário |
| Objetivo | hipertrofia |
| Dias disponíveis | 5 (seg / ter / qua / qui / sex) |
| Duração sessão | 60 min |
| Equipamento | academia completa |
| Restrições | nenhuma |
| Observação do trainer | "Platô no supino reto há 3 semanas — testar inclinado como principal" |
| Aderência | alta (criar ao menos 8 sessões completas nas últimas 4 semanas se possível) |

**Expectativa** (§4.3, §4.4, §4.5, §4.6):
- Split PPL ou Upper/Lower A/B (5x/semana intermediário).
- Substitui supino reto por **supino inclinado** como principal de peito (leia o prompt injeta `stagnated_exercises`).
- No Push: **peito com 4 séries + ombro com 4 séries**, tríceps **obrigatoriamente em 3** (§4.2).
- Bíceps/tríceps/antebraço/abdômen sempre ≤ 3 séries.
- Volume médio-alto por grupo principal.

### Perfil C — Avançado com restrição lombar

| Campo | Valor |
|---|---|
| Nome | Aluno Teste C — Avançado com restrição |
| Nível | avançado |
| Objetivo | força (performance) |
| Dias disponíveis | 4 (seg / ter / qui / sex) |
| Duração sessão | 75 min |
| Equipamento | academia completa |
| Restrições (`medical_restrictions`) | "Dor lombar leve — evitar compressão axial intensa" |
| Histórico | boa aderência, sem estagnação |

**Expectativa** (§4.1, §4.8, §4.9 "importantes"):
- Split Upper/Lower A/B ou PPL+1.
- **Reps baixas (3-6)** nos compostos + **rest 120-180s**.
- Programa evita agachamento livre / levantamento terra convencional (ou oferece variações menos axiais como hack, stiff apoiado, agachamento frontal leve).
- Acessórios podem chegar a **5 séries** (cap avançado).

---

## Roteiro de execução

Faça **na ordem abaixo**, um perfil por vez:

1. Abra a conta `gustavoprado11@hotmail.com` no produto (staging ou prod com a flag).
2. Crie/selecione o aluno do Perfil A. Vá em **"Gerar com IA"** dentro do construtor.
3. Preencha anamnese conforme a tabela do Perfil A. Clique "Gerar programa".
4. Aguarde a geração terminar. Observe o canvas preenchendo e o programa aparecer.
5. **Antes de editar ou ativar**, preencha o checklist §4 abaixo (subseção "Checklist Perfil A") olhando cada treino.
6. Repita passos 2-5 para Perfil B e Perfil C.
7. Após os 3 perfis, rode as queries SQL da seção **"Queries de auditoria"** e cole os resultados no final deste arquivo.
8. Se algum item do checklist vier ❌, não ative o programa — abra uma task de ajuste antes de seguir pra Fase 2 do rollout.

---

## Checklist §4 — preenchimento por perfil

Marque `[x]` (✅) ou `[ ]` (❌). Na linha "Observação", anote o que viu quando ❌ — ou deixe em branco quando ✅.

### Checklist Perfil A — Iniciante conservador

- [ ] §4.1 Nenhum exercício **composto** passa de **4 séries** (e idealmente iniciante fica em 3).
- [ ] §4.1 Nenhum **acessório** passa de **3 séries** (cap iniciante).
- [ ] §4.2 Bíceps/tríceps/antebraço/abdômen: principal **≤ 3 séries**.
- [ ] §4.3 No máximo **1 exercício com 4 séries** por grupo muscular por treino (expectativa: **zero**).
- [ ] §4.4 Volume semanal no limite inferior da faixa iniciante (~8-12 séries/grupo).
- [ ] §4.5 Split é Full Body A/B (2-3 treinos alternados cobrindo corpo inteiro).
- [ ] §4.6 Sinalizado como "aluno novo sem histórico" — prescrição visivelmente conservadora.
- [ ] §4.7 Ordem: compostos antes de acessórios; grandes grupos antes de pequenos.
- [ ] §4.8 Reps hipertrofia (8-12 compostos / 10-15 acessórios). Rest 60-90s.

Observações Perfil A:

```
(preencher)
```

### Checklist Perfil B — Intermediário estagnado

- [ ] §4.1 Nenhum composto > 4 séries. Acessório ≤ 4 (cap intermediário).
- [ ] §4.2 Bíceps/tríceps/antebraço/abdômen ≤ 3.
- [ ] §4.3 **Push**: até **2** exercícios com 4 séries (peito + ombro). Tríceps em 3.
- [ ] §4.3 **Pull** (se houver): no máximo 1 exercício com 4 séries. Bíceps em 3.
- [ ] §4.3 Quando houver 2 exercícios do **mesmo** grupo no mesmo treino, o primeiro tem mais séries (nunca 4+4 no mesmo grupo).
- [ ] §4.4 Volume médio-alto, consistente com intermediário (~12-18 séries/grupo).
- [ ] §4.5 Split compatível com 5 dias intermediário (PPL ou Upper/Lower A/B).
- [ ] §4.6 Programa **diferente visivelmente** do Perfil A (splits, picks, volumes).
- [ ] §4.6 Reflete estagnação: supino inclinado aparece como composto principal de peito (ou há variação explícita no padrão de empurrar).
- [ ] §4.7 Ordem compostos→acessórios, grandes→pequenos.
- [ ] §4.8 Reps 8-12 / 10-15; rest 60-90s.

Observações Perfil B:

```
(preencher)
```

### Checklist Perfil C — Avançado com restrição lombar

- [ ] §4.1 Nenhum composto > 4 séries. Acessórios podem ir até **5** (cap avançado).
- [ ] §4.2 Bíceps/tríceps/antebraço/abdômen ≤ 3 como principal.
- [ ] §4.3 Até 1 exercício com 4 séries por grupo por treino.
- [ ] §4.4 Volume no limite superior da faixa avançada (~16-22 séries/grupo), ajustado pra sessões de 75min.
- [ ] §4.5 Split compatível com 4 dias avançado (Upper/Lower A/B ou PPL+1).
- [ ] §4.7 Ordem compostos→acessórios, grandes→pequenos.
- [ ] §4.8 **Força**: reps 3-6 nos compostos, rest **2-3 min** (120-180s).
- [ ] §4.9 Restrição lombar respeitada — agachamento livre / levantamento terra pesado **ausentes** ou substituídos por variações sem compressão axial intensa.
- [ ] §4.6 Programa **diferente visivelmente** dos Perfis A e B.

Observações Perfil C:

```
(preencher)
```

---

## Queries de auditoria

⚠ **Adaptações vs. o prompt original**: o schema real tem algumas colunas diferentes das sugeridas no prompt de destravamento. Abaixo o que foi ajustado e por quê:

- `cache_hit` **não existe** — uso `cost_usd = 0 AND tokens_output = 0` como proxy (uma row de cache hit no smart-v2 é inserida sem consumo LLM).
- `used_fallback_model` **não existe** — infiro por `model_used = 'gpt-4o-mini'` (o fallback configurado; primário é `gpt-4.1-mini`).
- `error_message` **não existe** — quando a geração falha, a row nem é inserida (fallback para pipeline v1 ou erro retornado ao caller). Rows no banco são sempre de sucesso.
- `cache_key` **não é persistida** — o cache é in-memory (`Map` no processo Node), chave não vai pro DB.
- `generation_id` → é só `id`.

Rode cada query pelo SQL editor do Supabase logado como o Gustavo **OU** pelo MCP com `project_id = lylksbtgrihzepbteest`. Copie o JSON/tabela de saída e cole na seção "Resultados" no final.

### Q1 — Custo + tokens das últimas 10 gerações

```sql
-- Valida: §8 da spec (custo médio $0.004–$0.012 por geração) e propagação de
-- cached_input_tokens. Fallback aparece quando model_used = 'gpt-4o-mini'.
-- retry_count > 0 indica que teve pelo menos 1 tentativa falha antes.
SELECT
    id,
    created_at,
    model_used,
    (model_used = 'gpt-4o-mini')                           AS used_fallback,
    retry_count,
    tokens_input_new,
    tokens_input_cached,
    tokens_output,
    cost_usd,
    prompt_version
FROM public.prescription_generations
WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND prompt_version IS NOT NULL          -- só rows do caminho smart-v2
ORDER BY created_at DESC
LIMIT 10;
```

**Como interpretar:**
- `cost_usd` deve ficar entre **$0.004 e $0.012** na média (§8).
- Se `used_fallback = true` com frequência, o primário (`gpt-4.1-mini`) está instável — investigar.
- `retry_count ≥ 1` isolado é ok (rede); consistente > 0 é sinal de 5xx crônico.

### Q2 — Cache hit rate (proxy)

```sql
-- Valida: efetividade do cache program-cache.ts (spec §5.6) na semana.
-- Proxy: cost_usd=0 AND tokens_output=0 AND prompt_version presente → cache hit.
-- (O cache in-memory do Node não sobrevive deploy/restart; rate tende a subir
-- conforme o app fica quente.)
SELECT
    COUNT(*) FILTER (
        WHERE cost_usd = 0 AND tokens_output = 0
    ) AS cache_hits,
    COUNT(*) AS total,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cost_usd = 0 AND tokens_output = 0)
              / NULLIF(COUNT(*), 0),
        1
    ) AS cache_hit_pct,
    COUNT(*) FILTER (WHERE tokens_input_cached > 0) AS openai_prompt_cache_hits,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE tokens_input_cached > 0)
              / NULLIF(COUNT(*), 0),
        1
    ) AS openai_prompt_cache_pct
FROM public.prescription_generations
WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND prompt_version IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

**Como interpretar:**
- `cache_hit_pct` = quantas gerações evitaram chamar LLM graças ao nosso cache de 6h.
- `openai_prompt_cache_pct` = quantas chamadas ativaram o prompt cache da OpenAI (camadas 1+2 estáveis). Meta §8: ≥ 40% depois da primeira semana.

### Q3 — Violações de regras agrupadas

```sql
-- Valida: §5.8 (rules-validator aplicando §4). Cada violation_id aqui é algo
-- que o LLM produziu incorreto e o validador corrigiu antes de salvar.
-- Contagem alta numa regra sinaliza que o prompt não está convencendo a IA
-- daquela regra específica — candidato a reforço nos exemplos/instruções.
SELECT
    viol->>'rule_id'   AS rule_id,
    viol->>'severity'  AS severity,
    COUNT(*)           AS occurrences,
    COUNT(DISTINCT g.id) AS distinct_generations
FROM public.prescription_generations g,
     LATERAL jsonb_array_elements(COALESCE(g.rules_violations_json, '[]'::jsonb)) AS viol
WHERE g.trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND g.prompt_version IS NOT NULL
GROUP BY rule_id, severity
ORDER BY occurrences DESC;
```

**Como interpretar:**
- `severity='error'` significa que o LLM violou uma regra crítica (sets fora do cap) — foi clampado pelo validator. Se `occurrences` passar de ~20% das gerações na mesma `rule_id`, ajustar o prompt.
- `severity='warning'` (ordenação, reps/rest fora do range) é menos grave mas ainda informativo.
- **Zero linhas** neste resultado = todas as 3 gerações passaram limpas nas regras §4. Boa notícia.

### Q4 — Fallbacks e retries

```sql
-- Valida: callWithModelFallback (spec §5.2). Rows onde a primeira tentativa
-- ou o modelo primário falhou. Útil pra decidir se 'gpt-4.1-mini' está
-- confiável ou se precisa investigar rate-limit / timeout.
SELECT
    id,
    created_at,
    model_used,
    retry_count,
    tokens_input_new + tokens_input_cached AS total_input_tokens,
    tokens_output,
    cost_usd
FROM public.prescription_generations
WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND prompt_version IS NOT NULL
  AND (retry_count > 0 OR model_used = 'gpt-4o-mini')
ORDER BY created_at DESC
LIMIT 20;
```

**Como interpretar:**
- Zero rows = pipeline 100% verde no primário. Resultado ideal nesta fase de dogfood.
- Poucas rows com `retry_count=1` e `model_used='gpt-4.1-mini'` = hiccups transientes, aceitável.
- Muitas rows com `model_used='gpt-4o-mini'` = primário caindo com frequência; investigar logs do app.

### Q5 — Diferenças entre os 3 perfis (§4.6 — variabilidade)

```sql
-- Valida: §4.6. Queremos programas visivelmente diferentes quando os perfis
-- variam. Olhamos program.name, contagem de workouts, contagem total de items
-- e o tempo de geração. O spec não exige métrica automatizada de diversidade
-- (é o walk-through visual do Gustavo que fecha esse critério).
SELECT
    id,
    created_at,
    prompt_version,
    output_snapshot->'program'->>'name'                   AS program_name,
    jsonb_array_length(output_snapshot->'workouts')        AS workouts_count,
    (
        SELECT SUM(jsonb_array_length(w->'items'))
        FROM jsonb_array_elements(output_snapshot->'workouts') w
    )                                                      AS total_items,
    generation_time_ms,
    rules_violations_count,
    cost_usd,
    model_used
FROM public.prescription_generations
WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND prompt_version IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;
```

**Como interpretar:**
- As 3 rows devem ter **nomes de programa diferentes** e idealmente **splits / quantidade de workouts distintos** (2-3 vs. 5 vs. 4 — Perfil A, B, C respectivamente).
- Se duas rows tiverem `program_name` idêntico e `workouts_count + total_items` iguais, o LLM provavelmente copiou — sinal de que a Camada 3 (contexto do aluno) está entrando fraca no prompt. Registrar como bug.
- `rules_violations_count` idealmente 0 nos 3 casos (validator não teve que corrigir nada).

### Q6 — Sanity check pré-walkthrough (rodar ANTES de gerar)

```sql
-- Confirma que nenhuma row smart-v2 pré-existe pra este trainer. Se retornar
-- linhas, são de testes anteriores — tome nota do count pra separar na Q1.
SELECT COUNT(*) AS pre_existing_smart_v2_rows
FROM public.prescription_generations
WHERE trainer_id = '7aec3555-600c-4e7c-966e-028116921683'
  AND prompt_version IS NOT NULL;
```

---

## Resultados (preencher após rodar as 3 gerações)

### Q1 — Custo das últimas 10

```
(colar saída aqui)
```

### Q2 — Cache hit rate

```
(colar saída aqui)
```

### Q3 — Violações agrupadas

```
(colar saída aqui)
```

### Q4 — Fallbacks e retries

```
(colar saída aqui)
```

### Q5 — Diferenças entre perfis

```
(colar saída aqui)
```

### Q6 — Sanity check

```
(colar saída aqui — rodar ANTES das gerações)
```

---

## Decisão de rollout

Só passe pra Fase 2 do rollout (§7 da spec) se:

- **Os 3 checklists acima estão 100% ✅**, OU os ❌ restantes foram mapeados como bugs conhecidos com task aberta.
- **Q1** mostra `cost_usd` médio dentro de $0.004–$0.012.
- **Q3** mostra zero violações `severity=error` OU todas as que aparecerem foram corrigidas pelo validator (coluna `rules_violations_count` > 0 mas programa final é válido — aí é observabilidade funcionando, não bug).
- **Q5** mostra variabilidade visível entre os 3 perfis (nomes + splits distintos).

Se qualquer um falhar: registra o gap aqui embaixo, abre task, e **não liga a flag pra mais ninguém** antes de resolver.

```
(decisão final — pós-revisão)
```
