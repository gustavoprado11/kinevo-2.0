# Prompt Claude Code — Fase 4.5e: Paridade do mock celular + remover confirm desnecessário

> Cole numa nova sessão do Claude Code. **Workflow:** apenas modificações no working tree. **NÃO faça `git commit` nem `git push`.** Working tree continua acumulando mudanças até o Gustavo autorizar push da funcionalidade inteira.
>
> Releia `mobile/specs/WORKFLOW.md` e `web/CLAUDE.md` antes de começar.

---

Após validar a Fase 4.5d, o Gustavo identificou dois pontos:

1. **Mock do celular no builder web não reflete `set_scheme`.** Quando o trainer prescreve uma pirâmide com 4 fases (12-10-8-6 reps com descansos crescentes), o mock à direita mostra "3 séries · 10-12 reps · 60s descanso" e 3 linhas idênticas — comportamento legado, sem chip de método, sem meta por série, sem agrupamento por rodada. O aluno vê uma coisa diferente do que o mock mostra. Princípio: o mock tem que ser uma reprodução fiel do que o aluno verá.

2. **Confirm dialog desnecessário ao trocar de preset.** "Aplicar este preset vai sobrescrever as fases atuais. Continuar?" aparece a cada clique de chip. O trainer está sendo intencional ao clicar — o confirm é fricção sem ganho real. Remover.

## 0. Pré-checagens

```bash
git status              # confirma working tree atual com mudanças da Fase 4.5d acumuladas
git log --oneline -5    # confirma que estamos sem commits novos desde Fase 4.5d
```

## 1. Ler estado atual

```bash
ls web/src/components/programs/workout-preview/
cat web/src/components/programs/workout-preview/preview-exercise-card.tsx
cat web/src/components/programs/workout-preview/preview-set-row.tsx
cat web/src/components/programs/workout-preview/workout-execution-preview.tsx 2>/dev/null
cat web/src/components/programs/SetSchemePresetChips.tsx | grep -A 30 "handlePresetClick\|hasEdits\|confirm"
```

E referência da implementação que JÁ EXISTE no aluno mobile (deve servir de modelo):

```bash
cat mobile/components/workout/SetRow.tsx
cat mobile/components/workout/ExerciseCard.tsx
```

## 2. Ponto 1 — Paridade do mock celular com o aluno real

Os componentes em `web/src/components/programs/workout-preview/` precisam renderizar:

### 2.1 `preview-exercise-card.tsx`

Quando o exercício tem `set_scheme` preenchido:

- **Chip do método** ao lado do nome (igual `mobile/components/workout/ExerciseCard.tsx`):
  - Pílula violeta com ícone Lucide específico por método (`TrendingDown` pirâmide ↓, `TrendingUp` pirâmide ↑, `Zap` drop-set, etc.)
  - Texto via `METHOD_KEY_LABELS[method_key]` do shared
  - Só aparece se `method_key && method_key !== 'standard'`
- **Subtítulo** atualizado:
  - Quando `rounds > 1`: "**3 rodadas × 3 fases · 10/8/8 reps**"
  - Quando `rounds = 1` e `set_scheme.length > 1`: "**4 séries · 12-10-8-6 · 90s descanso**"
  - Quando linear simples (sem `set_scheme`): formato atual ("3 séries · 10-12 reps · 60s descanso")
  - Use `summarizeWithRounds(scheme, rounds)` do shared (já existe).

### 2.2 `preview-set-row.tsx`

Quando o exercício tem `set_scheme`, cada linha:

- **Borda esquerda colorida** quando `set_type !== 'normal'` (mesmas cores da Fase 4.5c).
- **"Meta: X"** acima do input de Reps em violeta (mesmo padrão de `mobile/components/workout/SetRow.tsx`).
- **"Meta: Y kg"** ou **"Meta: Z% 1RM"** acima do input de Carga, quando o trainer prescreveu `weight_kg`/`weight_pct1rm` (helper `buildWeightMetaLabel` do shared).
- **Placeholder** do input vira o `reps_target` específico da fase (não o anterior).

### 2.3 `workout-execution-preview.tsx` (ou o componente container)

Quando `rounds > 1`, agrupa fases visualmente em rodadas:

```
Rodada 1                    ◯
  Fase 1 (badge se ≠ normal) | Anterior | Peso | Reps | ✓
  Fase 2 (badge) | ...
  Fase 3 (badge) | ...

Rodada 2                    ◯
  Fase 1 ...
  ...
```

- Header da rodada: "**Rodada N**" + indicador `◯` (vazio) ou `✓` (todas fases marcadas) à direita.
- Espaçamento maior entre rodadas, menor dentro.
- Quando `rounds = 1`, renderiza flat (sem header de rodada) — comportamento atual.

### 2.4 Contador

Header da preview (ex.: "0/3 séries") passa a usar **fases totais** quando `rounds > 1`:

- `rounds = 3, scheme.length = 3` → "**0/9 fases**"
- `rounds = 1, scheme.length = 4` → "**0/4 séries**" (linear customizado)
- Linear simples (sem scheme) → formato atual.

### 2.5 Reaproveitar lógica

A hidratação das séries via `expandSchemeByRounds` já existe (Fase 4.3, no `useWorkoutSession.ts` mobile e na fase 4.4 web). Se a preview já chama essa função, ótimo. Senão, chama no container do preview pra ter o array materializado pra renderizar.

**Princípio:** o preview reusa a MESMA lógica de display do aluno real. Se possível, extraia componentes compartilhados em vez de duplicar — mas não force o refactor se a estrutura atual estiver muito divergente. Decida pragmaticamente.

### Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): web mock preview reflects set_scheme with full parity to student app

- preview-exercise-card: method chip, rounds × fases summary
- preview-set-row: meta per phase, set_type left border, weight target label
- workout-execution-preview: groups phases by round with completion indicator
- Counter shows 'X/N fases' when compound, 'X/N séries' when linear
```

Arquivos: `web/src/components/programs/workout-preview/preview-exercise-card.tsx`, `preview-set-row.tsx`, `workout-execution-preview.tsx` (ou nome do container).

## 3. Ponto 2 — Remover confirm dialog ao trocar de preset

Localize o handler do clique no chip de preset (`handlePresetClick` ou similar) em `SetSchemePresetChips.tsx` (web e mobile) ou onde quer que esteja.

**Comportamento atual:**
```ts
function handlePresetClick(key: MethodKey, opts: { hasEdits: boolean }) {
  if (key === 'custom') { onMethodKeyChange('custom'); return }
  if (opts.hasEdits) {
    const confirmed = confirm('Aplicar este preset vai sobrescrever as fases atuais. Continuar?')
    if (!confirmed) return
  }
  // ... aplica preset
}
```

**Comportamento alvo:**
```ts
function handlePresetClick(key: MethodKey) {
  if (key === 'custom') { onMethodKeyChange('custom'); return }
  // Aplica preset diretamente — sem confirm.
  const preset = SYSTEM_PRESETS[key]
  onSchemeChange(preset.defaultSetsConfig)
  onRoundsChange(preset.defaultRounds)
  onMethodKeyChange(key)
}
```

Aplica nos **dois** lugares (web `SetSchemePresetChips.tsx` + mobile `SetSchemePresetChips.tsx`). Remova também os parâmetros `hasEdits` que viraram dead code.

### Mensagem de commit (sugerida — não execute agora)

```
feat(per-set): remove confirm dialog when switching between presets

Trainer is intentional when clicking a preset chip. The previous confirm
added friction every time they wanted to compare methods. Removed for
cleaner UX. If trainer mis-clicks, they can re-apply the previous preset
or click Customizado.
```

Arquivos: `web/src/components/programs/SetSchemePresetChips.tsx`, `mobile/components/trainer/program-builder/SetSchemePresetChips.tsx`, e qualquer callsite que passava `hasEdits`.

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baseline TS web em 11 erros. Sem regressões.

## 5. NÃO commita, NÃO empurra

Apenas atualize a spec `mobile/specs/active/prescricao-per-set-manual.md` com notas dessa fase no working tree, rode `git status` pra confirmar o estado, e pare.

## 6. Reporte final

```
FASE 4.5e — paridade do mock + remover confirm (working tree, sem commit)

Ponto 1 — Mock celular reflete set_scheme:
  ✓ preview-exercise-card: chip de método + subtítulo dinâmico (rondas × fases / N séries)
  ✓ preview-set-row: meta por fase (reps + carga), borda colorida por set_type
  ✓ workout-execution-preview: agrupamento por rodada quando rounds > 1
  ✓ Contador adapta entre 'X/N fases' (compound) e 'X/N séries' (linear)

Ponto 2 — Confirm removido:
  ✓ handlePresetClick aplica preset diretamente
  ✓ Parâmetro hasEdits removido (dead code) nos 2 callsites
  ✓ Customizado continua sem confirm (label-only)

Arquivos modificados (working tree):
  web/src/components/programs/workout-preview/preview-exercise-card.tsx
  web/src/components/programs/workout-preview/preview-set-row.tsx
  web/src/components/programs/workout-preview/workout-execution-preview.tsx
  web/src/components/programs/SetSchemePresetChips.tsx
  mobile/components/trainer/program-builder/SetSchemePresetChips.tsx
  mobile/specs/active/prescricao-per-set-manual.md

Validações:
  shared: <X>/<X>
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: <X> erros baseline (idêntico)
  mobile vitest: <X>/<X>

Estado: working tree modificado, sem commits, sem push. Aguardando
suas próximas iterações + autorização final do batch (per WORKFLOW.md).

Próximos passos do Gustavo:
1. Web local: builder → criar pirâmide ↓ com 4 fases → conferir mock à
   direita mostra:
     a. Chip "Pirâmide ↓" violeta no exercício
     b. "4 séries · 12-10-8-6 · 90s descanso" no subtítulo
     c. 4 linhas com "Meta: 12 / Meta: 10 / Meta: 8 / Meta: 6"
     d. Contador "0/4 séries"
2. Aplicar Drop-set (rounds=3 × 3 fases) → mock mostra:
     a. Chip "Drop-set"
     b. "3 rodadas × 3 fases" no subtítulo
     c. 3 grupos "Rodada 1/2/3" com 3 fases dentro de cada
     d. Bordas vermelhas nas fases drop
     e. Contador "0/9 fases"
3. Trocar entre presets sem confirm — só aplica direto.
4. Mobile: confirmar mesmo comportamento no builder.
```

## 7. Edge cases

- **Preview de programa antigo (sem set_scheme)**: comportamento atual mantido (sem chip, sem meta, sem agrupamento). Backward compat.
- **Trainer mexeu manualmente nas fases e clica em outro preset**: aplica direto (perde edits). Sem confirm. Se o trainer reclamar disso, a gente volta o confirm.
- **Trainer quer só relabelar pra "Customizado"**: clica no chip Customizado — preserva scheme (já era o comportamento, mantém).
- **Mock em programa que ainda não foi salvo**: usa o estado em memória do builder. Nada de DB.

## 8. Iterar / desfazer

- Working tree: edita arquivos in-place se algo precisar ajustar.
- Voltar arquivo específico ao último commit em main: `git checkout -- <arquivo>`.
- NÃO fazer `git reset --hard origin/main` (apaga toda a Fase 4.5d acumulada).

Tudo claro? Confirme com "Fase 4.5e — começando" e parta da pré-checagem.
