# Unificação da Prescrição IA no App Mobile do Treinador

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Recentemente no **web** a prescrição com IA foi unificada ao program builder. O treinador não tem mais uma tela isolada "Prescrever com IA": o ponto de entrada é o builder, e dentro dele existem dois caminhos de IA acessíveis em painéis laterais:

1. **IA completa (agentiva)** — anamnese → análise de contexto → perguntas conversacionais → geração → resultado hidrata o builder como rascunho editável.
2. **Texto para Treino** — o treinador cola um texto livre de treino, a IA identifica os exercícios do catálogo, e o resultado é inserido no builder ativo.

Em ambos os casos o treinador continua dentro do builder e pode editar antes de salvar. O fluxo antigo `/students/[id]/prescribe` foi substituído por um `permanentRedirect(308)` para o builder com `?mode=ai`.

No **mobile** hoje está fragmentado e divergente:

- `app/student/[id]/prescribe.tsx` é uma **tela isolada** com formulário → preview read-only → "Aprovar" (salva direto, pulando o builder). Sem edição posterior, sem anamnese agentiva, sem perguntas.
- `TextPrescriptionSheet` (parse-text) já cai no builder com `mode="from-text"`, então esse caminho já está parcialmente alinhado.
- Os action buttons na tela do aluno expõem três entry points separados: **Atribuir Programa**, **Prescrever por Texto** e **Prescrever IA**.

Essa fragmentação gera inconsistência entre plataformas, impede o treinador de refinar o resultado da IA antes de atribuir, e duplica entry points.

### Posture de segurança existente (importante)

O endpoint `POST /api/programs/assign` atualmente **ignora explicitamente** qualquer `outputSnapshot` que o cliente mande no body. O comentário em `assign-from-snapshot.ts` (Fase 2.5.4 §5) documenta isso como uma decisão intencional: a fonte da verdade é `prescription_generations.output_snapshot` no banco, re-fetchada server-side a partir do `generationId`. Essa postura impede que um cliente malicioso injete exercícios ou volume arbitrário.

Qualquer mudança nesse endpoint precisa preservar a propriedade de segurança: o treinador autenticado só pode editar uma geração que lhe pertence, e o snapshot editado precisa passar por validação de shape e de catálogo de exercícios antes de ser persistido.

## Objetivo

Espelhar 1:1 a unificação do web no mobile: o **Program Builder é o hub**, a IA (completa e por texto) vive dentro dele como painéis/sheets, o resultado sempre hidrata o builder para edição, e o treinador salva manualmente via `saveAndAssign`. Consolidar os três action buttons em um único **"Prescrever"** que abre o builder.

## Estratégia de execução — faseada em 4 PRs

Por causa do escopo (web + shared + mobile) e da mudança de postura de segurança em `assign-from-snapshot.ts`, a entrega é dividida em quatro PRs independentes. Cada fase é autocontida, verde em `tsc` e testes, e não deixa o sistema em estado inconsistente.

| Fase | Escopo | Dependências |
|------|--------|--------------|
| **Fase 1 — Shared** | `mapAiOutputToBuilderData` movido para `shared/`, novo `buildSnapshotFromDraft`, testes unitários. | Nenhuma. |
| **Fase 2a — Web: analyze + generate** | Novo `POST /api/prescription/analyze`, extensão do `POST /api/prescription/generate` para aceitar `agentState`. Backward compat total. | Fase 1 (opcional — analyze/generate não usam o mapper). |
| **Fase 2b — Web: assign com snapshot editado** | Extensão cirúrgica de `POST /api/programs/assign` + `assign-from-snapshot.ts` para aceitar `outputSnapshot` + `isEdited: true`. Reavalia a decisão de Fase 2.5.4 §5. | Fase 1 (para tipos compartilhados). |
| **Fase 3 — Mobile** | Todo o fluxo novo no mobile: hook, sheets, store extension, builder integration, consolidação dos action buttons, redirect de deep link. | Fases 1, 2a e 2b deployadas. |

Cada fase tem seu próprio prompt para o Claude Code, com prerequisitos explícitos. **Fase 2b carrega um aviso de segurança no topo** pedindo que o executor releia o comentário em `assign-from-snapshot.ts` antes de escrever código.

## Escopo

### Incluído

**Web (mudanças mínimas para viabilizar o mobile):**
- Expor a state machine agentiva via HTTP:
  - Criar `POST /api/prescription/analyze` — thin wrapper sobre `analyzeStudentContext` (server action).
  - Estender `POST /api/prescription/generate` para aceitar `agentState` opcional no body (hoje ignora e gera direto); manter backward compat quando ausente.
- Aceitar programa editado em `POST /api/programs/assign`:
  - Novo campo opcional `outputSnapshot: PrescriptionOutputSnapshot` no body.
  - Novo campo `isEdited: boolean` (default `false`). Quando `true`, usar o snapshot enviado ao invés de re-fetchar do DB — **após validação rigorosa** (ver Restrições Técnicas).
- Mover `mapAiOutputToBuilderData` de `web/src/lib/prescription/builder-mapper.ts` para `shared/lib/prescription/builder-mapper.ts` (função pura, sem mudança de comportamento). Manter re-export no web para zero breakage.

**Mobile:**
- Consolidar os três action buttons em um único **"Prescrever"** na tela `app/student/[id].tsx`. "Atribuir Programa" se torna um submenu acessível de dentro do builder (selecionar existente). "Prescrever por Texto" e "Prescrever IA" deixam de ser action buttons.
- Reestruturar o header do program builder para incluir o botão "IA" que abre um menu com:
  - **"Gerar programa completo"** — abre bottom sheet de IA agentiva (novo).
  - **"Colar texto de treino"** — abre `TextPrescriptionSheet` (já existe, só reposicionar).
  - **"Selecionar programa existente"** — abre o wizard já existente (`AssignProgramWizard`).
- Criar bottom sheet novo `AIPrescriptionSheet` que reproduz o fluxo do web `AiPrescriptionPanelStudentTab`:
  1. Anamnese (reaproveitar `PrescriptionProfileForm`). **Sem seleção de formulários do aluno no V1** (ver Excluído).
  2. Análise (loading) → chama `POST /api/prescription/analyze`.
  3. Perguntas (single_choice / multi_choice / text) com opção "Pular perguntas".
  4. Geração (loading) → chama `POST /api/prescription/generate` com `agentState`.
  5. Confirmação ("Usar geração") → hidrata o builder e fecha o sheet.
- Criar hook `useAIPrescriptionAgent` no mobile que espelha a state machine do web (`use-prescription-agent.ts`), consumindo as duas APIs HTTP via `fetch(${EXPO_PUBLIC_WEB_URL}/api/prescription/*)`.
- Após "Usar geração", chamar `mapAiOutputToBuilderData(snapshot)` (do `shared/`) e popular `program-builder-store` via nova action `initFromAiSnapshot(studentId, builderProgramData)`.
- Ao salvar o programa editado no builder, chamar `POST /api/programs/assign` com `{ studentId, generationId, outputSnapshot: <editado>, isEdited: true }`. A função `saveAndAssign` do `useProgramBuilder` precisa receber `generationId` e o snapshot atualizado do store.
- Remover a tela `app/student/[id]/prescribe.tsx` e adicionar um redirect (Expo Router não tem `permanentRedirect` como Next, então fazer `useEffect` + `router.replace('/program-builder?studentId=...&mode=ai')`) para preservar deep links antigos.
- Remover o action button "Prescrever por Texto" e "Prescrever IA" da tela do aluno. O botão "Atribuir Programa" vira **"Prescrever"** e leva ao builder (modo `resume` ou `new` conforme draft existente).
- Atualizar `useStudentDetail.aiEnabled` para seguir sendo a flag de gating (usada no item do menu "Gerar programa completo").

### Excluído
- **Seleção de formulários do aluno na anamnese (V1)**. O mobile envia `selectedFormIds: []` para `/api/prescription/analyze` e `/api/prescription/generate`. Motivo: o seletor do web é rico (lista formulários preenchidos, filtra por data) e replicá-lo fielmente em sheet mobile adiciona ~1 dia de trabalho sem impacto crítico na geração (o prompt funciona sem formulários, só fica menos contextualizado). **Incremento futuro**: adicionar `FormSelector` no sheet, possivelmente como segundo step depois da anamnese.
- Nenhuma mudança visual no program builder além da adição do botão "IA" no header e dos sheets.
- Nenhuma mudança na Edge Function `parse-workout-text` (continua sendo a fonte — é superior ao route do web pois suporta `superset_group`).
- Nenhuma mudança no fluxo do aluno (tabs `(tabs)`).
- Nenhuma migração de banco.
- Streaming real-time da geração (continua sendo chamada HTTP única).
- Progressive reveal dos treinos (animação do web via `usePrescriptionGenerationStream`) — opcional para fase futura.
- Qualquer mudança no web além dos três pontos listados em "Incluído → Web".
- Reset de senha do aluno (já foi entregue em spec anterior).

## Arquivos Afetados

### Web — criar
- `shared/lib/prescription/builder-mapper.ts` — `mapAiOutputToBuilderData` movido de `web/src/lib/prescription/builder-mapper.ts`. (Fase 1)
- `web/src/app/api/prescription/analyze/route.ts` — POST. Bearer JWT, body `{ studentId, selectedFormIds? }`. Delega para `analyzeStudentContext`. Retorna o mesmo `AnalyzeContextResult`. (Fase 2a)

### Web — editar
- `web/src/lib/prescription/builder-mapper.ts` — vira `export { mapAiOutputToBuilderData } from '@kinevo/shared/lib/prescription/builder-mapper'` (re-export) para manter imports existentes. (Fase 1)
- `web/src/app/api/prescription/generate/route.ts` — aceitar `agentState?: PrescriptionAgentState` e `selectedFormIds?: string[]` no body e repassar para `generateProgram`. Se ausentes, comportamento atual (backward compat). (Fase 2a)
- `web/src/app/api/programs/assign/route.ts` — aceitar `outputSnapshot?: PrescriptionOutputSnapshot` e `isEdited?: boolean`. Quando `isEdited === true && outputSnapshot`, persistir `assigned_program` usando o snapshot fornecido (validar ownership e consistência — ver Restrições Técnicas). (Fase 2b)
- `web/src/actions/prescription/assign-from-snapshot.ts` (ou arquivo equivalente onde vive a lógica de assign) — aceitar `outputSnapshot?: PrescriptionOutputSnapshot` vindo do caller. Atualizar o comentário de Fase 2.5.4 §5 para refletir a nova decisão (cliente pode enviar snapshot editado **desde que** passe pela validação). (Fase 2b)

### Mobile — criar
- `mobile/hooks/useAIPrescriptionAgent.ts` — espelho de `use-prescription-agent.ts`. Não importa do web; consome APIs HTTP. (Fase 3)
- `mobile/components/trainer/program-builder/AIPrescriptionSheet.tsx` — bottom sheet com 5 steps (anamnese/analyzing/questions/generating/done). (Fase 3)
- `mobile/components/trainer/program-builder/AIPrescriptionMenu.tsx` — menu contextual (ActionSheetIOS/Alert) disparado pelo botão "IA" no header do builder com as três opções. (Fase 3)
- `mobile/lib/ai-prescription/fetch-client.ts` — wrapper de `fetch` com `Authorization: Bearer <token>` e `EXPO_PUBLIC_WEB_URL`. Funções: `analyzeContext`, `generateProgram`, `assignProgram`. Todas puras (sem state), retornando tipos compartilhados. (Fase 3)
- `mobile/components/trainer/program-builder/AgentQuestionsStep.tsx` — UI das perguntas agentivas (single_choice via RadioGroup, multi_choice via Checkbox, text via TextInput). Botão "Pular perguntas" sempre visível. (Fase 3)

### Mobile — editar
- `mobile/app/student/[id].tsx` (Fase 3):
  - Remover action buttons "Prescrever por Texto" e "Prescrever IA".
  - Renomear "Atribuir Programa" para **"Prescrever"** e simplificar `handleAssignProgram` para sempre abrir o builder (modo `new` se não houver draft; resume se houver draft para o mesmo `studentId`). A escolha "selecionar existente vs criar novo" passa a ser feita dentro do builder.
  - Remover `handlePrescribe` (tela isolada) e `handleTextPrescription` (sheet standalone), ambas migradas para dentro do builder.
- `mobile/app/program-builder/index.tsx` (Fase 3):
  - Adicionar botão "IA" (Sparkles, roxo) no header ao lado de "Salvar". Disabled se `studentId == null` (template mode).
  - Adicionar estados `showAIMenu`, `showAISheet`, `showTextSheet`, `showAssignWizard`.
  - Renderizar `AIPrescriptionMenu`, `AIPrescriptionSheet`, `TextPrescriptionSheet` e `AssignProgramWizard` no fim do JSX.
  - Ao receber resultado da IA completa: `initFromAiSnapshot(studentId, builderProgramData, generationId)` e fechar sheet.
  - Ao receber resultado do parse-text: `initFromParsedText(studentId, parsedWorkouts)` (já existe, só reconectar).
  - Ao receber programa selecionado: comportamento atual do wizard (atribui direto sem builder — manter como exceção explícita).
  - `saveAndAssign` passa a enviar `outputSnapshot` + `generationId` + `isEdited: true` quando o draft originou de IA.
- `mobile/stores/program-builder-store.ts` (Fase 3):
  - Nova action `initFromAiSnapshot(studentId: string, builderData: BuilderProgramData, generationId: string)` que popula o draft convertendo `workout_templates` → `workouts` (mesma estrutura interna de `initFromParsedText`, mas preservando `sets`, `reps`, `rest_seconds`, `notes` do snapshot).
  - Novo campo opcional no draft: `generationId: string | null`, `originatedFromAi: boolean`, `originalSnapshot: PrescriptionOutputSnapshot | null`. Persistido no MMKV junto com o resto.
- `mobile/hooks/useProgramBuilder.ts` (Fase 3):
  - `saveAndAssign` passa a ler `generationId`, `originatedFromAi` e o estado atual do draft. Quando `originatedFromAi === true`, reconstruir `outputSnapshot` a partir do `workouts[]` atual (função auxiliar pura `buildSnapshotFromDraft(draft): PrescriptionOutputSnapshot`) e enviar no body do `/api/programs/assign`.
  - **Comportamento de supersets** (ver Comportamento Esperado): se `originatedFromAi === true` e o draft contém supersets adicionados manualmente, bloquear o save e disparar diálogo de escolha.

### Mobile — remover
- `mobile/app/student/[id]/prescribe.tsx` — deletar arquivo. Adicionar uma rota stub que apenas redireciona (ver Edge Cases). (Fase 3)

### Shared — criar
- `shared/lib/prescription/builder-mapper.ts` — mover a função pura. (Fase 1)
- `shared/lib/prescription/snapshot-from-draft.ts` — nova função `buildSnapshotFromDraft(draft: ProgramDraft): PrescriptionOutputSnapshot`. Pura, usada pelo mobile no save. **Rejeita drafts com supersets** (ver Comportamento Esperado). (Fase 1)

### Shared — editar
- `shared/index.ts` — exportar os novos arquivos. (Fase 1)

## Comportamento Esperado

### Fluxo do Usuário

**Cenário 1 — IA completa**
1. Treinador abre o aluno e toca em **"Prescrever"**.
2. Program builder abre (vazio ou com draft recuperado).
3. Toca no botão **"IA"** no header (ícone Sparkles). Aparece ActionSheet/Alert com "Gerar programa completo", "Colar texto de treino", "Selecionar programa existente" e "Cancelar".
4. Toca em "Gerar programa completo". O bottom sheet abre na anamnese.
5. Revisa/edita o formulário de perfil e toca em **"Analisar"**. (Seleção de formulários fica fora do V1.)
6. Sheet mostra loading "Analisando contexto...". Em seguida exibe perguntas conversacionais (1 a 3). Treinador responde ou toca em "Pular perguntas".
7. Sheet mostra loading "Gerando programa...". Ao concluir, exibe um resumo da proposta (nome, nº de treinos, nº de exercícios) com botão **"Usar geração"** e "Descartar".
8. Ao tocar "Usar geração", o sheet fecha e o builder é preenchido com o programa gerado, editável.
9. Treinador edita o que quiser e toca em **"Salvar"** — o builder chama `/api/programs/assign` com o snapshot final.

**Cenário 2 — Texto para Treino**
1. Treinador em **"Prescrever"** → builder → botão "IA" → "Colar texto de treino".
2. `TextPrescriptionSheet` abre (reaproveitado). Cola o texto, toca "Gerar Treino".
3. Ao tocar "Criar Programa com estes Exercícios", o sheet fecha e o builder é preenchido com os workouts/exercícios parseados (comportamento atual, só muda o local de entrada — agora vem de dentro do builder, não da tela do aluno).

**Cenário 3 — Programa existente**
1. Treinador em **"Prescrever"** → builder → botão "IA" → "Selecionar programa existente".
2. `AssignProgramWizard` abre como modal. Fluxo atual, sem mudanças.

**Cenário 4 — Deep link antigo (`/student/[id]/prescribe`)**
1. Abre a rota → `useEffect` chama `router.replace('/program-builder?studentId=...&mode=ai')`.
2. Builder abre com o sheet de IA completa aberto automaticamente (via query param `mode=ai`).

### Fluxo Técnico

**IA completa:**
1. `useAIPrescriptionAgent(studentId, { onSuccess })` mantém `pageState`, `profile`, `agentState`, `questions`, `answers`, `error`.
2. `startAnalysis()` → `POST /api/prescription/analyze` com `selectedFormIds: []` → atualiza estado com `agentState`, `questions`. Se `questions.length === 0`, pular direto para `generating`.
3. `submitAnswersAndGenerate()` → monta `agentState` com `answers`, chama `POST /api/prescription/generate` com `{ studentId, agentState, selectedFormIds: [] }`. Retorno: `{ generationId, outputSnapshot, source, llmStatus, violations }`.
4. Hook chama `onSuccess({ generationId, outputSnapshot })`.
5. `AIPrescriptionSheet` chama `mapAiOutputToBuilderData(outputSnapshot)` (do `shared/`), depois `builderStore.initFromAiSnapshot(studentId, builderData, generationId)`, depois fecha.
6. Ao salvar: `useProgramBuilder.saveAndAssign(studentId)` monta `buildSnapshotFromDraft(draft)` e chama `POST /api/programs/assign` com `{ studentId, generationId, outputSnapshot, isEdited: true }`.

**Texto para Treino:** Comportamento atual. Apenas mudam os entry points.

### Regras especiais

**Supersets em draft originado de IA — bloqueio no save.**

O `PrescriptionOutputSnapshot` do web (shape definido em `shared/types/prescription.ts`) tem `workouts[].exercises` **flat**, ou seja, não suporta supersets nativamente. Quando o treinador gera via IA e depois adiciona supersets no builder (via `parent_item_id`), há um mismatch fundamental: não dá para serializar isso no snapshot de IA sem perder informação.

**Comportamento no `saveAndAssign`:**
- Se `originatedFromAi === true` e o draft **não tem** supersets, `buildSnapshotFromDraft` serializa normalmente e envia com `isEdited: true`.
- Se `originatedFromAi === true` e o draft **tem** supersets, `buildSnapshotFromDraft` **lança erro** (`SupersetInSnapshotError`). O hook `saveAndAssign` captura esse erro e exibe um `Alert.alert` com:
  - Título: **"Supersets não suportados"**
  - Mensagem: **"O snapshot de IA não suporta supersets. Remova os supersets adicionados ou salve como programa novo (sem vincular à geração)."**
  - Botões:
    - **"Remover supersets"** — fecha o alert; treinador volta ao builder e remove manualmente.
    - **"Salvar como programa novo"** — limpa `generationId`, `originatedFromAi`, `originalSnapshot` do draft, e procede com o save como programa manual (POST `/api/programs/assign` sem `outputSnapshot`, comportamento pré-Fase 2b). Feedback visual: toast "Programa salvo sem vínculo com a geração".
    - **"Cancelar"** — fecha o alert.

**Substituição de programa IA existente — confirmação.**

Quando o treinador já tem um draft gerado por IA (`originatedFromAi === true`) e tenta abrir "Gerar programa completo" novamente no menu IA, mostrar `Alert.alert` antes de abrir o sheet:
- Título: **"Substituir programa gerado?"**
- Mensagem: **"Isso descartará o programa atual e gerará um novo. Continuar?"**
- Botões: **"Cancelar"** (default) e **"Substituir"** (destrutivo).

Usar `Alert.alert` para consistência com o `handleAssignProgram` atual em `app/student/[id].tsx`.

## Critérios de Aceite

### Fase 1 — Shared
- [ ] `mapAiOutputToBuilderData` vive em `shared/lib/prescription/builder-mapper.ts`; import antigo do web continua funcionando via re-export.
- [ ] `buildSnapshotFromDraft` existe em `shared/lib/prescription/snapshot-from-draft.ts`, é pura, e rejeita drafts com supersets lançando `SupersetInSnapshotError`.
- [ ] `shared/index.ts` exporta as novas funções e tipos de erro.
- [ ] Vitest verde em todos os casos listados na seção "Testes Requeridos → Shared".
- [ ] `cd shared && npx tsc --noEmit` limpo.

### Fase 2a — Web: analyze + generate
- [ ] `POST /api/prescription/analyze` existe, exige Bearer JWT, respeita `ai_prescriptions_enabled`, retorna `AnalyzeContextResult`.
- [ ] `POST /api/prescription/generate` aceita `agentState?` e `selectedFormIds?`. Sem eles, comportamento idêntico ao atual.
- [ ] Rate limit do `analyze` herda os limites do `generate` (5/min, 20/day).
- [ ] Testes cobrem: chamada válida, 401 sem Bearer, 403 sem feature flag, backward compat do `generate`.
- [ ] `cd web && npx tsc --noEmit` sem novos erros vs `main`.

### Fase 2b — Web: assign com snapshot editado
- [ ] `POST /api/programs/assign` aceita `outputSnapshot?` + `isEdited?`. Sem eles, comportamento idêntico ao atual.
- [ ] Quando `isEdited === true`:
  - [ ] Revalida que o `generationId` pertence ao trainer autenticado E ao aluno alvo.
  - [ ] Valida shape do `outputSnapshot` (schema Zod ou equivalente) — rejeita body malformado com 400.
  - [ ] Valida que todos `exercise_id` no snapshot existem no catálogo do trainer (ou `exercise_templates` compartilhados).
  - [ ] Só então persiste `assigned_program` a partir do snapshot do body.
- [ ] Comentário de segurança em `assign-from-snapshot.ts` atualizado para refletir a nova decisão (com justificativa das validações).
- [ ] Testes cobrem: edited path happy, edited path com `generationId` de outro trainer (403), edited path com exercício fora do catálogo (400), edited path com shape inválido (400), path não-edited mantendo comportamento atual.
- [ ] `cd web && npx tsc --noEmit` sem novos erros vs `main`.

### Fase 3 — Mobile
- [ ] Ao tocar "Prescrever" na tela do aluno, o builder abre (novo draft ou resume).
- [ ] Dentro do builder, o botão "IA" abre um menu com as três opções.
- [ ] "Gerar programa completo" só aparece/funciona se `aiEnabled === true`.
- [ ] O fluxo de IA completa no mobile passa pelas 5 etapas (anamnese, analyzing, questions, generating, done) com loading visível em cada transição.
- [ ] "Pular perguntas" funciona e gera o programa imediatamente.
- [ ] Ao aceitar a geração, o builder fica populado e editável (não é read-only).
- [ ] "Salvar" no builder envia o snapshot editado para `/api/programs/assign` com `isEdited: true`.
- [ ] Ao editar um exercício pós-geração e salvar, o `assigned_program` no DB reflete a edição (não volta ao original da IA).
- [ ] Texto para Treino continua funcionando, agora acessado de dentro do builder.
- [ ] Rota antiga `/student/[id]/prescribe` redireciona para o builder.
- [ ] Tela do aluno tem 3 action buttons (Sala de Treino, Prescrever, Conversar) — não 5.
- [ ] Tentar salvar draft AI com supersets dispara o Alert de bloqueio com as três opções documentadas.
- [ ] Tentar gerar IA nova em cima de draft AI existente dispara o Alert de substituição.
- [ ] `useAIPrescriptionAgent` implementa as mesmas transições de `use-prescription-agent` do web (teste unitário de paridade).
- [ ] `cd mobile && npx tsc --noEmit` sem novos erros vs `main`.
- [ ] Nenhuma regressão no builder manual (criar programa do zero ainda funciona).

## Restrições Técnicas

- Seguir `mobile/CLAUDE.md`: NativeWind, Reanimated, Lucide, Haptics, SafeArea, sentence case, pt-BR hardcoded.
- Não usar `any`; preferir tipos de `@kinevo/shared` (`PrescriptionOutputSnapshot`, `PrescriptionAgentState`, `StudentPrescriptionProfile`).
- Bottom sheets no mobile usam o padrão já adotado (`Modal` do RN com `animationType="slide"` ou `@gorhom/bottom-sheet` se já houver outro sheet equivalente — verificar `TextPrescriptionSheet` e seguir o mesmo padrão).
- Haptics: `Medium` ao abrir menu IA, `Light` ao transicionar steps, `Success` ao receber geração, `Error` em falha de API.
- Chamadas HTTP do mobile vão para `${EXPO_PUBLIC_WEB_URL}/api/prescription/*` com `Authorization: Bearer <session.access_token>`. Se token ausente, retornar erro "Sessão expirada".
- Web: mudanças em endpoints devem ser backward compat. Qualquer cliente que ainda chame como hoje deve funcionar sem ajustes.
- **Fase 2b — segurança do `assign` com snapshot editado:**
  - Revalidar server-side que o `generationId` pertence ao `trainer_id` autenticado E aponta para o `studentId` do body. Se não, 403.
  - Validar shape do `outputSnapshot` com Zod (ou equivalente) contra o tipo `PrescriptionOutputSnapshot`. Rejeitar com 400 se inválido.
  - Validar que todo `exercise_id` no snapshot existe em `exercises` do trainer (ou em `exercise_templates` compartilhados). Se algum ID for desconhecido, 400.
  - Atualizar o comentário de Fase 2.5.4 §5 no `assign-from-snapshot.ts` explicando por que a postura mudou e quais validações foram adicionadas.
- `buildSnapshotFromDraft` deve ser totalmente puro, sem depender de catálogo de exercícios. Se um exercício foi adicionado manualmente pós-IA, ele entra como um item comum no snapshot (a validação de catálogo acontece server-side no `/api/programs/assign`).
- `buildSnapshotFromDraft` **rejeita supersets**. Não tenta "achatar" supersets em exercícios sequenciais silenciosamente — lança `SupersetInSnapshotError` e deixa o caller decidir (UI mobile mostra o Alert).
- Não tocar no banco de dados (nenhuma migration).
- O wizard `AssignProgramWizard` continua sendo o único caminho para atribuir programa existente. Não duplicar.
- Preservar `mode` do `program-builder-store` (MMKV persistence) — o draft de IA deve sobreviver a um kill/reopen do app, assim como o draft manual sobrevive hoje.

## Edge Cases

- **`aiEnabled === false`**: item "Gerar programa completo" aparece desabilitado no menu com texto "IA não habilitada" (ou só não aparece — decidir pela UX; recomendação: não aparecer, e mostrar toast informativo se usuário tentar acessar via deep link `?mode=ai`).
- **Sessão expirada durante geração**: Hook retorna erro, sheet mostra estado `error` com botão "Tentar novamente".
- **API `/api/prescription/analyze` retorna zero perguntas**: Hook pula direto para `generating`.
- **Treinador edita o draft, fecha o app, reabre**: MMKV restaura o draft; ao salvar, `originatedFromAi === true` e `generationId` ainda está lá → envia `isEdited: true` normalmente.
- **Treinador gera via IA, aceita, depois toca "IA" → "Gerar programa completo" de novo**: `Alert.alert` "Substituir programa gerado?" conforme descrito em Regras Especiais.
- **Treinador gera via IA, toca "IA" → "Colar texto"**: o parse-text adiciona exercícios ao treino ativo (comportamento atual); `originatedFromAi` permanece `true` e `generationId` permanece, mas o snapshot final vai refletir o estado pós-edição (IA + texto adicionado).
- **Treinador gera via IA, toca "IA" → "Selecionar programa existente"**: mostrar confirmação "Isso descartará o programa gerado. Continuar?". Se sim, wizard assume e draft IA é resetado.
- **Treinador adiciona supersets em draft AI e tenta salvar**: Alert "Supersets não suportados" com três opções conforme Regras Especiais.
- **Deep link `?mode=ai` sem `studentId`**: abrir builder como template (sem studentId). O menu IA deve avisar que IA completa requer aluno selecionado e oferecer "Atribuir depois".
- **Geração falha com 429 (rate limit)**: mostrar mensagem clara "Limite de gerações atingido. Tente novamente mais tarde."
- **Usuário aperta "Descartar" no sheet de sucesso**: sheet fecha, draft não é alterado.
- **Usuário fecha o sheet no meio da anamnese sem gerar**: estado do form é perdido (aceitável; igual ao web).

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
Vitest no web e mobile conforme o workspace.

**Shared (Fase 1):**
- [ ] `mapAiOutputToBuilderData` — output com 1 workout / 3 workouts / reasoning ausente / `duration_weeks` null.
- [ ] `mapAiOutputToBuilderData` — IDs gerados têm prefixo `temp_`.
- [ ] `buildSnapshotFromDraft` — draft com exercícios regulares vira `outputSnapshot` correto.
- [ ] `buildSnapshotFromDraft` — draft com supersets lança `SupersetInSnapshotError` (não achata silenciosamente).
- [ ] `buildSnapshotFromDraft` — workout sem `frequency` preenche `days: []`.
- [ ] `buildSnapshotFromDraft` — roundtrip (sem supersets): `mapAiOutputToBuilderData` → `buildSnapshotFromDraft` produz snapshot estruturalmente equivalente ao original (mesmos exercícios, sets, reps, rest_seconds).

**Web (Fase 2a):**
- [ ] `POST /api/prescription/analyze` — chamada válida retorna 200 com `agentState`.
- [ ] `POST /api/prescription/analyze` — sem Bearer retorna 401.
- [ ] `POST /api/prescription/analyze` — trainer sem `ai_prescriptions_enabled` retorna 403.
- [ ] `POST /api/prescription/generate` com `agentState` chama `generateProgram(studentId, agentState, selectedFormIds)`.
- [ ] `POST /api/prescription/generate` sem `agentState` mantém comportamento atual.

**Web (Fase 2b):**
- [ ] `POST /api/programs/assign` com `isEdited: true` e payload válido usa `outputSnapshot` do body.
- [ ] `POST /api/programs/assign` com `isEdited: true` e `generationId` de outro trainer retorna 403.
- [ ] `POST /api/programs/assign` com `isEdited: true` e exercício fora do catálogo retorna 400.
- [ ] `POST /api/programs/assign` com `isEdited: true` e shape inválido retorna 400.
- [ ] `POST /api/programs/assign` com `isEdited: false` mantém comportamento atual (re-fetcha).

**Mobile (Fase 3):**
- [ ] `useAIPrescriptionAgent` — transições `anamnese → analyzing → questions → generating → done` com mocks de fetch.
- [ ] `useAIPrescriptionAgent` — `skipQuestionsAndGenerate` transita direto para `generating`.
- [ ] `useAIPrescriptionAgent` — erro no `analyze` coloca `pageState='error'` com mensagem.
- [ ] `program-builder-store.initFromAiSnapshot` — popula `workouts`, `generationId`, `originatedFromAi`, `originalSnapshot`.
- [ ] `useProgramBuilder.saveAndAssign` — com `originatedFromAi` e sem supersets, envia `isEdited: true` e `outputSnapshot` no body.
- [ ] `useProgramBuilder.saveAndAssign` — com `originatedFromAi` e supersets, captura `SupersetInSnapshotError` e expõe flag para a UI mostrar Alert.
- [ ] `useProgramBuilder.saveAndAssign` — sem `originatedFromAi`, não envia `outputSnapshot` (mantém comportamento atual de template).

### Server Actions / Queries (recomendado)
- [ ] `analyzeStudentContext` continua cobrado pelos testes existentes. Novo wrapper HTTP não introduz lógica.
- [ ] `generateProgram` já tem testes (`generate-program.test.ts`); adicionar caso "recebe `agentState` via API".

### Componentes (opcional)
- Não prioritário. Se sobrar tempo, um smoke test do `AIPrescriptionSheet` cobrindo abertura e dismiss.

## Referências

- Web — state machine: `web/src/components/programs/ai-prescription-panel/use-prescription-agent.ts`
- Web — UI anamnese: `web/src/components/programs/ai-prescription-panel/student-tab.tsx`
- Web — panel wrapper: `web/src/components/programs/ai-prescription-panel.tsx`
- Web — parse-text panel: `web/src/components/programs/ai-prescribe-panel.tsx`
- Web — builder: `web/src/components/programs/program-builder-client.tsx`
- Web — server action analyze: `web/src/actions/prescription/analyze-context.ts`
- Web — server action generate: `web/src/actions/prescription/generate-program.ts`
- Web — server action assign: `web/src/actions/prescription/assign-from-snapshot.ts`
- Web — API generate: `web/src/app/api/prescription/generate/route.ts`
- Web — API assign: `web/src/app/api/programs/assign/route.ts`
- Web — mapper: `web/src/lib/prescription/builder-mapper.ts`
- Web — redirect legado: `web/src/app/students/[id]/prescribe/page.tsx`
- Shared — tipos: `shared/types/prescription.ts`
- Mobile — tela atual IA: `mobile/app/student/[id]/prescribe.tsx`
- Mobile — parse-text sheet: `mobile/components/trainer/student/TextPrescriptionSheet.tsx`
- Mobile — builder: `mobile/app/program-builder/index.tsx`
- Mobile — store: `mobile/stores/program-builder-store.ts`
- Mobile — hook builder: `mobile/hooks/useProgramBuilder.ts`
- Mobile — form de perfil: `mobile/components/trainer/prescription/PrescriptionProfileForm.tsx`
- Mobile — tela aluno: `mobile/app/student/[id].tsx`
- Template de spec: `mobile/specs/TEMPLATE.md`

## Notas de Implementação

### Status final
- Fase 1 — Shared: entregue.
- Fase 2a — Web (analyze + generate): entregue.
- Fase 2b — Web (assign editado): entregue.
- Fase 3 — Mobile: entregue.

### Arquivos tocados (agrupados)

**`shared/`**
- `shared/lib/prescription/builder-mapper.ts` (movido do web).
- `shared/lib/prescription/snapshot-from-draft.ts` (novo: `buildSnapshotFromDraft` + `SupersetInSnapshotError` + `BuildSnapshotFromDraftOptions.preserveReasoning`).
- `shared/lib/prescription/__tests__/builder-mapper.test.ts` (novo).
- `shared/lib/prescription/__tests__/snapshot-from-draft.test.ts` (novo).
- `shared/types/prescription.ts` (adicionado `ProgramDraftLike` + sub-tipos).
- `shared/package.json` (adicionado `exports["./lib/*"]` + `scripts.test`).
- `shared/tsconfig.json` (`include` cobre `lib/`).
- `shared/vitest.config.ts` (novo).

**`web/`**
- `web/src/lib/prescription/builder-mapper.ts` → re-export do shared (4 linhas).
- `web/src/lib/rate-limit/prescription.ts` (novo: helper compartilhado entre analyze + generate).
- `web/src/app/api/prescription/analyze/route.ts` (novo).
- `web/src/app/api/prescription/analyze/__tests__/route.test.ts` (novo, 9 testes).
- `web/src/app/api/prescription/generate/route.ts` (estendido: `agentState` + `selectedFormIds` opcionais; rate-limit helper).
- `web/src/app/api/prescription/generate/__tests__/route.test.ts` (novo, 11 testes).
- `web/src/app/api/programs/assign/route.ts` (estendido: validação shape + ownership + catálogo na branch `isEdited:true`).
- `web/src/app/api/programs/assign/__tests__/route.test.ts` (estendido: +10 testes Fase 2b, atualizado teste "outputSnapshot ignored").
- `web/src/lib/ai-prescription/assign-from-snapshot.ts` (`editedSnapshot` opcional; comentário §5 revisado; bump `trainer_edits_count`; `OutputSnapshot` shapes exportados).

**`mobile/`**
- `mobile/lib/ai-prescription/fetch-client.ts` (novo).
- `mobile/hooks/useAIPrescriptionAgent.ts` (novo).
- `mobile/hooks/__tests__/useAIPrescriptionAgent.test.ts` (novo, 6 testes).
- `mobile/hooks/useProgramBuilder.ts` (estendido: AI path + `saveAsNewProgramDiscardingAi` + `SaveAndAssignResult`).
- `mobile/hooks/__tests__/useProgramBuilder.test.ts` (novo, 3 testes).
- `mobile/stores/program-builder-store.ts` (estendido: 3 campos + `initFromAiSnapshot` + `merge` para retrocompat MMKV).
- `mobile/stores/__tests__/program-builder-store.test.ts` (estendido: +2 testes).
- `mobile/components/trainer/program-builder/AgentQuestionsStep.tsx` (novo).
- `mobile/components/trainer/program-builder/AIPrescriptionSheet.tsx` (novo).
- `mobile/components/trainer/program-builder/AIPrescriptionMenu.tsx` (novo).
- `mobile/app/program-builder/index.tsx` (botão IA, menu, sheets, mode=ai param, Alerts de superset/substituição).
- `mobile/app/student/[id].tsx` (5→3 action buttons, `handleOpenBuilder` único).
- `mobile/app/student/[id]/prescribe.tsx` (substituído por redirect stub).

### Comandos pra rodar

**Verificações (do root):**
```bash
cd shared && npx tsc --noEmit && npx vitest run    # 0 erros, 12 testes
cd web    && npx tsc --noEmit && npx vitest run    # 12 erros pré-existentes (3 arquivos não-relacionados), 391 testes
cd mobile && npx tsc --noEmit && npx vitest run    # 16 erros pré-existentes (6 arquivos não-relacionados), 229 testes
```

**Rodar app (mobile):**
```bash
cd mobile && npm run ios       # ou: npm run android
```

**Deploy ordem (web tem que ir primeiro):**
1. Merge + deploy web (Vercel) — Fases 2a + 2b.
2. Smoke test analyze: `curl -X POST $WEB_URL/api/prescription/analyze` sem Bearer → deve retornar 401.
3. **Smoke test crítico de regressão (canário)**: chama `/api/programs/assign` no caminho **sem `isEdited`** (igual ao que mobiles em produção pré-Fase-3 já chamam). Tem que retornar 200 — se quebrar, builds mobile atuais começam a falhar silenciosamente.
   ```bash
   curl -X POST $WEB_URL/api/programs/assign \
     -H "Authorization: Bearer <valid-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"studentId":"<valid>","generationId":"<valid>"}'
   # Esperado: 200 { success: true, programId: "..." }
   ```
4. Build mobile (EAS) — Fase 3.

### Variáveis de ambiente

**Nenhuma nova.** O mobile usa `EXPO_PUBLIC_WEB_URL` (já configurado para `https://www.kinevoapp.com` no `.env`). O web usa as Supabase + LLM keys já existentes — analyze e assign não introduzem secrets.

### Decisões não-óbvias

1. **Supersets no save de IA → 3-button Alert.** `buildSnapshotFromDraft` joga `SupersetInSnapshotError` se o draft tem `parent_item_id` ou `item_type === 'superset'`. O hook captura, retorna `{ ok: false, reason: 'SUPERSET_BLOCKED' }`, e o builder dispara um Alert com "Cancelar / Remover supersets / Salvar como programa novo". A última opção chama `saveAsNewProgramDiscardingAi` que limpa o linkage de IA do draft (em uma única `setState`) e re-salva pela rota legada.

2. **`mode=ai` no query param.** Tratado em dois useEffects: o de mount inicializa o draft (a menos que `mode === "ai"` ou `"from-text"` ou `"from-ai"`), e um segundo abre `AIPrescriptionSheet` automaticamente quando `mode=ai` + `studentId` presente. Sem `studentId`, mostra toast informativo (paridade com web).

3. **Substituição de programa IA existente.** Quando o treinador toca "Gerar programa completo" e o draft já tem `originatedFromAi`, dispara Alert "Substituir programa gerado?" com botão destrutivo "Substituir". Se confirmar, faz `reset() + initNewProgram(studentId)` antes de abrir o sheet.

4. **Backward compat MMKV.** Drafts persistidos antes de Fase 3 não têm `generationId` / `originatedFromAi` / `originalSnapshot`. Adicionei callback `merge` no Zustand persist que defaults esses campos no rehydrate. Sem isso, o primeiro `saveAndAssign` num draft antigo crasharia ao ler `draft.originatedFromAi`.

5. **`preserveReasoning` no save de IA.** A rota Fase 2b aceita reasoning vazio, mas pra preservar o audit trail enviamos `originalSnapshot.reasoning` (do draft) no save, via segundo argumento opcional de `buildSnapshotFromDraft`. Com isso o snapshot persistido em `prescription_generations.output_snapshot` mantém a justificativa original da LLM mesmo após o treinador editar exercícios. O patch foi aplicado na Fase 1 e cobrado por teste.

6. **`renderHook` minimal homemade.** O mobile workspace não tem `@testing-library/react`. Em vez de adicionar dependência, escrevi um helper `renderHook` de ~15 linhas usando `react-dom/client` (que já está no monorepo via React 19) + `act` (exportado pelo próprio `react` em v19). Mesmo padrão usado em ambos os arquivos de teste novos. Marcado `// @ts-expect-error` no import porque `@types/react-dom` não está instalado.

7. **Validação manual do `agentState`.** Mantive o padrão da Fase 2a (sem Zod) — ~50 linhas de validador puro, consistente com o `validateOutputSnapshotShape` da Fase 2b. Trocar pra Zod depois é substituição cirúrgica.

8. **Rate-limit compartilhado analyze ↔ generate.** O contador é write-driven: só incrementa quando `/generate` cria row em `prescription_generations`. `/analyze` lê o mesmo contador (então um trainer com 20 generations no dia recebe 429 também ao tentar analyze) mas não contribui pra ele. Análise é cheap, custo real tá no generate. Documentado em comentário no helper.

9. **`OutputSnapshot` (helper) vs `PrescriptionOutputSnapshot` (shared).** O helper `assign-from-snapshot.ts` mantém shape interno mais lax (aceita `description: null`, `duration_weeks: null`). Exportei o shape do helper pro route consumir, em vez de fazer o mobile/web convergirem agora — divergência mapeada como item de hardening futuro. O mobile envia o shape do shared; no happy path são compatíveis.

10. **Logging com PII guard.** O log de persistência de snapshot editado (`[programs/assign] generation persisted`) inclui `wasEdited:true` mas **não** o conteúdo do snapshot. Coberto por teste explícito.

### Checklist de validação manual (iOS + Android)

Disparar **depois** de deploy do web e build/sideload do mobile.

- [ ] **Tela do aluno tem 3 action buttons** (Sala de Treino, Prescrever, Conversar).
- [ ] **"Prescrever" abre o builder** sem precisar de submenu.
- [ ] **Botão "IA" no header do builder** abre menu com 3 opções (ou 2 se `aiEnabled === false`).
- [ ] **Fluxo IA completa**: menu → Gerar programa completo → anamnese → analisar → perguntas → gerar → builder populado e editável → Salvar → confirmar no DB que `assigned_program` carrega a edição (verifica `prescription_generations.trainer_edits_count > 0`).
- [ ] **Fluxo Texto para Treino**: menu → Colar texto de treino → cola → gera → builder populado.
- [ ] **Fluxo Programa existente**: menu → Selecionar programa existente → wizard atribui direto sem builder.
- [ ] **Deep link antigo** `/student/<id>/prescribe` redireciona para `/program-builder?studentId=<id>&mode=ai` e abre o sheet de IA automaticamente.
- [ ] **`aiEnabled = false`**: opção "Gerar programa completo" some do menu.
- [ ] **Sessão expirada**: hook do agent retorna mensagem clara "Sessão expirada. Faça login novamente." no error step.
- [ ] **Rate limit 429**: força via curl 6 generations seguidas; o sheet exibe "Limite de gerações atingido…".
- [ ] **Substituição de programa IA**: gera, confirma, depois abre IA de novo → Alert "Substituir programa gerado?" aparece. "Substituir" limpa e abre sheet em branco.
- [ ] **Supersets pós-IA**: gera, adiciona um superset (item com parent_item_id), tenta salvar → Alert "Supersets não suportados" com 3 botões. "Salvar como programa novo" funciona pelo path legado.
- [ ] **Kill/reopen** no meio de um draft AI: MMKV restaura. Save envia `isEdited:true` normalmente.
- [ ] **iOS**: ActionSheet nativo aparece. **Android**: Alert nativo com mesmas opções.

### Rollback plan

Toda a mudança é **opt-in via campos novos**:
- O mobile envia `isEdited: true` + `outputSnapshot` apenas no AI path. Sem essa flag, o web mantém o comportamento pré-Fase 2b.
- O mobile envia `agentState` apenas quando o agent rodou. Sem ele, `/api/prescription/generate` mantém o comportamento pré-Fase 2a.
- O endpoint `/api/prescription/analyze` é novo — não existe consumidor além do mobile pós-Fase-3, então removê-lo é seguro.

**Como reverter sem dor:**
1. Reverter o commit do mobile (Fase 3) — mobile volta a usar `/student/[id]/prescribe.tsx` (pre-stub) + os 5 action buttons. O web permanece compatível porque os endpoints estendidos seguem aceitando o body antigo.
2. Se precisar reverter o web também: reverter Fase 2b (assign route) primeiro, depois Fase 2a (analyze + generate). Fase 1 (shared) não precisa reverter — `mapAiOutputToBuilderData` continua funcionando do mesmo jeito.
3. Não há migração de banco. Não há nova coluna. `trainer_edits_count` já existe (migration 035) e é incrementado de forma idempotente.

Nenhuma mudança quebra deploys parciais — desde que o web esteja deployado primeiro, o mobile pode atualizar incrementalmente sem coordenação.

**⚠ Cuidado com revert assimétrico (web sem revert do mobile):** se um treinador já estiver com build mobile pós-Fase-3 e o web for revertido para pré-2b, o mobile vai mandar `isEdited: true` + `outputSnapshot` para um route que **silenciosamente ignora** esses campos (comportamento pré-2b: re-fetcha do DB). É **seguro** — não persiste snapshot ruim — mas o treinador acha que salvou as edições quando na verdade salvou o original da IA. Isso é tolerável por **horas, não por dias**. Se reverter o web, comunique o app team imediatamente para programar o revert do build mobile na próxima janela.
