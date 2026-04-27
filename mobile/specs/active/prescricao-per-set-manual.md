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
- [ ] Toggle "Avançado" aparece em cada `WorkoutItemCard`.
- [ ] Clicar "Avançado" expande os 3 campos atuais em N séries idênticas via `expandToSetScheme`.
- [ ] Tabela editável permite adicionar/remover/duplicar/editar série livremente.
- [ ] Barra de presets aplica as 6 configurações de sistema; editar pós-preset → `method_key='custom'`.
- [ ] Chip do `method_key` aparece no header da tabela.
- [ ] "Voltar para modo simples" funciona com confirm dialog.
- [ ] `saveProgram` persiste `workout_item_set_templates` row-by-row na ordem certa.
- [ ] Load de programa existente hidrata `set_scheme` corretamente.
- [ ] Modo avançado bloqueado dentro de superset (botão disabled + tooltip).
- [ ] Programas sem `set_scheme` continuam editáveis e salváveis exatamente como hoje (smoke test).
- [ ] `cd web && npx tsc --noEmit && npx vitest run` sem novos erros vs `main`.

### Fase 3 — Mobile Builder
- [ ] `SetSchemeEditor` bottom sheet abre via botão "Editar séries" no card do builder.
- [ ] UX: tabela vertical com card por série, steppers ergonômicos, presets em chips horizontais.
- [ ] Chip do `method_key` aparece no card do builder quando aplicável.
- [ ] `saveProgram` mobile persiste filhas (RPC ou inserts row-by-row).
- [ ] MMKV migration compatível: drafts pré-Fase-3 reabrem sem crash, com `set_scheme: null`.
- [ ] Modo avançado bloqueado dentro de superset.
- [ ] `cd mobile && npx tsc --noEmit && npx vitest run` sem novos erros vs `main`.

### Fase 4 — Sala de Treino
- [ ] `useWorkoutSession` hidrata os sets a partir de `assigned_workout_item_sets` quando existem.
- [ ] Programas legados (sem filhas) continuam funcionando exatamente como hoje.
- [ ] `SetRow` mostra badge do `set_type` para tipos não-`normal`.
- [ ] Header do card mostra resumo (`12-10-8-6`) e chip do método.
- [ ] Watch app (iOS) consome `set_scheme` quando disponível e fallback quando não.
- [ ] `set_logs` continua sendo gravado com `set_number` correto, batendo com a série prescrita.
- [ ] Smoke test em iOS + Android: aluno consegue concluir treino com pirâmide e drop-set sem erro.

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
