# Prompt Claude Code — Fase 4: Sala de Treino + Mock no Prescritor (push direto em main)

> Cole este prompt inteiro numa nova sessão do Claude Code dentro do repositório `kinevo-monorepo`. Push vai direto pra `main`. Validações locais são bloqueantes.

---

Você vai implementar a **Fase 4** da feature de prescrição por série. As Fases 1, 2 e 3 já estão em `main` e a migração 111 já foi aplicada no Supabase de produção.

**Escopo da Fase 4 (expandido vs. spec original):**

A. **Sala de treino do aluno** (escopo original): a tela de execução do aluno passa a renderizar `set_scheme` quando existe.

B. **Sala de treino do treinador — coaching ao vivo** (escopo expandido): o treinador acompanha a sessão do aluno em tempo real e precisa ver as mesmas reps/tipo por série que o aluno está vendo.

C. **Mock/preview no prescritor mobile** (feature nova): no builder mobile, adicionar um botão "Visualizar como aluno" que abre uma tela em modo somente-leitura mostrando exatamente como o programa em edição vai aparecer pro aluno. **Reaproveita os componentes criados no item A** — princípio é "renderizar o draft do builder com o mesmo componente que renderiza a execução real".

D. **Watch app** (opcional, deixa pro fim): se sobrar fôlego, atualizar o Watch app pra ler `set_scheme`. Se ficar pesado, marca como pendente e segue.

**Importante:** O Gustavo é não-desenvolvedor, trabalha sozinho, escolheu push direto em `main` (sem PR). Por isso, validações locais são **bloqueantes**: se algum teste falhar, pare, conserte, valide de novo. **Não suba código quebrado.**

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Você deve ver commits recentes das Fases 1, 2 e 3
```

Se algo falhar, **PARE e reporte ao Gustavo em linguagem simples** (sem jargão).

## 1. Ler a spec

```bash
cat mobile/specs/active/prescricao-per-set-manual.md
```

Foca em:
- **Escopo → Incluído → Mobile — sala de treino do aluno (Fase 4)**.
- **Comportamento Esperado → Cenário 5** (aluno executando treino com pirâmide).
- **Comportamento Esperado → Cenário 6** (programa legado sem set_scheme — fallback).
- **Critérios de Aceite → Fase 4**.
- **Edge Cases**: especialmente cluster reps ("5+5+5"), AMRAP, programa antigo sem filhas.

E também leia os arquivos da Fase 3 pra entender os tipos compartilhados:
- `shared/lib/prescription/set-scheme.ts`
- `shared/lib/prescription/set-scheme-presets.ts`
- `shared/types/prescription.ts` (procure `WorkoutSet`, `SetType`, `MethodKey`).

## 2. O trabalho — parte A: Aluno (sala de treino, execução)

**Arquivos a modificar:**

1. **`mobile/hooks/useWorkoutSession.ts`** (~1100 linhas, é o coração da execução):
   - Na query que busca o `assigned_workout` e seus itens, faz LEFT JOIN ou query secundária pra `assigned_workout_item_sets` ordenado por `set_number`.
   - No bloco que monta o initial state das séries (atualmente faz `Array(setsCount).fill(...)`), passa a hidratar a partir das linhas filhas se existirem; senão, mantém o fallback atual (replicar agregados como N séries idênticas com `set_type='normal'`).
   - **NÃO** mude o shape do `set_logs` que é gravado — continue usando `set_number`, `weight`, `reps_completed` como hoje. A diferença é apenas no estado em memória do que é PRESCRITO.

2. **`mobile/components/workout/SetRow.tsx`**:
   - Aceita uma nova prop opcional `setType?: SetType` e `repsTarget?: string`.
   - Renderiza badge à esquerda da linha quando `setType !== 'normal'`:
     - `warmup` → cinza, `Flame`
     - `top` → laranja, `ArrowUp`
     - `backoff` → cinza-azul, `ArrowDown`
     - `drop` → vermelho, `ChevronsDown`
     - `failure` → vermelho-escuro, `Zap`
     - `cluster` → roxo, `Layers`
     - `amrap` → azul, `Infinity`
   - O placeholder do input de reps usa `repsTarget` quando disponível (ex.: "6" na 4ª série de uma pirâmide); senão, mantém o placeholder atual.
   - **Cluster reps especial**: se `repsTarget` contém `+` (ex.: "5+5+5"), renderiza como hint visível "Meta: 5+5+5" abaixo do input. O aluno ainda digita a soma (ou o que executou) no campo numérico de reps; em `set_logs.notes` registra a quebra. (Confira no `useWorkoutSession.ts` se faz sentido — pode-se fazer fallback simples: aluno digita um número total).
   - **AMRAP**: placeholder vira "Até a falha" (ou "AMRAP") em vez de número.

3. **`mobile/components/workout/ExerciseCard.tsx`**:
   - O cabeçalho do card hoje mostra "X séries · Y reps · Z s descanso". Quando o exercício tem `set_scheme` ativo:
     - Linha de resumo vira `summarizeSetScheme(scheme)` formatado (ex.: "4 séries · 12-10-8-6 · 90s descanso").
     - Adiciona um chip pequeno do `method_key` ao lado do nome (ex.: "Pirâmide ↓"), com cor sutil. Use o mesmo helper de label que o builder usa pra paridade.

4. **Helper compartilhado** (se ainda não existe): cria `shared/lib/prescription/method-labels.ts` com:
   ```ts
   export const METHOD_KEY_LABELS: Record<MethodKey, string> = {
     standard: 'Padrão',
     pyramid_up: 'Pirâmide ↑',
     pyramid_down: 'Pirâmide ↓',
     drop_set: 'Drop-set',
     top_backoff: 'Top + Backoff',
     '5x5': '5×5',
     cluster: 'Cluster',
     custom: 'Customizado',
   }
   ```
   Isso garante paridade entre builder, aluno e treinador.

## 3. O trabalho — parte B: Treinador (sala de treino live coaching)

**Arquivos a modificar:**

1. **`mobile/stores/training-room-store.ts`** (475 linhas):
   - O tipo `WorkoutSetData` ganha campos opcionais `set_type?: SetType`, `reps_target?: string`. (Já tem `weight`, `reps` para o que o aluno executou.)
   - O tipo `WorkoutExercise` ganha `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`.
   - A função que inicializa `setsData` a partir dos dados do exercício passa a hidratar do `set_scheme` quando existir. Senão, fallback atual (`Array(sets || 3).fill(...)` com `set_type='normal'`).

2. **`mobile/hooks/useTrainerWorkoutSession.ts`** (381 linhas):
   - A query/RPC que busca a sessão do aluno passa a trazer também `assigned_workout_item_sets`. Confira se o RPC `get_trainer_workout_session` (ou equivalente) precisa ser atualizado, ou se uma query secundária resolve.
   - No mapping para o store, popula `set_scheme` e `method_key` por exercício.

3. **`mobile/app/training-room.tsx`** (1183 linhas):
   - Onde renderiza cada exercício e suas séries, passa as mesmas props novas (`setType`, `repsTarget`) para os componentes correspondentes — provavelmente reaproveita ou espelha o `SetRow.tsx` do aluno.
   - Header do exercício mostra `summarizeSetScheme` quando há `set_scheme`, com chip do `method_key` (mesma lógica do `ExerciseCard.tsx` do aluno — extraia componente compartilhado se útil).

4. **Componente compartilhado**: considere extrair `mobile/components/workout/ExerciseHeaderSummary.tsx` que recebe um item e gera o cabeçalho ("4 séries · 12-10-8-6 · 90s · chip Pirâmide ↓"). Reusado em: ExerciseCard (aluno), training-room (treinador), e no preview (parte C).

## 4. O trabalho — parte C: Mock/Preview no Prescritor mobile

**Feature nova.** Objetivo: dar ao treinador uma forma de ver exatamente como o programa em edição vai aparecer pro aluno, sem precisar salvar e sair pra testar com conta de aluno.

**Arquivos a criar:**

1. **`mobile/app/program-builder/preview.tsx`** (nova rota):
   - Tela de preview em modo somente-leitura.
   - Lê o draft atual do `program-builder-store` (não busca do banco).
   - Renderiza usando os mesmos componentes da execução do aluno (`ExerciseCard.tsx` com mesma estrutura, `SetRow` em modo readonly — isto é, sem inputs editáveis, só mostrando o alvo).
   - **Modo readonly do `SetRow`**: aceita uma prop `readOnly?: boolean` (ou um componente sibling `<SetRowPreview />`), que renderiza o badge + reps_target + descanso, mas sem campos de input editáveis. Mostra como "fantasma" do que o aluno verá.
   - Header da tela: nome do programa em edição + botão "Voltar" no topo esquerdo.
   - Tabs ou seletor de qual treino do programa visualizar (Treino A, B, C…) — espelha o que o aluno verá ao iniciar o treino.
   - Banner discreto no topo: "Modo preview — assim que o aluno verá".

2. **Botão de acesso** no builder:
   - Localiza o cabeçalho de `mobile/app/program-builder/index.tsx`.
   - Adiciona um botão "Visualizar como aluno" (ícone `Eye` da Lucide) ao lado do botão "Salvar".
   - Ao tocar, navega pra `/program-builder/preview` (Expo Router file-based).
   - Disabled se o draft estiver vazio (sem nenhum exercício).

3. **Componentes preview-only** (se for útil isolar):
   - `mobile/components/workout/SetRowPreview.tsx`: versão readonly do SetRow.
   - `mobile/components/workout/ExerciseCardPreview.tsx`: versão readonly do ExerciseCard.
   - Alternativa: prop `readOnly` nos componentes existentes. Escolha o que ficar mais limpo. Documente a decisão na seção "Notas de Implementação" da spec.

**Critério de paridade visual**: pega screenshot lado-a-lado da tela de execução real do aluno e do preview no builder. Devem ser visualmente idênticas no card do exercício e nas linhas de série. Se houver diferença, é bug.

## 5. O trabalho — parte D (OPCIONAL): Watch app

Se sobrou tempo após A, B, C estarem testados:

1. **`mobile/lib/getProgramSnapshotForWatch.ts`** e **`mobile/lib/getNextWorkoutForWatch.ts`**: incluem `set_scheme` e `method_key` no payload JSON enviado pro Watch. Bumps no `schemaVersion`.

2. **`targets/watch-app/Models/WorkoutExecutionState.swift`**: campos opcionais `setScheme` e `methodKey` por exercício.

3. **`targets/watch-app/Views/WorkoutExecutionView.swift`**: renderiza `setScheme[setIndex].reps` quando disponível; senão fallback atual.

**Se ficar muito pesado, pula.** Documenta como pendência na spec.

## 6. Restrições

- **Não tocar no motor de IA agentivo** (`web/src/lib/prescription/`).
- **Tipos vêm do shared**. Sem `any`.
- **Retrocompat absoluta**: programas legados (sem `set_scheme`) renderizam exatamente como hoje no aluno e no treinador.
- **NativeWind, Lucide, Haptics, sentence case, pt-BR**, sem emojis.
- **`set_logs`** continua sendo escrito com o mesmo shape (set_number, weight, reps_completed). Não mude esse contrato.
- **Modo readonly do preview** não escreve nada no banco. É puramente visual.

## 7. Validações locais (BLOQUEANTES)

Antes de qualquer push:

```bash
# TypeScript
cd shared && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit
cd ..

# Testes
cd shared && npx vitest run
cd ../mobile && npx vitest run
cd ..
```

Se ALGUM erro novo aparecer (que não existia em main antes), **NÃO faça push**. Conserte e re-valide. Erros pré-existentes (em arquivos não relacionados à Fase 4) podem ser ignorados.

## 8. Commits e push direto em main

```bash
# Pull final
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..

# Commits agrupados por área
git add shared/lib/prescription/method-labels.ts shared/lib/prescription/__tests__/method-labels.test.ts
git commit -m "feat(per-set): add METHOD_KEY_LABELS shared helper for parity across surfaces"

git add mobile/hooks/useWorkoutSession.ts \
        mobile/components/workout/SetRow.tsx \
        mobile/components/workout/ExerciseCard.tsx \
        mobile/components/workout/ExerciseHeaderSummary.tsx
git commit -m "feat(per-set): hydrate and render per-set scheme in student workout execution"

git add mobile/stores/training-room-store.ts \
        mobile/hooks/useTrainerWorkoutSession.ts \
        mobile/app/training-room.tsx
git commit -m "feat(per-set): hydrate and render per-set scheme in trainer live coaching room"

git add mobile/app/program-builder/preview.tsx \
        mobile/app/program-builder/index.tsx \
        mobile/components/workout/SetRowPreview.tsx
git commit -m "feat(per-set): add 'Visualizar como aluno' preview screen in mobile builder"

# (Se fez parte D do Watch app, mais um commit aqui)
# git add mobile/lib/getProgramSnapshotForWatch.ts ... targets/watch-app/...
# git commit -m "feat(per-set): support set_scheme in Watch app"

# Testes (se houver novos)
git add mobile/components/workout/__tests__/SetRow.test.tsx
git commit -m "test(per-set): cover SetRow set_type rendering and AMRAP/cluster placeholders"

# Spec atualizada
git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): mark Fase 4 criteria as complete in spec"

git push origin main
```

## 9. Reporte final

```
FASE 4 — completa (push direto em main)

Commits:
  - <hash> feat(per-set): METHOD_KEY_LABELS shared helper
  - <hash> feat(per-set): student workout execution
  - <hash> feat(per-set): trainer live coaching
  - <hash> feat(per-set): preview no builder
  - <hash> (opcional) feat(per-set): Watch app
  - <hash> test(per-set): cover SetRow rendering
  - <hash> docs(per-set): spec marked complete

Arquivos novos: <lista>
Arquivos modificados: <lista>
Testes: <X> novos verdes (total Y/Z)

Watch app: ENTREGUE / PENDENTE (justificar se pendente)

Próximo passo do Gustavo:
1. Abrir o app mobile e validar 4 fluxos:
   a. Treinador prescreve programa com pirâmide → toca "Visualizar como aluno" → confere que a tela mostra "12 reps", "10 reps", "8 reps", "6 reps" com badges corretos (e drop-set se prescrito).
   b. Sai do preview, salva o programa.
   c. Loga como aluno (ou abre o app no celular do aluno) e inicia o treino → confere que vê EXATAMENTE o mesmo do preview.
   d. (Se possível) Loga como treinador na sala de treino live com aluno em sessão → confere que vê o mesmo set_scheme que o aluno está vendo.
2. Programa legado (criado antes desta entrega) deve renderizar exatamente como antes — sem chip de método, sem badges, comportamento idêntico.
3. Quando confirmar visualmente, me chamar pra Fase 5 (Texto para Treino).
```

## 10. Se algo der errado

- **Crash no aluno em programa antigo**: o fallback do `useWorkoutSession.ts` está errado. Garanta que quando `assigned_workout_item_sets` é vazio, ainda monta `Array(sets).fill({...set_type: 'normal'})`.
- **Treinador vê reps diferente do aluno**: provavelmente as duas queries (aluno e treinador) estão buscando coisas diferentes. Centralize a hidratação num helper (`mobile/lib/hydrate-workout-sets.ts`) e use nos dois lugares.
- **Preview navegando mas em branco**: o `program-builder-store` não está sendo lido corretamente. Confira que o `useStore` está pegando o draft ativo, não um vazio.
- **Cluster ou AMRAP quebrando o input**: trate como caso especial no SetRow — o input continua sendo numérico, mas o placeholder e o hint mudam.

## 11. Reverter (se quebrar em produção)

```bash
git revert HEAD~7..HEAD --no-edit
git push origin main
```

(Ajusta o número de commits da Fase 4.)

Tudo claro? Confirme com "Fase 4 — começando" e parta da pré-checagem.
