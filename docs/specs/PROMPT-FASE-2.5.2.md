# Prompt para Claude Code — Fase 2.5.2 (4 findings do walk-through)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `docs/specs/06-fase-2.5-prescricao-inteligente.md` — §4 (regras de domínio) e §5.6 (rules-validator).
2. `docs/specs/logs/fase-2.5-execucao.md` — §9 e §6.
3. `docs/specs/logs/fase-2.5.1-execucao.md` — para entender o estado atual da route mobile.
4. `docs/specs/logs/fase-2.5-walkthrough-3-perfis.md` — **crítico**: este prompt endereça os 4 findings registrados lá.

## Contexto

O walk-through dos 3 perfis validou a Fase 2.5 com ressalvas. Cinco findings registrados; esta fase resolve os **quatro** que bloqueiam rollout expandido (§7 da spec principal):

- **#5 (observabilidade)** — `EnrichedStudentContextV2` não persistido no `input_snapshot`. Bloqueia debug de todas as outras investigações.
- **#1 (bloqueante)** — Violação de §4.5: LLM gerou 3 workouts pra aluno com `available_days=5`. Rules-validator não detectou.
- **#2 (bloqueante)** — `exercise_id` hallucinado / missing no pool. `enrichCompactOutput` caiu em fallback "Exercício desconhecido". Sem logging.
- **#3 (honestidade)** — `reasoning.structure_rationale` aparece com texto templated que contradiz o programa entregue. Evidência de que o enricher sobrescreve o output real da LLM.

Finding #6 (fallback 25% em `gpt-4o-mini`) fica fora de escopo desta fase — amostra ainda pequena, monitorar.

## Escopo

Quatro entregas, **nesta ordem estrita**:

1. Persistir `EnrichedStudentContextV2` no `input_snapshot` (habilita debug do resto).
2. Regra no rules-validator detectando `workouts.length !== available_days.length`; reforço de Layer 1 no prompt.
3. Validação de `exercise_id ∈ pool` no rules-validator + logging em `enrichCompactOutput`.
4. Auditar `output-enricher.ts` e decidir destino do campo `structure_rationale`.

**Cada etapa é um commit lógico, testada antes de passar pra próxima.** Não pule ordem.

## Antes de editar qualquer arquivo

Produza um **plano de execução** e aguarde aprovação. O plano deve cobrir, por etapa:

### Etapa 1 — Persistir `EnrichedStudentContextV2` no `input_snapshot`

**Investigação primeiro** (antes de propor diff):

- Ler `web/src/actions/prescription/generate-program.ts` — localizar onde `input_snapshot` é montado antes do INSERT na `prescription_generations`. Confirmar shape atual exato.
- Ler `web/src/lib/prescription/context-enricher-v2.ts` — confirmar shape de `EnrichedStudentContextV2` (tamanho estimado do payload).
- Confirmar que a coluna `input_snapshot` é `jsonb` e não tem limite de tamanho preocupante (payload esperado <50KB, não é issue).

**Fix proposto:**

- Adicionar chave `enriched_context_v2` ao objeto `input_snapshot` com o retorno completo do `enrichStudentContextV2`.
- Preservar chaves existentes (`profile`, `smart_v2`, `engine_version`, `prompt_version`, `available_exercises`, `performance_context`) — não remover nada, só acrescentar.
- **Não** persistir PII adicional que já não esteja lá. `EnrichedStudentContextV2` agrega dados de questionário; validar se algum campo é sensível (ex: questões sobre saúde mental, uso de medicamentos). Se houver, filtrar antes de persistir ou registrar follow-up de privacidade.

**Teste:**

- Teste novo em `web/src/actions/prescription/generate-program.test.ts` (o arquivo já existe após a 2.5.1): valida que uma chamada smart-v2 bem-sucedida produz `input_snapshot.enriched_context_v2` com os 5 campos principais (`anamnese_summary`, `performance_summary`, `adherence`, `trainer_observations`, `is_new_student`).
- Verificar que testes existentes continuam passando (295/295).

### Etapa 2 — Regra §4.5 no rules-validator + reforço do Layer 1

**Investigação primeiro:**

- Ler `reasoning.structure_rationale` e `reasoning.volume_rationale` da row `e3865526…` (Alysson, walk-through). SQL:
  ```sql
  SELECT id,
         output_snapshot->'reasoning' AS reasoning,
         input_snapshot->'profile'->'available_days' AS declared_days
  FROM prescription_generations
  WHERE id = '<UUID da row Alysson do walkthrough>';
  ```
  Pegar o UUID exato do log `fase-2.5-walkthrough-3-perfis.md`.
- Classificar: (a) LLM justificou os 3 workouts explicitamente (adaptação deliberada) ou (b) ignorou silenciosamente (bug de aderência). O fix do prompt depende disso.

**Fix no validator (sempre aplicado, independente da classificação):**

- Arquivo: `web/src/lib/prescription/rules-validator.ts` (confirmar nome exato).
- Nova regra: `workouts.length` deve ser igual a `context.available_days.length`, ou estar dentro de tolerância aceitável (ex: ±1 se o trainer indicou "flexível"). Definir threshold com base no que encontrar no código — não inventar.
- Severity: **`error`** auto-corrigível quando `workouts.length < available_days.length` (expandir para frequência declarada, usando split §4.5). Quando `workouts.length > available_days.length`, severity `error` não-corrigível que aborta (essa direção nunca deveria acontecer e significa bug sério).
- Registrar na `rules_violations_json` com `code: 'R45_FREQUENCY_MISMATCH'` (convenção inferida do código existente — validar).

**Reforço do prompt Layer 1 (só se classificação for (b)):**

- Arquivo: `web/src/lib/prescription/prompt-builder-v2.ts`.
- Localizar onde §4.5 é codificada no Layer 1. Linguagem atual provavelmente é descritiva; trocar por imperativa: "O programa gerado **deve** ter exatamente N workouts, onde N = número de dias disponíveis do aluno (fornecido no Layer 3). Frequências válidas: 2–6. Prescrever fora desse range é erro grave."
- Adicionar 1 exemplo few-shot específico de 5 dias se ainda não houver.
- Manter estabilidade da Layer 1 para preservar cache (isto vai invalidar uma vez, ok).

**Teste:**

- Teste unitário do validator: input com `workouts.length=3` e `available_days.length=5` → produz violation `R45_FREQUENCY_MISMATCH` com severity `error` + sugestão de auto-correção.
- Teste unitário do validator: input com `workouts.length=5` e `available_days.length=5` → sem violation.
- Se tocar no prompt, rodar teste de snapshot do prompt (se existir) — esperar que diff apareça e atualizar snapshot explicitamente.

### Etapa 3 — Validação `exercise_id ∈ pool` + logging em `enrichCompactOutput`

**Investigação primeiro:**

- Localizar `enrichCompactOutput` (provavelmente em `web/src/lib/prescription/output-enricher.ts`). Ler o path do fallback "Exercício desconhecido".
- Confirmar o padrão de logging do pipeline 2.5: `[Smart-v2] …` e `[AgentePrescitor] …` (2ª notação vem do código legado). Manter consistência.

**Fix logging:**

- Quando `exercise_id` não está no `exerciseMap`, logar:
  ```
  [Smart-v2][missingIds] generationId=<id> studentId=<id> trainerId=<id> missing=[<id1>,<id2>,...] poolSize=<n>
  ```
- Incluir na struct que retorna do enricher uma lista de `missing_exercise_ids` (não persistir em coluna separada ainda — fica no `output_snapshot` como `meta.missing_exercise_ids`).

**Fix validator:**

- Nova regra: todo `exercise_id` do output deve pertencer ao pool fornecido (`available_exercises` do `input_snapshot`).
- Severity: **`error` não-corrigível**. Missing exercise é hallucination; auto-correção seria escolher substituto arbitrário, o que mascara o bug. Em vez disso: abortar, retornar erro pra LLM com instrução "os seguintes IDs não existem no pool: [...]. Gere novamente usando apenas IDs do pool." e consumir o retry count.
- Integrar com retry/fallback: se o retry também hallucinar, propagar erro 500 com mensagem clara.

**Teste:**

- Teste unitário do validator: input com 1 exercise_id que não está no pool → violation com severity `error`, tipo `R_POOL_UNKNOWN_EXERCISE`.
- Teste de integração do enricher: input com id missing → retorna struct com `missing_exercise_ids` populado + log emitido (spy no console).

### Etapa 4 — Auditar `structure_rationale` e decidir destino

**Investigação primeiro (crítica, define o fix):**

- Ler `output-enricher.ts` inteiro focando em como `reasoning.structure_rationale` é produzido.
- Responder **explicitamente** no plano: o texto vem da LLM e o enricher sobrescreve, OU o campo nunca veio da LLM e é 100% templated determinístico?
- Ler o schema strict em `schemas.ts` — o campo `structure_rationale` está declarado no schema da LLM? Se sim, a LLM é obrigada a preencher. Se não, o enricher inventou.

**Fix depende da descoberta. Três opções, escolher uma no plano:**

- **Opção 1 — campo vem da LLM, enricher sobrescreve:** remover a sobrescrita no enricher. Garantir que `schema.strict=true` força a LLM a preencher corretamente.
- **Opção 2 — campo nunca veio da LLM, é 100% templated:** remover o campo do `output_snapshot` (não enganar o consumidor) OU renomear pra `structure_template_hint` deixando claro que é derivado, não reasoning real.
- **Opção 3 — híbrido (parte LLM, parte templated):** mal cheiro arquitetural. Separar em dois campos com nomes honestos.

Fechar com decisão explícita no log de execução da 2.5.2.

**Teste:**

- Teste de output do enricher: confirma que o campo final reflete a decisão tomada (e.g., se Opção 1, snapshot sem sobrescrita; se Opção 2, snapshot sem o campo).

### F. Validação end-to-end

Após as 4 etapas passarem unit/integration tests:

- Re-executar **apenas o caso do Alysson** (student_id `bbe3c04a-72cd-437e-8faa-46615b2ff9e2`) via curl Bearer (mesmo padrão da 2.5.1 / walk-through). Esse aluno triggerou 3 findings simultaneamente; é o melhor teste de regressão.
- Query:
  ```sql
  SELECT id, rules_violations_json, 
         input_snapshot ? 'enriched_context_v2' AS has_enriched,
         jsonb_array_length(output_snapshot->'workouts') AS n_workouts,
         output_snapshot->'reasoning'->>'structure_rationale' AS rationale
  FROM prescription_generations
  WHERE student_id = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'
  ORDER BY created_at DESC LIMIT 1;
  ```
- Expectativa:
  - `has_enriched = true` (etapa 1).
  - `n_workouts = 5` ou, se a LLM ainda errar, violation `R45_FREQUENCY_MISMATCH` em `rules_violations_json` (etapa 2).
  - Zero violations `R_POOL_UNKNOWN_EXERCISE` (etapa 3 — esperado que o prompt reforçado também reduza hallucination; se aparecer, logging novo permite diagnóstico).
  - `rationale` honesto (etapa 4).

### G. O que **não** fazer

- Não toque em `context-enricher-v2.ts` (só leitura pra entender shape).
- Não refatore `generate-program.ts` além do necessário pra montar o `input_snapshot` enriquecido.
- Não adicione colunas novas na `prescription_generations` — tudo fica em `input_snapshot`/`output_snapshot` jsonb.
- Não aplique migration SQL nesta fase.
- Não ligue flag pra outros trainers.
- Não use git.

## Regras desta sessão

- Plano primeiro, espera aprovação explícita.
- Se investigação da etapa 2 (classificação a/b do Alysson) mostrar que a LLM justificou deliberadamente os 3 workouts, pause e reporte antes de aplicar reforço do prompt — pode virar conversa de produto ("LLM adaptou por adherence baixa" é decisão, não bug).
- Se investigação da etapa 4 revelar que `schemas.ts` **não** declara `structure_rationale` (campo inventado pelo enricher), pause e reporte antes de implementar Opção 1/2/3 — decisão depende de input do Gustavo.
- `npm test` verde. `npx tsc --noEmit` verde em `web/`.
- Strings user-facing em pt-BR; código/comentários em inglês.

## Definição de "pronto"

- Etapa 1: `input_snapshot.enriched_context_v2` persistido, teste novo passa.
- Etapa 2: regra `R45_FREQUENCY_MISMATCH` no validator, teste unitário passa. Prompt Layer 1 reforçado (se aplicável). Classificação a/b do Alysson registrada no log.
- Etapa 3: regra `R_POOL_UNKNOWN_EXERCISE` no validator, logging `[Smart-v2][missingIds]` emitido, testes passam.
- Etapa 4: decisão Opção 1/2/3 aplicada com justificativa no log.
- Validação end-to-end do Alysson: 5 workouts OR violation explícita; enriched_context_v2 populado; zero pool-unknown; rationale honesto.
- `npm test` verde; `npx tsc --noEmit` verde.
- `docs/specs/logs/fase-2.5.2-execucao.md` criado com:
  - §1 Escopo (4 etapas).
  - §2 Investigações por etapa (classificação a/b, análise do enricher).
  - §3 Diffs resumidos.
  - §4 Evidência end-to-end (row nova do Alysson + comparação com `e3865526…` anterior).
  - §5 Follow-ups abertos (incluindo #6 do walk-through: fallback `gpt-4o-mini` em monitoramento).
- Atualizar `docs/specs/logs/fase-2.5-walkthrough-3-perfis.md` §7: marcar findings #1, #2, #3, #5 como **endereçados** com link pro log da 2.5.2. Manter #6 como aberto.

Comece produzindo o plano. Aguarde aprovação.
