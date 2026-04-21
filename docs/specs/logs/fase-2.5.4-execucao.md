# Fase 2.5.4 — Log de Execução

Data: 2026-04-20. Executor: Claude Code (Opus 4.7).

Objetivo: reconciliar o contrato do endpoint `/api/programs/assign` entre o caller mobile (aprovar programa IA-gerado) e o handler web, fechando o funil mobile end-to-end — **generate** (2.5.1) → **aprovar mensagem** (2.5.3) → **atribuir programa** (2.5.4). Um helper novo materializa `assigned_programs` + `assigned_workouts` + `assigned_workout_items` diretamente do `prescription_generations.output_snapshot`, sem template intermediário.

Durante a validação E2E, duas classes de bug latente no pipeline de geração foram expostas (IDs alucinados pelo LLM). Um fix defensivo no helper mantém o funil robusto; a correção estrutural no pipeline fica como follow-up §6.5 priorizado.

## §1. Escopo entregue

Commit coeso único. 9 itens:

1. **Helper `assignFromSnapshot`** ([web/src/lib/ai-prescription/assign-from-snapshot.ts](../../../web/src/lib/ai-prescription/assign-from-snapshot.ts)) — re-fetch da generation com triple filter (id + trainer_id + student_id), materialização completa do programa a partir do `output_snapshot`, best-effort rollback em falha parcial.
2. **Branch `generationId`** em [web/src/app/api/programs/assign/route.ts](../../../web/src/app/api/programs/assign/route.ts) — preserva o branch `templateId` intacto (web), delega ao helper quando body tem `generationId`. Erros tipados → códigos HTTP apropriados (404 / 409 / 422).
3. **3 erros tipados** no helper: `GenerationNotFoundError`, `GenerationAlreadyApprovedError`, `GenerationSnapshotMissingError` — contrato público para o handler mapear.
4. **Fix defensivo A** — `sanitizeSubstitutes`: drop silencioso de entradas não-UUID em `substitute_exercise_ids`, com warn estruturado para auditoria.
5. **Fix defensivo B** — bulk check de `exercise_id` principal contra a tabela `exercises` (system-owned + trainer-owned); drop de items ghost + drop de workouts que ficam vazios.
6. **Hard floor** — se o snapshot inteiro fica sem items válidos após filtragem, o helper lança `GenerationSnapshotAllItemsInvalidError`, handler retorna 422 em pt-BR ("A prescrição gerada contém dados inválidos. Regere o programa e tente novamente.") — evita persistir `assigned_programs` lixo.
7. **21 testes novos** (12 helper + 9 route), todos verdes. Full suite: **350/350**. `tsc` zero erros nos arquivos tocados.
8. **E2E Bearer real** (2 curls contra `localhost:3000`, JWT trainer): ambas generations do Alysson → 200 + rows corretas.
9. **Investigação do pipeline** — diagnóstico da origem dos bugs (§6.5): schema JSON Strict do OpenAI aceita qualquer `string` em `substitute_exercise_ids` / `exercise_id`; nem prompt-builder-v2 nem schemas.ts nem ai-optimizer validam contra o pool real de `exercises`. Fix candidato localizado em [schemas.ts:343](../../../web/src/lib/prescription/schemas.ts#L343) ou [output-enricher.ts](../../../web/src/lib/prescription/output-enricher.ts).

Zero dependências novas. Zero mudanças em `web/src/app/students/[id]/actions/assign-program.ts` (server action web).

## §2. Diff resumido

| Arquivo | Status | Delta |
|---|---|---|
| [web/src/lib/ai-prescription/assign-from-snapshot.ts](../../../web/src/lib/ai-prescription/assign-from-snapshot.ts) | **novo** | 4 classes de erro; helper `assignFromSnapshot(supabase, input)`; `sanitizeSubstitutes()` privado; bulk pool validation; hard floors. ~330 linhas. |
| [web/src/lib/ai-prescription/__tests__/assign-from-snapshot.test.ts](../../../web/src/lib/ai-prescription/__tests__/assign-from-snapshot.test.ts) | **novo** | 12 casos; factory `makeSnapshot` + `allSnapshotExercisesValid` + mock Supabase fluent chain. |
| [web/src/app/api/programs/assign/route.ts](../../../web/src/app/api/programs/assign/route.ts) | editado | Body: aceita `templateId \| generationId` (obrigatório um dos dois); validação UUID separada; warn quando ambos vierem (templateId vence); branch `generationId` que delega ao helper e mapeia erros tipados → 404/409/422. Branch `templateId` 100% intocado. |
| [web/src/app/api/programs/assign/__tests__/route.test.ts](../../../web/src/app/api/programs/assign/__tests__/route.test.ts) | **novo** | 9 casos: 400 sem ids, 400 UUID malformado, happy generationId, snapshot fake ignorado, templateId branch intocado, ambos presentes (templateId wins + warn), 404 not found, 409 already approved, 422 all items invalid. |

## §3. Mapping do contrato mobile

**Body que o mobile envia hoje** ([mobile/app/student/[id]/prescribe.tsx:161-166](../../../mobile/app/student/[id]/prescribe.tsx#L161-L166)):

```json
{
    "studentId": "<uuid>",
    "generationId": "<uuid>",
    "outputSnapshot": { "program": {...}, "workouts": [...], "reasoning": "..." },
    "startDate": "<ISO date>"
}
```

| Campo | Uso pelo handler | Observação |
|---|---|---|
| `studentId` | ✅ usado | ownership check + filter no helper |
| `generationId` | ✅ usado | triple filter no fetch da generation |
| `outputSnapshot` | ❌ **ignorado por design** | Snapshot é re-lido do DB — ver §5 |
| `startDate` | ✅ usado | passado ao helper como `startDate` (imediato assume now) |
| `isScheduled` | opcional | não enviado hoje — default `false` |
| `workoutSchedule` | opcional | não enviado hoje — helper usa `scheduled_days` do próprio snapshot |

## §4. Evidências E2E

### §4.1 Testes unitários

**Helper (12 casos, todos verdes):** happy path, generation not found, already approved, snapshot missing (null), snapshot missing (program.name missing), student_id mismatch não leak, isScheduled replaces vs not, sanitize de subs inválidos, drop de items ghost, drop de workout vazio, throw `GenerationSnapshotAllItemsInvalidError`, rollback em falha de workout.

**Route (9 casos, todos verdes):** 400 ambos ausentes, 400 UUID malformado, 200 generationId, outputSnapshot no body ignorado, 200 templateId branch, ambos presentes (templateId wins + warn), 404 GenerationNotFoundError, 409 GenerationAlreadyApprovedError, **422 GenerationSnapshotAllItemsInvalidError com mensagem pt-BR**.

**Suite full:** 350/350. `tsc --noEmit` zero erros nos arquivos tocados. Erro pré-existente em [generate-program.ts:1119](../../../web/src/actions/prescription/generate-program.ts#L1119) (TS1064) permanece — fora de escopo, documentado na 2.5.4 anterior.

### §4.2 Curl 1 — generation limpa `e3865526-db1e-473b-aa06-cfae3fb6dabd`

```bash
JWT=$(cat /tmp/kvn-trainer-jwt.txt)
curl -sS -X POST http://localhost:3000/api/programs/assign \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"bbe3c04a-72cd-437e-8faa-46615b2ff9e2","generationId":"e3865526-db1e-473b-aa06-cfae3fb6dabd"}' \
  -w "\nHTTP %{http_code}\n"
```

**Response (8.1s):** `HTTP 200` + `{"success": true, "programId": "e15e53a4-539e-49c8-bcd7-17f221ae3dfb"}`.

**Queries de sanidade:**

| Assertion | Esperado | Observado | ✓ |
|---|---|---|---|
| `assigned_programs.name` | "Programa de Hipertrofia - Alysson Lanza" (do snapshot) | idem | ✅ |
| `ai_generated` | true | true | ✅ |
| `source_template_id IS NULL` | true | true | ✅ |
| `prescription_generation_id` | `e3865526-...` | preenchido | ✅ |
| `status` | active | active | ✅ |
| `duration_weeks` | 4 (snapshot) | 4 | ✅ |
| `COUNT(assigned_workouts)` | 3 (snapshot) | **3** | ✅ |
| `COUNT(assigned_workout_items)` | **11** (snapshot 13 − 2 ghosts) | **11** | ✅ |
| `prescription_generations.status` | approved | approved | ✅ |
| `approved_at` | preenchido | true | ✅ |
| `assigned_program_id` (reverso) | `e15e53a4-...` | match | ✅ |

**Evidência do fix B em ação** (classe ghost exercise_id): `e3865526` tinha 2 items com `exercise_name = "Exercício desconhecido"` e `exercise_id` apontando para UUIDs inexistentes em `exercises` (`55d7bfaf-...` e `f864ce3f-...`). Antes do fix, o primeiro item desses disparava FK violation `assigned_workout_items_exercise_id_fkey` — 500. Depois do fix, ambos são dropados silenciosamente com `console.warn` estruturado, e o programa resultante tem **11 items** em vez de 13.

Comportamento do warn provado por teste unitário (#10 do helper); ausência dos `exercise_id` ghost nas rows do DB é evidência indireta em runtime.

### §4.3 Curl 2 — generation com sub corrompido `19957cce-ca65-42fb-a765-d40e83aae8f1`

```bash
JWT=$(cat /tmp/kvn-trainer-jwt.txt)
curl -sS -X POST http://localhost:3000/api/programs/assign \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"bbe3c04a-72cd-437e-8faa-46615b2ff9e2","generationId":"19957cce-ca65-42fb-a765-d40e83aae8f1"}' \
  -w "\nHTTP %{http_code}\n"
```

**Response (9.7s):** `HTTP 200` + `{"success": true, "programId": "241fa1eb-5d3d-42df-b757-24dcdfc15901"}`.

**Sanidade:**

| Assertion | Esperado | Observado | ✓ |
|---|---|---|---|
| `assigned_programs.name` | "Programa Hipertrofia Intermediário 5x Semana" | idem | ✅ |
| `duration_weeks` | 8 | 8 | ✅ |
| `COUNT(assigned_workouts)` | 5 | 5 | ✅ |
| `COUNT(assigned_workout_items)` | 22 (snapshot 22, zero ghosts nessa) | 22 | ✅ |
| Item wk2/it2 `substitute_exercise_ids` | `["5055a511-...]`, **sem `afbc035fc06b`** | idem | ✅ |

Confirmação do fix A (classe sub inválido) em runtime: snapshot raw da generation tem `substitute_exercise_ids: ["afbc035fc06b"]` no workout 2 / item 2; row DB tem apenas o sub válido. `sanitizeSubstitutes` executou corretamente em produção-like.

Comportamento do warn provado por teste unitário (#9 do helper); ausência do ID mutilado na row do DB após runtime é evidência indireta.

## §5. Decisões de segurança e design

### 5.0 Ignorar `outputSnapshot` do body; triple filter no fetch

- Qualquer `outputSnapshot` enviado pelo cliente é descartado. O helper re-busca de `prescription_generations.output_snapshot` com filtro `id = input.generationId AND trainer_id = input.trainerId AND student_id = input.studentId`. Triple filter é defesa em profundidade (RLS é o primário; essa camada continua funcionando mesmo se RLS regredir).
- Testado por 2 casos: teste #5 (student_id mismatch → GenerationNotFoundError, sem leak) e teste de route "outputSnapshot ignored" (helper recebe assinatura sem o campo, garantido pelo tipo).

### 5.1 Fix defensivo de classe A e B — por que drop silencioso em vez de falhar

**Problema:** o pipeline de geração às vezes emite UUIDs inválidos em 2 lugares:
- **Classe A** (sub corrompido): `substitute_exercise_ids` contém strings que passam pelo schema Zod/JSON (`type: 'string'`) mas não são UUIDs. Exemplo: `"afbc035fc06b"` (12 chars). Quebra o insert com `invalid input syntax for type uuid`.
- **Classe B** (exercise_id ghost): `exercise_id` principal do item é um UUID bem-formado, mas **não existe** em `exercises`. Exemplo: `55d7bfaf-a87f-4d25-ab90-d0a9ff656e1e`. Quebra com FK violation `assigned_workout_items_exercise_id_fkey`.

**Por que filtrar em vez de retornar erro HTTP honesto?** Porque retornar erro significa **funil mobile quebrado** para qualquer generation com o bug — observação em `bbe3c04a`: 2 de 5 generations recentes têm classe A ou B. Taxa alta. Falhar duramente punia o usuário pelo bug do LLM; sanitizar mantém o produto usável enquanto o fix estrutural é priorizado.

**Trade-off**: items são dropados silenciosamente. Programa de 13 items pode virar 11 sem que o trainer veja. Honestidade do log: `[assignFromSnapshot] dropping items with ghost exercise_id` emite `console.warn` estruturado com `generationId`, `workoutOrderIndex`, `droppedExerciseIds` e `kept`. Vai para os logs do Next (Vercel Logs em prod, terminal em dev). Não vai para Sentry/PostHog — essa camada não existe nesse ponto do código ainda (follow-up infra).

**Hard floor** preserva a honestidade quando a degradação passa do aceitável:
- Workout com 0 items válidos → drop do workout inteiro + warn.
- Snapshot inteiro sem items → abort **antes** de qualquer write. `GenerationSnapshotAllItemsInvalidError` → 422 com mensagem pt-BR "A prescrição gerada contém dados inválidos. Regere o programa e tente novamente."

**Escolha explícita rejeitada:** threshold percentual (ex: "se >30% dropado, falha"). Rejeitado por introduzir número mágico. Hard floor "0 items" é semanticamente claro.

**Escopo do fix defensivo:** o funil fecha no sentido HTTP 200 + programa montado + subset limpo de items. Não fecha no sentido "programa tem todos os exercícios que o trainer viu na tela de revisão mobile". Prioridade alta da Fase 2.5.5 ou Fase 3 (depende de tamanho) é validar o output do LLM contra o pool de exercícios **antes** de persistir o snapshot, eliminando as classes A e B na origem — ver §6.5 para o fix candidato.

### 5.2 `duration_weeks` default NULL (não 4)

Quando o snapshot omite `program.duration_weeks`, o helper grava `NULL` (coluna é nullable). Decisão consciente: `4` é uma mentira semanticamente carregada. `NULL` força a UI a tratar "desconhecido" explicitamente. Validado pelo tipo + teste happy path (snapshot tem 8 → persiste 8).

### 5.3 FK cascade verificado pré-implementação

Query em `information_schema.referential_constraints` confirmou que `assigned_workouts.assigned_program_id` e `assigned_workout_items.assigned_workout_id` têm `ON DELETE CASCADE`. Permite que o best-effort cleanup do helper delete apenas o `assigned_programs` row — a cascade limpa o resto. Sem necessidade de delete manual na ordem reversa.

### 5.4 `exercises` é global + trainer-owned

`exercises.owner_id` é `nullable`: `NULL` = exercício do sistema (visível a todos os trainers), UUID = exercício criado pelo trainer. Query do bulk check: `id = ANY($1) AND (owner_id IS NULL OR owner_id = <trainer>)`. Impede que trainer A materialize programa referenciando exercise criado pelo trainer B.

### 5.5 Contrato do body: `templateId` ganha silenciosamente se ambos vierem

Se o body tem `templateId` E `generationId`, o handler prefere `templateId` + emite `console.warn('[programs/assign] both templateId and generationId provided, preferring templateId', { trainerId, studentId })`. Razão: preservação do branch web intocado é o valor crítico. Se um caller bugado mandar ambos, o sistema funciona; warn auditável puxa atenção. Follow-up §6.3 considera tornar mutuamente exclusivo em fase futura.

## §6. Follow-ups

### 6.1 Unificar `assign-program.ts` server action web com helper

Hoje a server action web usa lógica própria para o branch template. Quando o dashboard web ganhar "aprovar IA-gerado" (hoje só existe no mobile), deve delegar ao mesmo helper `assignFromSnapshot`. Extensão natural: `assign-program.ts` aceita `generationId` opcional e roteia internamente. Cost: ~20 linhas + testes.

### 6.2 Varredura leve das outras 11 rotas A da auditoria

Bug de contrato mobile↔handler apareceu em `programs/assign` escondido por 307 e foi exposto pela 2.5.3. Similar pode existir em `notify-trainer`, `stripe/portal`, `financial/*`, `notifications/*`, `prescription/generate`. Proposta: grep do shape caller mobile vs shape handler (já feito visualmente em subset; formalizar em 1h).

### 6.3 Contrato `templateId` XOR `generationId` explícito

Hoje: `templateId` ganha se ambos, com warn. Em fase futura, retornar 400 `"Provide exactly one of: templateId | generationId"`. Requer coordenação com mobile para garantir que nunca envia ambos.

### 6.4 Superset no snapshot

Snapshot v2.5 é flat (items sem `parent_item_id`). Se o LLM passar a emitir superset no futuro, o helper precisa de second-pass igual ao branch template. Teste regression quando ocorrer.

### 6.5 **Pipeline de geração emite `substitute_exercise_ids` inválidos e `exercise_id` fantasma**

**Evidência (generations do Alysson):**

- `19957cce-ca65-42fb-a765-d40e83aae8f1` — `gpt-4.1-mini` primário, `retry_count=0`, **1 sub mutilado** (`"afbc035fc06b"`, 12 chars).
- `e3865526-db1e-473b-aa06-cfae3fb6dabd` — `gpt-4o-mini` fallback, `retry_count=0`, **zero subs em todos os items** (LLM seguiu "0-2 UUIDs" do prompt literalmente, gerou 0); **2 de 13 items têm `exercise_id` ghost** (`55d7bfaf-...` e `f864ce3f-...`).

**Diagnóstico (investigação rápida de ~12min):**

1. Schema JSON Strict em [schemas.ts:188-191](../../../web/src/lib/prescription/schemas.ts#L188-L191) declara `substitute_exercise_ids` como `{ type: 'array', items: { type: 'string' } }`. **Não há format/pattern de UUID.** OpenAI Structured Outputs aceita qualquer string. Mesma história para `exercise_id`: `type: ['string', 'null']`, sem pattern.
2. Prompt v2 em [prompt-builder-v2.ts:130](../../../web/src/lib/prescription/prompt-builder-v2.ts#L130): *"`substitute_exercise_ids` pode ter 0-2 UUIDs do mesmo pool"*. Instrução de **constraint**, mas não verificada em runtime.
3. Normalizador pós-LLM em [schemas.ts:343](../../../web/src/lib/prescription/schemas.ts#L343): `Array.isArray(it.substitute_exercise_ids) ? it.substitute_exercise_ids : []` — preserva o array vindo do LLM sem validar conteúdo.
4. AI-optimizer em [ai-optimizer.ts:441](../../../web/src/lib/prescription/ai-optimizer.ts#L441) valida `swap.new_exercise_id` contra `candidate.substitutes` pré-computados, mas **não revalida** o array `substitute_exercise_ids` já presente em cada item.
5. Sobre o `"afbc035fc06b"` de 12 chars: não é UUID v4 nem qualquer padrão reconhecido. Hipótese: o LLM tokenizou um UUID real do pool e recombinou sem hífens, mantendo os primeiros 2 segmentos. Indistinguível sem ler raw output (fora de budget).

**Não é "bug só no fallback"**: `19957cce` caiu no primário. Bug é sistêmico no contrato LLM → schema, com manifestação variável por modelo (`4.1-mini` alucina IDs truncados; `4o-mini` ignora o campo e retorna `[]`).

**Fix candidato:** em [schemas.ts:343](../../../web/src/lib/prescription/schemas.ts#L343) (ou melhor, em `output-enricher.ts`, que já recebe o contexto de exercícios), filtrar por: (a) é string, (b) casa UUID regex, (c) está presente no pool pré-carregado. Requer que o normalizer receba o set de IDs válidos. ~10-15 linhas.

**Prioridade:** **média-alta**. Sem o fix estrutural, todo usuário com generation afetada recebe programa com menos exercícios do que viu na revisão — honesto via warn, mas gera pergunta "cadê os outros exercícios?" Fase 2.5.5 ou Fase 3 deve atacar.

### 6.6 Erro TS1064 pré-existente em `generate-program.ts:1119`

Já documentado na 2.5.4 anterior. Continua pendente. Fora de escopo.

### 6.7 Observabilidade dos warns do helper

`console.warn` hoje só aparece em logs do Next. Para produção, vale pipear esses warns para Sentry/PostHog com tag `[assignFromSnapshot]` para surface rate de ocorrência. Esse é o sinal que determina quando a Fase 6.5 vira urgente vs pode esperar.

## §7. Cascade discoveries

**Curl 1 inicial retornou 500** com a mensagem do DB `insert or update on table "assigned_workout_items" violates foreign key constraint "assigned_workout_items_exercise_id_fkey"`. Debug temporário no handler (revertido após) expôs o stack. Investigação no DB mostrou 2 items com `exercise_id` ghost em `e3865526`.

Essa é a descoberta que virou **§6.5 classe B** e motivou o escopo adicional da fase (opção 1 aprovada pelo Gustavo): estender o fix defensivo para cobrir ambas as classes (A + B), em vez de escopar estritamente só classe A.

## §8. Sequência de trabalho executada

1. ✅ Etapa 1 — `sanitizeSubstitutes` privado + constante UUID_RE + plug no insert de items.
2. ✅ Etapa 2 — Teste helper #9 (sanitize de subs inválidos com warn).
3. ✅ Etapa 3 — Investigação focada: schema strict (§schemas.ts:170-200, :343), prompt v2 (§prompt-builder-v2.ts:120-140), ai-optimizer (§441), query de `ai_source/model_used/retry_count`. Diagnóstico em 12min.
4. 🟡 Curl 1 inicial — **500 inesperado**. Debug temporário + query de pool → classe B descoberta (exercise_id ghost). Pausa + report ao Gustavo.
5. ✅ Destravamento — Gustavo: opção 1 (estender fix defensivo, hard floors, novo erro tipado).
6. ✅ Etapa 4a — bulk check do pool `exercises` (filter `owner_id IS NULL OR owner_id = trainer`); drop ghost items; drop workouts vazios; throw `GenerationSnapshotAllItemsInvalidError` quando total = 0. Handler mapeia → 422 pt-BR.
7. ✅ Etapa 4b — testes helper #10 (drop ghost items), #11 (drop workout inteiro), #12 (abort com novo erro). Teste route #9 (422 pt-BR).
8. ✅ Etapa 4c — Curl 1 `e3865526`: **200**, 11/13 items persistidos (2 ghosts dropados), generation approved. Curl 2 `19957cce`: **200**, 22/22 items persistidos, sub `afbc035fc06b` filtrado da row DB.
9. ✅ Etapa 5 — Log (este arquivo).
10. ⏳ Etapas 6 e 7 — atualizar auditoria + fechar follow-up #17.
