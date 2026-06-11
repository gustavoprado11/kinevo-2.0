# Unificação dos builders de programa (F-04 da análise noturna)

## Status
- [x] Rascunho
- [x] Em implementação
- [x] Concluída (implementação 11/06/2026 — falta smoke manual; ver Validação)

## Resultado medido
- `program-builder-client.tsx`: 2.864 → 2.100 linhas · `edit-assigned-program-client.tsx`: 2.133 → 1.487
  (-1.410 nos clients; núcleo novo: builder-model 623 + 4 hooks 421, SEM duplicação).
- 31 testes unitários novos das mutações puras (`__tests__/builder-model.test.ts`).
- Validado: tsc 0 erros · vitest 1.013 verdes (982 pré + 31) · `next build` ok ·
  eslint sem warnings novas (restam 2 `no-explicit-any` pré-existentes nos catch dos saves).
- **Smoke E2E real (11/06, Chrome CDP + conta QA descartável em prod, dados apagados ao final):**
  builder de criação (modelo c/ 3 exercícios via biblioteca, superset com rest herdado,
  mover top-level, modal de frequência, save → linhas verificadas no banco: parent_item_id,
  ordem, agregados das prefs) · reabertura do modelo hidratando superset · contexto de aluno
  (dias seg/qui, ativar como atual ×2 com modal de confirmação arquivando o anterior) ·
  editor de atribuído (hidratação, 2º superset, desvincular com auto-dissolução, compare
  lado-a-lado, save → banco com superset intacto + itens promovidos + snapshot de exercício).
  TUDO PASSOU.
- **Achado do smoke:** `onMoveChild` é encanamento morto na UI — chega ao
  `workout-item-card` mas o `SupersetItemCard` não recebe; não há affordance para mover
  filho dentro de superset em NENHUM dos builders. O modelo unificado já suporta
  (`moveItemIn` children-aware, com teste); expor as setas nos filhos é follow-up barato.

## Contexto
`program-builder-client.tsx` (2.844 linhas) e `edit-assigned-program-client.tsx` (2.133 linhas)
reimplementam o mesmo domínio (workouts, itens, supersets, set_scheme/rounds, compare,
drag-and-drop). Toda feature nova precisa ser portada 2× e o drift já produziu bugs reais
(ver "Divergências encontradas"). É a maior fonte de risco de regressão do web e precisa
ser resolvida ANTES das fases de IA no builder (senão cada fase custa 2×).

## Objetivo
Os dois clients viram cascas finas sobre um núcleo compartilhado: tipos canônicos +
mutações puras do modelo + hooks de estado. A persistência (tabelas diferentes:
`program_templates`/`workout_item_templates` vs `assigned_*`) CONTINUA em cada client.

## Escopo

### Incluído
1. **`components/programs/builder-model.ts`** (novo, núcleo puro — testável sem React):
   - Tipos canônicos `WorkoutItem`, `Workout`, `BuilderViewMode` (hoje duplicados; 20+
     arquivos importam do builder — ele passa a RE-EXPORTAR daqui, zero churn nos importers).
   - `tempId`, `asItemConfig`, helpers per-set 100% duplicados hoje: `hydrateSetScheme`,
     `effectiveRoundsForItem`, `aggregatesFromItem`, `effectiveMethodKey`, e
     `buildSetSchemeRows(scheme, rounds)` (linhas materializadas SEM a coluna FK — cada
     client anexa `workout_item_template_id`/`assigned_workout_item_id`).
   - Mutações puras `(Workout[], …) => Workout[]`: update/delete/duplicate/move/reorder de
     item, quarteto de superset (criar com próximo, adicionar a existente, remover com
     auto-dissolução, dissolver), CRUD/reorder/duplicate de workout, `appendItems`,
     `cleanupEmptyPlaceholders`.
   - Fábricas de item: `makeExerciseItem`, `makeNoteItem`, `makeWarmupItem`,
     `makeCardioItem`, `buildSeedScheme` (prefs ficam nos clients e entram como args).
2. **`helpers/use-workout-model.ts`** (novo): estado `workouts`/`activeWorkoutId` +
   handlers memoizados sobre as mutações puras. Opção `generateWorkoutName(index)` —
   builder injeta convenção das prefs, editor usa default letra. Expõe
   `appendItemsWith(workoutId, (w) => WorkoutItem[])` para a heurística auto-warmup do builder.
3. **`helpers/use-compare-mode.ts`** (novo): todo o estado/handlers de compare
   (100% idênticos hoje), parametrizado por `studentId: string | null`.
4. **`helpers/use-program-schedule.ts`** (novo): `calculateEndDate`/`calculateWeeks` puros +
   hook de sync bidirecional start/end/weeks.
5. **`helpers/use-canvas-dnd.ts`** (novo): dragover/leave/drop do canvas (idênticos).
6. Rewire dos dois clients (handlers mantêm os MESMOS nomes — JSX praticamente intocado).
7. Testes unitários das mutações puras (superset lifecycle, reorder, move filho,
   duplicações com clone profundo, aggregates/rounds).

### Excluído
- Persistência (saveProgram/saveAsTemplate dos dois lados) — permanece em cada client.
- Draft/autosave (só builder), IA/preferences (só builder), capturePostAssignmentEdits
  (só editor), snapshot de exercício no save (só editor).
- Header auto-hide/scroll: implementações divergem de propósito (refs de acumulação no
  editor); fica como follow-up.
- Convergência visual (design Fase 2) — fora de escopo.

## Divergências encontradas → decisão de unificação
| Tema | Builder | Editor | Decisão |
|---|---|---|---|
| `moveItem` filho de superset | ignora (BUG: `onMoveChild` do panel não funciona) | move dentro do pai | **editor** (children-aware) |
| `createSupersetWithNext` parent_item_id dos filhos | seta supersetId | deixa null (BUG latente) | **builder** |
| rest do superset novo | null (UI mostra 0s) | herda do item ou 60s | **editor** (default melhor) |
| `duplicateWorkout` | clona item_config, regex c/ `Treino \d+` | referência compartilhada | **builder** + clone de set_scheme |
| `deleteItem` reindex | não reindexa (gaps) | reindexa | **editor** |
| `addToExistingSuperset` | splice c/ aritmética de índice | filter+map (equivalente, simples) | **editor** |
| setState | funcional (`prev =>`) | parte usa closure `workouts` | **builder** |
| `addSuperset` legado vazio | — | existe, sem uso na UI | **remover** |
| `handleExerciseCreated` | prepend | append | **builder** (novo no topo) |

## Arquivos Afetados
- Novos: `builder-model.ts`, `helpers/use-workout-model.ts`, `helpers/use-compare-mode.ts`,
  `helpers/use-program-schedule.ts`, `helpers/use-canvas-dnd.ts`, testes.
- Modificados: `program-builder-client.tsx`, `edit-assigned-program-client.tsx`.
- Intocados: `workout-panel.tsx` e demais filhos (props inalteradas), saves, page.tsx.

## Validação
- `tsc --noEmit` 0 erros; `vitest run` suíte inteira verde (982+ + novos); `next build` ok.
- Smoke manual (Gustavo): criar programa c/ superset+método composto, editar atribuído,
  mover filho de superset nos DOIS fluxos, compare, salvar como modelo.

## Critério de aceite
Nenhuma mudança de payload persistido além das decisões da tabela acima; contagem de
linhas dos dois clients cai ≥ 1.000 no total; mutações puras com cobertura de teste.
