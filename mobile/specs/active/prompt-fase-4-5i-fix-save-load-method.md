# Prompt Claude Code — Fase 4.5i: Fix do save/load do método (BUG CRÍTICO)

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando.
>
> Releia `mobile/specs/WORKFLOW.md` antes de começar.

---

**Bug reportado pelo Gustavo após validar a Fase 4.5h:**

No builder web, quando o trainer:
1. Entra em modo Avançado num exercício
2. Aplica um preset (Pirâmide, Drop-set, Cluster, etc.) e/ou edita as fases
3. Salva o programa
4. Volta pro programa (recarrega ou navega de volta)

→ **O exercício volta pra modo simples**. As fases prescritas, o método escolhido, as rondas — tudo desaparece.

Esse é um bug crítico. A funcionalidade de métodos avançados está incompleta sem save/load funcionando. **Antes de fazermos a Fase 5 (Texto para Treino), esse bug tem que ser resolvido.**

## 0. Pré-checagens

```bash
git status        # confirma working tree atual com 4.5d-h acumuladas
git log --oneline -3
```

## 1. Investigação ANTES de qualquer fix

**NÃO comece a editar código sem entender o problema.** Faz uma investigação metódica:

### 1.1 Reproduzir mentalmente o fluxo de save

Localize a função `saveProgram` em `web/src/components/programs/program-builder-client.tsx`:

```bash
grep -n "saveProgram\|workout_item_set_templates\|set_scheme\|method_key\|rounds" web/src/components/programs/program-builder-client.tsx | head -40
```

Verifica se `saveProgram`:
- (a) Lê `item.set_scheme`, `item.method_key`, `item.rounds` do estado do builder
- (b) INSERT em `workout_item_templates` inclui `method_key` e `rounds`
- (c) INSERT em `workout_item_set_templates` acontece pra cada fase materializada (`expandSchemeByRounds(item.set_scheme, item.rounds)`)
- (d) Linhas filhas têm `set_number` sequencial (1..N) e `round_number` correto

### 1.2 Verificar com query no DB se o save persistiu

Pergunta ao Gustavo o ID de um programa onde ele aplicou drop-set e salvou. Roda no Supabase MCP (sem aplicar nada — só SELECT):

```sql
SELECT 
  wit.id, 
  wit.exercise_id,
  wit.method_key, 
  wit.rounds,
  wit.sets,
  wit.reps,
  COUNT(wist.id) AS child_set_rows,
  ARRAY_AGG(wist.set_number || ' (round ' || COALESCE(wist.round_number::text, 'null') || '): ' || wist.set_type || ' / ' || wist.reps ORDER BY wist.set_number) AS sets_detail
FROM workout_item_templates wit
LEFT JOIN workout_item_set_templates wist ON wist.workout_item_template_id = wit.id
WHERE wit.workout_template_id IN (
  SELECT id FROM workout_templates WHERE program_template_id = '<program-id-do-gustavo>'
)
GROUP BY wit.id
ORDER BY wit.created_at DESC;
```

**3 cenários possíveis:**

- **A — `method_key=NULL` E `child_set_rows=0`:** save não está persistindo nada. Bug no `saveProgram`.
- **B — `method_key='drop_set'` mas `child_set_rows=0`:** save persiste só a coluna do parent, não as filhas. Bug no batch INSERT das filhas.
- **C — Ambos preenchidos no DB:** save está OK. Bug é no LOAD.

### 1.3 Reproduzir mentalmente o fluxo de load

Localize a query de load em `web/src/app/programs/[id]/page.tsx` (ou onde monta o draft inicial do builder):

```bash
grep -n "workout_item_templates\|workout_item_set_templates\|set_scheme\|method_key\|rounds\|collapseExpandedScheme" web/src/app/programs/[id]/page.tsx web/src/components/programs/program-builder-client.tsx | head -40
```

Verifica se a query SELECT:
- (a) Inclui `method_key`, `rounds` em `workout_item_templates`
- (b) JOIN com `workout_item_set_templates` ordenado por `set_number`
- (c) Hidrata `WorkoutItem.set_scheme` chamando `collapseExpandedScheme(rows, rounds)` quando `rounds > 1`
- (d) Quando `rounds === 1` mas há linhas filhas (linear customizado), atribui as linhas direto sem collapse

### 1.4 Reportar o diagnóstico antes de fixar

Imprime no chat:

```
DIAGNÓSTICO DO BUG:

Save flow:
  - saveProgram lê set_scheme/method_key/rounds do estado: <SIM/NÃO>
  - INSERT parent (workout_item_templates) inclui method_key + rounds: <SIM/NÃO>
  - INSERT batch (workout_item_set_templates) acontece: <SIM/NÃO>
  - Materialização via expandSchemeByRounds: <SIM/NÃO>

DB state (programa <id>):
  - method_key persistido: <valor>
  - rounds persistido: <valor>
  - linhas em workout_item_set_templates: <count>
  - estrutura: <resumo>

Load flow:
  - Query SELECT inclui method_key + rounds: <SIM/NÃO>
  - Query inclui LEFT JOIN com workout_item_set_templates: <SIM/NÃO>
  - Hidratação chama collapseExpandedScheme: <SIM/NÃO>

ROOT CAUSE: <save / load / ambos>
LINHA(S) DO BUG: <arquivo:linha>
PLANO DE FIX: <descrição em 2-3 frases>
```

**Pare aqui e aguarda o Gustavo confirmar o diagnóstico antes de aplicar o fix.** Isso evita que você corrija o lugar errado.

## 2. Fix (após aprovação do diagnóstico)

Aplica o fix conforme o root cause identificado. Princípios:

- **Não inventar lógica nova.** Se o save está faltando o batch INSERT, adiciona. Se o load está faltando o SELECT, adiciona. Não refatora estrutura.
- **Preserva backward compat.** Programas antigos (rounds=null, sem filhas) devem continuar abrindo como modo simples.
- **Helper compartilhado** (`expandSchemeByRounds`, `collapseExpandedScheme`) já existe — usa, não duplica.

### Casos comuns de fix

**Se cenário A (save não grava nada):**

Provavelmente `saveProgram` não está incluindo o objeto `set_scheme` no payload de insert. Verificar se o campo está sendo mapeado:

```ts
// Antes (provável bug)
const { error } = await supabase.from('workout_item_templates').insert({
  exercise_id: item.exercise_id,
  sets: item.sets,
  reps: item.reps,
  rest_seconds: item.rest_seconds,
})

// Depois
const { data: insertedItem, error } = await supabase
  .from('workout_item_templates')
  .insert({
    exercise_id: item.exercise_id,
    sets: item.set_scheme ? expandSchemeByRounds(item.set_scheme, item.rounds ?? 1).length : item.sets,
    reps: item.set_scheme ? summarizeWithRounds(item.set_scheme, item.rounds ?? 1).reps : item.reps,
    rest_seconds: item.set_scheme ? item.set_scheme[0]?.rest_seconds ?? item.rest_seconds : item.rest_seconds,
    method_key: item.method_key ?? null,
    rounds: item.set_scheme ? item.rounds ?? 1 : 1,
  })
  .select('id').single()

if (insertedItem && item.set_scheme?.length) {
  const expanded = expandSchemeByRounds(item.set_scheme, item.rounds ?? 1)
  await supabase.from('workout_item_set_templates').insert(
    expanded.map((s, idx) => ({
      workout_item_template_id: insertedItem.id,
      set_number: idx + 1,
      set_type: s.set_type,
      reps: s.reps,
      rest_seconds: s.rest_seconds,
      weight_kg: s.weight_kg,
      weight_pct1rm: s.weight_pct1rm,
      rir: s.rir,
      tempo: s.tempo,
      notes: s.notes,
      round_number: Math.floor(idx / item.set_scheme!.length) + 1,
    }))
  )
}
```

**Se cenário C (load não hidrata):**

Ajusta a query SELECT pra incluir os campos novos e adiciona a hidratação:

```ts
const { data } = await supabase
  .from('workout_item_templates')
  .select(`
    id, exercise_id, sets, reps, rest_seconds, method_key, rounds, notes,
    workout_item_set_templates (set_number, set_type, reps, rest_seconds, weight_kg, weight_pct1rm, rir, tempo, notes, round_number)
  `)
  .eq('workout_template_id', workoutTemplateId)
  .order('order_index')

// No mapeamento:
const items = data?.map(row => {
  const childSets = row.workout_item_set_templates ?? []
  if (childSets.length > 0) {
    const sortedExpanded = childSets.sort((a, b) => a.set_number - b.set_number)
    const { scheme, rounds } = collapseExpandedScheme(sortedExpanded, row.rounds ?? 1)
    return {
      ...row,
      set_scheme: scheme,
      rounds,
      method_key: row.method_key ?? 'standard',
    }
  }
  return { ...row, set_scheme: null, rounds: 1, method_key: row.method_key ?? null }
})
```

## 3. Verificação do round-trip

Após o fix, valida o round-trip:

1. Pede pro Gustavo (no chat) criar um programa novo com Drop-set 3 rondas × 3 fases, salvar.
2. Roda a query do passo 1.2 pra confirmar DB tem os dados certos (método + filhas).
3. Pede pro Gustavo recarregar a página/voltar pro programa.
4. Confirma visualmente que o exercício abre em modo Avançado com as fases preservadas.

## 4. Fix correlato no mobile (se aplicável)

Verifica se o mesmo bug existe no mobile (`mobile/hooks/useProgramBuilder.ts` ou onde fica o save):

```bash
grep -n "saveProgram\|saveAsTemplate\|workout_item_set_templates\|set_scheme\|method_key" mobile/hooks/useProgramBuilder.ts | head -20
```

Se o save mobile também não estiver materializando rounds × phases, aplica o mesmo padrão de fix lá. Reporta separadamente (web vs mobile).

## 5. Validações locais

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baselines. Sem regressões.

## 6. NÃO commita, NÃO empurra

Atualize a spec com notas dessa fase no working tree, rode `git status`, e pare.

## 7. Reporte final

```
FASE 4.5i — FIX do save/load de métodos avançados (working tree, sem commit)

Diagnóstico: <root cause identificado>

Fix aplicado:
  - Web: <arquivos + linhas>
  - Mobile (se aplicável): <arquivos + linhas>

Round-trip validado:
  - Save de drop-set 3×3 → DB tem method_key='drop_set', rounds=3, 9 filhas
  - Load do mesmo programa → builder abre em modo Avançado com 3 fases
  - Backward compat: programa antigo (rounds=null) abre em modo simples

Mensagem de commit sugerida (não execute agora):
  fix(per-set): persist and reload method_key/rounds/set_scheme in builder

Arquivos modificados (working tree):
  web/src/components/programs/program-builder-client.tsx
  web/src/app/programs/[id]/page.tsx (se aplicável)
  mobile/hooks/useProgramBuilder.ts (se aplicável)
  mobile/specs/active/prescricao-per-set-manual.md (notas Fase 4.5i)

Validações:
  shared: 142/142
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: 10 erros baseline (idêntico)
  mobile vitest: 255/255

Estado: working tree acumulando 4.5d-i. SEM commits, SEM push.
```

## 8. Edge cases

- **Programa salvo na Fase 3-4 com modelo errado** (rounds=null, sets=9 lineares): continua mostrando 9 séries lineares. Não é regressão — é dado herdado. Trainer pode re-prescrever pra arrumar.
- **Programa em transição** (parent tem rounds=3 mas zero filhas, por algum bug intermediário): cai no modo simples. Não trava.
- **`set_scheme` com 1 fase só e rounds=1**: trata como "modo avançado linear de 1 fase" — preserva, não força modo simples.

## 9. Iterar / desfazer

- Working tree: edita arquivos in-place.
- Voltar arquivo: `git checkout -- <arquivo>`.
- NÃO `git reset --hard origin/main`.

Tudo claro? Confirme com "Fase 4.5i — começando" e parta da pré-checagem (incluindo o passo 1.4 — diagnosticar antes de fixar, esperar OK do Gustavo).
