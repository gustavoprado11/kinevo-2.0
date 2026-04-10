# Especificação Técnica: Mobile Program Builder

**Data:** 2026-04-08  
**Versão:** 1.0  
**Status:** Em Desenvolvimento

---

## 1. Objetivo

Implementar um construtor de programas de treino **nativo para mobile** que permita aos treinadores criar, editar e organizar programas de exercícios diretamente no dispositivo móvel. O recurso deve manter paridade funcional com a versão web enquanto otimiza a experiência para interações mobile (swipe, long-press, toque direto).

---

## 2. Contexto

### 2.1 Gap Atual
- **Bloqueador crítico:** Treinadores precisam usar web/desktop para criar programas
- **Impacto:** Reduz produtividade em campo, limita onboarding mobile-first
- **Frequência:** #1 feature solicitada em feedback de treinadores

### 2.2 Referência Web Existente
A implementação web (`program-builder-client.tsx`) estabelece padrões:
- **Estrutura de dados:** `ProgramData` → `workout_templates[]` → `workout_item_templates[]`
- **Tipos de item:** `'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'`
- **Reordenação:** Drag-and-drop com `@dnd-kit`
- **Busca de exercícios:** Inline com `MIN_QUERY_LENGTH=2`, `MAX_RESULTS=5`

### 2.3 Padrões Mobile Existentes
- **State:** Zustand + MMKV (ex: `stores/training-room-store.ts`)
- **Componentes:** `PressableScale`, animações em `lib/animations.ts`
- **Navegação:** Expo Router com grupos de rota
- **Exercícios:** Hook `useExerciseLibrary` com filtro por músculo

---

## 3. Arquitetura da Solução

### 3.1 Fluxo de Dados

```
StudentDetailScreen
  ↓ [Atribuir Programa]
ProgramBuilderIndex (tabs por workout A/B/C)
  ↓ [Seleciona workout]
WorkoutEditorScreen ([workoutId])
  ↓ [Exercise List + Reorder + Inline Edit]
ExercisePickerModal (busca + seleção)
  ↓ [Salva em store]
useProgramBuilder (coordena store + Supabase sync)
```

### 3.2 State Management
- **Zustand store:** `program-builder-store.ts` (builder state + draft)
- **MMKV:** Persistência local para drafts
- **Supabase:** Salvamento remoto de programa finalizado
- **Optimistic updates:** UI reflete mudança antes de sync

---

## 4. Interfaces TypeScript

### 4.1 Program Builder State

```typescript
// stores/program-builder-store.ts

export interface WorkoutItemConfig {
  exercise_id: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  notes?: string;
  exercise_function?: string; // 'main' | 'accessory' | 'superset'
  item_config?: Record<string, any>;
  substitute_exercise_ids?: string[];
}

export interface WorkoutItem extends WorkoutItemConfig {
  id: string; // uuid
  type: 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio';
  created_at: string;
  order_index: number;
}

export interface Workout {
  id: string;
  name: string; // 'A', 'B', 'C', etc.
  items: WorkoutItem[];
  created_at: string;
  updated_at: string;
}

export interface ProgramDraft {
  id?: string; // null até salvar
  name: string;
  description?: string;
  workouts: Workout[];
  student_id?: string; // set quando atribuindo
  created_at: string;
  updated_at: string;
  is_draft: true;
}

export interface ProgramBuilderState {
  // Draft atual
  draft: ProgramDraft;
  currentWorkoutId: string | null;
  currentWorkoutItemId: string | null;
  
  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  
  // Actions
  initNewProgram: () => void;
  loadProgram: (programId: string) => Promise<void>;
  
  // Workout actions
  addWorkout: (name: string) => void;
  deleteWorkout: (workoutId: string) => void;
  renameWorkout: (workoutId: string, newName: string) => void;
  setCurrentWorkout: (workoutId: string) => void;
  
  // WorkoutItem actions
  addWorkoutItem: (workoutId: string, item: Omit<WorkoutItem, 'id' | 'order_index'>) => void;
  updateWorkoutItem: (workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => void;
  deleteWorkoutItem: (workoutId: string, itemId: string) => void;
  reorderWorkoutItems: (workoutId: string, items: WorkoutItem[]) => void;
  
  // Program actions
  updateProgramName: (name: string) => void;
  updateProgramDescription: (description: string) => void;
  saveProgram: (studentId?: string) => Promise<string>; // returns programId
  discardDraft: () => void;
  
  // Draft persistence
  saveDraftLocal: () => void;
  loadDraftLocal: () => Promise<boolean>;
  clearDraftLocal: () => void;
}
```

### 4.2 Exercise Library

```typescript
// Extends existing useExerciseLibrary

export interface ExerciseSearchOptions {
  query?: string;
  muscleGroup?: string;
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  limit?: number;
}

export interface ExerciseForBuilder extends Exercise {
  id: string;
  name: string;
  equipment?: string;
  owner_id: string;
  video_url?: string;
  instructions?: string;
  difficulty_level?: string;
  muscle_groups: string[];
}
```

### 4.3 Hook Integration

```typescript
// hooks/useProgramBuilder.ts

export interface UseProgramBuilderReturn {
  // State
  draft: ProgramDraft;
  currentWorkout: Workout | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  
  // Workout management
  addWorkout: (name: string) => void;
  deleteWorkout: (workoutId: string) => void;
  
  // Exercise management
  addExercise: (workoutId: string, exercise: ExerciseForBuilder, sets: number, reps: number) => void;
  updateExercise: (workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => void;
  deleteExercise: (workoutId: string, itemId: string) => void;
  reorderExercises: (workoutId: string, itemIds: string[]) => void;
  
  // Persistence
  saveToDraft: () => Promise<void>;
  saveToStudent: (studentId: string) => Promise<string>;
  discardChanges: () => void;
}
```

---

## 5. Arquivos a Criar

### 5.1 Store: `mobile/stores/program-builder-store.ts`

**Responsabilidades:**
- Gerenciar estado de draft do programa
- Sincronizar com MMKV para persistência local
- Fornecer ações para CRUD de workouts e items
- Rastrear estado de salvamento (draft vs finalizado)

**Destaques da implementação:**
- Usar `create<T>(immer(...))` para imutabilidade
- Implementar debounce para salvamento local (500ms)
- Validar constraints: min 1 workout, min 1 item por workout
- Suportar undo/redo? (v1: não, apenas discard)

**Pseudocódigo:**
```typescript
const useProgramBuilderStore = create<ProgramBuilderState>()(
  immer((set, get) => ({
    draft: { /* inicial */ },
    
    addWorkout: (name) => {
      set((state) => {
        const newWorkout = { id: uuid(), name, items: [], ... };
        state.draft.workouts.push(newWorkout);
      });
      // debounce saveDraftLocal
    },
    
    reorderWorkoutItems: (workoutId, items) => {
      // Recalcular order_index
      // Atualizar store
      // Sync local
    },
  }))
);
```

---

### 5.2 Tela Principal: `mobile/app/program-builder/index.tsx`

**Responsabilidades:**
- Exibir abas para cada workout (A, B, C, ...)
- Permitir adicionar novo workout (+ button)
- Navegar para detalhe do workout ao tocar aba
- Exibir nome/descrição do programa
- Botão de salvamento final (top-right)

**Layout:**
```
┌─────────────────────────────┐
│ [Back] Program Name   [Save]│
├─────────────────────────────┤
│ Description (edit inline)   │
├─────────────────────────────┤
│ [A]  [B]  [C]  [+]          │ ← WorkoutTabBar
├─────────────────────────────┤
│ (Conteúdo do workout selecionado)
│ → Encaminha para [workoutId]
└─────────────────────────────┘
```

**Componentes:**
- `WorkoutTabBar`: Abas horizontais com scroll
- `FloatingActionButton`: + para novo workout
- `ProgramHeaderInput`: Nome e descrição editáveis

---

### 5.3 Tela de Edição: `mobile/app/program-builder/[workoutId].tsx`

**Responsabilidades:**
- Listar todos os exercícios do workout
- Permitir reordenação (long-press + drag)
- Inline editing de sets/reps/rest
- Remover exercício (swipe left)
- Adicionar novo exercício (+ button)

**Layout:**
```
┌─────────────────────────────┐
│ Workout A  [Info] [Delete]  │
├─────────────────────────────┤
│ ╔═══════════════════════════╗│
│ ║ 1. Bench Press 4×8 60s    ║│ ← draggable
│ ║ → Swipe left to delete    ║│
│ ╚═══════════════════════════╝│
│ ╔═══════════════════════════╗│
│ ║ 2. Dumbbell Flyes 3×12    ║│
│ ╚═══════════════════════════╝│
├─────────────────────────────┤
│ [+ Add Exercise]            │
└─────────────────────────────┘
```

**Interações:**
- **Long-press:** Ativar modo reordenação (visual feedback com ScaleAnimation)
- **Drag:** Reordenar itens em tempo real
- **Swipe left:** Revelar botão delete com haptic feedback
- **Tap exercício:** Abrir picker para substituir/editar

---

### 5.4 Linha de Item: `mobile/components/trainer/program-builder/WorkoutItemRow.tsx`

**Responsabilidades:**
- Renderizar nome + info de exercício
- Inline editing para sets × reps
- Botão de delete (revelado por swipe)
- Indicador visual de tipo (exercise/superset/warmup)

**Props:**
```typescript
interface WorkoutItemRowProps {
  item: WorkoutItem;
  exercise: ExerciseForBuilder | null; // da biblioteca
  workoutId: string;
  isReordering: boolean;
  onPress: () => void;
  onDelete: () => void;
  onUpdateSets: (sets: number) => void;
  onUpdateReps: (reps: number) => void;
}
```

**Estrutura:**
- `Animated.View` para reveal swipe
- `PressableScale` para tap feedback
- `SetRepsInput` para edição compacta
- Ícone de tipo baseado em `item.type`

---

### 5.5 Modal de Seleção: `mobile/components/trainer/program-builder/ExercisePickerModal.tsx`

**Responsabilidades:**
- Bottom sheet com lista de exercícios
- Busca com `useExerciseLibrary`
- Filtro por grupo muscular
- Seleção e confirmação
- Feedback tátil ao selecionar

**Layout:**
```
┌─────────────────────────────┐
│ [X] Select Exercise         │
├─────────────────────────────┤
│ [Search...] [Filter ▼]      │
├─────────────────────────────┤
│ ○ Bench Press (Chest)       │
│ ○ Dumbbell Flyes (Chest)    │
│ ○ Machine Chest Press       │
│ ...                         │
├─────────────────────────────┤
│ [Cancel] [Select]           │
└─────────────────────────────┘
```

**Features:**
- Debounced search (`MIN_QUERY_LENGTH=2`)
- Resultado máximo de 5 exercícios (paginação v2)
- Filtro de grupo muscular via segmented control
- Haptic feedback ao selecionar

---

### 5.6 Input Compacto: `mobile/components/trainer/program-builder/SetRepsInput.tsx`

**Responsabilidades:**
- Edição inline de sets × reps
- Layout compacto (4 dígitos max)
- Teclado numérico apenas
- Validação min/max (1-12 sets, 1-50 reps)

**Exemplo visual:**
```
4 × 8 rest: 60s
↑ ↑ ↑ ↑
```

**Implementação:**
- `TextInput` controlado com `keyboardType="number-pad"`
- Validação onChange
- Salvar ao blur

---

### 5.7 Barra de Abas: `mobile/components/trainer/program-builder/WorkoutTabBar.tsx`

**Responsabilidades:**
- ScrollView horizontal com abas para cada workout
- Indicador visual da aba ativa
- Botão + para novo workout
- Auto-scroll para aba atual

**Props:**
```typescript
interface WorkoutTabBarProps {
  workouts: Workout[];
  currentWorkoutId: string | null;
  onSelectWorkout: (workoutId: string) => void;
  onAddWorkout: () => void;
  isEditingName?: boolean;
}
```

---

### 5.8 Hook: `mobile/hooks/useProgramBuilder.ts`

**Responsabilidades:**
- Orquestração entre store + API Supabase
- Carregar programa existente
- Salvar para aluno específico
- Gerenciar erro + loading states
- Integração com notificações (snackbar)

**Pseudocódigo:**
```typescript
export function useProgramBuilder(programId?: string) {
  const store = useProgramBuilderStore();
  const supabase = useSupabaseClient();
  
  const saveToStudent = async (studentId: string) => {
    set({ isSaving: true });
    try {
      const saved = await supabase
        .from('programs')
        .insert({
          data: store.draft,
          student_id: studentId,
          is_draft: false,
        });
      await store.clearDraftLocal();
      return saved.id;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  };
  
  return { ...store, saveToStudent };
}
```

---

## 6. Arquivos a Modificar

### 6.1 `mobile/app/student/[id].tsx`

**Mudança:** Ligar botão "Atribuir Programa" ao novo builder

**Pseudocódigo:**
```typescript
const StudentDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const handleAssignProgram = () => {
    // Opção 1: Criar programa novo
    // Opção 2: Selecionar programa existente
    router.push({
      pathname: '/program-builder',
      params: { studentId: id, mode: 'new' },
    });
  };
  
  return (
    <Button 
      label="Atribuir Programa"
      onPress={handleAssignProgram}
    />
  );
};
```

**Decisão:** Criar programa novo vs reutilizar? → v1: apenas novo

---

### 6.2 `mobile/app/_layout.tsx`

**Mudança:** Registrar grupo de rota `program-builder`

**Pseudocódigo:**
```typescript
<Stack.Group screenOptions={{ presentation: 'card' }}>
  <Stack.Screen 
    name="program-builder/index"
    options={{
      title: 'Construtor de Programa',
      headerLeft: () => <BackButton />,
      headerRight: () => <SaveButton />,
    }}
  />
  <Stack.Screen 
    name="program-builder/[workoutId]"
    options={{
      title: 'Editar Workout',
    }}
  />
</Stack.Group>
```

---

## 7. Padrões e Convenções

### 7.1 Interações Mobile-First

| Ação | Gesto | Feedback |
|------|-------|----------|
| Abrir exercício | Tap | Scale + vibração light |
| Reordenar | Long-press + drag | Feedback tátil médio |
| Deletar | Swipe left | Reveal + vibração heavy |
| Adicionar | Tap + button | Scale + sucesso |
| Salvar | Tap | Loading spinner + snack |

### 7.2 Bottom Sheets vs Modals
- **Exercício picker:** Bottom sheet (scrollável, dismissível com swipe)
- **Confirmação delete:** Modal (menor, centered)
- **Editar nome:** Inline text input

### 7.3 Persistência Local
- **MMKV key:** `@program-builder-draft-{studentId}`
- **Trigger save:** onChange com debounce 500ms
- **Carregar na init:** useEffect na tela principal
- **Limpar ao sucesso:** `saveToStudent` → `clearDraftLocal`

### 7.4 Haptic Feedback
```typescript
// lib/haptics.ts extensions
export const haptics = {
  light: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Light),
  medium: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Medium),
  heavy: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
```

### 7.5 Animações
```typescript
// Usar presets existentes de lib/animations.ts
const scaleAnim = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.95]) }],
}));
```

---

## 8. Fluxo de Dados Detalhado

### 8.1 Criar Novo Programa

```
1. StudentDetailScreen [Atribuir Programa]
   ↓ router.push('/program-builder', { studentId })
2. ProgramBuilderIndex
   ↓ useProgramBuilder() → initNewProgram()
3. Store: draft = { workouts: [{ name: 'A', items: [] }] }
4. UI: Seleciona workout A
5. WorkoutEditorScreen
   ↓ [+ Add Exercise]
6. ExercisePickerModal
   ↓ Seleciona "Bench Press"
7. Store: addWorkoutItem()
   ↓ saveDraftLocal() (debounce)
8. MMKV persiste draft
9. [Save Button]
   ↓ useProgramBuilder.saveToStudent()
10. Supabase: insert programa
    ↓ studentId atribuído
11. Sucesso: pop para student detail
```

### 8.2 Reordenar Exercícios

```
1. WorkoutEditorScreen: long-press sobre item
   ↓ isReordering = true
2. Animated feedback (scale + drop shadow)
3. Drag para nova posição
   ↓ store.reorderWorkoutItems() (otimista)
4. UI atualiza ordem_index em tempo real
5. Release:
   ↓ saveDraftLocal() (debounce)
6. MMKV atualiza
7. Haptic success feedback
```

### 8.3 Salvar + Atribuir a Aluno

```
1. [Save] button em ProgramBuilderIndex
2. Modal: confirmar nome do programa?
3. useProgramBuilder.saveToStudent(studentId)
   → isSaving = true
4. Supabase upsert:
   - programs table (name, description, data)
   - program_assignments (program_id, student_id)
5. Sucesso:
   - clearDraftLocal()
   - showSnackbar("Programa salvo!")
   - pop 2x (volta a StudentDetail)
6. Erro:
   - showSnackbar(erro)
   - mantém draft em MMKV

```

---

## 9. Critérios de Aceite

### 9.1 Funcionalidade (10+ itens)

- [ ] **AC-1:** Criar novo programa com nome
- [ ] **AC-2:** Adicionar workout (A, B, C, ...)
- [ ] **AC-3:** Adicionar exercício ao workout via picker
- [ ] **AC-4:** Editar sets × reps inline
- [ ] **AC-5:** Deletar exercício (swipe left)
- [ ] **AC-6:** Reordenar exercícios (long-press + drag)
- [ ] **AC-7:** Salvar programa para aluno específico
- [ ] **AC-8:** Carregar draft salvo localmente ao reabrir
- [ ] **AC-9:** Buscar exercício com query (MIN_QUERY_LENGTH=2)
- [ ] **AC-10:** Filtrar exercícios por grupo muscular
- [ ] **AC-11:** Atribuir programa a aluno via StudenDetail → "Atribuir Programa"
- [ ] **AC-12:** Validações (min 1 workout, min 1 item, sets/reps válidos)

### 9.2 UX/Interação

- [ ] **AC-13:** Haptic feedback em gestos principais (tap, swipe, drag)
- [ ] **AC-14:** Animações suaves (scale, fade, slide) via reanimated
- [ ] **AC-15:** Feedback visual de loading durante salvamento
- [ ] **AC-16:** Confirmação visual antes de deletar workout
- [ ] **AC-17:** Auto-scroll para aba atual em WorkoutTabBar

### 9.3 Persistência

- [ ] **AC-18:** Draft salvo localmente (MMKV) a cada mudança
- [ ] **AC-19:** Draft carregado ao reabrir app
- [ ] **AC-20:** Draft descartado após sucesso de salvamento

### 9.4 Integração

- [ ] **AC-21:** Navega corretamente de StudentDetail
- [ ] **AC-22:** Programa finalizado visível em StudentDetail
- [ ] **AC-23:** Sem erros console em fluxo principal

---

## 10. Considerações Técnicas

### 10.1 Performance
- **Store immer:** Mutações fáceis + imutabilidade automática
- **Reordenação:** Usar `Animated.createAnimatedComponent` para scroll suave
- **Picker:** Limitar 5 resultados + lazy load em v2
- **MMKV:** Serializar apenas draft, não todo state

### 10.2 Errors Handling
- Validar constraints localmente antes de Supabase
- Retry automático em salvamento falhado?
- User-friendly messages em português
- Manter draft em caso de falha

### 10.3 Segurança (RLS)
- Garantir que `studentId` pertence ao treinador (RLS check)
- Não expor `owner_id` de exercício na resposta
- Validar `program_id` ao carregar

### 10.4 Escalabilidade
- **v1:** Single program per flow (novo programa)
- **v2:** Reutilizar programa existente (template)
- **v2:** Duplicar programa
- **v2:** Histórico de versões

---

## 11. Sequência de Implementação

### Fase 1: Core Store + Tipos (Dia 1)
1. `program-builder-store.ts` com Zustand + immer
2. Tipos em `types/program-builder.ts`
3. MMKV persistência

### Fase 2: UI Principal (Dias 2-3)
4. `mobile/app/program-builder/index.tsx`
5. `WorkoutTabBar.tsx`
6. Navegação em `_layout.tsx`

### Fase 3: Editor de Workout (Dias 3-4)
7. `mobile/app/program-builder/[workoutId].tsx`
8. `WorkoutItemRow.tsx`
9. Swipe + delete logic

### Fase 4: Picker de Exercício (Dia 5)
10. `ExercisePickerModal.tsx`
11. Integração com `useExerciseLibrary`
12. Busca + filtro

### Fase 5: Inline Editing (Dia 5)
13. `SetRepsInput.tsx`
14. Validações

### Fase 6: Hook + Supabase (Dia 6)
15. `useProgramBuilder.ts`
16. Save to student logic
17. Error handling

### Fase 7: Integração + QA (Dia 7)
18. Wire StudentDetail button
19. Testes e1e
20. Refinamento UX

---

## 12. Exemplo: Fluxo de Reordenação Completo

```typescript
// WorkoutEditorScreen
const [isReordering, setIsReordering] = useState(false);
const animValue = useSharedValue(0);

const handleLongPress = (itemId: string) => {
  setIsReordering(true);
  animValue.value = withTiming(1);
  haptics.medium();
};

const handleDragEnd = (newOrder: WorkoutItem[]) => {
  store.reorderWorkoutItems(currentWorkoutId, newOrder);
  animValue.value = withTiming(0);
  setIsReordering(false);
  haptics.success();
};

return (
  <DraggableFlatList
    data={currentWorkout.items}
    keyExtractor={(item) => item.id}
    onDragEnd={({ data }) => handleDragEnd(data)}
    renderItem={({ item, drag, isActive }) => (
      <WorkoutItemRow
        item={item}
        isReordering={isActive}
        onLongPress={isReordering ? () => drag() : () => handleLongPress(item.id)}
      />
    )}
  />
);
```

---

## 13. Dependências Externas

### NPM
- `zustand` (já existe)
- `immer` (já existe)
- `react-native-mmkv` (já existe)
- `react-native-reanimated` (já existe)
- `expo-haptics` (já existe)
- `react-native-gesture-handler` (verif. compatibilidade)

### Supabase
- Tabelas: `programs`, `program_assignments` (criadas em migration)
- RLS: Policies para treinador + aluno

### Componentes Internos
- `PressableScale` (existing)
- `BottomSheet` (existing ou usar `react-native-bottom-sheet`)
- `useExerciseLibrary` (extend)

---

## 14. Roadmap Futuro (v2+)

- [ ] Templates de programa (ex: "Força", "Hipertrofia")
- [ ] Histórico de versões
- [ ] Feedback de exercício (form submission)
- [ ] Notas de progresso por aluno
- [ ] Comparação: programa planejado vs realizado
- [ ] Exportar para PDF
- [ ] Compartilhar entre treinadores

---

## 15. Referências e Links

- **Web builder:** `web/components/trainer/program-builder-client.tsx`
- **Exercício hook:** `mobile/hooks/useExerciseLibrary.ts`
- **Store pattern:** `mobile/stores/training-room-store.ts`
- **Animações:** `mobile/lib/animations.ts`
- **RLS docs:** https://supabase.com/docs/guides/auth/row-level-security

---

**Próximas Passos:**
1. Aprovação desta especificação
2. Criar migration para tabelas `programs` e `program_assignments`
3. Iniciar implementação Fase 1

