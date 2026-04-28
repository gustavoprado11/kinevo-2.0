# Prompt Claude Code — Fase 4.1: Fix visual da execução (deixar formato claro pro aluno)

> Cole numa nova sessão do Claude Code. Push direto em main. É um fix visual cirúrgico em cima da Fase 4.

---

A Fase 4 entregou a infraestrutura (carregar `set_scheme`, montar estado por série), mas a tela de execução do aluno ficou **visualmente tímida**: o aluno não consegue ver de relance qual é o "formato" do exercício (pirâmide, drop-set, customizado) nem a meta específica de cada série.

Olha o screenshot que o Gustavo me mandou — exercício "Supino Inclinado Articulado" prescrito como Drop-set com 10-8-8 reps:

- ✗ Placeholder do campo "Reps" mostra **6** (vindo do treino anterior), em vez da **meta da série** (10 / 8 / 8).
- ✗ Não há **chip do `method_key`** ("Drop-set") no header do card.
- ✗ Sem **badge de `set_type`** por linha.
- ✗ Aluno tem que ler o subtítulo ("10-8-8 reps") e parear mentalmente com cada linha.

Sua missão: **deixar o formato visível pro aluno** com mudanças cirúrgicas. Mesma correção precisa aparecer no preview do builder e na sala de treino do treinador (paridade de 3 superfícies).

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -10
# Confira que vê os commits da Fase 4
```

## 1. Investigar o estado atual primeiro

Antes de mexer no código, valide que o banco está com os dados corretos:

```bash
# Pega um exemplo de assigned_workout_item recém-salvo e confere
# se method_key está preenchido e set_scheme tem 3 linhas
```

Pode usar uma query no Supabase Dashboard SQL Editor (peça pro Gustavo se precisar):

```sql
SELECT
  awi.id,
  awi.exercise_name,
  awi.method_key,
  awi.sets,
  awi.reps,
  awi.rest_seconds,
  COUNT(awis.id) AS child_set_rows,
  ARRAY_AGG(awis.set_number || ': ' || awis.set_type || ' / ' || awis.reps ORDER BY awis.set_number) AS sets_detail
FROM assigned_workout_items awi
LEFT JOIN assigned_workout_item_sets awis ON awis.assigned_workout_item_id = awi.id
WHERE awi.exercise_name ILIKE '%supino%'
GROUP BY awi.id
ORDER BY awi.created_at DESC
LIMIT 5;
```

**Cenário esperado:** `method_key = 'drop_set'` e 3 linhas filhas em `assigned_workout_item_sets` com reps "10", "8", "8".

**Se método_key vier NULL ou child_set_rows=0**: a Fase 3 não está persistindo direito. Investigue `mobile/hooks/useProgramBuilder.ts` (função save) — provavelmente o INSERT em `workout_item_set_templates` está OK mas não está propagando pra `assigned_workout_item_sets` no momento de atribuir o programa ao aluno.

**Se vier OK no DB**: o problema é só visual no front. Vai pro passo 2.

## 2. Mudanças no front (aluno — sala de treino)

### 2.1 `mobile/components/workout/SetRow.tsx`

- **Placeholder do input "Reps"** deve priorizar o `repsTarget` da série (vindo do `set_scheme`) sobre `previousReps`. Lógica nova:
  - Se `repsTarget` está preenchido (não null/empty): usa como placeholder + cor levemente destacada (ex.: text-violet-500 com 60% opacity).
  - Senão: usa `previousReps` como placeholder atual (comportamento legado, cor neutra).
- **Adicionar uma label/chip de meta** dentro da célula da Reps, ANTES do input:
  - Quando há `repsTarget`, mostra texto pequeno acima do input: "Meta: 10" (ou "Meta: 8-12" se for range).
  - Posicionamento: dentro da célula da Reps, line-height pequeno, peso médio, cor texto-violet-700 dark mode-aware.
- **Badge de `setType`** quando `setType !== 'normal'`:
  - Posicionamento: à esquerda do número da série (#).
  - Cores e ícones (use Lucide):
    - `warmup` → bg-zinc-100 / text-zinc-600 / ícone `Flame` (W)
    - `top` → bg-orange-100 / text-orange-700 / ícone `ArrowUp` (TOP)
    - `backoff` → bg-sky-100 / text-sky-700 / ícone `ArrowDown` (BACK)
    - `drop` → bg-rose-100 / text-rose-700 / ícone `ChevronsDown` (DROP)
    - `failure` → bg-red-200 / text-red-800 / ícone `Zap` (FAIL)
    - `cluster` → bg-violet-100 / text-violet-700 / ícone `Layers` (CLUSTER)
    - `amrap` → bg-blue-100 / text-blue-700 / ícone `Infinity` (AMRAP)
  - Usa o helper `SET_TYPE_LABELS` do shared (criar se não existir, mesma estrutura de `METHOD_KEY_LABELS`).
- **Cluster (`reps_target` contém "+")**: rendezira hint "Meta: 5+5+5 · cluster" abaixo do input.
- **AMRAP**: hint "Meta: até a falha".

### 2.2 `mobile/components/workout/ExerciseCard.tsx` (header do card)

- **Chip do `method_key`** quando o exercício tem `method_key` ≠ `'standard'` e ≠ null:
  - Posicionamento: ao lado do nome do exercício, na MESMA linha, antes ou depois.
  - Visual: pílula violeta (bg-violet-100 / text-violet-700 / dark mode adapt), texto pequeno semibold, ícone à esquerda (ex.: `Zap` pra drop-set, `TrendingDown` pra pirâmide, `Dumbbell` genérico).
  - Texto: usa `METHOD_KEY_LABELS[method_key]` do shared (criado na Fase 4 anterior).
- **Subtítulo do card** ("3 séries · 10-8-8 reps · 60s descanso") fica como está. **Mas garante que está usando `summarizeSetScheme(set_scheme)` do shared** — se o exercício tem set_scheme, deve sempre mostrar o resumo correto.

### 2.3 (Eventual) `mobile/components/workout/ExerciseHeaderSummary.tsx`

Se você criou esse componente compartilhado na Fase 4, aplica as mudanças ali. Senão, faz nos dois cards (aluno e treinador).

## 3. Aplicar as MESMAS mudanças no treinador

`mobile/app/training-room.tsx` renderiza os exercícios da sessão do aluno. Aplica a mesma estética:

- Chip do `method_key` no header.
- Badges de `set_type` por linha.
- Meta visível por série.

Princípio: o treinador, ao acompanhar o aluno, **tem que ver exatamente o mesmo card que o aluno vê**.

## 4. Aplicar as MESMAS mudanças no preview do builder mobile

`mobile/app/program-builder/preview.tsx` (criada na Fase 4) renderiza o programa em edição em modo readonly. Aplica idem:

- Chip do `method_key` no header.
- Badges de `set_type` por linha.
- Meta visível por série.

Princípio: o preview já existia, mas com os mesmos problemas visuais. Após este fix, o preview, a execução do aluno e a tela do treinador são **visualmente idênticos**.

## 5. Helpers compartilhados

Se ainda não existe, **crie `shared/lib/prescription/set-type-labels.ts`**:

```ts
import type { SetType } from '../types/prescription'  // ajusta o path

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Aquecimento',
  normal: 'Normal',
  top: 'Top',
  backoff: 'Backoff',
  drop: 'Drop',
  failure: 'Falha',
  cluster: 'Cluster',
  amrap: 'AMRAP',
}

export const SET_TYPE_BADGE_LABELS: Record<SetType, string> = {
  warmup: 'W',
  normal: '',         // não mostra badge
  top: 'TOP',
  backoff: 'BACK',
  drop: 'DROP',
  failure: 'FAIL',
  cluster: 'CLUSTER',
  amrap: 'AMRAP',
}
```

Re-exporta de `shared/index.ts`.

## 6. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Sem erros novos = ok. Erros pré-existentes em arquivos não relacionados podem ser ignorados.

## 7. Commits e push

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

git add shared/lib/prescription/set-type-labels.ts shared/index.ts
git commit -m "feat(per-set): add SET_TYPE_LABELS and SET_TYPE_BADGE_LABELS helpers"

git add mobile/components/workout/SetRow.tsx \
        mobile/components/workout/ExerciseCard.tsx \
        mobile/components/workout/ExerciseHeaderSummary.tsx
git commit -m "feat(per-set): show meta per set, method chip and set_type badges in student execution"

git add mobile/app/training-room.tsx
git commit -m "feat(per-set): mirror student visual treatment in trainer live coaching"

git add mobile/app/program-builder/preview.tsx \
        mobile/components/workout/SetRowPreview.tsx
git commit -m "feat(per-set): mirror student visual treatment in builder preview"

git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.1 visual fixes for student/trainer/preview parity"

git push origin main
```

## 8. Reporte final

```
FASE 4.1 — fix visual completo

Diagnóstico do banco:
  - method_key: <preenchido / NULL — explicar se for NULL>
  - assigned_workout_item_sets: <count, exemplo>

Mudanças visuais aplicadas em 3 superfícies (aluno / treinador / preview):
  - Chip do method_key no header
  - Meta de reps visível por série
  - Badges de set_type quando não-normal
  - Suporte especial pra AMRAP e cluster (5+5+5)

Commits:
  - <hash> feat(per-set): SET_TYPE_LABELS helpers
  - <hash> feat(per-set): student execution
  - <hash> feat(per-set): trainer live coaching
  - <hash> feat(per-set): builder preview
  - <hash> docs(per-set): Fase 4.1 notes

Próximo passo do Gustavo:
1. Reload do app no simulador.
2. Abrir o programa do "Supino Inclinado Articulado" como aluno.
3. Conferir:
   a. Chip "Drop-set" aparece ao lado do nome do exercício.
   b. Cada linha mostra "Meta: 10" / "Meta: 8" / "Meta: 8" (ou similar).
   c. Se houve set_type ≠ normal, badge colorido aparece.
4. Abrir o preview no builder pra confirmar paridade visual.
5. (Se possível) Testar a tela de live coaching do treinador.
```

## 9. Se algo der errado

- **method_key vem NULL no DB**: investiga o save no `useProgramBuilder.ts`. Provavelmente está faltando propagar `method_key` na hora de criar o `assigned_workout_item` (atribuir programa ao aluno). Pode haver um RPC `assign_program` que precisa ser estendido — confira `supabase/migrations/003_assign_program_function.sql` e migrações posteriores que tocaram esse RPC.
- **assigned_workout_item_sets vem vazio**: idem, problema no fluxo de atribuição de programa. Garanta que ao atribuir, as linhas filhas de `workout_item_set_templates` são copiadas para `assigned_workout_item_sets`.
- **Visual quebra em telas pequenas (iPhone SE)**: chip do método pode quebrar a linha do nome do exercício. Use `flexWrap` ou trunca o nome com ellipsis e mantém o chip sempre visível.

## 10. Reverter (se necessário)

```bash
git revert HEAD~5..HEAD --no-edit
git push origin main
```

Tudo claro? Confirma com "Fase 4.1 — começando" e parta da pré-checagem.
