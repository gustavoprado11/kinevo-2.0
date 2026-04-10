# Fase 4: Program Builder Enhancement

## Objetivo

Elevar o builder de programas do mobile ao mesmo nível de informação e usabilidade do web, respeitando as limitações de espaço em tela. Cinco melhorias priorizadas por impacto × esforço.

---

## Spec 1: Seletor de Dias da Semana

### Problema
O campo `frequency: string[]` existe em `Workout` no store, mas nenhum componente no mobile o utiliza. O trainer não consegue definir em quais dias da semana cada treino será executado.

### Solução
Criar componente `DaySelector` com 7 botões circulares (D S T Q Q S S) posicionado no header de cada workout, entre o nome e o botão de excluir.

### Referência Web
`web/src/components/programs/workout-panel.tsx` → `DaySelectorButtons` (linhas 36-95)

### Detalhes

**Componente**: `mobile/components/trainer/program-builder/DaySelector.tsx`

```
┌──────────────────────────────────────────────┐
│ Treino A                  D S T Q Q S S  🗑️  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ [lista de exercícios...]                     │
└──────────────────────────────────────────────┘
```

**Estados visuais por botão**:
- **Selecionado**: fundo `#7c3aed`, texto branco, borda `#7c3aed`
- **Ocupado** (outro treino já usa esse dia): fundo `#e2e8f0`, texto `#94a3b8`, disabled
- **Disponível**: fundo `#f1f5f9`, texto `#64748b`, touchable

**Props**:
```typescript
interface DaySelectorProps {
    frequency: string[];           // ['mon', 'wed', 'fri']
    occupiedDays: string[];        // dias usados por OUTROS treinos
    onUpdateFrequency: (days: string[]) => void;
}
```

**Dimensões**: botões 28×28, gap 4, fontSize 11, fontWeight 700.

### Store Change

Adicionar action `updateWorkoutFrequency` em `program-builder-store.ts`:

```typescript
updateWorkoutFrequency: (workoutId: string, days: string[]) => void;
```

Implementação: atualizar `workout.frequency` do workout especificado.

### Computed `occupiedDays`

No `program-builder/index.tsx`, calcular:
```typescript
const occupiedDays = useMemo(() => {
    const days = new Set<string>();
    draft.workouts.forEach(w => {
        if (w.id !== currentWorkoutId && w.frequency) {
            w.frequency.forEach(d => days.add(d));
        }
    });
    return Array.from(days);
}, [draft.workouts, currentWorkoutId]);
```

---

## Spec 2: Volume Summary por Grupo Muscular

### Problema
O trainer não tem visibilidade do volume semanal por grupo muscular durante a prescrição. É a métrica mais importante para garantir volume adequado.

### Solução
Barra horizontal colapsável mostrando séries semanais por grupo muscular com feedback visual de cores.

### Referência Web
`web/src/components/programs/volume-summary.tsx` (95 linhas)

### Detalhes

**Componente**: `mobile/components/trainer/program-builder/VolumeSummary.tsx`

**Layout** (colapsado — padrão):
```
┌──────────────────────────────────────────────┐
│ 🏋️ Peito 12  Costas 15  Quadríceps 9  ▼     │
└──────────────────────────────────────────────┘
```

**Layout** (expandido — ao tocar):
```
┌──────────────────────────────────────────────┐
│ Volume Semanal por Grupo Muscular         ▲  │
│                                              │
│ Costas         ████████████████  15 séries   │
│ Peito          ████████████      12 séries   │
│ Quadríceps     ██████████        10 séries   │
│ Ombros         ██████            6 séries    │
│ Bíceps         ████              4 séries    │
│                                              │
│ 🟢 10-20: Produtivo  🔵 <10: Baixo  🟡 >20  │
└──────────────────────────────────────────────┘
```

**Cores de feedback** (mesmas do web):
- `#60a5fa` (azul): < 10 séries — volume pode ser insuficiente
- `#34d399` (verde): 10-20 séries — faixa produtiva
- `#fbbf24` (amarelo): > 20 séries — volume alto, monitorar recuperação

**Cálculo** (mesma lógica do web `volume-summary.tsx`):
```typescript
function calculateVolume(workouts: Workout[]): Record<string, number> {
    return workouts.reduce((acc, workout) => {
        const frequency = Math.max(1, workout.frequency.length);
        workout.items.forEach(item => {
            if (item.item_type === 'exercise' && item.sets > 0) {
                const weeklySets = item.sets * frequency;
                item.exercise_muscle_groups.forEach(group => {
                    acc[group] = (acc[group] || 0) + weeklySets;
                });
            }
        });
        return acc;
    }, {} as Record<string, number>);
}
```

**Posição**: Renderizar acima do `WorkoutTabBar`, entre os campos de metadata e os tabs.

**Animação**: Usar `LayoutAnimation` ou `Animated` para expand/collapse suave.

---

## Spec 3: WorkoutTabBar Compacto

### Problema
O tab bar atual renderiza cards retangulares grandes (~160×200px como visível no screenshot). Ocupam espaço excessivo e não mostram informação útil suficiente.

### Solução
Redesenhar como chips horizontais compactos com mini-dots indicando dias selecionados.

### Detalhes

**Antes** (atual):
```
┌─────────────┐  ┌─────────────┐
│ Treino A    │  │             │
│ 0 exercícios│  │    [+]      │
│             │  │             │
│             │  └─────────────┘
│             │
│             │
└─────────────┘
   Treino A                  🗑️
```

**Depois** (redesenhado):
```
┌──────────────────┐ ┌──────────────────┐ ┌───┐
│ Treino A · 3 ex  │ │ Treino B · 5 ex  │ │ + │
│ ● ● ●  ○ ○ ○ ○  │ │ ○ ○ ● ○ ● ○ ○   │ │   │
└──────────────────┘ └──────────────────┘ └───┘
```

**Cada chip mostra**:
- Nome do treino + contagem de exercícios (ex: "Treino A · 3 ex")
- Mini-dots de dias da semana (7 circles de 6px): preenchido se selecionado, vazio se não
- Tab ativa: fundo `#7c3aed`, texto branco, dots brancos
- Tab inativa: fundo `#ffffff`, borda `#e2e8f0`, texto `#0f172a`

**Altura do chip**: ~48px (vs ~200px+ do card atual)
**Width**: auto-sized pelo conteúdo, min ~110px

### Props adicionais no WorkoutTabBar

```typescript
interface WorkoutTabBarProps {
    workouts: Workout[];
    currentWorkoutId: string | null;
    onSelectWorkout: (workoutId: string) => void;
    onAddWorkout: () => void;
}
```

Não precisa mudar props — os dados de frequency já estão no `Workout`.

---

## Spec 4: Campo de Duração do Programa

### Problema
O store já tem `duration_weeks: number | null` e `updateDurationWeeks`, mas a tela não expõe esse campo.

### Solução
Adicionar campo de duração na área de metadata, após a descrição.

### Detalhes

**Layout**:
```
┌──────────────────────────────────────────────┐
│ Nome do programa                             │
├──────────────────────────────────────────────┤
│ Descrição (opcional)                         │
├──────────────────────────────────────────────┤
│ Duração:  [ 4 ] semanas        ⓘ            │
└──────────────────────────────────────────────┘
```

**Implementação**: Row com label "Duração", TextInput numérico (width 48px), texto "semanas".

**Validação**: 1-52 semanas. Se vazio → null (duração indefinida).

**Tooltip info** (ⓘ): "Defina por quantas semanas este programa ficará ativo. Deixe vazio para duração indefinida."

---

## Spec 5: WorkoutItemRow Compacto

### Problema
Cada exercício ocupa ~80px+ de altura com layout vertical (nome, muscles, sets/reps em linhas separadas). Com 8-10 exercícios, o scroll é excessivo.

### Solução
Layout de duas linhas, mais denso, com sets/reps inline.

### Detalhes

**Antes** (atual):
```
┌──────────────────────────────────────────────┐
│ ≡  🏋️ Supino Reto                       🗑️  │
│       Peito, Tríceps                         │
│       3 × 10 · 60s                           │
└──────────────────────────────────────────────┘
```

**Depois** (compacto):
```
┌──────────────────────────────────────────────┐
│ ≡  🏋️ Supino Reto          3×10  60s    🗑️  │
│       Peito, Tríceps                         │
└──────────────────────────────────────────────┘
```

**Mudanças**:
1. Mover `SetRepsInput` display para a mesma linha do nome (à direita, alinhado)
2. Muscle groups continuam na segunda linha (opcional — colapsável se espaço apertado)
3. Reduzir padding vertical: de 14px para 10px
4. Reduzir marginBottom: de 8px para 6px
5. Mover drag handle para ícone mais compacto (12px vs 18px)
6. Sets/reps display: "3×10" (sem espaço), rest separado: "60s"
7. Ao tocar no "3×10 60s", expandir para modo edição (mesmo SetRepsInput modal/inline)

**Economia**: ~20-25px por item → ~200px com 10 exercícios ≈ metade de um screen a menos de scroll.

---

## Resumo de Arquivos

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `mobile/components/trainer/program-builder/DaySelector.tsx` | Seletor de dias da semana (7 botões) |
| `mobile/components/trainer/program-builder/VolumeSummary.tsx` | Resumo de volume semanal por grupo muscular |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `mobile/stores/program-builder-store.ts` | Adicionar `updateWorkoutFrequency` action |
| `mobile/app/program-builder/index.tsx` | Integrar DaySelector, VolumeSummary, campo duração, occupiedDays |
| `mobile/components/trainer/program-builder/WorkoutTabBar.tsx` | Redesign compacto com mini-dots de dias |
| `mobile/components/trainer/program-builder/WorkoutItemRow.tsx` | Layout compacto de 2 linhas |
| `mobile/components/trainer/program-builder/SetRepsInput.tsx` | Suportar modo inline (display compacto) |
| `mobile/hooks/useProgramBuilder.ts` | Expor `updateWorkoutFrequency` |

### Testes
| Arquivo | Conteúdo |
|---------|----------|
| `mobile/components/trainer/program-builder/__tests__/volumeCalculation.test.ts` | Testes de `calculateVolume`, `getVolumeColor`, sorting |
| `mobile/components/trainer/program-builder/__tests__/daySelector.test.ts` | Testes de `occupiedDays` computation, toggle logic |
