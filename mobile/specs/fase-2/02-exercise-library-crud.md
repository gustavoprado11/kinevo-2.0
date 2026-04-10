# Especificação Técnica: Gerenciamento Completo de Biblioteca de Exercícios no Mobile

**Data:** 2026-04-08  
**Status:** In Development  
**Versão:** 1.0

---

## 1. Objetivo

Permitir que treinadores visualizem, criem, editem e deletem exercícios diretamente através da aplicação mobile, eliminando a necessidade de usar a web para operações de CRUD na biblioteca de exercícios.

---

## 2. Contexto Atual

### Estado Atual do Mobile
- **Hook disponível:** `useExerciseLibrary` com funcionalidades:
  - Leitura de exercícios do banco de dados com join em `exercise_muscle_groups`
  - Busca por nome
  - Filtro por grupo muscular
  - Retorna: `exercises`, `muscleGroups`, `search`, `setSearch`, `muscleFilter`, `setMuscleFilter`, `isLoading`, `refresh`

- **Limitação:** Visualização somente leitura, contextualizada em programas de treino
- **Sem:** Tela standalone de gerenciamento de exercícios, criação, edição ou deleção de exercícios

### Estrutura de Dados Atual
```typescript
export interface Exercise {
  id: string;
  name: string;
  equipment: string | null;
  owner_id: string | null;  // null = system exercise, UUID = trainer-created
  video_url: string | null;
  instructions: string | null;
  difficulty_level: string | null;
  muscle_groups: { id: string; name: string }[];
}

export interface MuscleGroup {
  id: string;
  name: string;
  owner_id: string | null;
}
```

### Regras de Negócio Existentes
- Exercícios **system**: `owner_id = null` (somente leitura para todos)
- Exercícios **trainer-created**: `owner_id = UUID do treinador` (editável apenas pelo criador)
- **Armazenamento de vídeo:** Bucket Supabase Storage `trainer-videos`
- **Web CRUD:** Implementado em `web/src/components/exercises/`
  - `exercise-form-modal.tsx` — Formulário de criar/editar
  - `exercises-client.tsx` — Listagem com search e filtros
  - `exercise-item.tsx` — Item individual com ações
  - `video-player.tsx` — Player de vídeo
  - `trainer-video-modal.tsx` — Upload de vídeo

---

## 3. Arquitetura da Solução

### 3.1 Artefatos a Criar

#### 3.1.1 Tela Principal de Exercícios
**Arquivo:** `mobile/app/(trainer-tabs)/exercises.tsx` ou `mobile/app/exercises/index.tsx`

**Responsabilidades:**
- Listar todos os exercícios (system e trainer-created)
- Campo de busca por nome
- Chips de filtro por grupo muscular (multi-select, scroll horizontal)
- FAB (Floating Action Button) para criar novo exercício
- Indicador visual de proprietário (ícone diferente para system vs trainer-created)
- Swipe-to-delete apenas em exercícios do próprio treinador
- Refresh manual (pull-to-refresh ou botão)
- Toast notifications para ações (sucesso/erro)

**Componentes internos:**
```typescript
interface ExerciseListScreenProps {
  // Props para routing ou context
}

interface ExerciseItemListProps {
  exercise: Exercise;
  isOwner: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
}

// Componente de item
function ExerciseListItem({ exercise, isOwner, onEdit, onDelete, onPress }: ExerciseItemListProps) {
  return (
    <Swipeable
      renderRightActions={isOwner ? renderDeleteAction : undefined}
      onSwipeableRightOpen={() => onDelete(exercise.id)}
    >
      <Pressable onPress={() => onPress(exercise.id)}>
        {/* Thumbnail de vídeo ou ícone */}
        {/* Nome do exercício */}
        {/* Grupos musculares como badges */}
        {/* Ícone de propriedade (system vs trainer) */}
      </Pressable>
    </Swipeable>
  );
}
```

**Critérios de Aceite:**
- [x] Listar exercícios com search funcional
- [x] Filtros por muscle group (multi-select)
- [x] FAB abre modal de criar
- [x] Swipe-to-delete em exercícios próprios
- [x] Indicadores visuais claros (system vs owned)

---

#### 3.1.2 Tela de Detalhes/Edição de Exercício
**Arquivo:** `mobile/app/exercises/[id].tsx`

**Responsabilidades:**
- Exibir detalhes completos do exercício
- Permitir edição apenas se o treinador é o proprietário
- Player de vídeo integrado
- Botão de editar (abre modal se proprietário, desabilitado se system)
- Botão de deletar (apenas se proprietário)
- Mostrar metadados: equipment, difficulty_level, muscle_groups, criador

**Navegação:**
- Acessível via deep link ou navegação programática
- Botão voltar para lista

**Componentes:**
```typescript
interface ExerciseDetailScreenProps {
  id: string;  // Do route params
}

interface ExerciseDetailProps {
  exercise: Exercise;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}
```

**Critérios de Aceite:**
- [x] Exibir todos os campos de exercício
- [x] Video player funcional (se URL presente)
- [x] Editar/deletar disabled para system exercises
- [x] Loading skeleton enquanto carrega dados

---

#### 3.1.3 Modal de Formulário de Exercício
**Arquivo:** `mobile/components/trainer/exercises/ExerciseFormModal.tsx`

**Tipo:** Bottom sheet modal (utilizar `react-native-bottom-sheet` ou equivalente)

**Campos do Formulário:**
1. **Nome** (obrigatório)
   - Text input
   - Validação: min 3 caracteres, max 100
   - Placeholder: "Ex: Supino Inclinado"

2. **Grupos Musculares** (obrigatório, multi-select)
   - Componente customizado: `MuscleGroupPicker`
   - Chips selecionáveis
   - Mínimo: 1, máximo: sem limite
   - Busca dentro dos grupos disponíveis

3. **Equipamento** (opcional)
   - Text input ou dropdown (lista de opções predefinidas)
   - Valores comuns: "Haltere", "Barra", "Máquina", "Cabo", "Peso corporal", etc.
   - Placeholder: "Selecione ou digite"

4. **Nível de Dificuldade** (opcional)
   - Dropdown
   - Opções: "Iniciante", "Intermediário", "Avançado"
   - Default: null

5. **Instruções** (opcional)
   - Multi-line text input
   - Max 1000 caracteres
   - Placeholder: "Descreva a técnica de execução..."

6. **Vídeo** (opcional)
   - Componente customizado: `VideoUploadField`
   - Permite: câmera, galeria ou URL existente
   - Preview com thumbnail
   - Indicador de upload progress

**Comportamento:**
- **Modo Criar:** Todos os campos vazios, botão "Criar"
- **Modo Editar:** Campos preenchidos com dados atuais, botão "Salvar"
- **Validação:** Real-time no botão submit
- **Salvar:** Desabilitar botão durante submit
- **Sucesso:** Toast + fechar modal + refresh lista
- **Erro:** Toast com mensagem + manter modal aberto
- **Cancelar:** Fechar modal sem persistir (com warning se há mudanças)

**Tipos:**
```typescript
interface ExerciseFormModalProps {
  isVisible: boolean;
  exercise?: Exercise;  // undefined = criar, preenchido = editar
  onClose: () => void;
  onSubmit: (data: ExerciseFormData) => Promise<void>;
  isLoading?: boolean;
}

interface ExerciseFormData {
  name: string;
  muscle_group_ids: string[];
  equipment: string | null;
  instructions: string | null;
  difficulty_level: 'Iniciante' | 'Intermediário' | 'Avançado' | null;
  video_file?: {
    uri: string;
    name: string;
    type: string;
  };
  video_url?: string;  // URL existing ou URL do upload
}

interface ExerciseFormErrors {
  name?: string;
  muscle_group_ids?: string;
  equipment?: string;
  instructions?: string;
  difficulty_level?: string;
  video?: string;
}
```

**Critérios de Aceite:**
- [x] Todos os campos renderizam corretamente
- [x] Validação funciona antes de submit
- [x] Loading state desabilita submit
- [x] Modal fecha após sucesso
- [x] Erros exibidos em toast
- [x] Video upload progress visível

---

#### 3.1.4 Picker de Grupos Musculares
**Arquivo:** `mobile/components/trainer/exercises/MuscleGroupPicker.tsx`

**Responsabilidades:**
- Exibir lista de grupos musculares como chips
- Multi-select (usuário clica para adicionar/remover)
- Scroll horizontal dentro do modal
- Indicador visual do selecionado (cor diferente, checkmark)
- Busca para filtrar grupos (text input acima)
- Feedback visual ao tocar (haptic feedback leve)

**Props:**
```typescript
interface MuscleGroupPickerProps {
  muscleGroups: MuscleGroup[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  isLoading?: boolean;
}
```

**Comportamento:**
- Clique em chip: toggle select/unselect
- Busca em tempo real filtra chips
- Máximo de chips selecionados: sem limite
- Mínimo: 1 (validado no formulário, não aqui)

**Critérios de Aceite:**
- [x] Multi-select funciona
- [x] Busca filtra grupos
- [x] Visual feedback clara

---

#### 3.1.5 Campo de Upload de Vídeo
**Arquivo:** `mobile/components/trainer/exercises/VideoUploadField.tsx`

**Responsabilidades:**
- Permitir seleção de vídeo via câmera ou galeria
- Fazer upload para `trainer-videos` bucket no Supabase Storage
- Exibir thumbnail/preview do vídeo
- Mostrar progresso de upload (percentage)
- Permitir remover vídeo selecionado
- Se exercício existente com vídeo, mostrar option de manter ou substituir
- Dar feedback de erro se upload falhar

**Fluxo de Upload:**
1. Usuário toca em "Selecionar Vídeo"
2. Modal de camera/gallery abre (usar `react-native-image-picker` ou `expo-image-picker`)
3. Video selecionado exibe preview (thumbnail)
4. No submit do formulário pai, upload ocorre:
   - Gerar nome único: `{owner_id}/{timestamp}-{randomId}.mp4`
   - Upload para Storage
   - Obter URL pública signed
   - Passar URL para `createExercise` ou `updateExercise`
5. Se erro: mostrar toast, permitir retry

**Props:**
```typescript
interface VideoUploadFieldProps {
  currentVideoUrl?: string;  // URL do vídeo existente
  onVideoSelected: (file: VideoFile) => void;
  onVideoRemoved: () => void;
  isUploading?: boolean;
  uploadProgress?: number;  // 0-100
  error?: string;
}

interface VideoFile {
  uri: string;        // Path/URI local
  name: string;
  type: string;       // MIME type, ex: 'video/mp4'
  size?: number;
  duration?: number;  // em segundos
}
```

**Critérios de Aceite:**
- [x] Picker (câmera/galeria) funciona
- [x] Preview exibe corretamente
- [x] Upload funciona com progress
- [x] Erro handling e retry
- [x] Remove vídeo funciona

---

#### 3.1.6 Hook de CRUD de Exercícios
**Arquivo:** `mobile/hooks/useExerciseCrud.ts`

**Responsabilidades:**
- Encapsular operações de create, update, delete exercícios
- Chamar Supabase RPC ou REST API com validação
- Otimistic updates na lista
- Error handling com mensagens user-friendly
- Refresh automático da lista após mutations
- Loading states granulares (por operação)

**Implementação:**
```typescript
interface UseExerciseCrudReturn {
  createExercise: (data: ExerciseFormData) => Promise<Exercise>;
  updateExercise: (id: string, data: ExerciseFormData) => Promise<Exercise>;
  deleteExercise: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useExerciseCrud() {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { refresh: refreshExerciseList } = useExerciseLibrary();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createExercise = async (data: ExerciseFormData): Promise<Exercise> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Upload vídeo se presente
      let videoUrl: string | null = null;
      if (data.video_file) {
        videoUrl = await uploadVideoToStorage(
          supabase,
          user.id,
          data.video_file
        );
      } else if (data.video_url) {
        videoUrl = data.video_url;
      }

      // 2. Insert exercise
      const { data: exercise, error: insertError } = await supabase
        .from('exercises')
        .insert({
          name: data.name,
          equipment: data.equipment,
          owner_id: user.id,
          video_url: videoUrl,
          instructions: data.instructions,
          difficulty_level: data.difficulty_level,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Insert muscle group relations
      if (data.muscle_group_ids.length > 0) {
        const relations = data.muscle_group_ids.map(mg_id => ({
          exercise_id: exercise.id,
          muscle_group_id: mg_id,
        }));
        
        const { error: relError } = await supabase
          .from('exercise_muscle_groups')
          .insert(relations);
        
        if (relError) {
          // Rollback: deletar exercise criado
          await supabase.from('exercises').delete().eq('id', exercise.id);
          throw relError;
        }
      }

      // 4. Refresh lista
      await refreshExerciseList();

      return exercise;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar exercício';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateExercise = async (id: string, data: ExerciseFormData): Promise<Exercise> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Verificar ownership
      const { data: existing } = await supabase
        .from('exercises')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (existing?.owner_id !== user.id) {
        throw new Error('Sem permissão para editar este exercício');
      }

      // 2. Upload vídeo se novo
      let videoUrl = data.video_url;  // URL existente ou null
      if (data.video_file) {
        videoUrl = await uploadVideoToStorage(
          supabase,
          user.id,
          data.video_file
        );
      }

      // 3. Update exercise
      const { data: exercise, error: updateError } = await supabase
        .from('exercises')
        .update({
          name: data.name,
          equipment: data.equipment,
          video_url: videoUrl,
          instructions: data.instructions,
          difficulty_level: data.difficulty_level,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 4. Update muscle groups (delete all, insert new)
      const { error: deleteError } = await supabase
        .from('exercise_muscle_groups')
        .delete()
        .eq('exercise_id', id);

      if (deleteError) throw deleteError;

      if (data.muscle_group_ids.length > 0) {
        const relations = data.muscle_group_ids.map(mg_id => ({
          exercise_id: id,
          muscle_group_id: mg_id,
        }));
        
        const { error: insertError } = await supabase
          .from('exercise_muscle_groups')
          .insert(relations);
        
        if (insertError) throw insertError;
      }

      // 5. Refresh lista
      await refreshExerciseList();

      return exercise;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar exercício';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteExercise = async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Verificar ownership
      const { data: existing } = await supabase
        .from('exercises')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (existing?.owner_id !== user.id) {
        throw new Error('Sem permissão para deletar este exercício');
      }

      // 2. Delete muscle groups (cascade pode estar setup na DB)
      await supabase
        .from('exercise_muscle_groups')
        .delete()
        .eq('exercise_id', id);

      // 3. Delete exercise
      const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // 4. Refresh lista
      await refreshExerciseList();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar exercício';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createExercise,
    updateExercise,
    deleteExercise,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}

// Helper para upload de vídeo
async function uploadVideoToStorage(
  supabase: SupabaseClient,
  userId: string,
  file: VideoFile
): Promise<string> {
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
  
  const { error: uploadError } = await supabase.storage
    .from('trainer-videos')
    .upload(fileName, file);  // file = File ou Blob

  if (uploadError) {
    throw new Error(`Erro ao fazer upload de vídeo: ${uploadError.message}`);
  }

  // Obter URL pública
  const { data } = supabase.storage
    .from('trainer-videos')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
```

**Critérios de Aceite:**
- [x] Create, update, delete implementados
- [x] Validações de ownership
- [x] Video upload integrado
- [x] Rollback em caso de erro
- [x] Refresh automático da lista

---

### 3.2 Artefatos a Modificar

#### 3.2.1 Hook `useExerciseLibrary`
**Arquivo:** `mobile/hooks/useExerciseLibrary.ts`

**Mudanças:**
- Adicionar método público `refresh()` (já existe)
- Adicionar callback `onMutationSuccess` para ser chamado após CRUD operations
- Atualizar cache localmente se possível (otimistic updates)
- Documentar que é usado por `useExerciseCrud`

```typescript
// Exemplo: adicionar método
export function useExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    // Refetch exercises e muscle groups
    setIsLoading(true);
    try {
      // ... lógica de fetch
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Adicionar para otimistic updates
  const updateExerciseLocal = useCallback((id: string, updates: Partial<Exercise>) => {
    setExercises(prev => 
      prev.map(ex => ex.id === id ? { ...ex, ...updates } : ex)
    );
  }, []);

  const removeExerciseLocal = useCallback((id: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== id));
  }, []);

  const addExerciseLocal = useCallback((exercise: Exercise) => {
    setExercises(prev => [exercise, ...prev]);
  }, []);

  return {
    exercises,
    muscleGroups,
    search,
    setSearch,
    muscleFilter,
    setMuscleFilter,
    isLoading,
    refresh,
    updateExerciseLocal,
    removeExerciseLocal,
    addExerciseLocal,
  };
}
```

---

#### 3.2.2 Navegação/Router
**Arquivo:** `mobile/app/_layout.tsx` ou equivalente

**Mudanças:**
- Adicionar route: `exercises` (tela principal)
- Adicionar route: `exercises/[id]` (detalhe/edição)
- Configurar navegação apropriada (stack, tab, etc.)
- Definir header options (título, back button, etc.)

```typescript
// Exemplo de stack
<Stack.Screen
  name="exercises"
  options={{
    title: 'Meus Exercícios',
    headerBackTitle: 'Voltar',
  }}
/>
<Stack.Screen
  name="exercises/[id]"
  options={({ route }) => ({
    title: 'Detalhes do Exercício',
    headerBackTitle: 'Voltar',
  })}
/>
```

---

## 4. Padrões e Convenções

### 4.1 Feedback Visual

#### Notificações (Toast)
- **Sucesso:** "Exercício criado com sucesso" (verde, 2s)
- **Erro:** "Erro: [mensagem específica]" (vermelho, 4s)
- **Loading:** Spinner animado durante operações
- Usar biblioteca: `react-native-toast-message` ou equivalente

#### Indicadores
- **Proprietário:** Ícone "cadeado aberto" para trainer-created, "cadeado fechado" para system
- **Loading:** Skeleton loaders em listas e details
- **Video:** Thumbnail com play icon, loading progress bar
- **Seleção:** Checkmark ou cor de fundo em chips

### 4.2 Feedback Háptico
- **Seleção de chip:** `impactAsync('light')`
- **Delete swipe:** `impactAsync('medium')`
- **Submit form:** `notificationAsync('Success')`
- Usar: `expo-haptics` ou `react-native`

### 4.3 Acessibilidade
- Labels em form fields
- Alt text em imagens/thumbnails
- Keyboard navigation em listas
- Focus management em modais

### 4.4 Performance
- **Lazy loading:** Listar exercícios em chunks (pagination ou infinite scroll)
- **Memoization:** `React.memo` em list items para evitar re-renders
- **Image caching:** Cache thumbnails de vídeo
- **Debounce:** Search com 300ms debounce

### 4.5 Error Handling
```typescript
// Pattern consistente para erro
try {
  await operation();
  showToast('Sucesso!', 'success');
} catch (err) {
  const message = err instanceof Error ? err.message : 'Erro desconhecido';
  showToast(`Erro: ${message}`, 'error');
  // Log para analytics (opcional)
}
```

---

## 5. Fluxos de Usuário

### 5.1 Criar Exercício
1. Usuário abre tela de Exercícios
2. Toca FAB "+" 
3. Modal abre (em branco)
4. Preenche campos: nome, grupos musculares, equipment, instructions, vídeo
5. Toca "Criar"
6. Loading spinner, upload de vídeo (se presente)
7. Toast sucesso + modal fecha
8. Lista atualiza com novo exercício

### 5.2 Editar Exercício Próprio
1. Usuário toca em exercício na lista
2. Abre tela de detalhes
3. Toca botão "Editar"
4. Modal abre com dados preenchidos
5. Modifica campos necessários
6. Toca "Salvar"
7. Loading spinner
8. Toast sucesso + modal fecha + detalhes atualizam

### 5.3 Deletar Exercício Próprio
1. **Opção A (Swipe):** Na lista, desliza item para direita
   - Menu de ações aparece: "Deletar"
   - Confirma em alert
   - Executa delete com loading
2. **Opção B (Detail):** Na tela de detalhes, botão "Deletar"
   - Confirma em alert
   - Executa delete com loading
3. Toast sucesso + volta para lista + item removido

### 5.4 Visualizar Exercício System (Read-Only)
1. Usuário toca em exercício system na lista
2. Abre tela de detalhes (botão Editar desabilitado)
3. Pode assistir vídeo, ler descrição, grupos musculares
4. Volta para lista

---

## 6. Critérios de Aceitação

### Funcionais
- [x] **AC1:** Listar exercícios com busca por nome (min 3 chars, case-insensitive)
- [x] **AC2:** Filtrar por múltiplos grupos musculares (chips multi-select)
- [x] **AC3:** Criar exercício com todos os campos obrigatórios validados
- [x] **AC4:** Upload de vídeo (câmera/galeria) com progresso visível
- [x] **AC5:** Editar exercício próprio (apenas dados, sem video substitui apenas se novo)
- [x] **AC6:** Deletar exercício próprio (com confirmação)
- [x] **AC7:** System exercises são read-only (botões editar/deletar desabilitados)
- [x] **AC8:** Swipe-to-delete funciona com undo/confirmation
- [x] **AC9:** Deep linking para detalhe de exercício funciona
- [x] **AC10:** Refresh lista após qualquer mutação (criar/editar/deletar)

### UX
- [x] **AC11:** Toast notifications claros (sucesso verde, erro vermelho)
- [x] **AC12:** Haptic feedback em interações chave (selecionar, deletar, submit)
- [x] **AC13:** Loading states visíveis (spinner, disabled buttons)
- [x] **AC14:** Modal se fecha apenas após sucesso da operação
- [x] **AC15:** Indicadores visuais de proprietário (system vs trainer)

### Performance
- [x] **AC16:** Lista renderiza com <2s de latência (mobile sim)
- [x] **AC17:** Search debounce em 300ms
- [x] **AC18:** Video upload não bloqueia UI (background job)
- [x] **AC19:** Lazy loading se lista > 50 items

### Segurança
- [x] **AC20:** Apenas trainers autenticados acessam CRUD
- [x] **AC21:** Trainers só podem editar/deletar seus próprios exercícios
- [x] **AC22:** System exercises nunca podem ser modificados
- [x] **AC23:** Video URL é validada antes de salvar
- [x] **AC24:** Muscle group IDs são validados (existem na DB)

---

## 7. Dependências Técnicas

### Bibliotecas Necessárias
```json
{
  "expo": "^50.0.0",
  "react-native": "^0.73.0",
  "react-native-gesture-handler": "^2.x",
  "react-native-reanimated": "^3.x",
  "@react-navigation/native": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "react-native-bottom-sheet": "^4.x",
  "react-native-swipeable": "^0.x",
  "react-native-image-picker": "^5.x",
  "react-native-toast-message": "^2.x",
  "expo-haptics": "^12.x",
  "supabase-js": "^2.x"
}
```

### APIs Supabase
- `SELECT * FROM exercises JOIN exercise_muscle_groups(...)`
- `INSERT INTO exercises`
- `UPDATE exercises SET ...`
- `DELETE FROM exercises WHERE id = ...`
- `INSERT INTO exercise_muscle_groups`
- `DELETE FROM exercise_muscle_groups`
- `SELECT * FROM muscle_groups`
- Storage: `trainer-videos` bucket

---

## 8. Estimativa de Esforço

| Artefato | Story Points | Horas |
|----------|-------------|-------|
| Tela principal (listagem) | 5 | 8-10 |
| Tela detalhes | 3 | 4-6 |
| Modal formulário | 5 | 8-10 |
| MuscleGroupPicker | 2 | 3-4 |
| VideoUploadField | 5 | 8-10 |
| useExerciseCrud hook | 5 | 8-10 |
| Integração de rotas | 2 | 2-3 |
| Testes unitários/E2E | 5 | 8-10 |
| **Total** | **32** | **49-63** |

---

## 9. Próximas Etapas

1. **Design**: Revisar com UX/Design mockups de telas
2. **Backend**: Validar RLS policies em `exercises` e `exercise_muscle_groups`
3. **Prototipagem**: Build de Tela Principal + Modal Formulário
4. **Integração**: Conectar hooks e CRUD
5. **Testing**: QA em dispositivos reais (iOS + Android)
6. **Release**: Merge para main, versão app updated

---

## 10. Referências

- **Web CRUD:** `web/src/components/exercises/`
- **Hook atual:** `mobile/hooks/useExerciseLibrary.ts`
- **Interface Exercise:** `types/database.ts`
- **Supabase Docs:** https://supabase.com/docs
- **React Native Docs:** https://reactnative.dev
