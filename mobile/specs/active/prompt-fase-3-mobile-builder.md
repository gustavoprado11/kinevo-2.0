# Prompt Claude Code — Fase 3: Builder Mobile (push direto em main)

> Cole este prompt inteiro numa nova sessão do Claude Code dentro do repositório `kinevo-monorepo`. **Nesta fase, o push vai direto pra `main`**, sem PR. Por isso a barra de validação local é mais alta.

---

Você vai implementar a **Fase 3** da feature de prescrição por série (pirâmide, drop-set, cluster) — agora no app mobile do treinador. As Fases 1 e 2 já estão em `main`.

**Importante**: nesta fase, o Gustavo (não-desenvolvedor, dono do app, trabalhando sozinho) escolheu pular o PR e fazer push direto em `main`. Por isso, **as validações locais são mandatórias e bloqueantes**. Se algum teste ou typecheck falhar, **NÃO faça push** — pare, conserte, valide de novo.

## 0. Pré-checagens (sempre)

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Confirme que vê commits recentes "feat(per-set): Fase 1" e "feat(per-set): Fase 2"
```

Se algo falhar, **PARE e reporte ao Gustavo em linguagem simples** (sem jargão técnico).

## 1. Ler a spec

```bash
cat mobile/specs/active/prescricao-per-set-manual.md
```

Foca em:
- **Escopo → Incluído → Mobile — builder manual (Fase 3)**: o que entregar.
- **Comportamento Esperado → Cenário 3** (drop-set em isolador final): UX esperada.
- **Critérios de Aceite → Fase 3**: o que tem que ficar verde.
- **Edge Cases**: comportamentos especiais.
- **Restrições Técnicas**: regras invioláveis.
- E também olha como ficou a Fase 2 no web pra inspirar paridade visual:
  - `web/src/components/programs/SetSchemeTable.tsx`
  - `web/src/components/programs/SetSchemePresetChips.tsx`
  - As mudanças em `workout-item-card.tsx` e `program-builder-client.tsx`.

## 2. O trabalho

Resumo do que precisa ser feito:

1. **Estender `WorkoutItem`** em `mobile/stores/program-builder-store.ts`: adicionar `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`. Importar tipos de `@kinevo/shared`.

2. **Migração de schema do MMKV** via callback `merge` no Zustand persist:
   - Drafts pré-Fase-3 não têm os campos novos. No rehydrate, defaultar `null`.
   - Sem isso o app crasha em drafts antigos. **Não pule este passo.**

3. **Atualizar `initFromParsedText`** (linha ~239 do store) pra propagar `set_scheme` e `method_key` quando vierem do parse-text.

4. **Atualizar `addExerciseToWorkout`** pra aceitar os novos campos opcionais.

5. **Criar `mobile/components/trainer/program-builder/SetSchemeEditor.tsx`** (bottom sheet):
   - Tabela vertical (uma série por card empilhado, ergonômico em academia).
   - Cada card: `#`, `Tipo` (chips), `Reps` (input), `Carga` (steppers + toggle kg/%1RM), `RIR` (stepper), `Descanso` (stepper s), `Tempo` (input opcional), botões Duplicar/Remover.
   - Barra de presets no topo (chips horizontais scroll) — usa `SYSTEM_PRESETS` do shared.
   - Botão "+ Adicionar série" ao final.
   - Botão "Voltar para modo simples" no header (com confirm dialog).
   - Salva no store ao fechar com "Salvar".
   - Mesmo padrão de bottom sheet usado em `mobile/components/trainer/student/TextPrescriptionSheet.tsx`.

6. **Criar componentes auxiliares** se útil:
   - `mobile/components/trainer/program-builder/SetSchemeCard.tsx` — card por série dentro do editor.
   - `mobile/components/trainer/program-builder/SetSchemePresetChips.tsx` — barra horizontal de chips.

7. **Adicionar botão "Editar séries"** no card de exercício do builder mobile (procure onde o card é renderizado — provavelmente em `mobile/app/program-builder/index.tsx` ou em um componente dedicado tipo `ExerciseCardEditor`). Botão abre o `SetSchemeEditor`.

8. **Indicador visual no card**: chip pequeno do `method_key` no header quando aplicável (Pirâmide ↓, Drop-set, Customizado, etc.).

9. **Atualizar `mobile/hooks/useProgramBuilder.ts`**:
   - `saveProgram` insere filhas em `workout_item_set_templates` quando há `set_scheme`.
   - Persistência segue o mesmo padrão do web (após inserir o template do item, batch insert das filhas com `workout_item_template_id`).

10. **Modo avançado bloqueado em superset**: botão "Editar séries" fica disabled se `parent_item_id !== null`. Tooltip/Toast: "Não suportado dentro de superset".

11. **Testes Vitest** mínimos em `mobile/components/trainer/program-builder/__tests__/SetSchemeEditor.test.tsx` (smoke do happy path).

## 3. Restrições

- **Não tocar no motor de IA agentivo** (`web/src/lib/prescription/`).
- **Tipos vêm do shared** (`@kinevo/shared`). Sem `any`.
- **Retrocompat absoluta**: drafts antigos no MMKV reabrem sem crash; programas sem `set_scheme` continuam editáveis.
- **NativeWind, Lucide, Haptics, sentence case, pt-BR**, sem emojis.
- **Steppers (botões + e -)** pra inputs numéricos no mobile — mais ergonômico que digitar em academia.
- **Modo avançado bloqueado dentro de superset**.

## 4. Validações locais (BLOQUEANTES — não pule)

Antes de qualquer push, rode TODAS estas e confirme verdes:

```bash
# TypeScript em todos os workspaces afetados
cd shared && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit
cd ..

# Testes
cd shared && npx vitest run
cd ../mobile && npx vitest run
cd ..
```

**Se alguma der erro NOVO** (que não existia antes — confira contra o último commit em main), **NÃO faça push**. Conserte e re-valide.

Erros pré-existentes em arquivos NÃO relacionados à Fase 3 (ex.: `program-calendar.test.tsx` no web, ou outros) podem ser ignorados — não são responsabilidade desta entrega.

## 5. Commits e push direto em main

Quando os testes estiverem todos verdes:

```bash
# Pull final pra evitar conflito
git pull --rebase origin main

# Re-rodar tsc + vitest depois do rebase pra garantir
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..

# Commits lógicos
git add mobile/stores/program-builder-store.ts
git commit -m "feat(per-set): extend WorkoutItem with set_scheme and method_key in mobile store"

git add mobile/components/trainer/program-builder/SetSchemeEditor.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx \
        mobile/components/trainer/program-builder/SetSchemePresetChips.tsx
git commit -m "feat(per-set): add SetSchemeEditor bottom sheet for mobile builder"

# Ajusta o nome do arquivo abaixo se o card de exercício for em outro lugar
git add mobile/app/program-builder/index.tsx
git commit -m "feat(per-set): add 'Editar séries' button and method chip to mobile builder card"

git add mobile/hooks/useProgramBuilder.ts
git commit -m "feat(per-set): persist set_scheme on save in mobile builder"

git add mobile/components/trainer/program-builder/__tests__/SetSchemeEditor.test.tsx
git commit -m "test(per-set): cover SetSchemeEditor happy path"

# Atualiza spec marcando Fase 3 como concluída
git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): mark Fase 3 criteria as complete in spec"

# Push direto em main
git push origin main
```

## 6. Reporte final

Imprime EXATAMENTE este formato:

```
FASE 3 — completa (push direto em main)

Commits adicionados em main:
  - <hash> feat(per-set): extend WorkoutItem ...
  - <hash> feat(per-set): add SetSchemeEditor ...
  - <hash> feat(per-set): add 'Editar séries' button ...
  - <hash> feat(per-set): persist set_scheme on save ...
  - <hash> test(per-set): cover SetSchemeEditor happy path
  - <hash> docs(per-set): mark Fase 3 criteria as complete

Arquivos novos: <lista>
Arquivos modificados: <lista>
Testes: <X> novos verdes (total: Y/Z)

Próximo passo do Gustavo:
1. Abrir o app mobile (Expo) num dispositivo/simulador pra validar visualmente:
   - Adicionar exercício no builder
   - Tocar "Editar séries"
   - Aplicar chip "Pirâmide ↓"
   - Editar uma célula
   - Salvar
   - Reabrir o programa — estado preservado
2. Quando confirmar que está bom, me chamar pra começar a Fase 4 (sala de treino).
3. Se algo estiver errado visualmente, mandar print que eu (próxima sessão) ajusto.
```

## 7. Se algo der errado

- **Tipos do shared não disponíveis**: `cd shared && npx tsc --noEmit` deve passar. Se não, `cd .. && git pull origin main`.
- **Conflito ao push**: alguém commitou em main no meio do caminho. `git pull --rebase origin main`, re-valide tudo, push de novo.
- **Confuso sobre arquitetura mobile**: leia `mobile/CLAUDE.md` — define convenções (Expo Router, Zustand, NativeWind).
- **Crash em draft antigo do MMKV**: você esqueceu o callback `merge` do Zustand persist. Adicione antes de continuar.

## 8. Reverter (se descobrir bug em produção)

Se o Gustavo te chamar dizendo "quebrou no celular dele depois do push", você pode reverter rápido com:

```bash
git revert HEAD~5..HEAD --no-edit
git push origin main
```

(ajusta `HEAD~5` pro número exato de commits da Fase 3)

Tudo claro? Confirme com "Fase 3 — começando" e parta da pré-checagem.
