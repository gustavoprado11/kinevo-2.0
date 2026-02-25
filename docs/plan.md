# Plano de Implementacao — Sala de Treino (Training Room)

## Visao Geral

Criar uma nova secao `/training-room` no dashboard web do treinador, onde ele pode conduzir sessoes de treino presenciais para multiplos alunos simultaneamente. Os dados serao salvos nas mesmas tabelas que o app mobile (`workout_sessions` + `set_logs`), garantindo transparencia total no historico do aluno.

---

## 1. Arquitetura de Estado (Frontend)

### Problema
Multiplos alunos treinando ao mesmo tempo, cada um com seu cronometro, exercicios, series e dados. Se o treinador der F5, tudo se perde.

### Solucao: Zustand + `persist` (localStorage)

**Por que Zustand (e nao Context ou Redux):**
- O projeto web hoje usa apenas `useState` — nao ha state management global
- Zustand e minimalista (~1KB), sem boilerplate, e o `persist` middleware salva no localStorage automaticamente
- Context re-renderiza toda a arvore; Zustand e seletivo por subscriber
- Multiplos "slices" de treino isolados por `studentId` dentro de um unico store

**Estrutura do Store:**

```typescript
interface TrainingRoomStore {
  // Sala ativa
  sessions: Record<string, ActiveSession>  // chave = `student_id`
  activeStudentId: string | null           // tab atualmente visivel

  // Acoes
  addStudent(studentId: string, data: SessionSetupData): void
  removeStudent(studentId: string): void    // descarte sem salvar
  setActiveStudent(studentId: string): void

  // Acoes de treino (operam no activeStudentId)
  startWorkout(studentId: string): void
  updateSet(studentId: string, exerciseIndex: number, setIndex: number, data: Partial<SetData>): void
  toggleSetComplete(studentId: string, exerciseIndex: number, setIndex: number): void
  swapExercise(studentId: string, exerciseIndex: number, newExercise: ExerciseOption): void
}

interface ActiveSession {
  studentId: string
  studentName: string
  studentAvatarUrl: string | null

  // Dados do treino
  assignedWorkoutId: string
  assignedProgramId: string
  workoutName: string
  exercises: ExerciseData[]          // Mesma interface do mobile

  // Timing
  status: 'ready' | 'in_progress' | 'finishing'
  startedAt: number | null           // Date.now() timestamp

  // Rest timer
  restTimerEnd: number | null
  restTimerDuration: number | null
}

// Reutilizadas do mobile (mesma interface):
interface ExerciseData {
  id: string                          // assigned_workout_item_id
  planned_exercise_id: string
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  video_url?: string
  substitute_exercise_ids: string[]
  swap_source: 'none' | 'manual' | 'auto'
  setsData: WorkoutSetData[]
  previousLoad?: string
}

interface WorkoutSetData {
  weight: string
  reps: string
  completed: boolean
}
```

**Persistencia:** O middleware `persist` do Zustand salva o store inteiro no `localStorage` a cada mudanca. Se o treinador der F5:
- As sessoes, cronometros e dados de series sao restaurados
- O `startedAt` e um timestamp absoluto, entao o cronometro continua correto
- Um banner "Sessao restaurada" aparece ao recarregar com sessoes ativas

**Dependencia nova:** `zustand` (unica adicao ao `package.json` do web)

---

## 2. Proposta de UI/UX

### Layout: Tabs horizontais (alunos) + Painel central de treino

```
+------------------------------------------------------------------+
| SALA DE TREINO                          [+ Adicionar Aluno]      |
+------------------------------------------------------------------+
| [Avatar] Joao  * | [Avatar] Maria | [Avatar] Pedro              |  <- Tabs
+------------------------------------------------------------------+
|                                                                   |
|  Treino A — Superiores               Cronometro: 32:15           |
|  +------------------------------------------------------------+  |
|  | 1. Supino Reto           Carga anterior: 80kg              |  |
|  |    Serie 1: [80]kg  [12]reps  [v]                          |  |
|  |    Serie 2: [80]kg  [10]reps  [v]    Descanso: 1:23        |  |
|  |    Serie 3: [  ]kg  [  ]reps  [ ]                          |  |
|  |                                             [Trocar]        |  |
|  |------------------------------------------------------------+  |
|  | 2. Desenvolvimento       Carga anterior: 30kg              |  |
|  |    Serie 1: [  ]kg  [  ]reps  [ ]                          |  |
|  |    ...                                                      |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  [Descartar Treino]                         [Concluir Treino]    |
+------------------------------------------------------------------+
```

### Decisoes de UX

**Por que Tabs (e nao side-by-side ou cards expansiveis):**
- Side-by-side limita a 2 alunos e comprime o conteudo
- Cards expansiveis exigem scroll e escondem informacao
- Tabs permitem N alunos com area de treino 100% visivel
- O indicador verde na tab mostra quais treinos estao em andamento
- Troca de aluno em 1 clique

**Fluxo de adicionar aluno:**
1. Treinador clica em "+ Adicionar Aluno"
2. Modal abre com busca/lista de alunos ativos do treinador
3. Ao selecionar, busca o programa ativo e o treino do dia
4. Se nao houver treino agendado para hoje, mostra todos os treinos do programa para escolha manual
5. Aluno aparece como nova tab — status "ready"

**Fluxo do treino:**
1. Treinador clica "Iniciar Treino" -> cronometro comeca, status = `in_progress`
2. Preenche peso/reps serie a serie (mesma logica de waterfall do mobile)
3. Marca serie completa com checkbox -> rest timer inicia
4. Pode trocar exercicio (modal com sugestoes manuais/auto/busca)
5. Ao finalizar -> modal de feedback (RPE + texto) -> salva -> remove da sala
6. "Descartar" -> confirmacao -> remove sem salvar

**Pagina `/training-room` na sidebar:**
- Novo item de navegacao com icone `Monitor` (lucide)
- Badge com contagem de alunos ativos quando > 0

---

## 3. Paridade de Dados (Backend)

### O Problema de RLS

Hoje, o banco tem estas policies:
- `workout_sessions`: trainer = SELECT only; student = ALL
- `set_logs`: trainer = SELECT only; student = ALL

O treinador **nao pode inserir** sessoes/set_logs via Supabase client-side. Isso e correto por seguranca.

### Solucao: Server Action com `supabaseAdmin`

Criaremos um server action `finishTrainingRoomWorkout()` que:
1. Recebe o payload do frontend (exercicios, series, timing, RPE)
2. Valida que o treinador e dono do aluno (`students.coach_id = trainer.id`)
3. Insere em `workout_sessions` e `set_logs` usando `supabaseAdmin` (bypassa RLS)
4. O payload segue **exatamente** o mesmo schema que o mobile

### Payload de Conclusao (identico ao mobile)

```typescript
interface FinishWorkoutPayload {
  // Contexto
  studentId: string
  assignedWorkoutId: string
  assignedProgramId: string
  trainerId: string

  // Sessao
  startedAt: string              // ISO timestamp
  durationSeconds: number
  rpe: number | null             // 1-10
  feedback: string | null

  // Series (apenas as completas)
  setLogs: Array<{
    assignedWorkoutItemId: string
    plannedExerciseId: string
    executedExerciseId: string
    swapSource: 'none' | 'manual' | 'auto'
    exerciseId: string
    setNumber: number            // 1-indexed
    weight: number
    repsCompleted: number
    weightUnit: 'kg'
  }>
}
```

### Mapeamento para DB (server action)

**workout_sessions INSERT:**
```
student_id       = payload.studentId
trainer_id       = payload.trainerId
assigned_workout_id = payload.assignedWorkoutId
assigned_program_id = payload.assignedProgramId
status           = 'completed'
started_at       = payload.startedAt
completed_at     = NOW()
duration_seconds = payload.durationSeconds
rpe              = payload.rpe
feedback         = payload.feedback
sync_status      = 'synced'
```

**set_logs INSERT (batch):**
```
workout_session_id     = session.id
assigned_workout_item_id = log.assignedWorkoutItemId
planned_exercise_id    = log.plannedExerciseId
executed_exercise_id   = log.executedExerciseId
swap_source            = log.swapSource
exercise_id            = log.exerciseId
set_number             = log.setNumber
weight                 = log.weight
reps_completed         = log.repsCompleted
is_completed           = true
completed_at           = NOW()
weight_unit            = log.weightUnit
```

**Resultado:** Os dados sao indistinguiveis de um treino feito pelo aluno no mobile.

### Server Actions Necessarias

| Action | Descricao |
|--------|-----------|
| `getTrainingRoomStudents()` | Lista alunos ativos do treinador (nome, avatar, programa ativo) |
| `getStudentTodayWorkout(studentId)` | Retorna treino do dia + exercicios + historico de cargas |
| `getStudentWorkoutOptions(studentId)` | Lista todos os treinos do programa ativo (para escolha manual) |
| `getExerciseSubstitutes(exerciseId)` | Sugestoes de troca (reusa RPCs existentes) |
| `searchExerciseSubstitutes(exerciseId, query)` | Busca de exercicio para troca |
| `finishTrainingRoomWorkout(payload)` | Salva sessao + set_logs (descrito acima) |

---

## 4. Faseamento

### Fase 1 — Fundacao (MVP Funcional para 1 aluno)

**Escopo:** Treinador consegue abrir 1 aluno, ver o treino do dia, lancar series e concluir.

**Entregaveis:**
1. Instalar `zustand` e criar o store basico `useTrainingRoomStore`
2. Rota `/training-room` com layout e item na sidebar
3. Server action `getTrainingRoomStudents()` — lista de alunos
4. Modal de selecao de aluno (busca + treino do dia)
5. Server action `getStudentTodayWorkout()` — exercicios + cargas anteriores
6. UI de treino: exercise cards, inputs de peso/reps, checkbox de serie completa
7. Logica de waterfall (preencher series seguintes automaticamente)
8. Cronometro geral (elapsed time)
9. Server action `finishTrainingRoomWorkout()` — salvar sessao + set_logs
10. Modal de feedback (RPE + texto) ao finalizar
11. Botao "Descartar Treino" com confirmacao

**Validacao:** Treinar 1 aluno pelo web e verificar que o historico aparece no app mobile identico a um treino feito no celular.

### Fase 2 — Multi-aluno + Persistencia

**Escopo:** Suporte a multiplos alunos simultaneos com persistencia contra F5.

**Entregaveis:**
1. Habilitar `persist` middleware no Zustand (localStorage)
2. Sistema de tabs para alternar entre alunos
3. Badge na sidebar com contagem de sessoes ativas
4. Banner "Sessao restaurada" ao recarregar com sessoes ativas
5. Indicadores visuais nas tabs (em andamento, pronto para finalizar)
6. Teste com 3+ alunos simultaneos

### Fase 3 — Rest Timer + Troca de Exercicio

**Escopo:** Features de acompanhamento durante o treino.

**Entregaveis:**
1. Rest timer com countdown visual ao completar serie (usa `rest_seconds` do exercicio)
2. Modal de troca de exercicio (sugestoes manuais + auto + busca)
3. Server actions para substitutes (reusa RPCs `get_smart_substitutes`)
4. Confirmacao ao trocar exercicio com series ja preenchidas
5. Tracking de `swap_source` no set_log

### Fase 4 — Polish + Edge Cases

**Escopo:** Refinamento de UX e tratamento de cenarios incomuns.

**Entregaveis:**
1. Selecao manual de treino quando nao ha treino agendado para hoje
2. Visualizacao do "ultimo treino feito" do aluno antes de iniciar
3. Protecao de navegacao (warn ao sair da pagina com treinos ativos)
4. Animacao de conclusao
5. Responsividade para telas menores
6. Limpar sessoes expiradas no localStorage (> 24h)

---

## 5. Resumo de Arquivos por Fase

### Fase 1
```
web/package.json                               # + zustand

web/src/app/training-room/
  page.tsx                                      # Server component (auth + redirect)
  training-room-client.tsx                      # Client component principal

web/src/components/training-room/
  student-picker-modal.tsx                      # Modal de selecao de aluno
  exercise-card.tsx                             # Card de exercicio com series
  set-row.tsx                                   # Linha de serie (peso/reps/check)
  workout-feedback-modal.tsx                    # Modal RPE + feedback
  workout-timer.tsx                             # Cronometro elapsed

web/src/stores/
  training-room-store.ts                        # Zustand store

web/src/actions/training-room/
  get-training-room-students.ts                 # Lista alunos
  get-student-today-workout.ts                  # Treino do dia + cargas
  finish-training-room-workout.ts               # Salvar sessao

web/src/components/layout/sidebar.tsx           # + item "Sala de Treino"
```

### Fase 2 (adicoes)
```
web/src/components/training-room/
  student-tabs.tsx                              # Tabs de alunos
  session-restored-banner.tsx                   # Banner de restauracao
```

### Fase 3 (adicoes)
```
web/src/components/training-room/
  rest-timer.tsx                                # Countdown de descanso
  exercise-swap-modal.tsx                       # Modal de troca

web/src/actions/training-room/
  get-exercise-substitutes.ts                   # Sugestoes de troca
  search-exercise-substitutes.ts                # Busca de exercicio
```

### Fase 4 (adicoes)
```
web/src/components/training-room/
  workout-picker-modal.tsx                      # Escolha manual de treino
  last-workout-summary.tsx                      # Resumo do ultimo treino
```

---

## 6. Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Treinador fecha aba com treinos ativos | Zustand persist + `beforeunload` warning |
| localStorage cheio (raro, ~5MB limit) | Limpar sessoes > 24h automaticamente |
| Treinador salva treino duplicado (duplo clique) | Desabilitar botao durante submit + idempotency check |
| Aluno treina no mobile ao mesmo tempo que treinador lanca no web | Treinos independentes — ambos geram sessoes separadas (comportamento aceitavel) |
| RLS impede trainer de inserir dados | Server action com `supabaseAdmin` (ja planejado) |

---

## 7. Nao-escopos (para futuras versoes)

- Real-time sync entre web e mobile (ex: aluno ve ao vivo o que treinador lanca)
- Video call integrado na sala
- Timer de intervalo global (ex: circuito com todos os alunos)
- Relatorio pos-sessao gerado automaticamente
- Historico de sessoes da sala de treino (quem treinou, quando)
