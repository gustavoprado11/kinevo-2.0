# Prompt Claude Code — Fase 4.5a: Volume correto para métodos compostos

> Cole numa nova sessão do Claude Code. **Sem migration nova** (a 112 da Fase 4.3 já tem `rounds`). Push direto em main.

---

A Fase 4.4 entregou paridade web do modelo de rodadas. Mas o Gustavo (não-dev, dono do app) descobriu que o cálculo de volume no app **superestima 2-3×** o volume de métodos compound (drop-set, cluster).

**Por quê:** o cálculo atual é `weeklySets = item.sets * frequency`. Para drop-set materializado (3 rodadas × 3 fases = 9 phys rows), `item.sets = 9`. Resultado: drop-set 3 rondas × 2x/semana = 18 sets/semana. Errado.

**Convenção certa:** **1 ronda = 1 série efetiva**. Drop-set 3 rondas = 3 effective sets. Cluster idem. Linear (pirâmide, 5×5, top+backoff) mantém: cada fase é uma série.

## Estratégia

Helper único `effectiveSetsForVolume` no shared, usado em 4 superfícies:

```ts
// shared/lib/prescription/volume.ts (NOVO)
export function effectiveSetsForVolume(item: { sets: number | null; rounds?: number | null }): number {
  // Compound: rondas são as séries efetivas
  if (item.rounds && item.rounds > 1) return item.rounds
  // Linear: sets já reflete a contagem certa
  return item.sets ?? 0
}
```

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Você deve ver os commits da Fase 4.4 (fe897d2, 4b44075, e83a62f, ba638ae)
```

## 1. Criar helper compartilhado

`shared/lib/prescription/volume.ts` (NOVO):

```ts
/**
 * Quantidade de séries efetivas para cálculo de volume semanal.
 *
 * Para métodos compound (drop-set, cluster) com rounds > 1: cada ronda conta como
 * UMA série efetiva (independente de quantas fases existem dentro da ronda).
 * Convenção alinhada com literatura científica (Schoenfeld et al.) e com o
 * contador de progresso do aluno ("0/N rodadas").
 *
 * Para métodos lineares (rounds=1 ou null): retorna `sets` diretamente.
 *
 * Exemplos:
 *  - Pirâmide ↓ 4 séries (rounds=1): retorna 4
 *  - 5×5 (rounds=1): retorna 5
 *  - Drop-set 3 rondas × 3 fases (sets=9, rounds=3): retorna 3
 *  - Cluster 3 rondas × 3 fases (sets=9, rounds=3): retorna 3
 */
export function effectiveSetsForVolume(
  item: { sets: number | null; rounds?: number | null }
): number {
  if (item.rounds && item.rounds > 1) return item.rounds
  return item.sets ?? 0
}
```

**Testes** (`shared/lib/prescription/__tests__/volume.test.ts`, NOVO):
- Pirâmide rounds=1, sets=4 → 4
- 5×5 rounds=1, sets=5 → 5
- Drop-set rounds=3, sets=9 → 3
- Cluster rounds=3, sets=9 → 3
- Programa antigo rounds=null, sets=3 → 3 (backward compat)
- sets=null → 0 (defensivo)
- rounds=1, sets=10 → 10

Re-exporta em `shared/index.ts`.

## 2. Aplicar nos 4 lugares

### 2.1 Mobile builder — `mobile/components/trainer/program-builder/volume-helpers.ts`

Atualiza `calculateVolume`:

```ts
import { effectiveSetsForVolume } from '@kinevo/shared/lib/prescription/volume'

export function calculateVolume(
    workouts: { frequency: string[]; items: { item_type: string; sets: number; rounds?: number | null; exercise_muscle_groups: string[] }[] }[]
): Record<string, number> {
    return workouts.reduce((acc, workout) => {
        const frequency = Math.max(1, workout.frequency.length);
        workout.items.forEach(item => {
            if (item.item_type === 'exercise') {
                const effective = effectiveSetsForVolume({ sets: item.sets, rounds: item.rounds });
                if (effective > 0) {
                    const weeklySets = effective * frequency;
                    item.exercise_muscle_groups.forEach(group => {
                        acc[group] = (acc[group] || 0) + weeklySets;
                    });
                }
            }
        });
        return acc;
    }, {} as Record<string, number>);
}
```

Atualiza testes em `volume-helpers.test.ts` se existirem.

### 2.2 Web builder — `web/src/components/programs/volume-summary.tsx`

Atualiza o `processSets` interno pra receber `rounds`:

```tsx
import { effectiveSetsForVolume } from '@kinevo/shared/lib/prescription/volume'

// dentro do reduce:
workout.items.forEach(item => {
    const processItem = (it: WorkoutItem) => {
        if (!it.exercise?.muscle_groups || it.exercise.muscle_groups.length === 0) return
        const effective = effectiveSetsForVolume({ sets: it.sets, rounds: it.rounds })
        if (effective <= 0) return
        const weeklySets = effective * frequency
        it.exercise.muscle_groups.forEach(group => {
            const groupName = typeof group === 'object' ? group.name : group
            if (groupName) acc[groupName] = (acc[groupName] || 0) + weeklySets
        })
    }
    if (item.item_type === 'exercise') {
        processItem(item)
    } else if (item.item_type === 'superset' && item.children) {
        item.children.forEach(processItem)
    }
})
```

### 2.3 Server action — `web/src/app/students/[id]/actions/get-program-muscle-volume.ts`

Passa `rounds` na query SELECT (já existe em `assigned_workout_items` desde a migration 112):

- Adiciona `rounds` no SELECT do `assigned_workout_items`.
- No reduce/loop que monta o volume, usa `effectiveSetsForVolume({ sets: item.sets, rounds: item.rounds })`.

### 2.4 Reports — `web/src/lib/reports/program-report-service.ts`

Confere se calcula volume. Se sim, aplica o mesmo helper. Se não, ignora.

## 3. AI motor (FORA DE ESCOPO — não tocar)

`web/src/lib/prescription/rules-engine.ts`, `program-builder.ts`, `edits-diff.ts` lidam com volume internamente. **Não tocar.** O motor IA gera programas com `rounds=1` sempre (não conhece compound methods), então o volume dele permanece correto pra o que ele gera. Manual prescriptions com `rounds>1` não passam pelo motor.

Se durante a leitura você encontrar tentação de "também consertar lá", PARE. Confirma com Gustavo antes de expandir escopo.

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Sem erros novos. Mantém baseline TS web em 11 erros (pré-existentes).

## 5. Commits e push

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd web && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

git add shared/lib/prescription/volume.ts \
        shared/lib/prescription/__tests__/volume.test.ts \
        shared/index.ts
git commit -m "feat(per-set): add effectiveSetsForVolume helper for compound methods"

git add mobile/components/trainer/program-builder/volume-helpers.ts \
        mobile/components/trainer/program-builder/__tests__/volume-helpers.test.ts
git commit -m "feat(per-set): mobile volume counter uses rounds as effective sets for compound"

git add web/src/components/programs/volume-summary.tsx \
        web/src/app/students/[id]/actions/get-program-muscle-volume.ts \
        web/src/lib/reports/program-report-service.ts
git commit -m "feat(per-set): web volume counters use rounds as effective sets for compound"

git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.5a — correct volume for compound methods"

git push origin main
```

## 6. Reporte final

```
FASE 4.5a — volume correto para métodos compostos (em main)

Helper criado:
  shared/lib/prescription/volume.ts → effectiveSetsForVolume

Aplicado em 4 superfícies:
  - mobile builder (VolumeSummary via calculateVolume)
  - web builder (volume-summary.tsx)
  - web server action (get-program-muscle-volume.ts)
  - reports (program-report-service.ts) — se aplicável

Testes:
  shared: <X>/<X> (Y novos)
  mobile: <X>/<X>
  web TS: 11 erros baseline (idêntico, sem regressão)

Antes da fase: drop-set 3 rondas × 3 fases × 2x/semana = 18 sets/semana
Depois da fase: drop-set 3 rondas × 2x/semana = 6 sets/semana ✓

Próximo passo do Gustavo:
1. Web: builder com drop-set prescrito → conferir que VolumeSummary mostra 
   contagem reduzida pra peito (deve cair de ~18 pra ~6 sets/semana se 
   o programa tem drop-set numa frequência semanal de 2).
2. Mobile: idem.
3. Programa só com pirâmide/5×5/lineares: contagem deve permanecer idêntica
   (rounds=1 ou null → fallback pra item.sets, comportamento atual).

```

## 7. Edge cases

- **Programa antigo com drop-set salvo na Fase 3-4 (rounds=1, sets=9 lineares)**: continua mostrando 9 sets, comportamento atual. Não é regressão — esse programa foi salvo com modelo errado, e o cálculo de volume reflete o que está no DB. Solução: trainer re-prescrever pra atualizar pra modelo de rondas.
- **Item sem muscle_groups**: ignora (já existia).
- **Item dentro de superset**: usa `effectiveSetsForVolume` no child também.

## 8. Reverter (se necessário)

```bash
git revert HEAD~4..HEAD --no-edit
git push origin main
```

Tudo claro? Confirma com "Fase 4.5a — começando" e parta da pré-checagem.
