# Prompt Claude Code — Fase 4.3: Modelo de Rodadas para métodos compostos (drop-set, cluster)

> Cole numa nova sessão do Claude Code. **Esta fase precisa de migration aplicada manualmente no Supabase Dashboard antes do código ir pra produção** — o Gustavo (não-dev) vai aplicar quando você pedir. Push do código direto em main como nas fases anteriores.

---

A Fase 4 ficou linda visualmente, mas tem um problema **conceitual** no modelo de dados: drop-set e cluster (rest-pause) são métodos **compostos** — uma série inteira contém múltiplas fases sem descanso entre elas, e essa estrutura inteira se repete N vezes (rodadas). Hoje a gente trata cada fase como se fosse uma série linear separada, o que confunde tanto o treinador quanto o aluno.

**Decisão de produto:**

- Métodos **lineares** (pirâmide ↑/↓, 5×5, top+backoff, customizado simples): `rounds = 1`. Comportamento idêntico ao atual.
- Métodos **compostos** (drop-set, cluster): `rounds >= 2` (default 3). `set_scheme` descreve UMA rodada e o app expande pra display.
- **Contador macro** no aluno: "0/N rodadas concluídas". Cada fase ainda tem seu próprio ✓ individual.

**Backward compat:** programas existentes (todos com `rounds=1` por default) continuam funcionando exatamente como hoje.

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Você deve ver commits recentes da Fase 4.2 (meta de carga visível)
```

## 1. Ler a spec atual

```bash
cat mobile/specs/active/prescricao-per-set-manual.md
```

Especialmente as seções de **Comportamento Esperado** e **Restrições Técnicas**.

## 2. Migration 112

Crie `supabase/migrations/112_rounds_for_compound_methods.sql`:

```sql
-- Migration 112 — Rounds for compound methods (drop-set, cluster, rest-pause)
--
-- Adds a `rounds` column to workout_item_templates and assigned_workout_items.
-- For linear methods (pyramid, 5x5, top+backoff): rounds=1 (default).
-- For compound methods (drop-set, cluster): rounds>=2, set_scheme describes ONE round.
-- The app multiplies rounds × phases at runtime for display and tracking.
--
-- Backward compat: existing rows get rounds=1, behavior identical to today.

ALTER TABLE workout_item_templates
  ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1
  CHECK (rounds >= 1 AND rounds <= 20);

ALTER TABLE assigned_workout_items
  ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1
  CHECK (rounds >= 1 AND rounds <= 20);

COMMENT ON COLUMN workout_item_templates.rounds IS
  'Rodadas para métodos compostos (drop-set, cluster). 1 para métodos lineares. Quando > 1, set_scheme descreve UMA rodada e é repetido N vezes em runtime.';

COMMENT ON COLUMN assigned_workout_items.rounds IS
  'Espelho de workout_item_templates.rounds copiado no momento da atribuição.';
```

**Importante:** após criar o arquivo, **PARE e peça pro Gustavo aplicar** essa migration no Supabase Dashboard manualmente. Mensagem sugerida pra ele:

> "Pronto pra Fase 4.3, mas preciso que você aplique uma migration nova no Supabase antes de eu seguir. É o mesmo procedimento da Fase 1: abre `supabase/migrations/112_rounds_for_compound_methods.sql`, copia tudo, cola no SQL Editor do Supabase Dashboard, clica Run. Me avisa quando aplicar — sem isso o código vai dar erro em runtime."

Espera o "ok" dele antes de continuar com os próximos passos.

## 3. Atualizar tipos compartilhados

### `shared/types/prescription.ts`

Adicionar campo opcional `rounds?: number` na interface `WorkoutItem` (e correspondente). Aceita 1-20.

### `shared/lib/prescription/set-scheme.ts`

Adicionar duas funções utilitárias:

```ts
/**
 * Expand a set_scheme by rounds. For linear methods (rounds=1), returns the original.
 * For compound methods (rounds>1), returns the scheme repeated N times with sequential set_numbers.
 * 
 * Example: rounds=3, scheme=[{set_number:1, ...}, {set_number:2, ...}]
 *   → [{set_number:1}, {set_number:2}, {set_number:3}, {set_number:4}, {set_number:5}, {set_number:6}]
 */
export function expandSchemeByRounds(scheme: WorkoutSet[], rounds: number): WorkoutSet[] {
  if (rounds <= 1) return scheme
  const phasesPerRound = scheme.length
  const expanded: WorkoutSet[] = []
  for (let r = 0; r < rounds; r++) {
    for (let p = 0; p < phasesPerRound; p++) {
      const phase = scheme[p]
      expanded.push({
        ...phase,
        set_number: r * phasesPerRound + p + 1,
      })
    }
  }
  return expanded
}

/**
 * For a given set_number in execution and phasesPerRound, derive round and phase indices.
 * Both indices are 1-based.
 * 
 * Example: setNumber=4, phasesPerRound=2 → { round: 2, phase: 2 }
 */
export function deriveRoundAndPhase(setNumber: number, phasesPerRound: number): { round: number; phase: number } {
  if (phasesPerRound <= 0) return { round: 1, phase: setNumber }
  const round = Math.floor((setNumber - 1) / phasesPerRound) + 1
  const phase = ((setNumber - 1) % phasesPerRound) + 1
  return { round, phase }
}
```

Adicionar testes Vitest cobrindo:
- `expandSchemeByRounds` com rounds=1, 2, 3.
- `deriveRoundAndPhase` para os 3 cenários e edge cases (phasesPerRound=0, setNumber=1).

### `shared/lib/prescription/set-scheme-presets.ts`

Atualizar os presets compostos para incluir `defaultRounds`:

```ts
export const SYSTEM_PRESETS: Record<MethodKey, { name: string; description: string; defaultSetsConfig: WorkoutSet[]; defaultRounds: number }> = {
  // ...
  drop_set: {
    name: 'Drop-set',
    description: '...',
    defaultSetsConfig: [/* phase 1 normal, phase 2 drop, phase 3 drop */],
    defaultRounds: 3,
  },
  cluster: {
    name: 'Cluster (rest-pause)',
    description: '...',
    defaultSetsConfig: [/* phase 1, phase 2, phase 3 com rest-pause curto */],
    defaultRounds: 3,
  },
  pyramid_down: { /* ... */ defaultRounds: 1 },
  pyramid_up:   { /* ... */ defaultRounds: 1 },
  '5x5':        { /* ... */ defaultRounds: 1 },
  top_backoff:  { /* ... */ defaultRounds: 1 },
}
```

Atualiza testes correspondentes. Re-exporta em `shared/index.ts`.

### Atualizar `summarizeSetScheme`

A função agora aceita `rounds` opcional e retorna resumo apropriado:

```ts
export function summarizeSetScheme(scheme: WorkoutSet[], rounds: number = 1): { sets: number; reps: string; rest_seconds: number } {
  const phasesPerRound = scheme.length
  const totalPhases = phasesPerRound * rounds
  
  // sets = total de fases (mantém retrocompat com programas linhares antigos)
  const sets = totalPhases
  
  // reps: para linear, mantém o resumo atual ("12-10-8-6").
  // Para compound, usa formato compacto ("3× 8-10/8-10" ou similar). 
  // Detalhe: para compound, mostra as reps das fases UNIQUE separadas por "/", prefixado por "Nx" se rounds>1.
  let reps: string
  if (rounds === 1) {
    reps = scheme.map(s => s.reps).join('-')
  } else {
    const phaseReps = scheme.map(s => s.reps).join('/')
    reps = `${rounds}× ${phaseReps}`
  }
  
  // rest_seconds: o do PRIMEIRO descanso entre fases (não entre rondas — esse é o "rest curto")
  const rest_seconds = scheme[0]?.rest_seconds ?? 0
  
  return { sets, reps, rest_seconds }
}
```

Atualiza testes. Roundtrip preset → summarize → render must be coerente.

## 4. Builder mobile (`mobile/components/trainer/program-builder/SetSchemeEditor.tsx`)

### 4.1 Adicionar campo "Rodadas"

- Quando `method_key` é compound (`drop_set`, `cluster`): mostra campo "Rodadas: [3 ↕]" no header do editor (acima da tabela de fases).
- Quando linear: oculta o campo (rounds sempre 1).
- Stepper visual com `-` e `+`, range 1-20.
- Ao mudar `method_key` aplicando um preset, popula `rounds` com `SYSTEM_PRESETS[key].defaultRounds`.

### 4.2 Renomear "Séries" → "Fases" quando rounds > 1

- Header da tabela vira "Estrutura de uma rodada" quando rounds > 1.
- Botão "+ Adicionar série" vira "+ Adicionar fase" quando rounds > 1.
- Ícone do tipo de série continua o mesmo.

### 4.3 Resumo no card do exercício no builder

- Para rounds=1: mantém "3 séries · 10-8-8 reps" como hoje.
- Para rounds>1: "3 rodadas × 2 fases · 10/8 reps · 80%/60% 1RM" (mostra estrutura compacta).
- Chip do método continua aparecendo.

### 4.4 Salvar no store

- `program-builder-store` aceita `rounds: number` no item.
- Default 1.
- Persiste no MMKV.

## 5. Builder web (`web/src/components/programs/SetSchemeTable.tsx`)

Mesmas mudanças do mobile — paridade visual.

## 6. Edge Function `assign-program`

Atualiza `supabase/functions/assign-program/index.ts`:

- SELECT inclui `rounds` de `workout_item_templates`.
- INSERT em `assigned_workout_items` propaga `rounds`.
- Linhas filhas em `assigned_workout_item_sets` continuam sendo as MESMAS (uma rodada de fases). O app expande no display.

**Importante:** após editar o código, **deploya a Edge Function via MCP** seguindo o mesmo padrão da Fase 4. Avisa o Gustavo que vai deployar e siga.

## 7. Mobile execução — sala de treino do aluno

### 7.1 `mobile/hooks/useWorkoutSession.ts`

- Lê `rounds` do `assigned_workout_item`.
- Quando popula o estado das séries do exercício, chama `expandSchemeByRounds(set_scheme, rounds)` pra obter a lista expandida.
- Salva `phasesPerRound` no estado do exercício pra fácil acesso.

### 7.2 `mobile/components/workout/ExerciseCard.tsx`

- Header do card mostra resumo apropriado:
  - rounds=1: "3 séries · 10-8-8 reps · 60s descanso" (atual).
  - rounds>1: "3 rodadas · 2 fases · 10/8 reps".
- Chip do método continua.
- Body do card agrupa as séries em **rodadas** quando rounds > 1:

```
Rodada 1                                       ◯ (não concluída)
  Fase 1 (TIPO badge) | Anterior | Peso | Reps | ✓
  Fase 2 (DROP badge) | Anterior | Peso | Reps | ✓

Rodada 2                                       ◯
  Fase 1 ...
  Fase 2 ...

Rodada 3                                       ◯
  Fase 1 ...
  Fase 2 ...
```

- Header da rodada: nome ("Rodada N") + indicador ◯/✓ que vira ✓ verde quando TODAS as fases dela estão completas.
- Gap visual maior entre rodadas que entre fases dentro de uma rodada (espacement interno menor).

### 7.3 Contador no header da tela

- Atualmente mostra "0/N séries" no canto.
- Quando o exercício atual tem rounds > 1: mostra "0/N rodadas" (ou um contador combinado se tiver vários exercícios).
- Calcular: rondas concluídas = quantas rodadas tiveram TODAS as fases checadas.

**Nota:** a tela tem múltiplos exercícios. Use a soma total das rodadas pendentes vs concluídas. Para programas mistos (alguns com rounds=1, outros com >1), trata cada série não-rondada como "1 rodada" pra simplificar — a métrica importante é "X% feito".

Alternativa simpler: mantém "0/N séries" sempre (onde N = total de fases × rondas), e só dentro do card do exercício composto mostra "Rodada 1/3", "Rodada 2/3", etc. Decida e documente na spec.

**Sugestão minha:** mantém contador de tela como "0/N séries" (somando todas as fases), e dentro de cada card composto mostra o detalhamento por rodada. Reduz complexidade do header global.

### 7.4 `mobile/components/workout/SetRow.tsx`

- Sem mudança estrutural (continua sendo uma linha por fase).
- Já vai vir com os campos corretos via `expandSchemeByRounds`.

### 7.5 Cluster — formatos especiais

Para cluster (rest-pause), o set_scheme dentro da rodada deve refletir o formato real:
- Fase 1: 8 reps, 15s descanso
- Fase 2: 4 reps, 15s descanso
- Fase 3: 2 reps, 90s descanso (rest entre rodadas)

Trainer prescreve isso no editor. O preset `cluster` em `SYSTEM_PRESETS` já tem esse formato.

## 8. Mobile execução — sala de treino do treinador (live coaching)

`mobile/app/training-room.tsx` reusa `<ExerciseCard>` — herda automaticamente as mudanças do item 7.2.

## 9. Preview no builder mobile

`mobile/app/program-builder/preview.tsx` reusa `<ExerciseCard>` — herda automaticamente.

## 10. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
```

Sem erros novos. Erros pré-existentes não relacionados ao escopo são OK.

## 11. Commits e push direto em main

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

# Commits agrupados
git add supabase/migrations/112_rounds_for_compound_methods.sql
git commit -m "feat(per-set): add rounds column for compound methods (drop-set, cluster)"

git add shared/types/prescription.ts shared/lib/prescription/set-scheme.ts shared/lib/prescription/set-scheme-presets.ts shared/lib/prescription/__tests__/
git commit -m "feat(per-set): expandSchemeByRounds, deriveRoundAndPhase, default rounds for presets"

git add supabase/functions/assign-program/index.ts
git commit -m "feat(per-set): propagate rounds in assign-program edge function"

git add mobile/components/trainer/program-builder/SetSchemeEditor.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx \
        mobile/stores/program-builder-store.ts
git commit -m "feat(per-set): add rounds field to mobile SetSchemeEditor"

git add mobile/hooks/useWorkoutSession.ts \
        mobile/components/workout/ExerciseCard.tsx
git commit -m "feat(per-set): render compound methods grouped by round in workout execution"

git add web/src/components/programs/SetSchemeTable.tsx
git commit -m "feat(per-set): add rounds field to web SetSchemeTable"

git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.3 rounds model for compound methods"

git push origin main
```

## 12. Reporte final

```
FASE 4.3 — modelo de rodadas completo

Migration 112: status = aplicada por Gustavo no Supabase / pendente
Edge Function: deployada via MCP / pendente

Commits:
  - <hash> feat(per-set): migration rounds
  - <hash> feat(per-set): shared helpers e presets
  - <hash> feat(per-set): assign-program propaga rounds
  - <hash> feat(per-set): mobile builder com rodadas
  - <hash> feat(per-set): execução agrupada por rodada
  - <hash> feat(per-set): web builder com rodadas
  - <hash> docs(per-set): Fase 4.3

Próximo passo do Gustavo:
1. Reload do simulador.
2. Builder mobile → adicionar exercício novo → modo Avançado.
3. Aplicar preset "Drop-set" — campo "Rodadas: 3" deve aparecer no editor.
4. Editar a estrutura da rodada (ex.: 8-10 reps 80% / 8-10 reps 60%).
5. Salvar e atribuir.
6. Abrir como aluno → conferir card mostra "Rodada 1", "Rodada 2", "Rodada 3" com 2 fases cada.
7. Marcar fases da Rodada 1 como completas → header da Rodada 1 ganha ✓.
8. (Opcional) Validar pirâmide ainda funciona normalmente (rounds=1 implícito).
```

## 13. Edge cases & dúvidas conhecidas

- **Programa antigo com drop-set salvo na Fase 3-4** (rounds=1, set_scheme=[normal, drop, drop]): renderiza como 3 séries lineares (comportamento atual). É bom — não quebra. Trainer pode editar e o builder oferece migrar pra novo modelo.
- **Trainer aplica preset drop-set num programa que já tinha 5 séries lineares**: confirm dialog "Isso vai converter pra modelo de rodadas. Continuar?".
- **Rodadas=1 num método compound**: trata como linear (sem grouping de rodadas no display). Aceita.
- **Pirâmide tem rounds=2 (raro)**: respeita, expande no display.

## 14. Reverter (se quebrar)

```bash
git revert HEAD~7..HEAD --no-edit
git push origin main
```

E pra reverter a coluna do DB (caso precise):
```sql
ALTER TABLE workout_item_templates DROP COLUMN rounds;
ALTER TABLE assigned_workout_items DROP COLUMN rounds;
```

(O Gustavo aplica no Supabase Dashboard se necessário.)

Tudo claro? Confirme com "Fase 4.3 — começando" e parta da pré-checagem.
