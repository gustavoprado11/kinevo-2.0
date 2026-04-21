# Prompt para Claude Code — Fase 2.5.4 (fix: resiliência a snapshots com UUID corrompido)

Copie o bloco abaixo e cole no Claude Code (rodando a partir da raiz do repo `~/kinevo`).

---

Leia, nesta ordem:

1. `web/src/lib/ai-prescription/assign-from-snapshot.ts` — helper da 2.5.4 (já implementado).
2. `web/src/lib/ai-prescription/__tests__/assign-from-snapshot.test.ts` — testes existentes (7 casos, todos verdes).
3. `web/src/app/api/programs/assign/route.ts` — handler (branch `generationId` já implementado).
4. `web/src/actions/prescription/generate-program.ts` — pipeline de geração (onde o LLM output vira `output_snapshot`). Leia os ~200 linhas finais, foco em onde `substitute_exercise_ids` é populado.

## Contexto

A Fase 2.5.4 está a **um fix** de fechar. O curl E2E falhou com **500 `invalid input syntax for type uuid: "afbc035fc06b"`** porque o `output_snapshot` da generation `19957cce-ca65-42fb-a765-d40e83aae8f1` contém um item com `substitute_exercise_ids: ["afbc035fc06b"]` — string de 12 chars, não é UUID.

Evidência direta (já coletada via SQL):

- Generation `19957cce`: 26 substitutos totais, **1 item com ID corrompido** (workout idx 2, item idx 2). Exercise principal (`exercise_id`) está íntegro — só o substituto desse item está quebrado.
- Generation `e3865526-db1e-473b-aa06-cfae3fb6dabd`: snapshot limpo, **zero substitutos em 15+ items**. Outro sintoma de bug latente — spec prevê substitutos obrigatórios.

**Conclusão:** o pipeline de geração às vezes emite `substitute_exercise_ids` inválidos ou nenhum. O helper de materialização precisa ser **resiliente** — não pode quebrar o funil do mobile porque o LLM cuspiu um sub corrompido.

## Escopo

Esta sessão implementa **fix defensivo no helper** + **E2E real via curl Bearer** + **investigação rápida da origem dos 2 bugs no pipeline**. A correção estrutural do pipeline fica como follow-up — infla demais o escopo da 2.5.4.

1. Filtrar `substitute_exercise_ids` no helper por regex UUID antes do insert. Log warn com evidência (generationId + workout.order_index + item.order_index + strings descartadas) se algo for filtrado.
2. Test case novo: "substitutos com UUID inválido são filtrados silenciosamente e warn é emitido". Deve passar junto com os 7 existentes.
3. E2E real via curl Bearer: primeiro com `e3865526` (caminho feliz limpo), depois retry com `19957cce` (prova que o fix filtra o inválido sem quebrar).
4. Investigação de ~15min no pipeline de geração: onde o `substitute_exercise_ids` é populado no output da IA? É o LLM emitindo lixo ou pós-processamento truncando? Documentar achado, não corrigir.
5. Fechar `docs/specs/logs/fase-2.5.4-execucao.md` com §1–§7 + adicionar seção §5.1 do fix defensivo.
6. Atualizar auditoria middleware (§3 de `docs/specs/logs/auditoria-middleware-mobile.md`) marcando `/api/programs/assign` como ✅ funil reconciliado.
7. Marcar follow-up #17 da Fase 2.5 como concluído.

## Regras desta sessão

- Plano primeiro, espera aprovação antes de editar.
- Strings user-facing em pt-BR; código e comentários em inglês.
- **Não corrigir o pipeline de geração.** Só investigar onde o bug acontece e documentar. Correção estrutural é fase futura.
- Não ligar flag `smart_v2_enabled` pra outros trainers.
- Não usar git.

## Antes de editar — produza o plano

### Etapa 1 — Fix defensivo no helper

Arquivo: `web/src/lib/ai-prescription/assign-from-snapshot.ts`.

Adicionar constante no topo do módulo (depois dos imports):

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

No loop de items (dentro do `try`, antes do insert de `assigned_workout_items`), transformar:

```ts
substitute_exercise_ids: item.substitute_exercise_ids ?? [],
```

em:

```ts
substitute_exercise_ids: sanitizeSubstitutes(
    item.substitute_exercise_ids ?? [],
    {
        generationId: input.generationId,
        workoutOrderIndex: workout.order_index,
        itemOrderIndex: item.order_index,
    },
),
```

Adicionar helper privado no final do módulo:

```ts
function sanitizeSubstitutes(
    raw: unknown[],
    ctx: { generationId: string; workoutOrderIndex: number; itemOrderIndex: number },
): string[] {
    const valid: string[] = []
    const invalid: unknown[] = []
    for (const x of raw) {
        if (typeof x === 'string' && UUID_RE.test(x)) {
            valid.push(x)
        } else {
            invalid.push(x)
        }
    }
    if (invalid.length > 0) {
        console.warn('[assignFromSnapshot] dropping invalid substitute_exercise_ids', {
            ...ctx,
            dropped: invalid,
            kept: valid.length,
        })
    }
    return valid
}
```

Plano deve confirmar:
- Linhas exatas a editar.
- Que nenhum outro lugar do helper lê `item.substitute_exercise_ids` (pra não ficar inconsistente).
- Que o tipo `string[]` do resultado bate com o shape aceito pela coluna `_uuid` do Supabase.

### Etapa 2 — Test case novo

Arquivo: `web/src/lib/ai-prescription/__tests__/assign-from-snapshot.test.ts`.

Adicionar caso #8: `'filters invalid UUIDs from substitute_exercise_ids and logs warn'`.

Setup:
- Snapshot com 1 workout, 1 item.
- `item.substitute_exercise_ids = ['afbc035fc06b', 'fa921fca-3f70-4d8c-803a-2f30a03d3784', '', null, 'not-a-uuid']`.
- Mock `console.warn`.

Asserts:
- Helper retorna programId sem lançar.
- Insert de `assigned_workout_items` recebe `substitute_exercise_ids: ['fa921fca-3f70-4d8c-803a-2f30a03d3784']` (apenas o válido).
- `console.warn` foi chamado 1 vez com `dropped.length === 4`.

Rodar: `npm test -- --run assign-from-snapshot` deve mostrar 8/8 verde.

### Etapa 3 — Investigação do pipeline (sem fix)

Objetivo: **descobrir onde** o `substitute_exercise_ids` é populado no pipeline de geração e **por que** às vezes contém ID mutilado ou array vazio.

Passos:

1. Grep no `web/src/actions/prescription/generate-program.ts` por `substitute_exercise_ids` — listar todas as ocorrências com contexto.
2. Grep em `web/src/lib/prescription/**/*.ts` pela mesma string. Listar.
3. Identificar o ponto onde o LLM retorna o item e onde `substitute_exercise_ids` é derivado. Duas possibilidades típicas:
   - (a) LLM cospe IDs direto → validar contra `exercises.id`. Se for esse caminho, o bug é "LLM alucinou um ID" e o pipeline não valida.
   - (b) Pipeline enriquece item com substitutos por lookup (ex: "pega os N exercícios mais similares pelo muscle_group") → validar shape do retorno.
4. Abrir o cache key `ProgramCache` relevante pra `19957cce` — se houver um arquivo de cache no disco, ler o raw do LLM (pré-processamento) e comparar com o snapshot final. Se o LLM já veio com "afbc035fc06b", bug é do LLM. Se o raw estava íntegro, bug é pós-processamento.
5. Registrar achado concreto: linha + código + diagnóstico.

**Não escreva fix.** Só documente. Se o fix for óbvio (ex: 1 linha faltando validação), anote como follow-up detalhado — mas não aplica nesta sessão.

### Etapa 4 — E2E Bearer real

Pré-checks:

```bash
cat /tmp/kvn-trainer-jwt.txt | wc -c   # esperado 807
```

Se expirou (JWT do Supabase dura 1h a partir da emissão), pausa e reporta. Não tenta contornar.

**Curl 1 — generation limpa (`e3865526`):**

```bash
JWT=$(cat /tmp/kvn-trainer-jwt.txt)
GEN_ID="e3865526-db1e-473b-aa06-cfae3fb6dabd"
STU_ID="bbe3c04a-72cd-437e-8faa-46615b2ff9e2"

curl -sS -X POST http://localhost:3000/api/programs/assign \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STU_ID\",\"generationId\":\"$GEN_ID\"}" \
  -w "\n---\nHTTP %{http_code} — %{time_total}s\n"
```

Esperado: HTTP 200 + `{ success: true, programId: "<uuid>" }`.

Verificações SQL (via MCP supabase):

```sql
-- 1. assigned_programs row
SELECT id, name, status, ai_generated, prescription_generation_id, duration_weeks
FROM assigned_programs
WHERE prescription_generation_id = 'e3865526-db1e-473b-aa06-cfae3fb6dabd';

-- 2. Counts batem com snapshot
SELECT COUNT(*) AS n_workouts
FROM assigned_workouts aw
JOIN assigned_programs ap ON ap.id = aw.assigned_program_id
WHERE ap.prescription_generation_id = 'e3865526-db1e-473b-aa06-cfae3fb6dabd';

SELECT COUNT(*) AS n_items
FROM assigned_workout_items awi
JOIN assigned_workouts aw ON aw.id = awi.assigned_workout_id
JOIN assigned_programs ap ON ap.id = aw.assigned_program_id
WHERE ap.prescription_generation_id = 'e3865526-db1e-473b-aa06-cfae3fb6dabd';

-- 3. Comparar com snapshot
SELECT 
  jsonb_array_length(output_snapshot->'workouts') AS snapshot_workouts,
  (SELECT SUM(jsonb_array_length(wk->'items'))
   FROM jsonb_array_elements(output_snapshot->'workouts') wk) AS snapshot_items
FROM prescription_generations
WHERE id = 'e3865526-db1e-473b-aa06-cfae3fb6dabd';

-- 4. Generation marcada approved
SELECT status, approved_at, assigned_program_id
FROM prescription_generations
WHERE id = 'e3865526-db1e-473b-aa06-cfae3fb6dabd';
```

Todos os counts devem bater. Generation deve estar `status='approved'`.

**Curl 2 — generation com sub corrompido (`19957cce`):**

Mesmo curl, trocando `GEN_ID` para `19957cce-ca65-42fb-a765-d40e83aae8f1`.

Esperado: HTTP 200 (fix defensivo filtrou o sub inválido).

Verificações adicionais:

```sql
-- Item específico (workout 2, item 2) deve ter substitute_exercise_ids vazio ou sem o "afbc035fc06b"
SELECT awi.substitute_exercise_ids, awi.exercise_name
FROM assigned_workout_items awi
JOIN assigned_workouts aw ON aw.id = awi.assigned_workout_id
JOIN assigned_programs ap ON ap.id = aw.assigned_program_id
WHERE ap.prescription_generation_id = '19957cce-ca65-42fb-a765-d40e83aae8f1'
  AND aw.order_index = 2
  AND awi.order_index = 2;
```

Esperado: array vazio ou sem `afbc035fc06b`.

Log do dev server deve conter linha `[assignFromSnapshot] dropping invalid substitute_exercise_ids` com `dropped: ['afbc035fc06b']`.

### Etapa 5 — Fechar log 2.5.4

`docs/specs/logs/fase-2.5.4-execucao.md`:

- §1 Escopo entregue (helper + handler + testes + fix defensivo + E2E).
- §2 Diff resumido (4 arquivos: helper, handler, teste helper, teste handler).
- §3 Mapping do contrato mobile.
- §4 Evidências E2E: 2 curls + queries + linha do warn no log.
- §5 Decisões de segurança.
- §5.1 Fix defensivo: **NOVO** — por que filtrar substitutos inválidos em vez de falhar; qual o trade-off; onde o warn vai parar.
- §6 Follow-ups:
  - #6.1 Unificar `assign-program.ts` com helper (não fazer agora).
  - #6.2 Varredura das outras 11 routes A.
  - #6.3 Contrato `templateId` XOR `generationId` explícito.
  - #6.4 Superset no snapshot (quando IA emitir).
  - **#6.5 NOVO — Pipeline de geração: `substitute_exercise_ids` às vezes vem com UUIDs corrompidos ou array vazio.** Evidência: `19957cce` (1 sub mutilado), `e3865526` (zero subs). Diagnóstico da Etapa 3: `<anotar resultado da investigação>`. Fix candidato: `<anotar com base no achado>`. Prioridade: média (não quebra funil graças ao fix defensivo, mas degrada UX de substitutos).
- §7 Cascade discoveries se houver outras.

### Etapa 6 — Atualizar auditoria middleware

`docs/specs/logs/auditoria-middleware-mobile.md` §3: marcar `/api/programs/assign` como ✅ "Contrato reconciliado + resiliente a snapshot ruim (Fase 2.5.4)".

### Etapa 7 — Fechar follow-up #17 da Fase 2.5

`docs/specs/logs/fase-2.5-execucao.md` §6 follow-up #17: marcar ✅ **Concluído** com link pro log 2.5.4.

## Se algo falhar

- **Curl 1 (e3865526) retorna 404 "Generation not found"**: pode ter sido aprovada entre a investigação e agora. Checar `SELECT status FROM prescription_generations WHERE id = 'e3865526-...'`. Se approved, disparar nova generation via `/api/prescription/generate` pro Alysson e usar a nova.
- **Curl 1 retorna 500**: outro bug latente. Pausa, coleta logs, reporta. Não cascateia fixes.
- **Curl 2 (19957cce) retorna 500 mesmo com o fix**: o fix defensivo não cobriu algum edge case. Analisar warn + erro e reportar.
- **Teste `npm test` quebra**: se quebrou teste novo, debug. Se quebrou um pré-existente, checa se já era um dos 11 documentados.

## Definição de "pronto"

- `sanitizeSubstitutes` implementado no helper + regex UUID + warn estruturado.
- Teste #8 verde (8/8 no arquivo, 346/346 total).
- `npx tsc --noEmit` zero erros nos arquivos tocados.
- Curl 1 (`e3865526`): HTTP 200, counts batem, generation approved.
- Curl 2 (`19957cce`): HTTP 200, warn emitido, sub inválido filtrado.
- Investigação do pipeline registrada no §6.5 do log com achado concreto.
- Log 2.5.4 fechado, auditoria atualizada, follow-up #17 marcado concluído.

Comece produzindo o plano. Aguarde aprovação.
