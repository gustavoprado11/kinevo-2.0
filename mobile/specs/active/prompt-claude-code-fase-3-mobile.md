# Prompt — Fase 3: Mobile (fluxo novo completo)

> Copie e cole o bloco abaixo em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`.

---

Essa é a **Fase 3 de 4** — e a maior — da unificação da prescrição IA no mobile. Aqui você implementa o fluxo novo inteiro no app mobile: hook de agente, sheets, integração no builder, consolidação dos action buttons, redirect de deep link.

## Prerequisitos

**Todos os três precisam estar deployados / mergeados antes:**
1. **Fase 1 (Shared)** — `shared/lib/prescription/builder-mapper.ts` e `shared/lib/prescription/snapshot-from-draft.ts` precisam existir e estar exportados em `shared/index.ts`.
2. **Fase 2a (Web analyze + generate)** — `POST /api/prescription/analyze` tem que existir e responder; `POST /api/prescription/generate` tem que aceitar `agentState`.
3. **Fase 2b (Web assign)** — `POST /api/programs/assign` tem que aceitar `outputSnapshot` + `isEdited: true`.

Antes de começar, valide via curl (ou pelo `.env` de dev) que os três endpoints estão live. Se algum estiver indisponível, **pare** e avise o dev.

## Spec

Leia por inteiro: `mobile/specs/active/unificacao-prescricao-ia-mobile.md`. Essa fase corresponde à seção "Estratégia de execução → Fase 3" e às entradas "(Fase 3)" em "Arquivos Afetados" + "Critérios de Aceite" + "Regras especiais" + "Edge Cases".

## Contexto

- Mobile é Expo 54 / React Native 0.81.5, Expo Router 6, NativeWind 4, Reanimated 3, Lucide icons, Haptics, Expo SecureStore. Store: Zustand + MMKV persist.
- Mobile chama web por HTTP: `fetch(${EXPO_PUBLIC_WEB_URL}/api/...)` com `Authorization: Bearer <session.access_token>`. Padrão em `mobile/app/student/[id]/prescribe.tsx` (tela que você vai REMOVER) e `mobile/hooks/useTrainerPlans.ts`.
- Edge Function `supabase/functions/parse-workout-text/` é fonte do parse-text (suporta `superset_group`). **NÃO mexer nela.** O mobile continua usando-a via `supabase.functions.invoke('parse-workout-text', ...)`.
- Web é a fonte da verdade comportamental. Ao implementar a state machine do mobile, use `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts` como referência **exata**.
- `V1 NÃO inclui seleção de formulários do aluno** na anamnese — sempre envie `selectedFormIds: []` para o analyze/generate. (Incremento futuro.)

## Trabalho

### Leia antes de codar
- `mobile/CLAUDE.md` — convenções.
- `mobile/app/program-builder/index.tsx` — builder atual.
- `mobile/stores/program-builder-store.ts` — `ProgramDraft`, `initFromParsedText`.
- `mobile/hooks/useProgramBuilder.ts` — `saveAndAssign` atual.
- `mobile/app/student/[id].tsx` — action buttons atuais.
- `mobile/app/student/[id]/prescribe.tsx` — tela que vai sumir.
- `mobile/components/trainer/student/TextPrescriptionSheet.tsx` — sheet que vai reposicionar (o UI/contrato dele não muda, só o lugar que abre).
- `mobile/components/trainer/prescription/PrescriptionProfileForm.tsx` — vai ser reusado na anamnese.
- `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts` — referência da state machine.
- `web/src/components/programs/ai-prescription-panel/student-tab.tsx` — referência visual da anamnese + perguntas (note: a versão mobile **não** replica a seleção de formulários; só o form de perfil + perguntas).
- `web/src/components/programs/program-builder-client.tsx` — referência do botão IA no header e dos sheets.

### 1. `mobile/lib/ai-prescription/fetch-client.ts` (novo)

Funções puras que encapsulam o fetch HTTP:

```ts
// pseudo-ts
export async function analyzeContext(studentId: string, selectedFormIds: string[]): Promise<AnalyzeContextResult>
export async function generateProgram(studentId: string, agentState: PrescriptionAgentState, selectedFormIds: string[]): Promise<GenerateProgramResponse>
export async function assignProgram(body: AssignProgramBody): Promise<AssignProgramResponse>
```

- Cada função obtém o access_token via `supabase.auth.getSession()`. Se ausente, lança `Error('Sessão expirada')`.
- Faz `fetch(${process.env.EXPO_PUBLIC_WEB_URL}/api/...)` com `Authorization: Bearer <token>` e `Content-Type: application/json`.
- Centraliza tradução de status → erro com mensagens pt-BR:
  - 401 → "Sessão expirada. Faça login novamente."
  - 403 → "Sem permissão para essa ação."
  - 429 → "Limite de gerações atingido. Tente novamente mais tarde."
  - 400 → usa a mensagem do body se existir, senão "Requisição inválida."
  - 5xx/outros → "Erro inesperado. Tente novamente."
- Retorna tipos de `@kinevo/shared`. **Nunca** `any`.

### 2. `mobile/hooks/useAIPrescriptionAgent.ts` (novo)

Espelho fiel de `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts`.

**State:**
- `pageState: 'anamnese' | 'analyzing' | 'questions' | 'generating' | 'done' | 'error'`
- `profile: StudentPrescriptionProfile` (tipo de shared)
- `agentState: PrescriptionAgentState | null`
- `questions: AgentQuestion[]`
- `answers: Record<string, AgentAnswer>`
- `error: string | null`
- `result: { generationId, outputSnapshot } | null`

**Actions:**
- `setProfile(update: Partial<StudentPrescriptionProfile>)`
- `setAnswer(questionId: string, answer: AgentAnswer)`
- `startAnalysis()` — seta `analyzing`, chama `analyzeContext(studentId, [])`. Em sucesso: se `questions.length === 0`, chama `generate` imediatamente; senão seta `questions`. Em erro: `error` state.
- `submitAnswersAndGenerate()` — seta `generating`, monta `agentState` com `answers`, chama `generateProgram`. Em sucesso: seta `result` e `pageState='done'`. Em erro: `error` state com mensagem. Haptic Success on ok, Error on fail.
- `skipQuestionsAndGenerate()` — mesmo que submit, mas com `answers: {}` (ou o que o agente aceita como "skip").
- `reset()` — volta tudo ao default.

**Assinatura:**
```ts
function useAIPrescriptionAgent(
  studentId: string,
  options: { onSuccess: (result: { generationId: string, outputSnapshot: PrescriptionOutputSnapshot }) => void }
): { ...state, ...actions }
```

### 3. `mobile/components/trainer/program-builder/AgentQuestionsStep.tsx` (novo)

UI para renderizar `AgentQuestion[]`:
- `single_choice` → RadioGroup (botões verticais, o selecionado fica `bg-primary`).
- `multi_choice` → Checkboxes (múltiplos selecionáveis).
- `text` → TextInput multiline.
- Botão **"Pular perguntas"** sempre visível no rodapé (outlined).
- Botão **"Gerar programa"** primário no rodapé (disabled enquanto nenhuma resposta dada — ou habilitado sempre e a lógica de "pular" é só não mandar `answers`).

Props: `{ questions, answers, onAnswer(id, value), onSubmit(), onSkip(), isLoading }`.

### 4. `mobile/components/trainer/program-builder/AIPrescriptionSheet.tsx` (novo)

Bottom sheet completo com 5 steps controlado pelo `pageState` do hook.

- Padrão visual: siga `TextPrescriptionSheet` para consistência (Modal RN com `animationType="slide"` ou `@gorhom/bottom-sheet` — use o que `TextPrescriptionSheet` já usa).
- Props: `{ visible: boolean, studentId: string, onClose: () => void, onSuccess: (result) => void }`.
- Instancia `useAIPrescriptionAgent(studentId, { onSuccess })`.
- Step `anamnese`: `PrescriptionProfileForm` + botão "Analisar". **Sem FormSelector.**
- Step `analyzing`: spinner + "Analisando contexto..."
- Step `questions`: `AgentQuestionsStep`.
- Step `generating`: spinner + "Gerando programa..."
- Step `done`: card com resumo (nome do programa, número de treinos, número total de exercícios), botão "Usar geração" (primário) e "Descartar" (outlined). "Usar geração" chama `onSuccess(result)` e fecha o sheet.
- Step `error`: mensagem + "Tentar novamente" (volta pro step anterior) + "Fechar".
- Haptics: `Light` nas transições, `Success` no `done`, `Error` no `error`.

### 5. `mobile/components/trainer/program-builder/AIPrescriptionMenu.tsx` (novo)

Menu acionado pelo botão "IA" do header do builder.

- Em iOS: `ActionSheetIOS.showActionSheetWithOptions`.
- Em Android: `Alert.alert` com botões.
- Itens:
  1. "Gerar programa completo" — só se `aiEnabled === true`. Abre `AIPrescriptionSheet`.
  2. "Colar texto de treino" — abre `TextPrescriptionSheet`.
  3. "Selecionar programa existente" — abre `AssignProgramWizard`.
  4. "Cancelar" — default dismiss.

### 6. `mobile/stores/program-builder-store.ts` (editar)

- Adicionar ao `ProgramDraft`:
  - `generationId: string | null`
  - `originatedFromAi: boolean`
  - `originalSnapshot: PrescriptionOutputSnapshot | null`
- Nova action `initFromAiSnapshot(studentId: string, builderData: BuilderProgramData, generationId: string, originalSnapshot: PrescriptionOutputSnapshot)`:
  - Popula `workouts` a partir do `builderData` (converte `workout_templates` → `workouts` com `exercises[]` preservando `sets`, `reps`, `rest_seconds`, `notes`).
  - Seta `studentId`, `mode: 'from-ai'` (ou similar — adicione ao union type se não existir), `generationId`, `originatedFromAi: true`, `originalSnapshot`.
  - Persiste no MMKV (já persistido pelo middleware, só confirme que os novos campos estão no schema de persist).
- `reset()` limpa os três novos campos (`null`, `false`, `null`).

### 7. `mobile/hooks/useProgramBuilder.ts` (editar)

- `saveAndAssign(studentId)`:
  - Ler do store: `draft`, `generationId`, `originatedFromAi`, `workouts`.
  - Se `originatedFromAi === false`: comportamento atual (chama `assignProgram` sem `outputSnapshot`).
  - Se `originatedFromAi === true`:
    - `try { snapshot = buildSnapshotFromDraft(draft) }` (do `@kinevo/shared`).
    - `catch (e) { if (e instanceof SupersetInSnapshotError) return { error: 'SUPERSET_BLOCKED' } }` — retorna um resultado especial que a UI trata.
    - Chama `assignProgram({ studentId, generationId, outputSnapshot: snapshot, isEdited: true })`.
- Expor no hook um helper `saveAsNewProgramDiscardingAi()` — limpa `generationId`, `originatedFromAi`, `originalSnapshot` do store e chama `saveAndAssign` de novo (agora sem o path de IA).

### 8. `mobile/app/program-builder/index.tsx` (editar)

- Header: adicionar botão "IA" (Lucide `Sparkles`, roxo) ao lado do "Salvar". `disabled={studentId == null}`. Ao tocar, abre `AIPrescriptionMenu`. Haptic `Medium`.
- Estados locais: `showAIMenu`, `showAISheet`, `showTextSheet`, `showAssignWizard`.
- Renderize ao final do JSX: `AIPrescriptionMenu`, `AIPrescriptionSheet`, `TextPrescriptionSheet`, `AssignProgramWizard`.
- **Handler `handleAIGenerateTap`** (disparado por "Gerar programa completo" no menu):
  - Se `draft.originatedFromAi === true`: `Alert.alert("Substituir programa gerado?", "Isso descartará o programa atual e gerará um novo. Continuar?", [{ text: "Cancelar", style: "cancel" }, { text: "Substituir", style: "destructive", onPress: () => { store.reset(); setShowAISheet(true); } }])`.
  - Senão: `setShowAISheet(true)` direto.
- `onSuccess` do `AIPrescriptionSheet`:
  - `const builderData = mapAiOutputToBuilderData(result.outputSnapshot)` (de `@kinevo/shared/lib/prescription/builder-mapper`).
  - `store.initFromAiSnapshot(studentId, builderData, result.generationId, result.outputSnapshot)`.
  - `setShowAISheet(false)`. Haptic Success.
- Query param `mode=ai` no mount: se presente e `studentId` presente, abrir `AIPrescriptionSheet` automaticamente. Se `studentId` ausente, exibir toast "Selecione um aluno para gerar via IA" e não abrir.
- Handler para "Colar texto de treino": `setShowTextSheet(true)`. O `TextPrescriptionSheet` já trata tudo, só mudou o local de onde abre.
- Handler para "Selecionar programa existente": `setShowAssignWizard(true)`. Wizard atual, sem mudanças.
- `handleSave` (ou como se chame o handler do botão "Salvar"):
  - Chama `saveAndAssign(studentId)`.
  - Se retornar `{ error: 'SUPERSET_BLOCKED' }`, disparar `Alert.alert`:
    ```
    Título: "Supersets não suportados"
    Mensagem: "O snapshot de IA não suporta supersets. Remova os supersets adicionados ou salve como programa novo (sem vincular à geração)."
    Botões:
      - "Cancelar" (style: cancel)
      - "Remover supersets" — fecha alert, usuário volta ao builder.
      - "Salvar como programa novo" (style: destructive) — chama saveAsNewProgramDiscardingAi().
    ```
  - Se sucesso, comportamento atual (navega de volta, toast "Programa atribuído", etc.).

### 9. `mobile/app/student/[id].tsx` (editar)

- Remover os action buttons "Prescrever por Texto" e "Prescrever IA".
- Renomear "Atribuir Programa" para **"Prescrever"**.
- Handler único `handleOpenBuilder`: sempre navega para `/program-builder?studentId=...`. Expo Router resolve modo novo/resume com base no draft MMKV.
- Remover `handlePrescribe`, `handleTextPrescription`, `handleAssignProgram` na forma atual.
- Remover imports de `TextPrescriptionSheet`, `AssignProgramWizard` da tela do aluno (eles agora vivem dentro do builder).
- Verificar visualmente: a tela do aluno deve ter **3 action buttons** (Sala de Treino, Prescrever, Conversar) — não 5.

### 10. `mobile/app/student/[id]/prescribe.tsx` (substituir por redirect stub)

- Substitua o conteúdo atual por um componente minimal:
  ```tsx
  import { useEffect } from 'react';
  import { useLocalSearchParams, router } from 'expo-router';

  export default function PrescribeRedirect() {
    const { id } = useLocalSearchParams<{ id: string }>();
    useEffect(() => {
      router.replace({ pathname: '/program-builder', params: { studentId: id, mode: 'ai' } });
    }, [id]);
    return null;
  }
  ```

### 11. Testes

Unitários com Vitest (já configurado no mobile):
- `mobile/hooks/__tests__/useAIPrescriptionAgent.test.ts`:
  - Transições `anamnese → analyzing → questions → generating → done` com mocks de fetch.
  - `skipQuestionsAndGenerate` transita direto para `generating`.
  - Erro no `analyze` coloca `pageState='error'`.
- `mobile/stores/__tests__/program-builder-store.test.ts` (adicionar casos):
  - `initFromAiSnapshot` popula `workouts`, `generationId`, `originatedFromAi`, `originalSnapshot`.
  - `reset` limpa todos os três campos novos.
- `mobile/hooks/__tests__/useProgramBuilder.test.ts` (adicionar casos):
  - `saveAndAssign` com `originatedFromAi: true` e sem supersets envia `isEdited: true` + `outputSnapshot`.
  - `saveAndAssign` com `originatedFromAi: true` e draft contendo supersets retorna `{ error: 'SUPERSET_BLOCKED' }` sem fazer fetch.
  - `saveAndAssign` com `originatedFromAi: false` mantém comportamento atual (sem `outputSnapshot`).

Mocks esperados:
- `supabase.auth.getSession()` retornando session válida.
- `global.fetch` mockado para os três endpoints.
- `buildSnapshotFromDraft` real (do shared).
- `mapAiOutputToBuilderData` real.

### 12. Verificação final

- `cd mobile && npx tsc --noEmit` → zero novos erros vs `main`.
- `cd mobile && npx vitest run hooks/useAIPrescriptionAgent.test.ts stores/program-builder-store.test.ts hooks/useProgramBuilder.test.ts` → verde.
- Abra o app (iOS Simulator ou device) e valide manualmente:
  - [ ] Tela do aluno: 3 action buttons.
  - [ ] "Prescrever" abre o builder.
  - [ ] Botão "IA" no header abre menu com 3 opções (ou 2 se `aiEnabled === false`).
  - [ ] Fluxo IA completa: anamnese → analisar → perguntas → gerar → builder populado → editar → salvar → confirmar no DB que `assigned_program` tem a edição.
  - [ ] Fluxo texto para treino: mesmo caminho pelo menu → cola → gera → builder populado.
  - [ ] Fluxo programa existente: wizard abre normalmente.
  - [ ] Deep link `/student/<id>/prescribe` redireciona para `/program-builder?studentId=<id>&mode=ai`.
  - [ ] Criar um draft AI, adicionar superset, tentar salvar → Alert "Supersets não suportados" com 3 opções; "Salvar como programa novo" funciona.
  - [ ] Gerar IA com draft já AI existente → Alert "Substituir programa gerado?"; "Substituir" limpa e abre sheet.
  - [ ] Desligar `aiEnabled`: "Gerar programa completo" some do menu.
  - [ ] Simular 429 no `/api/prescription/generate`: mensagem clara.
  - [ ] Kill/reopen do app no meio de um draft AI: MMKV restaura e save envia `isEdited: true` normalmente.

### 13. Preencher "Notas de Implementação" na spec

Ao fim, edite `mobile/specs/active/unificacao-prescricao-ia-mobile.md` e preencha a seção "Notas de Implementação" com:
- Arquivos tocados agrupados por workspace.
- Comandos para rodar localmente (iOS/Android, testes).
- Variáveis de ambiente (nenhuma nova — confirme que `EXPO_PUBLIC_WEB_URL` já está setado).
- Checklist de validação manual (os bullets da seção 12).
- Decisões não-óbvias (ex: como tratou `mode=ai` no query param, como cuidou de supersets, como lidou com MMKV migration para os campos novos — se existir).

## Restrições

- **Fases 1, 2a e 2b precisam estar deployadas.** Se os endpoints não existirem ou a função compartilhada não estiver disponível, pare.
- **Não toque em `web/`, `shared/` nem em `supabase/functions/`.** Tudo que você precisa já foi criado nas fases anteriores.
- **Não use `any`.** Tipos de `@kinevo/shared`.
- **Sentence case em pt-BR.** "Gerar programa completo", não "Gerar Programa Completo".
- **Só Lucide para ícones.** Sem emojis, sem ícones de outras libs.
- **Haptics em transições.** `Medium` ao abrir menu, `Light` nas transições de step, `Success` ao receber geração, `Error` em falha.
- **Não use `Animated` base do RN.** Reanimated ou `animationType="slide"` do `Modal`.
- **MMKV persistence** deve incluir os novos campos (`generationId`, `originatedFromAi`, `originalSnapshot`). Confirme olhando o schema de persist.
- **`TextPrescriptionSheet` não muda de contrato** — só de local onde abre.
- **Não crie nova rota** — tudo é sheet dentro do builder existente.
- **Backward compat com draft antigo**: se o MMKV tem um draft pré-deploy (sem os novos campos), a hidratação deve defaultar `generationId: null`, `originatedFromAi: false`, `originalSnapshot: null`. Não crashe.

## Entregáveis finais

1. Arquivos novos: `fetch-client.ts`, `useAIPrescriptionAgent.ts`, `AIPrescriptionSheet.tsx`, `AIPrescriptionMenu.tsx`, `AgentQuestionsStep.tsx`.
2. Arquivos editados: `program-builder-store.ts`, `useProgramBuilder.ts`, `program-builder/index.tsx`, `student/[id].tsx`, `student/[id]/prescribe.tsx` (agora stub).
3. Todos os testes passando.
4. `tsc --noEmit` limpo.
5. Seção "Notas de Implementação" da spec preenchida.
6. Resumo final em bullets:
   - Arquivos tocados (agrupados).
   - Decisões não-óbvias (superset handling, substituição, MMKV migration).
   - Comandos para rodar/testar.
   - Rollback plan: a mudança é opt-in via campos novos na request; se algo quebrar em prod, um feature flag (ou revert do commit mobile) volta o comportamento antigo porque o web permanece backward compat.

Quando terminar, **não crie PR ou commit** — deixe as mudanças locais para o dev revisar.
