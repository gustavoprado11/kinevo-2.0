# Spec 06 — Program Builder (Workspace Layout)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
O Program Builder é a tela que mais se beneficia do espaço do tablet. Atualmente, montar um programa exige navegação constante: abrir modal de exercícios, selecionar, voltar, editar sets/reps, abrir outro modal. No tablet, tudo pode ficar visível simultaneamente.

**Dependência: Spec 01 (useResponsive)**

## Objetivo
Transformar o Program Builder em um workspace de tela dividida no tablet: painel de exercícios persistente ao lado do editor de treino.

## Escopo

### Incluído
- Layout workspace: exercise picker lateral + editor central
- Exercise picker como painel persistente (não modal) no tablet
- Drag-and-drop mais confortável com alvos maiores
- Preview/resumo do programa visível
- Manter modal de exercícios no celular

### Excluído
- Novas funcionalidades do builder (supersets, templates)
- Mudanças na lógica do Zustand store
- Novas queries de exercícios

## Arquivos Afetados

### Novos
- `mobile/components/trainer/program-builder/ExercisePanel.tsx` — painel lateral de exercícios para tablet

### Modificados
- `mobile/app/program-builder/index.tsx` — layout workspace no tablet
- `mobile/app/program-builder/[workoutId].tsx` — editor com mais espaço
- `mobile/components/trainer/program-builder/ExercisePickerModal.tsx` — modo panel vs modal
- `mobile/components/trainer/program-builder/WorkoutItemRow.tsx` — touch targets maiores
- `mobile/components/trainer/program-builder/SetRepsInput.tsx` — inputs maiores

## Comportamento Esperado

### Phone
Sem mudanças — fluxo atual com modais.

### Tablet — Workspace Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← Novo Programa                          [Salvar]      │
│  Nome: Hipertrofia Total                                │
├──────────────┬──────────────────────────────────────────┤
│  EXERCÍCIOS  │  TREINO A  |  TREINO B  |  TREINO C  +  │
│              │                                          │
│  🔍 Buscar   │  1. Supino Reto          [≡ drag]       │
│              │     3 × 10 · 60s rest                   │
│  ── Peito ── │     [Editar] [Remover]                  │
│  Supino Reto │                                          │
│  Supino Inc. │  2. Crucifixo             [≡ drag]       │
│  Crucifixo   │     3 × 12 · 45s rest                   │
│  Crossover   │     [Editar] [Remover]                  │
│              │                                          │
│  ── Costas ──│  3. Tríceps Pulley        [≡ drag]       │
│  Remada      │     4 × 12 · 45s rest                   │
│  Puxada      │     [Editar] [Remover]                  │
│  Serrote     │                                          │
│              │  ┌────────────────────────────────────┐  │
│  ── Pernas ──│  │  Toque em um exercício à esquerda │  │
│  Agachamento │  │  para adicioná-lo ao treino       │  │
│  Leg Press   │  └────────────────────────────────────┘  │
│              │                                          │
│  280px       │              restante                    │
└──────────────┴──────────────────────────────────────────┘
```

### ExercisePanel (Tablet Only)

```typescript
interface ExercisePanelProps {
  onSelectExercise: (exercise: Exercise) => void;
  selectedMuscleGroup?: string;
}

// Painel fixo à esquerda, ~280px
// Busca inline com debounce
// Categorias de músculo colapsáveis
// Toque no exercício → adiciona ao treino ativo (com feedback haptic)
```

### WorkoutItemRow Adaptações
- **Phone**: compact, touch target 44px
- **Tablet**: expanded, touch target 56px, mais info visível inline
- Drag handle maior no tablet (mais fácil de agarrar)

### SetRepsInput Adaptações
- **Phone**: inputs em stack vertical dentro de modal
- **Tablet**: inputs em row horizontal inline no card do exercício

### Fluxo do Usuário (Tablet)
1. Abre Program Builder → vê workspace com painel de exercícios à esquerda
2. Busca "supino" no painel → resultados filtram em tempo real
3. Toca em "Supino Reto" → exercício é adicionado ao treino ativo
4. Arrasta exercícios para reordenar (drag-and-drop confortável)
5. Edita sets/reps inline (sem abrir modal adicional)
6. Troca de treino via tabs no topo (Treino A / B / C)

## Critérios de Aceite
- [ ] Phone: fluxo com modais idêntico ao atual
- [ ] Tablet: painel de exercícios persistente à esquerda
- [ ] Toque no exercício do painel adiciona ao treino
- [ ] Drag-and-drop funcional com targets maiores
- [ ] Busca no painel com debounce
- [ ] Categorias de músculo colapsáveis no painel
- [ ] Edição de sets/reps sem modal extra no tablet
- [ ] Tabs de treino funcionais no topo
- [ ] Sem novos erros de TypeScript

## Edge Cases
- Painel vazio (sem exercícios cadastrados) → CTA para criar exercício
- Exercício já no treino → indicador visual ("Já adicionado") ou permitir duplicata com aviso
- Rotação durante edição → manter estado do builder
- Muitos exercícios no treino → scroll independente do painel
- Keyboard aberto (editar sets/reps) → painel se adapta ao espaço disponível

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getBuilderLayout(isTablet)` — 'workspace' vs 'modal'
- [ ] `getPanelWidth(isTablet, isLandscape)` — 280 tablet, 0 phone
- [ ] Exercise filtering logic — busca por nome, grupo muscular

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
