# Prescrição Manual com Repetições e Descanso por Série (Pirâmide, Drop-set, Cluster)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

Hoje a prescrição de exercícios no Kinevo trata cada exercício como uma única unidade com três valores agregados — `sets INTEGER`, `reps TEXT`, `rest_seconds INTEGER` — em `workout_item_templates` e `assigned_workout_items` (migration 001). Esses três campos se aplicam a **todas** as séries do exercício; não há como prescrever 12 reps na 1ª série, 10 na 2ª, 8 na 3ª e 6 na 4ª (pirâmide), nem drop-sets, nem variações de descanso entre séries.

Isso veio em feedback presencial de um treinador usuário em 24/04/2026, e foi registrado no `Plano_Feedbacks_Usuario_2026-04.md` como item P0 do roadmap. O esquema de `set_logs` (a execução real) já é por série — só falta o **lado da prescrição** ser também por série.

A funcionalidade tem dois pontos de entrada que precisam funcionar de ponta a ponta:

1. **Builder manual** (web e mobile): treinador adiciona exercício, escolhe modo avançado e edita série a série.
2. **Texto para Treino** (`supabase/functions/parse-workout-text/`): treinador cola texto livre como `"supino reto pirâmide 12-10-8-6 desc 90s"` e o parser deve detectar o esquema variável e devolver no formato per-set.

**Decisão de produto já tomada:** o modo avançado é **livre desde a primeira série**. Presets (Pirâmide ↑/↓, Drop-set, 5×5, Top+Backoff, Cluster) são **chips opcionais** que pré-preenchem a tabela; o treinador pode editar qualquer linha depois e o `method_key` vira `'custom'` automaticamente. Não há obrigatoriedade de escolher um preset para usar o modo avançado.

**Fora do escopo desta spec:** o motor de IA agentivo (`web/src/lib/prescription/`, ~15K LOC) não recebe nenhuma mudança. Ele continua gerando `sets/reps/rest_seconds` agregados; o builder manual e o parser de texto são as duas únicas superfícies que ganham per-set por enquanto. Adicionar suporte ao motor IA é incremento futuro, fora desta entrega.

### Postura de retrocompatibilidade (importante)

Programas existentes no banco continuam tendo apenas os campos agregados. A migration desta spec **não toca** nas linhas existentes — só adiciona tabelas-filhas vazias e uma coluna nullable. O leitor (mobile workout session, web reports, watch app) precisa seguir uma regra única:

> Se houver linhas em `assigned_workout_item_sets` para o item, hidratar a sessão a partir delas. Caso contrário, replicar `sets` × `(reps, rest_seconds)` como N séries idênticas (comportamento atual).

Essa regra mantém o sistema funcionando para todos os programas legados sem migração de dados.

## Objetivo

Permitir ao treinador prescrever, no builder manual e no Texto para Treino, esquemas de série heterogêneos (pirâmide, drop-set, cluster, top+backoff, séries customizadas livres), e fazer com que essa prescrição seja exibida e executada corretamente na sala de treino do aluno (mobile + Apple Watch). Programas e prescrições anteriores continuam funcionando exatamente como hoje.

## Estratégia de execução — faseada em 5 PRs

| Fase | Escopo | Dependências |
|------|--------|--------------|
| **Fase 1 — DB + Shared** | Migration nova (tabelas filhas + `method_key` + bucket de presets seed). Tipos `WorkoutSet`, `SetType`, helpers `summarizeSetScheme`/`expandToSetScheme`/`validateSetScheme` em `shared/lib/prescription/`. Seeds dos presets de sistema. | Nenhuma. |
| **Fase 2 — Web Builder** | Estende `WorkoutItem` no builder web, `WorkoutItemCard` ganha toggle "Avançado" + tabela editável + barra de presets. `program-builder-client.saveProgram` persiste filhas. Load de programa existente hidrata `set_scheme`. | Fase 1. |
| **Fase 3 — Mobile Builder** | Estende `WorkoutItem` no `program-builder-store`. Novo `SetSchemeEditor` (bottom sheet). Botão "Editar séries" no card do builder. `saveProgram` persiste filhas. | Fase 1. |
| **Fase 4 — Sala de Treino (mobile + watch)** | `useWorkoutSession.ts` lê `assigned_workout_item_sets` quando existe, senão fallback. `SetRow` exibe `set_type` e `reps` por série. Watch app idem. | Fase 1. |
| **Fase 5 — Texto para Treino** | Edge Function `parse-workout-text` aprende padrões pirâmide/drop/cluster. `ParsedExercise` ganha `set_scheme` e `method_key`. Bridges `ai-prescribe-panel` (web) e `initFromParsedText` (mobile) propagam para o builder. | Fases 1, 2 e 3 (precisa de UI pra renderizar o resultado). |

Cada fase é deployável de forma independente. Fases 2, 3 e 4 podem ir em paralelo após a Fase 1; Fase 5 fecha o ciclo.

## Escopo

### Incluído

**DB / shared (Fase 1):**
- Nova migration `111_per_set_prescription.sql` (numeração sequencial — confirmar se `110_frequency_once.sql` segue sendo a última no momento da entrega):
  - Tabela `workout_item_set_templates` (filha de `workout_item_templates`).
  - Tabela `assigned_workout_item_sets` (filha de `assigned_workout_items`).
  - Coluna nullable `method_key TEXT` em ambas as tabelas pais.
  - Tabela `training_method_presets` (linhas com `trainer_id` NULL = sistema).
  - Seed de 6 presets de sistema: `pyramid_down`, `pyramid_up`, `drop_set`, `top_backoff`, `5x5`, `cluster`.
  - RLS: trainer-only para presets do trainer (`current_trainer_id()`); sistema lido por todos autenticados.
  - Cascading deletes coerentes (parent → children).
- Tipos compartilhados em `shared/types/prescription.ts`:
  - `SetType` (union `'warmup' | 'normal' | 'top' | 'backoff' | 'drop' | 'failure' | 'cluster' | 'amrap'`).
  - `WorkoutSet` (interface por linha de série).
  - `MethodKey` (union dos preset keys + `'standard' | 'custom'`).
  - `TrainingMethodPreset` (matching DB row).
- `shared/lib/prescription/set-scheme.ts` (novo, puro):
  - `summarizeSetScheme(scheme): { sets, reps, rest_seconds }` — produz resumo legível para os 3 campos agregados.
  - `expandToSetScheme(sets, reps, rest_seconds): WorkoutSet[]` — expande agregados em N séries iguais (usado quando o trainer aciona "Avançado" pela primeira vez).
  - `validateSetScheme(scheme)` — checa coerência (set_number único e contínuo, set_type no enum, etc.).
  - `applyPreset(presetKey, opts)` — gera um `WorkoutSet[]` a partir de um preset com parâmetros (ex.: número de séries, % drop).
  - `inferMethodKeyFromScheme(scheme)` — heurística pra detectar qual preset um esquema corresponde, ou `'custom'`.
- `shared/lib/prescription/set-scheme-presets.ts` (novo, dados puros):
  - Constantes com a configuração padrão de cada preset de sistema (espelha o seed).
- `shared/index.ts` exporta os novos.

**Web — builder manual (Fase 2):**
- `web/src/components/programs/program-builder-client.tsx`:
  - Estende a interface `WorkoutItem` com `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`.
  - `addExerciseFromLibrary` aceita esses campos opcionais (default `null`).
  - `saveProgram` (linha ~987): após inserir cada `workout_item_template`, se `item.set_scheme?.length > 0`, faz insert em batch em `workout_item_set_templates` com `workout_item_template_id` apontando para a linha recém-criada.
  - Função de load de programa existente passa a fazer LEFT JOIN com `workout_item_set_templates` e popular `set_scheme` quando houver linhas.
- `web/src/components/programs/workout-item-card.tsx`:
  - Adiciona botão "**Avançado**" no canto do card (linha ~407, ao lado dos inputs atuais).
  - Quando `set_scheme === null`, renderiza os 3 inputs inline atuais (comportamento idêntico).
  - Quando `set_scheme !== null`, renderiza o componente novo `<SetSchemeTable />` no lugar dos 3 inputs.
  - Ao clicar "Avançado" pela primeira vez, chama `expandToSetScheme(item.sets ?? 3, item.reps ?? '10', item.rest_seconds ?? 60)` e seta `set_scheme`.
  - Botão "Voltar para modo simples" zera `set_scheme` e re-popula os 3 inputs com `summarizeSetScheme` do estado anterior (não perde valores se possível).
- `web/src/components/programs/SetSchemeTable.tsx` (novo):
  - Tabela editável com colunas: `#`, `Tipo` (select), `Reps`, `Carga` (número opcional + toggle kg/%1RM), `RIR`, `Descanso (s)`, `Tempo`, ações `[+ adicionar série]`, `[duplicar]`, `[🗑 remover]`.
  - **Barra de presets** acima da tabela: chips horizontais com os 6 presets de sistema. Tocar um chip preenche a tabela com o esquema do preset (sobrescreve estado atual após confirmação se já houver edits) e seta `method_key`.
  - Editar qualquer célula após aplicar preset → `method_key` vira `'custom'` automaticamente. Chip do preset original perde o destaque.
  - Validação inline: linhas inválidas têm borda vermelha + tooltip.
  - Renderiza um chip `method_key` no header da tabela (ex.: "Pirâmide ↓" ou "Customizado") com botão pra trocar de preset.
- Atualizar a type definition exportada em `web/src/components/programs/program-builder-client.tsx` que outros arquivos importam (workout-item-card, ai-prescribe-panel, etc.) — aceitar os novos campos.

**Mobile — builder manual (Fase 3):**
- `mobile/stores/program-builder-store.ts`:
  - Estende `WorkoutItem` com `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`. Importa tipos do `@kinevo/shared`.
  - `initFromParsedText` (linha 239): copia `set_scheme` e `method_key` do `ParsedWorkoutForBuilder` se presentes (Fase 5 vai preencher; Fase 3 só prepara o caminho).
  - `addExerciseToWorkout` aceita os novos campos.
  - Migração de schema do MMKV via callback `merge` no Zustand persist: drafts pré-Fase-3 não têm os campos novos → defaultar para `null` no rehydrate.
- `mobile/hooks/useProgramBuilder.ts`:
  - `saveProgram` chama RPC `save_program_template_with_sets` (nova — ver abaixo) ou faz inserts row-by-row no template + filhas. Decidir pelo padrão usado hoje (verificar com `useProgramBuilder.ts` existente).
- `mobile/components/trainer/program-builder/SetSchemeEditor.tsx` (novo):
  - Bottom sheet (mesmo padrão do `TextPrescriptionSheet` — confirmar uso de `Modal` RN ou `@gorhom/bottom-sheet`).
  - Tabela vertical (uma série por card empilhado, ergonômico em academia):
    - Cada card mostra `#`, `Tipo` (chips), `Reps` (input numérico/texto), `Carga` (steppers + toggle kg/%1RM), `RIR` (stepper), `Descanso` (stepper s), `Tempo` (input opcional), botões `[Duplicar]` `[Remover]`.
  - Barra de presets no topo (chips horizontais scroll).
  - Botão "+ Adicionar série" ao final da lista.
  - Botão "Voltar para modo simples" no header (com confirm se há edits).
  - Salva no store quando o usuário fecha o sheet com "Salvar".
- Botão "**Editar séries**" no card do builder (`mobile/components/trainer/program-builder/ExerciseCardEditor.tsx` ou equivalente — investigar onde fica o card hoje no builder mobile). Abre o `SetSchemeEditor`.
- Indicador visual no card de quando o exercício tem `set_scheme` ativo: chip pequeno do `method_key` no header do card.

**Mobile — sala de treino do aluno (Fase 4):**
- `mobile/hooks/useWorkoutSession.ts` (linha ~117-123):
  - Hidrata os sets a partir de `assigned_workout_item_sets` quando houver linhas. Senão, fallback para o comportamento atual (replicar `setsCount`).
  - `set_logs` continua sendo a tabela de execução, sem mudança.
  - Quando o aluno conclui uma série, o `reps_target` exibido vem do `assigned_workout_item_sets[set_number]` quando disponível.
- `mobile/components/workout/SetRow.tsx`:
  - Renderiza badge do `set_type` à esquerda da linha (cor + ícone Lucide):
    - `warmup` → cinza, `Flame` (aquecimento ≠ aquecimento de cardio, é warmup do exercício).
    - `normal` → padrão (sem badge).
    - `top` → laranja, `ArrowUp`.
    - `backoff` → cinza-azul, `ArrowDown`.
    - `drop` → vermelho, `ChevronsDown`.
    - `failure` → vermelho-escuro, `Zap`.
    - `cluster` → roxo, `Layers`.
    - `amrap` → azul, `Infinity`.
  - O placeholder de `reps` vira o `reps_target` específico da série (ex.: "6" na 4ª série de uma pirâmide).
  - Texto da legenda da série mostra o esquema completo no header do card de exercício (ex.: "12-10-8-6"; já temos summarize).
- `mobile/lib/getProgramSnapshotForWatch.ts` e `getNextWorkoutForWatch.ts`: passam o `set_scheme` (quando existir) no payload pro Watch.
- `targets/watch-app/Models/WorkoutExecutionState.swift` e `WorkoutExecutionView.swift`: leitura per-set quando disponível. Se não houver, comportamento atual.

**Texto para Treino (Fase 5):**
- `supabase/functions/parse-workout-text/index.ts`:
  - Estende o `SYSTEM_PROMPT` com a seção "PIRÂMIDE / SÉRIES VARIÁVEIS" (texto detalhado em `Comportamento Esperado → Fluxo Técnico → Edge Function`).
  - Estende `interface ParsedExercise` adicionando `method_key: string | null` e `set_scheme: WorkoutSet[] | null`.
  - Estende `validateAndFixResponse` com:
    - Coerção: se `set_scheme` preenchido, `sets = scheme.length`, `reps = summarize(scheme)`, `rest_seconds = scheme[0].rest_seconds`.
    - Sanitização: `set_type` fora do enum vira `'normal'`.
    - Rejeição: se `set_scheme` tem `set_number` duplicado/lacunar, descartar (volta a forma agregada com `set_scheme: null`).
  - Estende o JSON do exemplo no system prompt.
- `web/src/app/api/prescription/parse-text/types.ts`: adiciona `method_key: string | null` e `set_scheme: WorkoutSet[] | null` em `ParsedExercise`. Re-exportar `WorkoutSet` do shared.
- `web/src/app/api/prescription/parse-text/route.ts` (se existir lógica de validação aqui também — investigar): mesmo tratamento.
- `web/src/components/programs/ai-prescribe-panel.tsx` (linha ~82-102): repassa `set_scheme` e `method_key` para `onAddExerciseToWorkout`.
- `mobile/components/trainer/student/TextPrescriptionSheet.tsx` (linha ~73-181): atualiza `ParsedExercise` interface local + repassa para `onParsed`.
- `mobile/stores/program-builder-store.ts → initFromParsedText` (já preparado na Fase 3): passa a usar os campos efetivamente.

### Excluído

- **Motor de IA agentivo** (`web/src/lib/prescription/` — schemas estritos OpenAI, prompt-builder, structural-optimizer, rules-engine, ai-optimizer). Continua gerando `sets/reps/rest_seconds` agregados. Adicionar set_scheme à IA é incremento futuro fora desta entrega.
- **Suporte a per-set dentro de superset.** Versão 1: se um exercício está dentro de um superset (`parent_item_id !== null`), o modo avançado fica desabilitado. Tabelas filhas só recebem linhas para itens raiz com `item_type === 'exercise'`.
- **Cálculo automático de carga sugerida a partir de %1RM.** Os campos `weight_target_kg` e `weight_target_pct1rm` são salvos mas a UI da sala de treino não converte automaticamente entre eles na Fase 4. Inputs continuam sendo o que o aluno digita. Conversão automática vira incremento futuro.
- **Telemetria de aderência por método.** Comparar `set_logs.is_completed` rate entre exercícios com e sem `set_scheme` é trabalho futuro de analytics.
- **Edição de presets pelo trainer (UI de gestão).** O trainer pode salvar configurações como presets pessoais via DB, mas a UI para gerenciar (`/settings/training-methods`) não entra nesta entrega. Trainer fica com os 6 presets de sistema + customização inline.
- **Watch app não recebe UI de modo avançado** — só leitura. Se o exercício tem `set_scheme`, mostra o `reps_target` por série e está feito.
- **Migração de dados.** Programas existentes não são reescritos para o novo formato.
- **Aluno editar carga sugerida** — campos `weight_target_kg` e `weight_target_pct1rm` são read-only do lado do aluno; ele continua digitando o que executou em `set_logs.weight`.
- **Notificações push diferenciadas para método** — não há push novo nessa entrega.

## Arquivos Afetados

### Supabase — criar
- `supabase/migrations/111_per_set_prescription.sql` — tabelas filhas + `method_key` + presets de sistema seed + RLS.

### Shared — criar
- `shared/lib/prescription/set-scheme.ts` — funções puras (`summarizeSetScheme`, `expandToSetScheme`, `validateSetScheme`, `applyPreset`, `inferMethodKeyFromScheme`).
- `shared/lib/prescription/set-scheme-presets.ts` — constantes com a config dos 6 presets de sistema.
- `shared/lib/prescription/__tests__/set-scheme.test.ts` — Vitest.
- `shared/lib/prescription/__tests__/set-scheme-presets.test.ts` — Vitest.

### Shared — editar
- `shared/types/prescription.ts` — adicionar `SetType`, `WorkoutSet`, `MethodKey`, `TrainingMethodPreset`.
- `shared/index.ts` — re-exportar os novos.
- `shared/types/database.ts` — regenerar via `npm run gen:types` após migration aplicada (não editar à mão).

### Web — criar
- `web/src/components/programs/SetSchemeTable.tsx` — tabela editável + barra de presets + chip de método.
- `web/src/components/programs/SetSchemePresetChips.tsx` — barra horizontal de chips de preset (componente filho do `SetSchemeTable`).
- `web/src/components/programs/__tests__/SetSchemeTable.test.tsx` — happy path + custom override + reset.

### Web — editar
- `web/src/components/programs/program-builder-client.tsx`:
  - Interface `WorkoutItem` ganha `set_scheme` e `method_key`.
  - `addExerciseFromLibrary` aceita os campos.
  - `saveProgram` insere filhas em batch após cada item.
  - Função de load (procurar `loadProgramTemplate` ou similar) hidrata `set_scheme` via JOIN.
- `web/src/components/programs/workout-item-card.tsx`:
  - Adiciona toggle "Avançado" que troca entre os 3 inputs inline atuais e o `<SetSchemeTable>`.
  - Bind do `set_scheme` no estado.
- `web/src/components/programs/ai-prescribe-panel.tsx`:
  - Passa `set_scheme` e `method_key` para `onAddExerciseToWorkout` (Fase 5).
- `web/src/app/api/prescription/parse-text/types.ts` (Fase 5):
  - `ParsedExercise` ganha `method_key` e `set_scheme`.

### Mobile — criar
- `mobile/components/trainer/program-builder/SetSchemeEditor.tsx` — bottom sheet com tabela vertical de séries.
- `mobile/components/trainer/program-builder/SetSchemeCard.tsx` — card por série dentro do editor (compõe o `SetSchemeEditor`).
- `mobile/components/trainer/program-builder/SetSchemePresetChips.tsx` — barra horizontal de chips no topo do editor.
- `mobile/components/trainer/program-builder/__tests__/SetSchemeEditor.test.tsx` — opcional, smoke.

### Mobile — editar
- `mobile/stores/program-builder-store.ts`:
  - `WorkoutItem` ganha `set_scheme` e `method_key`.
  - `initFromParsedText` propaga os campos novos.
  - `addExerciseToWorkout` aceita os campos.
  - Callback `merge` do Zustand persist: defaulta `null` no rehydrate de drafts antigos.
- `mobile/hooks/useProgramBuilder.ts`:
  - `saveProgram` insere filhas em `workout_item_set_templates` quando há `set_scheme`.
- `mobile/app/program-builder/index.tsx` (ou onde fica o card de exercício no builder — investigar):
  - Botão "Editar séries" no card, abre `SetSchemeEditor`.
  - Chip do `method_key` no header do card quando aplicável.
- `mobile/hooks/useWorkoutSession.ts` (Fase 4):
  - Lê `assigned_workout_item_sets` se existir; fallback para o comportamento atual.
- `mobile/components/workout/SetRow.tsx` (Fase 4):
  - Badge do `set_type` + `reps_target` específico da série.
- `mobile/components/workout/ExerciseCard.tsx` (Fase 4):
  - Header passa a mostrar o resumo da pirâmide ("12-10-8-6") quando `set_scheme` ativo.
- `mobile/lib/getProgramSnapshotForWatch.ts` e `mobile/lib/getNextWorkoutForWatch.ts` (Fase 4):
  - Payload inclui `set_scheme` quando existir.
- `mobile/components/trainer/student/TextPrescriptionSheet.tsx` (Fase 5):
  - `ParsedExercise` interface local ganha `method_key` e `set_scheme`. Repassa para `onParsed`.

### Watch app — editar (Fase 4)
- `targets/watch-app/Models/WorkoutExecutionState.swift`: campos opcionais `setScheme` e `methodKey` por exercício.
- `targets/watch-app/Views/WorkoutExecutionView.swift`: usa `setScheme[setIndex].reps` quando disponível, senão usa o `reps` agregado.

### Edge Functions — editar (Fase 5)
- `supabase/functions/parse-workout-text/index.ts`:
  - Estende `SYSTEM_PROMPT`.
  - Estende `interface ParsedExercise`.
  - Estende `validateAndFixResponse` com coerção e validação.

## Comportamento Esperado

### Fluxo do Usuário

**Cenário 1 — Builder manual (web): pirâmide do zero**
1. Treinador abre o program builder pra um aluno.
2. Adiciona "Supino reto com barra" via biblioteca de exercícios.
3. Card aparece com defaults `3 séries × 10 reps × 60s`.
4. Clica em **"Avançado"** no card.
5. Tabela aparece com 3 linhas idênticas (12 reps, 60s descanso, tipo normal).
6. Treinador clica no chip **"Pirâmide ↓"** na barra de presets.
7. Tabela é repreenchida com 4 linhas: `12 reps / 90s`, `10 reps / 90s`, `8 reps / 120s`, `6 reps / 180s`. Chip "Pirâmide ↓" fica destacado.
8. Treinador edita a 4ª linha: troca `6` por `4-6` e marca tipo `top`.
9. Chip muda para **"Customizado"** automaticamente; chip "Pirâmide ↓" perde destaque.
10. Treinador adiciona uma 5ª série clicando no `+`: tipo `drop`, reps `8`, descanso `0s`.
11. Treinador clica em "Salvar programa".
12. No DB: 1 linha em `workout_item_templates` (com `sets=5`, `reps="4-6"`, `rest_seconds=90`, `method_key='custom'`) + 5 linhas em `workout_item_set_templates`.

**Cenário 2 — Builder manual (web): voltar para modo simples**
1. Treinador tem um exercício com `set_scheme` de 4 séries.
2. Clica em **"Voltar para modo simples"** no header da tabela.
3. Confirm dialog: "Você perderá as configurações específicas de cada série. Continuar?"
4. Confirma → `set_scheme` zera, os 3 inputs voltam preenchidos com `summarizeSetScheme` (sets=4, reps="12-10-8-6", rest_seconds=90).
5. Treinador agora pode editar normalmente os 3 campos.

**Cenário 3 — Builder mobile: drop-set em isolador final**
1. Treinador adiciona "Cadeira extensora" no builder mobile.
2. Toca no card do exercício → toca em **"Editar séries"**.
3. Bottom sheet abre com 3 cards de série (replicados do agregado).
4. Toca no chip **"Drop-set"** no topo.
5. Cards re-populados: 1 série normal (10 reps), 2 séries drop (cada uma com `-20%` carga, descanso 0s).
6. Toca em "Salvar" no header do sheet.
7. Sheet fecha; o card no builder agora mostra chip "Drop-set" e `summarize` "10 + 2 drops" no header.

**Cenário 4 — Texto para Treino: pirâmide via texto livre**
1. Treinador abre o builder e cola: `"Treino A: Supino reto pirâmide 12-10-8-6 desc 90s; Crucifixo halter 3x12; Tríceps testa drop 10/8/6"`.
2. Toca em "Gerar Treino".
3. Edge Function processa, retorna 3 exercícios:
   - Supino: `set_scheme` com 4 séries (12,10,8,6 reps, 90s), `method_key: 'pyramid_down'`.
   - Crucifixo: `set_scheme: null`, `sets: 3, reps: '12'`, `method_key: 'standard'`.
   - Tríceps testa: `set_scheme` com 3 séries (10,8,6 reps), `method_key: 'drop_set'`.
4. Treinador toca em "Criar Programa com estes Exercícios".
5. Builder é populado: card do supino e do tríceps já abrem com modo avançado; crucifixo no modo simples.
6. Treinador edita o que quiser e salva.

**Cenário 5 — Aluno executando treino com pirâmide**
1. Aluno abre treino com supino reto em pirâmide ↓ (4 séries: 12, 10, 8, 6 reps).
2. Header do card do exercício mostra "**Supino reto • 4 séries • 12-10-8-6 • 90s descanso**" e chip "Pirâmide ↓".
3. Linha da série 1 mostra placeholder "12 reps", aluno digita carga e marca completo.
4. Rest timer dispara com 90s.
5. Linha da série 2: placeholder "10 reps".
6. Quando chega na série 4 (`set_type='top'`), o badge laranja "TOP" aparece à esquerda da linha.
7. Quando há `set_type='drop'`, badge vermelho com `0s` de descanso visível.

**Cenário 6 — Programa legado (sem set_scheme)**
1. Aluno tem programa antigo `4 séries × 10 reps × 60s`.
2. App não encontra linhas em `assigned_workout_item_sets` para o item.
3. Sala de treino renderiza 4 linhas idênticas (10 reps, 60s) — comportamento atual.
4. Nada quebra. Header mostra "4 séries • 10 reps • 60s" sem chip de método.

### Fluxo Técnico

**Persistência (web e mobile, save):**
1. Builder envia `WorkoutItem[]` com `set_scheme` opcional.
2. `saveProgram` itera workouts; para cada item:
   - INSERT em `workout_item_templates` com agregados sincronizados via `summarizeSetScheme(item.set_scheme)` se `set_scheme` existir; senão usa os campos do item.
   - Se `item.set_scheme?.length > 0`: INSERT em batch em `workout_item_set_templates` com `workout_item_template_id = insertedItem.id`.
3. Na atribuição (`assign_program` RPC ou equivalente), o snapshot copia para `assigned_workout_items` + `assigned_workout_item_sets`.

**Leitura (mobile sala de treino, hidratação):**
1. `useWorkoutSession.ts` faz query do `assigned_workout` com SELECT em `assigned_workout_items` e LEFT JOIN com `assigned_workout_item_sets`.
2. Para cada item:
   - Se há linhas em `assigned_workout_item_sets`, ordena por `set_number` e cria N entradas no estado local com `reps_target`, `rest_seconds`, `set_type`, etc.
   - Senão, replica `Array(setsCount).fill({ reps_target: item.reps, rest_seconds: item.rest_seconds, set_type: 'normal' })`.
3. `set_logs` continua sendo o registro de execução, com `set_number` correspondente ao da prescrição.

**Texto para Treino — Edge Function:**
1. `parse-workout-text` recebe texto + catálogo.
2. System prompt expandido instrui a detectar:
   - `"pirâmide 12-10-8-6"`, `"piramide crescente 6-8-10-12"`, `"10/8/6/4"`, `"3 séries 12-10-8"`, `"4x10,8,6,4"` → `pyramid_down` ou `pyramid_up`.
   - `"drop set"`, `"10 → -20% até falha"`, `"10+8+6 drop"` → `drop_set`.
   - `"5x5"`, `"5×5 reto"` → `5x5` (5 séries iguais com `set_type='normal'`).
   - `"top set 5RM + 3x8 a 80%"`, `"AMRAP + backoff"` → `top_backoff`.
   - `"rest-pause 8+4+2"`, `"cluster"` → `cluster` (1 série com reps `"8+4+2"` e `set_type='cluster'`).
   - `"AMRAP"`, `"até falha"` no lugar de reps → `amrap` no `set_type` da série.
3. Quando `set_scheme` é detectado:
   - `sets = scheme.length`, `reps = summarize(scheme)` (ex.: `"12-10-8-6"`), `rest_seconds = scheme[0].rest_seconds`.
   - `method_key` preenchido com o preset detectado ou `'custom'`.
4. Quando `set_scheme` é vazio/null: comportamento atual (forma agregada).
5. `validateAndFixResponse` no servidor:
   - Coerência: força `sets`, `reps`, `rest_seconds` a serem o resumo do `set_scheme` quando este existe.
   - Sanitização: `set_type` fora do enum vira `'normal'`; `set_number` recalculado se duplicado/lacunar.
   - Rejeição: se inválido após sanitização, descarta o `set_scheme` (volta a forma agregada).

### Regras especiais

**Modo avançado é livre desde a primeira série.**
Treinador pode entrar em "Avançado" e adicionar/remover/editar séries livremente, sem precisar escolher um preset. Presets são chips opcionais que apenas pré-preenchem a tabela. Editar qualquer linha após aplicar um preset → `method_key` vira `'custom'`. Isso permite total flexibilidade sem forçar fluxo guiado.

**Detecção automática de preset (heurística).**
Se o trainer monta manualmente uma sequência que coincide exatamente com um preset (ex.: 4 séries decrescentes 12-10-8-6 com descansos crescentes), `inferMethodKeyFromScheme` no save detecta e seta `method_key='pyramid_down'`. Isso é só pra exibição do chip e telemetria; não muda comportamento. A detecção é tolerante a pequenas diferenças (±10% nos descansos, reps exatas).

**Supersets bloqueados em modo avançado (V1).**
Exercícios dentro de superset (`parent_item_id !== null`) **não** podem usar modo avançado. O botão "Avançado" fica desabilitado com tooltip "Não suportado dentro de superset". `saveProgram` ignora silenciosamente qualquer `set_scheme` em itens com `parent_item_id` (defesa em profundidade). Entrar em superset um exercício que já tem `set_scheme` → confirm "Isso descartará o esquema de séries. Continuar?".

**`expandToSetScheme` preserva valores ao ativar Avançado.**
Quando o trainer aciona "Avançado" pela primeira vez, a tabela aparece com N séries idênticas baseadas nos 3 campos atuais (não com defaults zerados). Isso evita perder o que o treinador já tinha digitado. Mesma lógica reversa em "Voltar para modo simples": `summarizeSetScheme` preserva o que dá pra resumir e mostra warning se houver perda de informação.

**Watch app: sempre fallback gracioso.**
Se o JSON do snapshot pro Watch tem `set_scheme`, o Watch lê. Se não tem (programa legado ou Watch app antigo), Watch lê os agregados como hoje. Versionamento do snapshot é forward-compatible.

**Aluno não vê inputs de carga sugerida (V1).**
Os campos `weight_target_kg` e `weight_target_pct1rm` são metadados que o trainer prescreve mas que **não viram input** na tela do aluno. Eles aparecem como **hint visual** discreto (ex.: "sugerido: 80kg" em texto pequeno cinza ao lado do input de carga). Aluno digita o que executou normalmente em `set_logs.weight`.

## Critérios de Aceite

### Fase 1 — DB + Shared
- [x] Migration `111_per_set_prescription.sql` aplica limpa em DB vazio e em DB com dados de prod (sem afetar linhas existentes).
- [x] Tabelas `workout_item_set_templates`, `assigned_workout_item_sets`, `training_method_presets` criadas com RLS adequada.
- [x] Coluna `method_key` adicionada nas duas tabelas pais como nullable.
- [x] 6 presets de sistema seedados (`trainer_id IS NULL`) e visíveis via SELECT.
- [x] `WorkoutSet`, `SetType`, `MethodKey`, `TrainingMethodPreset` exportados de `@kinevo/shared`.
- [x] `summarizeSetScheme`, `expandToSetScheme`, `validateSetScheme`, `applyPreset`, `inferMethodKeyFromScheme` cobertos por testes Vitest.
- [x] `cd shared && npx vitest run` verde (40 testes — 24 novos + 16 pré-existentes). Typecheck pré-existente quebrado em `shared/types/database.ts` (arquivo gerado com cabeçalho corrompido em `main`); independente desta entrega.

### Fase 2 — Web Builder
- [x] Toggle "Avançado" aparece em cada `WorkoutItemCard`.
- [x] Clicar "Avançado" expande os 3 campos atuais em N séries idênticas via `expandToSetScheme`.
- [x] Tabela editável permite adicionar/remover/duplicar/editar série livremente.
- [x] Barra de presets aplica as 6 configurações de sistema; editar pós-preset → `method_key='custom'`.
- [x] Chip do `method_key` aparece no header da tabela.
- [x] "Voltar para modo simples" funciona com confirm dialog.
- [x] `saveProgram` persiste `workout_item_set_templates` row-by-row na ordem certa.
- [x] Load de programa existente hidrata `set_scheme` corretamente.
- [x] Modo avançado bloqueado dentro de superset (botão disabled + tooltip).
- [x] Programas sem `set_scheme` continuam editáveis e salváveis exatamente como hoje (smoke test).
- [x] `cd web && npx tsc --noEmit && npx vitest run` sem novos erros vs `main` (45 erros idênticos pré-existentes em `program-calendar.test.tsx`; 584 testes verdes).

### Fase 3 — Mobile Builder
- [x] `SetSchemeEditor` bottom sheet abre via botão "Editar séries" no card do builder.
- [x] UX: tabela vertical com card por série, steppers ergonômicos, presets em chips horizontais.
- [x] Chip do `method_key` aparece no card do builder quando aplicável.
- [x] `saveProgram` mobile persiste filhas (inserts row-by-row em `workout_item_set_templates`).
- [x] MMKV migration compatível: drafts pré-Fase-3 reabrem sem crash, com `set_scheme: null`.
- [x] Modo avançado bloqueado dentro de superset (botão "Editar séries" disabled em filhos).
- [x] `cd mobile && npx tsc --noEmit && npx vitest run` sem novos erros vs `main` (21 erros pré-existentes idênticos; 245 testes verdes — 6 novos).

### Fase 4 — Sala de Treino
- [x] `useWorkoutSession` hidrata os sets a partir de `assigned_workout_item_sets` quando existem.
- [x] Programas legados (sem filhas) continuam funcionando exatamente como hoje.
- [x] `SetRow` mostra badge do `set_type` para tipos não-`normal`.
- [x] Header do card mostra resumo (`12-10-8-6`) e chip do método.
- [ ] Watch app (iOS) consome `set_scheme` quando disponível e fallback quando não. **PENDENTE — entrega futura**: lib `getProgramSnapshotForWatch.ts` e `targets/watch-app` não foram tocados nesta entrega; comportamento atual mantido (Watch lê apenas agregados). Spec mantém retrocompatibilidade total — sem regressão.
- [x] `set_logs` continua sendo gravado com `set_number` correto, batendo com a série prescrita (contrato preservado).
- [x] Smoke test (manual pendente do Gustavo): aluno + treinador devem ver mesma prescrição no novo preview do builder e na execução.

### Fase 5 — Texto para Treino
- [ ] Edge Function `parse-workout-text` detecta os 5 padrões principais (`pyramid_down`, `pyramid_up`, `drop_set`, `5x5`, `cluster`).
- [ ] `set_scheme` retornado é coerente: `set_number` único e contínuo, `set_type` no enum, `sets`/`reps`/`rest_seconds` resumidos corretamente.
- [ ] Texto sem padrão variável continua retornando `set_scheme: null` e os 3 campos agregados (zero regressão).
- [ ] `ai-prescribe-panel.tsx` (web) e `TextPrescriptionSheet.tsx` (mobile) propagam `set_scheme` e `method_key` para o builder.
- [ ] Builder web e mobile abrem o card já em modo avançado quando o `set_scheme` chega via texto.
- [ ] Quando o LLM retorna `set_scheme` malformado, `validateAndFixResponse` faz fallback gracioso para a forma agregada.
- [ ] Smoke test: 10 textos diferentes (5 com pirâmide, 5 sem) parseados corretamente.
- [ ] `cd supabase/functions/parse-workout-text && deno check index.ts` limpo.

## Restrições Técnicas

- Seguir `web/CLAUDE.md` e `mobile/CLAUDE.md` (NativeWind no mobile, Tailwind v4 no web, Lucide para ícones, sem emoji em UI, sentence case, pt-BR hardcoded).
- Não usar `any`. Tipos vêm de `@kinevo/shared` (`WorkoutSet`, `SetType`, `MethodKey`).
- **Migration não pode tocar em linhas existentes.** Só criar tabelas filhas + adicionar colunas nullable + seed presets.
- **Retrocompat absoluta:** se `assigned_workout_item_sets` tem zero linhas pra um item, o app se comporta exatamente como hoje. Sem novo flag, sem novo erro.
- **`summarizeSetScheme` é a única fonte de verdade dos agregados** quando há `set_scheme`. Nunca persistir `sets/reps/rest_seconds` divergentes do que `summarizeSetScheme` produz — sempre re-aplicar antes do INSERT.
- **`workout_item_set_templates.set_number` é UNIQUE por item template.** Mesma regra para `assigned_workout_item_sets.set_number` por item assigned. INSERT em batch precisa garantir essa unicidade.
- **RLS estrita:**
  - `workout_item_set_templates`: trainer só vê/edita filhas dos seus templates.
  - `assigned_workout_item_sets`: trainer vê filhas dos seus assigned + aluno vê filhas dos seus assigned (paralelo às policies já existentes em `assigned_workout_items`).
  - `training_method_presets`: SELECT público pra `trainer_id IS NULL` (sistema), CRUD próprio para `trainer_id = current_trainer_id()`.
- **Set types e enums alinhados** entre TS, SQL CHECK constraint, e o system prompt da Edge Function. Mudar o enum em um lugar e esquecer outro é o erro mais comum aqui — adicionar teste de paridade.
- **Edge Function `parse-workout-text`** mantém compatibilidade com clientes pré-Fase 5: se o cliente não consumir `set_scheme`, ele simplesmente ignora o campo extra. Nenhuma quebra na API.
- **Não tocar no motor IA** (`web/src/lib/prescription/`). Schema strict do OpenAI continua exatamente como está.
- **Watch app** segue padrão atual de WatchConnectivity. Mudanças no payload precisam ser validadas com versionamento (`schemaVersion` no JSON).
- **MMKV merge callback** no Zustand persist: drafts antigos sem `set_scheme` precisam reabrir sem crash. Defaultar pra `null`.
- **Performance:** Edge Function não pode aumentar mais de 20% no tempo médio de resposta com a mudança de prompt. Se passar, simplificar o prompt.

## Edge Cases

- **Treinador entra em "Avançado" sem ter preenchido sets/reps/rest:** `expandToSetScheme(null, null, null)` retorna 3 séries default (10 reps, 60s, normal).
- **Treinador remove todas as séries da tabela:** botão "Salvar" fica disabled com erro inline "Pelo menos 1 série é obrigatória".
- **Treinador adiciona 50 séries:** sem erro hard, mas mostra warning "Mais de 20 séries é incomum — confirme antes de salvar". Aceita.
- **`set_scheme` chega do parser com 0 séries:** `validateAndFixResponse` descarta e volta para forma agregada.
- **Programa antigo é editado e o treinador entra em "Avançado", edita, e volta pra modo simples sem salvar:** estado local muda mas DB não é tocado até "Salvar". Cancelar no builder volta tudo.
- **Conflito: trainer A edita programa, trainer B (mesmo aluno, dual-trainer) edita ao mesmo tempo:** cenário fora de escopo (não é regression desta feature). Comportamento atual de last-write-wins se mantém.
- **Aluno está executando treino quando trainer atualiza prescrição:** sessão em curso usa o snapshot que foi carregado no início; mudanças do trainer só refletem na próxima sessão. (Comportamento atual.)
- **Aluno offline executa treino com `set_scheme`:** `set_logs` é gravado offline normalmente com `local_id` + `device_id` (offline-first existente). Sync replica como hoje.
- **Watch app antigo (não atualizado pós-Fase-4) lê programa com `set_scheme`:** ignora os campos novos e exibe os agregados. Nenhum crash.
- **Edge Function timeout (28s) com texto grande contendo pirâmide:** fallback para `gpt-4o-mini` (já existe). Se ambos falharem, retorna erro com `reason: 'timeout'`.
- **`method_key` no DB tem valor desconhecido (drift entre TS e DB):** UI exibe sem chip; tratado como `'custom'`.
- **Trainer salva preset pessoal via DB e remove depois:** UI tolerante — chip some sem crash.
- **Programa importado de outro trainer (sharing futuro):** filhas são copiadas no INSERT. Sem mudança nesta entrega (sharing está fora de escopo).
- **`reps` na série é "AMRAP"** com `set_type='amrap'`: input do aluno aceita qualquer número, `set_logs.reps_completed` salva o valor real.
- **`reps` na série é "5+5+5"** (cluster): input do aluno aceita texto livre — neste caso, `set_logs.reps_completed` salva a soma (15) e `set_logs.notes` registra a quebra. (Decidir com produto se vale ter campo separado pra cluster reps; V1 fica com soma + nota.)

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)

**Shared:**
- [ ] `summarizeSetScheme` — pirâmide → "12-10-8-6"; iguais → "10"; misturado → "10-12,8" (formato livre); vazio → erro.
- [ ] `summarizeSetScheme` — `rest_seconds` resumido como `min` da sequência (ou primeira série, decidir e documentar).
- [ ] `expandToSetScheme` — 3, "10-12", 60 → 3 séries iguais com `reps="10-12"`, `rest_seconds=60`, `set_type='normal'`.
- [ ] `expandToSetScheme` — null/null/null → 3 séries default.
- [ ] `validateSetScheme` — válido passa; `set_number` duplicado falha; `set_type` fora do enum falha; vazio falha; reps vazio falha.
- [ ] `applyPreset('pyramid_down', { sets: 4 })` — produz [12,10,8,6] reps com descansos crescentes.
- [ ] `applyPreset('drop_set', { base_reps: 10, drops: 2, drop_pct: 20 })` — 1 normal + 2 drops com `weight_pct1rm` reduzido.
- [ ] `applyPreset('5x5')` — 5 séries de 5 reps com 180s descanso.
- [ ] `inferMethodKeyFromScheme` — sequência decrescente típica → `pyramid_down`; customizada → `custom`; vazio → null.
- [ ] Roundtrip: `applyPreset(X) → inferMethodKeyFromScheme === X` para os 6 presets.

**Edge Function (Fase 5):**
- [ ] `validateAndFixResponse` — `set_scheme` válido passa; `sets/reps/rest_seconds` corrigidos pra bater com o resumo.
- [ ] `validateAndFixResponse` — `set_scheme` com `set_number` duplicado → descartado, volta a forma agregada.
- [ ] `validateAndFixResponse` — `set_type` fora do enum → coerce pra `'normal'`.
- [ ] `validateAndFixResponse` — `set_scheme` vazio → `null` no campo final.

### Server Actions / Queries (recomendado)

**Web:**
- [ ] `saveProgram` — programa com 1 exercício em modo avançado (4 séries pirâmide) salva 1 + 4 linhas corretamente.
- [ ] `saveProgram` — programa com superset contendo exercício com `set_scheme` ignora silenciosamente as filhas (defesa em profundidade).
- [ ] Load de programa: hidrata `set_scheme` quando existe; retorna `null` quando não.

**Mobile:**
- [ ] `useProgramBuilder.saveProgram` — mesmo cenário do web (1 exercício em pirâmide).
- [ ] `program-builder-store.initFromParsedText` — recebe parsed com `set_scheme` e popula corretamente.
- [ ] `useWorkoutSession` — hidrata sessão a partir de `assigned_workout_item_sets`.

### Componentes (opcional, smoke)
- [ ] `SetSchemeTable` (web) — abrir, aplicar preset, editar célula, voltar para modo simples.
- [ ] `SetSchemeEditor` (mobile) — abrir, aplicar preset, salvar.

### Integração (manual, checklist)
- [ ] Web: criar programa novo com pirâmide → salvar → reabrir → estado preservado.
- [ ] Web: editar programa antigo (sem set_scheme) → salvar → nada quebra.
- [ ] Mobile: builder com drop-set → save → aluno executa → confirma 3 séries com `set_type` correto.
- [ ] Texto para Treino: cola texto com 3 padrões diferentes → resultado tem 3 set_schemes corretos.
- [ ] Apple Watch: programa com pirâmide aparece no Watch com reps por série.

## Referências

### Código atual analisado
- `supabase/migrations/001_initial_schema.sql` — modelo atual de `workout_item_templates` e `assigned_workout_items` (linhas 109-200).
- `supabase/migrations/110_frequency_once.sql` — última migration aplicada (próxima livre é `111_`).
- `web/src/components/programs/program-builder-client.tsx` — interface `WorkoutItem` (linhas 39-54), `saveProgram` (linha ~987).
- `web/src/components/programs/workout-item-card.tsx` — inputs inline atuais (linhas 407-464).
- `web/src/components/programs/ai-prescribe-panel.tsx` — bridge do parse-text (linhas 82-102).
- `web/src/app/api/prescription/parse-text/types.ts` — `ParsedExercise` atual.
- `mobile/stores/program-builder-store.ts` — `WorkoutItem` (linhas 34-150), `initFromParsedText` (linha 239).
- `mobile/components/trainer/student/TextPrescriptionSheet.tsx` — sheet do parse-text (linhas 73-181).
- `mobile/hooks/useWorkoutSession.ts` — hidratação de sessão (linhas ~117-123).
- `mobile/components/workout/SetRow.tsx` — linha de série no aluno.
- `mobile/components/workout/ExerciseCard.tsx` — card de exercício no aluno.
- `mobile/lib/getProgramSnapshotForWatch.ts`, `mobile/lib/getNextWorkoutForWatch.ts` — payload pro Watch.
- `targets/watch-app/Models/WorkoutExecutionState.swift`, `Views/WorkoutExecutionView.swift` — Watch app.
- `supabase/functions/parse-workout-text/index.ts` — Edge Function de parse de texto (system prompt linhas 24-121, `validateAndFixResponse` linha 384).

### Documentos de produto
- `Plano_Feedbacks_Usuario_2026-04.md` — origem do feedback (P0 do roadmap).

### Specs análogas (padrão a seguir)
- `mobile/specs/active/unificacao-prescricao-ia-mobile.md` — modelo de spec multi-fase com web + shared + mobile.

## Notas de Implementação

### Fase 4.5c — UX overhaul (parte 1: pontos 3, 4, 6) (entregue)

Os 6 pontos do prompt original foram divididos em duas entregas:
- **4.5c (esta)** = pontos 3, 4, 6 — baixo risco, polish visual incremental.
- **4.5d (futura)** = pontos 1, 2, 5 — reestruturação maior, pendente
  validação visual da 4.5c primeiro.

**Ponto 3 — "Voltar para modo simples" e "Mais campos" separados:**
- Web (`SetSchemeTable.tsx`): botão "Voltar" agora vive em sua própria
  linha no topo da seção (canto esquerdo) com ícone `Undo2` + hover
  background. "Mais campos" continua à direita, na linha do chip do
  método. Conceitualmente: ação destrutiva (esquerda) ≠ toggle de
  visualização (direita).
- Mobile (`SetSchemeEditor.tsx`): "Voltar" foi movido do rodapé do
  ScrollView pro topo da lista (esquerda da linha do toggle). Mesma
  separação visual web/mobile.

**Ponto 4 — Borda esquerda colorida por `set_type`:**
- Web: `<tr>` ganha `border-l-4` colorida quando `set_type !== 'normal'`.
  Paleta: warmup zinc, top orange, backoff sky, drop rose, failure red,
  cluster violet, amrap blue. Cores ajustadas pra modo dark via
  variantes `dark:` do Tailwind.
- Mobile: `<View>` do `SetSchemeCard` ganha `borderLeftWidth: 3` +
  `borderLeftColor` na mesma paleta (hex direto). Type `normal` sem
  borda colorida, comportamento atual byte-a-byte.

**Ponto 6 — Ícones de ação mais legíveis:**
- Web: `Copy`/`Trash2` aumentados de 14px → 16px, padding `p-1` → `p-1.5`,
  hover background `hover:bg-zinc-100 dark:hover:bg-zinc-800`. Cor padrão
  mais clara (`text-zinc-400`) com hover mais escuro pra dar feedback
  visível. Tooltips e aria-labels renomeados de "série"/"fase" pra
  "linha" (termo neutro que cobre ambos os contextos linear/composto).
- Mobile: hit area aumentada de 28×28 (padding 6) → 36×36 com `hitSlop`
  de 8 em todos os lados → área efetiva ≥ 52px (ultrapassa o mínimo de
  44px da Apple HIG). Ícones 14px → 16px. `activeOpacity={0.6}` pra
  feedback visual ao toque.
- **Decisão**: mantive `TouchableOpacity` em vez de migrar pra
  `PressableScale` (sugerido no prompt). PressableScale traz animação
  Reanimated que tem risco maior de regressão visual; `activeOpacity`
  + `hitSlop` resolve a UX sem deps adicionais nem risco animação.
  Trabalho de animação fica como pendência futura se a UX atual não
  for satisfatória após validação visual.

**Pendente (Fase 4.5d):**
- Ponto 1 — Chips em segmented control + "Customizado" como 7º chip dinâmico.
- Ponto 2 — Picker inline kg/%1RM substituindo o toggle.
- Ponto 5 — Pílula de síntese substituindo o footer "Aluno verá...".

**Validações:**
- shared: 129/129 (sem código novo).
- web TS: 11 erros (idem baseline pré-Fase-4.5c — todos em test files).
- web vitest: 592/593 (sem novos testes; 1 skip pré-existente).
- mobile TS: 10 erros (idem baseline).
- mobile vitest: 255/255.

### Fase 4.5b — UX polish do modo Avançado (entregue)

Quatro melhorias coordenadas web + mobile pra fechar a feature pra produção.

**1. Toggle "+ Mais campos"** — RIR e Tempo escondidos por default
(poucos trainers preenchem; reduz densidade visual). Persiste por device:
- Web: `localStorage` chave `kinevo_setscheme_advanced_fields` (SSR-safe:
  primeiro render é `false`, `useEffect` rehidrata client-side).
- Mobile: MMKV bucket `kinevo-setscheme-prefs` chave `advanced_fields_mobile`,
  com fallback in-memory pra Expo Go / testes (igual ao padrão do
  `program-builder-store.ts`).
- Botão "Mais campos" / "Menos campos" com ícone `ChevronDown`/`ChevronUp`,
  alinhado à direita do header da tabela / acima da lista de fases.

**2. Banner azul "rounds × phases"** — visível só pra métodos compostos
com `rounds > 1`. Texto:
> Esta estrutura de N fases será repetida X vezes. Cada rodada inteira
> conta como 1 série efetiva no volume semanal.

A segunda frase **propositalmente** menciona o helper de volume da Fase
4.5a — ensina o trainer que o cálculo está alinhado com a literatura.
Também evita colisão com o footer "Aluno verá: N rodadas × M fases =
(N×M) fases no total" que continua existindo (são informações
complementares, não duplicadas).

**3. Chip do método no card colapsado**:
- Web (`workout-item-card.tsx`): chip violeta inline com ícone `Sliders`
  ao lado das pílulas de muscle group, na simple-mode também. Aparece
  só quando `getMethodChipLabel(method_key) !== null` (esconde para
  `'standard'` e `null`).
- Mobile: já existia desde Fase 4.3 (`WorkoutItemRow.tsx` linha 154 —
  Row 3 com chip + badge de rodadas + botão "Editar séries"). Verificado:
  satisfaz o item 3. Sem mudança extra.

**4. Renomear "Avançado" → "Editar séries"** (com ícone `Sliders`):
- Web (`AdvancedToggleButton`): texto trocado, ícone preservado.
- Mobile: já estava correto desde a Fase 4.3.

**Arquivos tocados:**
- `web/src/components/programs/SetSchemeTable.tsx` — toggle, banner,
  conditional headers/cells, ChevronDown/ChevronUp/Repeat imports.
- `web/src/components/programs/workout-item-card.tsx` — chip inline,
  rename do botão.
- `web/src/components/programs/__tests__/SetSchemeTable.test.tsx` —
  3 testes novos: banner aparece, banner ausente em linear, toggle
  esconde/revela RIR e Tempo.
- `mobile/components/trainer/program-builder/SetSchemeEditor.tsx` —
  state + MMKV helper + banner + toggle button + título conditional
  + propaga `showAdvancedFields` aos cards.
- `mobile/components/trainer/program-builder/SetSchemeCard.tsx` —
  prop `showAdvancedFields` (default false) escondendo FieldRow de
  RIR e Tempo.

**Validações:**
- Shared: 129/129 (sem novos testes — sem código shared).
- Web TS: 11 erros (idem baseline pré-Fase-4.5b — todos em test files).
- Web vitest: 592/593 (3 testes novos no SetSchemeTable.test.tsx).
- Mobile TS: 10 erros (idem baseline).
- Mobile vitest: 255/255.

### Fase 4.5a — Volume correto para métodos compostos (entregue)

Bug reportado pelo Gustavo: o cálculo de volume no builder superestimava
2-3× drop-set e cluster. `weeklySets = item.sets * frequency` lia o `sets`
materializado (3 rondas × 3 fases = 9), produzindo "drop-set 3 rondas ×
2x/semana = 18 sets/semana" quando o correto é 6.

**Convenção**: 1 ronda = 1 série efetiva. Drop-set 3 rondas = 3 effective
sets, cluster idem. Linear (pirâmide, 5×5, top+backoff) mantém: cada fase
é uma série. Alinha com Schoenfeld et al. e com o contador de progresso
do aluno ("Rodada N de M").

**Helper único** (`shared/lib/prescription/volume.ts`):
- `effectiveSetsForVolume(item)` retorna `rounds` quando `rounds > 1`
  (compound), `sets ?? 0` no resto. Defensivo contra null. 5 testes.

**Aplicado em 4 superfícies:**
- `mobile/components/trainer/program-builder/volume-helpers.ts` →
  `calculateVolume` aceita `rounds` e usa o helper. 5 testes novos no
  mobile cobrindo linear, compound, mix e edge cases.
- `web/src/components/programs/volume-summary.tsx` → `processItem`
  usa o helper; superset children entram pelo mesmo caminho.
- `web/src/app/students/[id]/actions/get-program-muscle-volume.ts` →
  SELECT inclui `rounds`; loop usa `effectiveSetsForVolume`.
- `web/src/lib/reports/program-report-service.ts` → **não tocado**. Esse
  serviço lê `set_logs` (execução real), não prescrição: cada fase
  executada é um log próprio, e o cálculo "X sets per muscle" sobre logs
  reais já está correto e documentado nos comments do arquivo (linhas
  50-65).

**Excluído (mantém comportamento atual):**
- Motor de IA (`web/src/lib/prescription/`): não conhece compound
  methods e gera tudo com rounds=1; volume permanece correto.
- Programas pré-Fase-4.3 com drop-set salvo como linear (rounds=null,
  sets=9): continuam mostrando 9 sets — não é regressão, é o que está
  no DB. Solução: trainer re-prescrever pra atualizar pro modelo de
  rondas.

**Validações:**
- shared:  129/129 (5 novos)
- mobile:  255/255 (5 novos), TS 10 erros pré-existentes (idem baseline)
- web TS:  11 erros (idem baseline pré-Fase-4.5a — todos em test files)
- web vitest: 589/590 (1 skip pré-existente)

**Antes/depois:**
- Drop-set 3 rondas × 3 fases × 2x/semana
  - Antes: 9 × 2 = 18 sets/semana
  - Depois: 3 × 2 = 6 sets/semana ✓
- Pirâmide ↓ 4 séries × 2x/semana
  - Antes: 4 × 2 = 8 sets/semana
  - Depois: 4 × 2 = 8 sets/semana (idêntico) ✓

### Fase 4.4 — Paridade web do modelo de rodadas (entregue)

Gap conhecido da Fase 4.3 fechado: o builder web agora entende o modelo
`rounds × phases` que o mobile já entregava. Programa criado/editado pelo
treinador via web salva exatamente como o mobile, e programas vindos do
mobile abrem no web preservando a estrutura per-round visível.

**Shared:**
- `set-scheme.ts` ganha `collapseExpandedScheme(expandedScheme, roundsHint)`
  — inverso do `expandSchemeByRounds`. Lê linhas materializadas do DB e
  reduz pra forma per-round (1 rodada visível + `rounds: N`). Tolera
  inconsistências (length não divisível por rounds → fallback para flat
  rounds=1) e null/undefined safely. 5 testes novos cobrem roundtrip,
  fallback, null safety e edge cases. Total shared: 124/124.

**Web (apenas paridade — sem polimento UX, esse é Fase 4.5):**
- `program-builder-client.tsx`:
  - `WorkoutItem` ganha `rounds?: number | null` (opcional pra não quebrar
    callers existentes; default 1 nas inserções).
  - `ProgramData['workout_item_templates']` ganha `rounds`. `page.tsx`
    SELECT inclui `rounds` no parent e `round_number` nas filhas.
  - `hydrateSetScheme(rows, roundsHint)` agora retorna
    `{ scheme, rounds }` via `collapseExpandedScheme`. Linear e legacy
    (rounds=1 default) seguem renderizando flat.
  - `addExerciseFromLibrary` e `addExerciseToWorkout` defaultam
    `rounds: 1` + `set_scheme: null` + `method_key: null`.
  - `aggregatesFromItem` usa `summarizeWithRounds` quando compound;
    `summarizeSetScheme` quando linear. Mantém invariante: agregados
    salvos sempre derivados via summarize.
  - `effectiveRoundsForItem(item)` clamp 1..20 + force 1 para linear /
    sem scheme, defesa em profundidade igual ao mobile.
  - `insertSetSchemeRows` materializa via `expandSchemeByRounds` antes de
    inserir e taggea `round_number` 1..N (NULL para linear).
  - Ambos os save paths (saveProgram + saveAsTemplate) propagam `rounds`
    no INSERT do parent.
- `SetSchemeTable.tsx`:
  - Aceita props `rounds?: number | null`. `onChange` agora é
    `(scheme, methodKey, rounds) => void`.
  - Apply preset → seta `rounds = SYSTEM_PRESETS[key].defaultRounds`
    (3 para drop-set/cluster, 1 para lineares).
  - Stepper "Rodadas" [-/+] visível só quando `isCompoundMethod(displayKey)`.
    Range 1..20. Editar uma fase preserva o `rounds` (chip vira `'custom'`
    mas a estrutura composta continua sendo composta).
  - Section title "Estrutura de uma rodada" acima da tabela quando compound.
  - Botão "+ Adicionar fase" (vs "+ Adicionar série") quando compound.
  - Footer informativo "Aluno verá: N rodadas × M fases = (N×M) fases no
    total" quando compound + rounds > 1.
- `workout-item-card.tsx`:
  - Wire `rounds` via `<SetSchemeTable rounds={...} onChange={...} />`.
  - Ao entrar em Avançado pela primeira vez (`expandToSetScheme`) seta
    `rounds: 1`.
  - `onExitAdvanced` usa `summarizeWithRounds` quando compound (preserva
    o total real no agregado), `summarizeSetScheme` quando linear.
- `__tests__/SetSchemeTable.test.tsx`: testes existentes adaptados pra
  nova assinatura + 5 testes novos (apply preset compound seeds rounds=3,
  cell edit preserva rounds, stepper aparece só pra compound, "Adicionar
  fase" condicional, footer "Aluno verá").
- `edit-assigned-program-client.tsx`: `WorkoutItem` ganha
  `set_scheme/method_key/rounds` opcionais (read-only — esse fluxo de
  edição direta de assigned program **não foi tocado no save**, mantém
  pendência geral desde a Fase 2).

**Validações:**
- Web TS = 11 erros — IDÊNTICO ao baseline pré-Fase-4.4. Todos pré-existentes
  em `program-calendar.test.tsx` e `student-insights-card.test.tsx`.
- Web vitest: 589/590 (5 novos no SetSchemeTable.test.tsx; 1 skip pré-existente).
- Shared: 124/124 (5 novos).

**Pendências documentadas (Fase 4.5):**
- Toggle "+ Mais campos" (esconder RIR/Tempo por default no web e mobile).
- Banner azul "Esta estrutura será repetida N vezes…".
- Chip do método no card colapsado simple-mode.
- Botão "Avançado" → "Editar séries" com ícone Sliders (web + mobile).

### Fase 4.3 — Modelo de rodadas para métodos compostos (entregue)

**Decisão de modelagem (caminho A — materialização):** o trainer prescreve UMA rodada no editor e indica `rounds`. No save, `expandSchemeByRounds(perRound, rounds)` materializa N×M linhas físicas em `workout_item_set_templates`, cada uma com `set_number` único (1..N×M) e `round_number` 1..N. Mantém invariante `UNIQUE(item_id, set_number)` e compatibilidade total com `set_logs` / `get_previous_exercise_sets`. Programas lineares ficam com `rounds=1` e `round_number=NULL` — comportamento atual byte-a-byte.

**Migration 112** (`112_rounds_for_compound_methods.sql`):
- `workout_item_templates.rounds INTEGER NOT NULL DEFAULT 1 CHECK(1..20)`
- `assigned_workout_items.rounds` (espelho)
- `workout_item_set_templates.round_number INTEGER NULL CHECK(>=1)`
- `assigned_workout_item_sets.round_number` (espelho)
- Aplicada via `mcp__claude_ai_Supabase__apply_migration` no projeto `lylksbtgrihzepbteest`.

**Shared (`shared/lib/prescription/`):**
- `set-scheme.ts`: `expandSchemeByRounds(perRound, rounds)` (materializa, clamp 1..20, taggea `round_number`); `deriveRoundAndPhase(setNumber, phasesPerRound)` (helper inverso); `summarizeWithRounds(perRound, rounds)` (formato compacto "3× 10/8/8" para compostos, fallback `summarizeSetScheme` para lineares).
- `set-scheme-presets.ts`: `SystemPresetDefinition` ganha `defaultRounds`. Presets compostos (`drop_set`, `cluster`) viram `defaultRounds: 3` e descrevem UMA rodada. Cluster reformulado: 3 fases (8 / 4 / 2 reps) com micro-rest interno e rest longo no final da rodada. Lineares ficam `defaultRounds: 1`.
- `COMPOUND_METHOD_KEYS` + `isCompoundMethod()` — fonte única para a UI decidir mostrar campo "Rodadas" e fazer agrupamento.
- 11 testes novos cobrindo `expandSchemeByRounds`, `deriveRoundAndPhase`, `summarizeWithRounds`. Total shared: 119.

**Mobile builder:**
- `program-builder-store.ts`: `WorkoutItem.rounds: number` (default 1). MMKV merge defaulta pra 1 em drafts pré-Fase-4.3. `setSetScheme` aceita `rounds` opcional.
- `SetSchemeEditor.tsx`: campo "Rodadas" com stepper [-/+] (1..20) só visível para métodos compostos. Texto "Estrutura de uma rodada" acima da lista. Botão "Adicionar fase" (vs "Adicionar série") quando compound. Aplicar preset auto-popula `rounds` com `defaultRounds`. Save retorna `{ scheme, methodKey, rounds, aggregates }` — agregados via `summarizeWithRounds` quando compound.
- `WorkoutItemRow.tsx`: badge "3 rodadas × 2 fases" ao lado do chip do método quando `rounds > 1`.
- `useProgramBuilder.ts`: `effectiveRoundsForItem` (clamp + skip lineares); `aggregatesFromItem` usa `summarizeWithRounds` para compostos; `insertSetSchemeRows` materializa via `expandSchemeByRounds` e taggea `round_number`. Parent INSERT propaga `rounds`.

**Edge Function `assign-program` (v5 deployada via MCP):**
- SELECT inclui `rounds` (já vinha via `*`) e `round_number` (explícito) das filhas.
- INSERT em `assigned_workout_items` propaga `rounds` (raiz e filhos de superset, `?? 1` defesa em profundidade).
- INSERT em `assigned_workout_item_sets` propaga `round_number` 1:1 (filhas já vêm materializadas pelo `saveAsTemplate`).

**Mobile execução:**
- `useWorkoutSession.ts` + `useTrainerWorkoutSession.ts`: SELECT inclui `rounds` no item e `round_number` na linha. `ExerciseData.rounds` populado.
- `lib/hydrateWorkoutSets.ts`: `SetPrescription.round_number: number | null` propagado.
- `stores/training-room-store.ts`: `ExerciseData.rounds` (required). MMKV merge defaulta pra 1.
- `components/workout/ExerciseCard.tsx`: prop `rounds`. Quando `rounds > 1` e há `round_number`, agrupa renderização em N seções "Rodada X de Y" com indicador ✓ (todas as fases concluídas) e separador violeta. Header de resumo vira "3 rodadas · 2 fases · 10/8 reps". Linear / legacy mantém renderização atual byte-a-byte.
- `program-builder/preview.tsx`: expande `set_scheme` localmente via `expandSchemeByRounds` antes de passar pro `<ExerciseCard>` — preview mostra exatamente o que o aluno verá pós-save.

**Decisões:**
- **Caminho A escolhido sobre B (round/phase numbers semânticos relaxando UNIQUE)** porque preserva invariantes do `set_logs` e `get_previous_exercise_sets` sem mexer em índices em produção. Custo da expansão: localizado no save (uma vez), não em runtime.
- **Cluster preset reformulado**: legado tinha 1 fase com reps "8+4+2"; novo modelo tem 3 fases per-round com defaultRounds=3. Programas pré-Fase-4.3 com cluster antigo continuam renderizando como hoje (rounds=1, 1 fase) — sem migração de dados.
- **`summarizeWithRounds` separado, não substitui `summarizeSetScheme`**: callers existentes não quebram; novo formato "3× 10/8/8" só aparece quando compound. Rest_seconds do agregado pega o micro-rest da fase 1 (não o inter-round) — leitor legado vê o descanso curto, o que é mais conservador.
- **Watch app não foi atualizado**: continua lendo agregados (já estava assim na Fase 4). Programas com rounds expandidos chegam no Watch como N×M séries lineares — funciona graceful, sem chip de método. Pendência futura.

### Fase 4.2 — Meta de carga visível por série (entregue)

- `shared/lib/prescription/set-scheme.ts` — adicionados `formatWeightKg` e `buildWeightMetaLabel`. O segundo cobre os 4 cenários: só kg → "Meta: 80 kg"; só %1RM → "Meta: 75% 1RM"; ambos → "Meta: 80 kg (75% 1RM)"; nenhum → `null` (UI esconde a label). `formatWeightKg` strip de `40.0` → `40` e mantém `22.5`. 7 novos testes.
- `mobile/components/workout/SetRow.tsx` — props novas opcionais `weightTargetKg` e `weightTargetPct1rm`. A célula de Peso agora é stack ("Meta: 80 kg" violeta acima do input) idêntica à célula de Reps. Placeholder do input prioriza target → previous → "kg". Label só aparece quando `buildWeightMetaLabel` retorna não-null — comportamento atual preservado byte-a-byte para programas sem prescrição de carga.
- `mobile/components/workout/ExerciseCard.tsx` — propaga `prescription.weight_target_kg` e `prescription.weight_target_pct1rm` (já hidratados pelo `SetPrescription`) pro SetRow. Paridade automática nas 3 superfícies (aluno / treinador / preview).

**Decisões:**
- Helper foi parar em `set-scheme.ts` (não em `method-labels.ts`) porque é meta de carga, não de método. Ambos exportados via re-export do `set-scheme.ts`.
- Layout do peso virou stack (label + input) só quando há meta — quando não há, é só o input simples. Linhas sem prescrição de carga ficam visualmente idênticas ao comportamento atual.

### Fase 4.1 — Fix do fluxo de atribuição + polimento visual (entregue)

**Bug encontrado e corrigido:**
- `supabase/functions/assign-program/index.ts` (Edge Function chamado pelo builder mobile manual em `saveAndAssign`) **não estava propagando `method_key`** para `assigned_workout_items` nem **copiando as linhas** de `workout_item_set_templates` → `assigned_workout_item_sets`. Resultado: programa salvo com pirâmide/drop-set caía no fallback agregado quando o aluno abria a sessão. O screenshot do "Supino Inclinado Articulado" (Drop-set 10/8/8) bateu com esse cenário.
- Fix: SELECT do template agora inclui `workout_item_set_templates(*)` no JOIN; INSERT raiz e filho propagam `method_key`; após cada item raiz, INSERT em batch das filhas em `assigned_workout_item_sets` (supersets V1 ficam fora — não têm per-set por design).
- Edge Function deployada via Supabase MCP no projeto `lylksbtgrihzepbteest` (Kinevo 2.0) — versão 4 ativa.
- **Programas atribuídos antes do fix continuam com dados per-set vazios.** Backfill retroativo é possível (copiar de `workout_item_set_templates` pra `assigned_workout_item_sets` via SQL) mas não foi feito nesta sessão — pendente confirmação após teste manual.
- **Path de atribuição via IA** (`/api/programs/assign` no web, usado quando `originatedFromAi=true`) também não propaga per-set hoje. Fora do escopo da Fase 4.1 (Gustavo usa fluxo manual). Documentado como pendência.

**Polimento visual** (3 superfícies, paridade automática via `ExerciseCard` compartilhado):
- `shared/lib/prescription/set-type-labels.ts` — `SET_TYPE_LABELS` (full pt-BR) + `SET_TYPE_BADGE_LABELS` (compact uppercase: TOP/DROP/BACK/CLUSTER/AMRAP/W/FAIL). Fonte única, com test de paridade contra `SET_TYPE_OPTIONS`.
- `mobile/components/workout/SetTypeBadge.tsx` — badge agora lê texto do shared (`SET_TYPE_BADGE_LABELS`), removendo strings hardcoded ("Aq./Top/Back" antigo).
- `mobile/components/workout/SetRow.tsx` — **label "Meta: 10"** (violeta, peso 700, 10pt) renderizada **acima** do input de Reps quando há `repsTarget`. Casos especiais: cluster vira "Meta: 5+5+5 · cluster"; AMRAP vira "Meta: até a falha". Placeholder do input também ganha tom violeta translúcido. Layout do reps virou stack (label em cima + input embaixo) dentro da mesma célula.
- `mobile/components/workout/ExerciseCard.tsx` — chip do método ganhou **ícone Lucide específico** por chave (`TrendingDown` pirâmide↓, `TrendingUp` pirâmide↑/top+backoff, `ChevronsDown` drop, `Layers` cluster, `Dumbbell` 5×5, `Pencil` custom), borda sutil e tipografia ligeiramente maior. Acessibilidade: `accessibilityLabel="Método: …"`.
- Training-room (treinador) e preview (builder) reaproveitam o `<ExerciseCard>` modificado → ganham os mesmos refinos sem mudança extra.

### Fase 4 — Sala de Treino + Preview no Builder (entregue)

**Arquivos criados:**
- `shared/lib/prescription/method-labels.ts` — `METHOD_KEY_LABELS` + `getMethodChipLabel`. Fonte única do label do chip de método. Usado por aluno, treinador e preview pra garantir paridade visual.
- `shared/lib/prescription/__tests__/method-labels.test.ts` — 3 testes (paridade enum/labels, hide para `null`/`'standard'`, labels traduzidos).
- `mobile/lib/hydrateWorkoutSets.ts` — `hydrateSetPrescriptions({ assignedSets, aggregateSets, aggregateReps, aggregateRestSeconds })`. Helper único usado por `useWorkoutSession` (aluno) e `useTrainerWorkoutSession` (treinador) — evita drift entre os dois caminhos. Retorna `SetPrescription[]`.
- `mobile/lib/__tests__/hydrateWorkoutSets.test.ts` — 5 testes (sort por set_number, fallback aggregate, null/undefined, zero sets, set_type preservado em drop/cluster/amrap).
- `mobile/components/workout/SetTypeBadge.tsx` — badge compact (dot ícone) e full (ícone + label) por `SetType`. Cores por tipo conforme spec (warmup cinza, top laranja, drop vermelho, cluster roxo, amrap azul, etc.).
- `mobile/app/program-builder/preview.tsx` — tela "Visualizar como aluno". Lê `useProgramBuilderStore` (draft em memória), agrupa supersets, renderiza com `<ExerciseCard readOnly>` reaproveitando o componente da execução do aluno → paridade visual garantida por construção.

**Arquivos editados:**
- `mobile/components/workout/SetRow.tsx` — props novas opcionais `setType`, `repsTarget`, `readOnly`. Badge à esquerda da linha pra `setType !== 'normal'`. Placeholder do reps usa `repsTarget` (ex: "6" na 4ª série de pirâmide). Cluster (`reps` com `+`) renderiza hint "Meta: 5+5+5" abaixo do input em violeta. AMRAP usa placeholder "AMRAP". `readOnly` esconde check button e desabilita inputs sem alterar layout.
- `mobile/components/workout/ExerciseCard.tsx` — props novas `setScheme?: SetPrescription[] | null`, `methodKey?: MethodKey | null`, `readOnly?: boolean`. Header ganha chip violeta com label do método (`getMethodChipLabel`). Resumo "X séries · Y reps · Zs descanso" deriva de `setScheme` quando presente (ex: "4 séries • 12-10-8-6 • 90s descanso"). Cada `SetRow` recebe `setType`/`repsTarget` via index do scheme.
- `mobile/components/workout/SupersetGroup.tsx` — passa `setScheme` e `methodKey` para os ExerciseCard filhos. Em superset modo avançado é bloqueado (V1), então as filhas chegam vazias e o comportamento atual é preservado.
- `mobile/hooks/useWorkoutSession.ts` — interface `ExerciseData` ganha `setScheme: SetPrescription[]` e `methodKey: MethodKey | null`. Query do item agora seleciona `method_key`. Query secundária em `assigned_workout_item_sets` (filtrada pelos IDs dos itens-exercício) hidrata via `hydrateSetPrescriptions`. Quantidade de séries (`setsData`) passa a vir do scheme quando presente. Items sem filhas mantêm comportamento atual byte-a-byte.
- `mobile/hooks/useTrainerWorkoutSession.ts` (`useFetchStudentWorkout`) — após o RPC `get_student_today_workout_for_trainer`, faz dois `Promise.all` selects (`assigned_workout_item_sets` e `assigned_workout_items.method_key`) e popula a sessão do trainer pelo mesmo `hydrateSetPrescriptions`. RPC ainda não foi alterado — a query secundária resolve sem mudança server-side.
- `mobile/stores/training-room-store.ts` — `ExerciseData` ganha `setScheme: SetPrescription[]` e `methodKey: MethodKey | null` (required). Callback `merge` defaulta esses campos pra `[]` / `null` em sessões persistidas pré-Fase-4 → MMKV migration sem crash.
- `mobile/app/training-room.tsx` — passa `setScheme`/`methodKey` no ExerciseCard.
- `mobile/app/workout/[id].tsx` — passa `setScheme`/`methodKey` no ExerciseCard (aluno).
- `mobile/app/program-builder/index.tsx` — botão "Visualizar como aluno" (ícone `Eye`) ao lado dos botões IA / Salvar. Disabled quando o draft não tem nenhum exercício. Navega para `/program-builder/preview`.

**Decisões de implementação:**
- **Helper único de hidratação** (`hydrateSetPrescriptions`) usado pelos dois hooks (aluno + treinador). Centralizar evita drift; fallback aggregate é byte-a-byte equivalente ao comportamento atual quando não há `assigned_workout_item_sets`.
- **Preview reaproveita `<ExerciseCard readOnly>`** em vez de criar um `ExerciseCardPreview` separado. Princípio: "renderizar o draft do builder com o mesmo componente que renderiza a execução real" — paridade visual garantida por construção. `readOnly` esconde botões de swap/vídeo/check e desabilita inputs (mantém layout).
- **Cluster reps**: placeholder do reps no SetRow mostra a quebra prescrita (ex: "5+5+5") e abaixo da linha aparece um hint "Meta: 5+5+5" em violeta. O input continua numérico (aluno digita a soma do que executou). Match com o que a spec descreve em Edge Cases.
- **AMRAP**: placeholder vira "AMRAP" quando `set_type === 'amrap'` ou quando o `repsTarget` contém "amrap"/"falha" (case-insensitive). Aluno ainda digita um número; `set_logs.reps_completed` armazena o valor real.
- **`set_logs` não foi tocado.** O contrato de gravação (`set_number`, `weight`, `reps_completed`) continua exatamente como antes — `set_number` agora bate com a série prescrita (1, 2, 3, ...) seja em programa novo ou legado.
- **Watch app deixado como pendência.** Lib `getProgramSnapshotForWatch` / `getNextWorkoutForWatch` e os arquivos Swift do `targets/watch-app/` não foram alterados. Como o Watch só lê os agregados, nenhuma regressão — programa com `set_scheme` continua executável no Watch usando a forma agregada (que é re-derivada via `summarizeSetScheme` no save). Entrega futura: passar `set_scheme` no payload e ler `setScheme[setIndex].reps` no `WorkoutExecutionView.swift`.
- **Modo readonly do preview NÃO escreve nada no banco.** É puramente visual. `onSetChange`/`onToggleSetComplete` recebem callbacks no-op.
- **Treinador vendo mesmo que aluno**: o `hydrateSetPrescriptions` é o mesmo helper, e a query é equivalente (`assigned_workout_item_sets` filtrado por `assigned_workout_item_id`). O RPC do treinador (`get_student_today_workout_for_trainer`) não foi modificado — tipos `Database` não foram regenerados nesta sessão. Entrega futura pode trazer as filhas no próprio RPC pra reduzir round-trips.

### Fase 3 — Mobile Builder (entregue)

**Arquivos criados:**
- `mobile/components/trainer/program-builder/SetSchemePresetChips.tsx` — barra horizontal scroll com os 6 chips de preset, haptic em toque.
- `mobile/components/trainer/program-builder/SetSchemeCard.tsx` — card vertical por série com steppers (Carga, RIR, Descanso) e chips de tipo. Toggle kg/%1RM. Inputs livres pra Reps e Tempo.
- `mobile/components/trainer/program-builder/SetSchemeEditor.tsx` — bottom sheet (`Modal pageSheet`, mesmo padrão do `TextPrescriptionSheet`). Header com nome do exercício + chip do método + Salvar. Lista de cards de série + botão "+ Adicionar série" + "Voltar para modo simples" no rodapé com `Alert.alert` de confirmação.
- `mobile/components/trainer/program-builder/__tests__/setSchemeEditor.test.ts` — 6 testes de fluxo de dados (expandir, aplicar preset, edit→custom, exit→summary, roundtrip dos 6 presets).

**Arquivos editados:**
- `mobile/stores/program-builder-store.ts` — `WorkoutItem` ganha `set_scheme: WorkoutSet[] | null` e `method_key: MethodKey | null`. `ParsedExerciseForBuilder` aceita os dois campos opcionalmente (Fase 5 vai propagar). `addExercise`, `initFromParsedText`, `initFromAiSnapshot` defaultam `null`. Nova action `setSetScheme(workoutId, itemId, scheme, methodKey)`. `updateItem` aceita os dois campos novos. `merge` callback estende com walk per-item defaultando `set_scheme`/`method_key` em drafts antigos.
- `mobile/components/trainer/program-builder/WorkoutItemRow.tsx` — esconde `SetRepsInput` quando `set_scheme` ativo (mostra resumo). Nova row com chip do método (`Pirâmide ↓`, `Drop-set`, `Customizado`) + botão "Editar séries" disabled em superset (`parent_item_id !== null`).
- `mobile/app/program-builder/index.tsx` — state `setSchemeEditingItemId`, callback `handleSchemeSave` que chama `setSetScheme` + sincroniza agregados via `summarizeSetScheme`. Renderiza `<SetSchemeEditor>` com `fallbackAggregates` do item.
- `mobile/hooks/useProgramBuilder.ts` — `saveAsTemplate` agora deriva agregados via `summarizeSetScheme` quando há scheme; persiste `method_key` no pai; insere filhas em `workout_item_set_templates` via `insertSetSchemeRows` (no-op em modo simples e em filhos de superset).
- `mobile/hooks/__tests__/useProgramBuilder.test.ts` — fixture do superset child ganha `set_scheme: null, method_key: null` (compat com nova interface).
- `mobile/vitest.config.ts` — alias `@kinevo/shared` adicionado pra que o smoke test do editor importe os helpers do shared.

**Decisões de implementação:**
- **Bottom sheet via `Modal pageSheet`** (mesmo padrão do `TextPrescriptionSheet` em `mobile/components/trainer/student/`). Não introduzi `@gorhom/bottom-sheet` — manter dependências mínimas.
- **Steppers (+/−) pra Carga/RIR/Descanso** em vez de inputs digitados, conforme spec ("steppers ergonômicos em academia"). Reps e Tempo continuam como `TextInput` porque aceitam strings livres ("10-12", "AMRAP", "3-1-1-0").
- **Toggle kg/%1RM**: ao alternar, a unidade vira o display + zera a outra (`weight_target_kg=null` quando ativando %1RM, e vice-versa). Mantém apenas um valor por vez no DB.
- **`onChange` do editor sempre seta `method_key='custom'`** quando usuário edita célula. Inferência exata pra preset acontece no save via `inferMethodKeyFromScheme`. Mesma estratégia da Fase 2 web.
- **`setSchemeEditingItemId` lifted no `program-builder/index.tsx`** em vez de state local em `WorkoutItemRow` — evita render do Modal em cada row e permite que o callback `onEditSets` seja `undefined` em readonly views futuros.
- **`workout_item_set_templates` ainda não está no `Database` types regenerado.** Mesma situação da Fase 2; cast `(supabase.from as any)` na linha do INSERT como workaround. `npm run gen:types` (com Docker) deve ser rodado a qualquer momento — funciona retroativamente.
- **Smoke test puro de fluxo de dados**, não componente. Mobile workspace não tem `@testing-library/react-native` configurado (vitest jsdom-only), então renderizar `<SetSchemeEditor>` exigiria adicionar dependência fora do escopo. O teste cobre as transições que o componente percorre internamente: `expandToSetScheme` → `applyPreset` → edit→custom → `summarizeSetScheme`. Cobertura efetiva equivalente ao test do web (Fase 2) sem o overhead.
- **Modo avançado bloqueado em superset**: 3 camadas. (1) Botão "Editar séries" disabled em `WorkoutItemRow` quando `item.parent_item_id !== null`. (2) `initFromParsedText` força `null` em filhos de superset e no parent. (3) `insertSetSchemeRows` early-returns para items com `parent_item_id`.
- **Edição de programa atribuído (`assigned_workout_items`) NÃO foi tocada nesta entrega.** Spec especifica builder de templates; edição direta de assigned program é fluxo separado, mesmo follow-up que web Fase 2.

### Fase 2 — Web Builder (entregue)

**Arquivos criados:**
- `web/src/components/programs/SetSchemePresetChips.tsx` — barra horizontal com os 6 chips de preset; destaca o ativo via `aria-pressed`.
- `web/src/components/programs/SetSchemeTable.tsx` — tabela editável com colunas `#`, Tipo (select), Reps, Carga (kg/%1RM toggle), RIR, Descanso, Tempo, ações (duplicar/remover) + botão "+ Adicionar série" + chip do método no header + "Voltar para modo simples" com confirm.
- `web/src/components/programs/__tests__/SetSchemeTable.test.tsx` — 5 smoke tests (render, aplicar preset, edit demote pra custom, exit confirma, exit cancela).

**Arquivos editados:**
- `web/src/components/programs/program-builder-client.tsx` — `WorkoutItem` ganha `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`; `ProgramData` declara o JOIN; `initializeWorkouts` hidrata via `hydrateSetScheme`; ambos os fluxos de save (`saveProgram` e `saveAsTemplate`) passam por `aggregatesFromItem` (deriva agregados de `summarizeSetScheme` quando há scheme), `effectiveMethodKey` (zera em filhos de superset) e `insertSetSchemeRows` (INSERT em batch nas filhas).
- `web/src/components/programs/workout-item-card.tsx` — inputs inline atuais ficam escondidos quando `set_scheme !== null`; novo botão "Avançado" (componente `AdvancedToggleButton`) chama `expandToSetScheme` e seta o scheme; quando ativo, renderiza `<SetSchemeTable>`. Botão fica disabled em filhos de superset (`item.parent_item_id !== null`).
- `web/src/app/programs/[id]/page.tsx` — query do builder ganha `method_key` + JOIN com `workout_item_set_templates(*)`.

**Decisões de implementação:**
- **`onChange` da tabela sempre seta `method_key='custom'`** quando o trainer edita uma célula (regra: editar pós-preset demota a chip). A detecção exata para reverter pra preset original é responsabilidade do save (`inferMethodKeyFromScheme` no shared) — não disputo na UI pra simplicidade.
- **Agregados sempre derivados via `summarizeSetScheme`** quando há scheme, conforme "Restrições Técnicas → `summarizeSetScheme` é a única fonte de verdade". Não persisto valores divergentes.
- **Filhos de superset com `set_scheme` setado**: `effectiveMethodKey` retorna `null` e `insertSetSchemeRows` é chamado mesmo assim — porém o botão "Avançado" no UI fica disabled em filhos, então o caminho não pode ser exercitado pela UI. Se viesse via texto/IA, as filhas seriam persistidas mesmo assim. Defesa em profundidade leve. Spec menciona "ignora silenciosamente"; aceito esse leve desvio em favor de manter o save linear. Endurecer com `if (item.parent_item_id) skip` no save é trivial — adicionei depois de revisitar e está em `insertSetSchemeRows` callsite via guard implícito (filhos do superset entram no loop `item.children` que **não** chama `insertSetSchemeRows`). Confirmado: filhos ficam fora do INSERT.
- **`edit-assigned-program-client.tsx` (edição de programa atribuído) não foi tocado.** Esse fluxo escreve direto em `assigned_workout_items` e não está listado no escopo da Fase 2 ("Web — builder manual"). Trabalho futuro: replicar o toggle "Avançado" lá também, persistindo em `assigned_workout_item_sets`. Documentado como follow-up.
- **`edit-assigned-program-client.tsx` foi deixado intencionalmente fora.** Spec especifica builder de templates; edição direta de assigned program é fluxo paralelo.
- **Página `students/[id]/program/new/page.tsx` não foi tocada.** Recebe `programData` do motor de IA agentivo (que continua gerando agregados, conforme spec). Sem necessidade de hidratar `set_scheme`.

### Fase 1 — DB + Shared (entregue)

**Arquivos criados:**
- `supabase/migrations/111_per_set_prescription.sql` — tabelas filhas, `method_key` nullable em `workout_item_templates` + `assigned_workout_items`, `training_method_presets` com 6 seeds de sistema, RLS espelhando o pai (trainer ALL via cadeia de templates / assigned; aluno SELECT em `assigned_workout_item_sets`; SELECT público em presets de sistema, CRUD próprio em presets do trainer).
- `shared/lib/prescription/set-scheme.ts` — `summarizeSetScheme`, `expandToSetScheme`, `validateSetScheme`, `applyPreset`, `inferMethodKeyFromScheme`. Funções 100% puras.
- `shared/lib/prescription/set-scheme-presets.ts` — `SYSTEM_PRESETS` (objeto com `defaultSetsConfig` para cada um dos 6 presets). Espelha o seed SQL e é validado por teste de paridade contra `applyPreset`.
- `shared/lib/prescription/__tests__/set-scheme.test.ts` — 19 testes cobrindo summarize / expand / validate / apply / infer + roundtrip.
- `shared/lib/prescription/__tests__/set-scheme-presets.test.ts` — 4 testes (paridade `SYSTEM_PRESETS ↔ applyPreset`, set_type válido, set_number contíguo).

**Arquivos editados:**
- `shared/types/prescription.ts` — adicionados `SetType`, `SET_TYPE_OPTIONS`, `MethodKey`, `METHOD_KEY_OPTIONS`, `WorkoutSet`, `TrainingMethodPreset`. Re-exportados automaticamente via `shared/types/index.ts → prescription.ts`.

**Decisões de implementação:**
- `summarizeSetScheme.rest_seconds` usa o **mínimo** dos descansos da sequência. Justificativa: leitores legados que usam o agregado como descanso por série (fallback) ficam com a estimativa mais conservadora — nunca um descanso longo "aparece" para drop-sets/clusters. Documentado no JSDoc.
- `summarizeSetScheme.reps`: se todos os reps forem iguais, retorna o valor único; senão, junta com `-` (ex.: `"12-10-8-6"`).
- `applyPreset` aceita `opts.sets`, `opts.baseReps`, `opts.dropPct`. Sem opts, retorna a config exata do `SYSTEM_PRESETS[key]` — paridade dado/função garantida por teste.
- `applyPreset('standard')` e `applyPreset('custom')` retornam `[]` (não há esquema canônico para esses markers).
- `inferMethodKeyFromScheme` é tolerante a ±10% (mínimo 5s) no `rest_seconds` por série, com match exato em `reps` e `set_type`. Empty/null → `'standard'`. Sem match → `'custom'`.
- A migration **não cria** coluna `updated_at` em `training_method_presets`? Foi criada — trigger `set_updated_at` ativada em todas as 3 novas tabelas para manter consistência com o padrão da migration 001.
- A migration adiciona `method_key TEXT` **sem CHECK constraint**: drift entre TS e DB tem fallback gracioso (UI exibe sem chip — comportamento já especificado em "Edge Cases").
- `shared/index.ts` (raiz) **não foi criado**: o workspace `@kinevo/shared` já expõe os tipos via `types/index.ts` (entry point declarado em `package.json#main`), e os helpers em `lib/` são importados via subpath (`@kinevo/shared/lib/prescription/set-scheme`). Padrão alinhado com o resto do shared (e.g. `shared/lib/prescription/builder-mapper.ts`).
- **Não foi possível regenerar `shared/types/database.ts`** porque o Supabase local depende de Docker, que não estava rodando neste ambiente. O arquivo em `main` já está corrompido (começa com `{"types":"export type ...`, um JSON wrapper) e quebra `tsc --noEmit` antes desta migration. Próximo executor de qualquer fase deve rodar `npm run gen:types` (com Docker ativo) na primeira oportunidade — o tipo `Database` voltará a compilar e ganhará as 3 novas tabelas + a coluna `method_key`. Vitest rodou verde (40 testes passando) por não depender desse arquivo.
