# Prompt Claude Code — Fase 2: Builder Web (modo "Avançado")

> Cola este prompt inteiro numa nova sessão do Claude Code dentro do repositório `kinevo-monorepo`.

---

Você vai implementar a **Fase 2** da feature de prescrição por série (pirâmide, drop-set, cluster). A Fase 1 (banco + tipos compartilhados) já está em `main`.

## 0. Pré-checagens (sempre)

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -3
# Confirme que vê o commit "feat(per-set): Fase 1 — DB e shared (#4)" recente
```

Se algum step falhar, PARE e me diga o erro — quem está te dando este prompt é o Gustavo, dono do app, **não-desenvolvedor**, então use linguagem simples se reportar problemas.

## 1. Ler a spec — fonte da verdade

```bash
cat mobile/specs/active/prescricao-per-set-manual.md
```

Foca nas seções:
- **Escopo → Incluído → Web — builder manual (Fase 2)**: o que entregar.
- **Comportamento Esperado → Cenário 1 e Cenário 2**: como o usuário vai usar.
- **Critérios de Aceite → Fase 2**: o que precisa estar verde no fim.
- **Edge Cases**: comportamentos especiais (modo avançado bloqueado em superset, "voltar para modo simples", etc).
- **Restrições Técnicas**: regras invioláveis (sem `any`, retrocompat, etc).

## 2. O trabalho

Resumo do que precisa ser feito:

1. **Estender `WorkoutItem`** em `web/src/components/programs/program-builder-client.tsx`: adicionar campos opcionais `set_scheme?: WorkoutSet[] | null` e `method_key?: MethodKey | null`. Tipos importados do `@kinevo/shared`.

2. **Criar `web/src/components/programs/SetSchemeTable.tsx`**: tabela editável de séries com colunas (#, Tipo, Reps, Carga, RIR, Descanso, Tempo, ações). Barra de chips com os 6 presets de sistema acima da tabela. Ler a config dos presets de `@kinevo/shared/lib/prescription/set-scheme-presets`.

3. **Atualizar `web/src/components/programs/workout-item-card.tsx`**:
   - Adicionar botão "Avançado" no canto do card.
   - Quando `set_scheme === null`, renderiza os 3 inputs inline atuais (zero mudança visual pro fluxo simples).
   - Quando `set_scheme !== null`, esconde os 3 inputs e renderiza o `<SetSchemeTable />`.
   - Botão "Avançado" pela 1ª vez → chama `expandToSetScheme()` do shared e seta `set_scheme`.
   - Botão "Voltar para modo simples" no header da tabela → confirm dialog → zera `set_scheme` e re-popula os agregados via `summarizeSetScheme()`.
   - Modo avançado **bloqueado** se `parent_item_id !== null` (item dentro de superset): botão fica disabled com tooltip explicando.

4. **Atualizar `saveProgram()`** em `program-builder-client.tsx` (procura linha ~987):
   - Após inserir cada `workout_item_template`, se `item.set_scheme?.length > 0`, faz INSERT em batch em `workout_item_set_templates` com `workout_item_template_id = insertedItem.id`.
   - Os campos agregados (`sets`, `reps`, `rest_seconds`) ficam coerentes via `summarizeSetScheme(item.set_scheme)` antes do INSERT.

5. **Atualizar a função de load** de programa existente: LEFT JOIN com `workout_item_set_templates` ordenado por `set_number`, popula `set_scheme` quando há linhas.

6. **Testes Vitest** em `web/src/components/programs/__tests__/SetSchemeTable.test.tsx`: smoke do happy path (aplicar preset, editar célula, voltar para modo simples).

## 3. Restrições

- **Sem mexer no motor de IA agentivo** (`web/src/lib/prescription/`).
- **Tipos vêm do shared** (`@kinevo/shared`). Sem `any`, sem `unknown` injustificado.
- **Retrocompat absoluta**: programas existentes (sem `set_scheme`) continuam editáveis e salváveis exatamente como hoje.
- **Sentence case, pt-BR**, ícones do Lucide React, sem emojis na UI.
- Modo avançado **bloqueado dentro de superset** na V1.

## 4. Quando completar

```bash
# 1. Validações locais
cd web && npx tsc --noEmit && npx vitest run

# 2. Commits lógicos numa nova branch
git checkout -b feat/per-set-fase-2-web

git add web/src/components/programs/SetSchemeTable.tsx \
        web/src/components/programs/SetSchemePresetChips.tsx
git commit -m "feat(per-set): add SetSchemeTable + preset chips for web builder"

git add web/src/components/programs/workout-item-card.tsx
git commit -m "feat(per-set): add 'Avançado' toggle and per-set editor to WorkoutItemCard"

git add web/src/components/programs/program-builder-client.tsx
git commit -m "feat(per-set): persist set_scheme on save, hydrate on load"

git add web/src/components/programs/__tests__/SetSchemeTable.test.tsx
git commit -m "test(per-set): cover SetSchemeTable happy path"

git push -u origin feat/per-set-fase-2-web

# 3. Abrir PR
gh pr create \
  --base main \
  --title "feat(per-set): Fase 2 — builder web (modo avançado)" \
  --body "$(cat <<'EOFB'
Implementa a Fase 2 da spec [prescricao-per-set-manual.md](mobile/specs/active/prescricao-per-set-manual.md).

## O que muda na UI

- Cada card de exercício no builder ganha um botão "Avançado" no canto.
- Clicar abre uma tabela editável de séries com chips de preset (Pirâmide ↑/↓, Drop-set, 5×5, Top+Backoff, Cluster).
- Tabela permite adicionar/remover/duplicar/editar série livremente.
- Botão "Voltar para modo simples" reverte com confirm.
- Modo avançado fica bloqueado dentro de superset (tooltip explica).

## Retrocompat

Programas sem `set_scheme` continuam editáveis exatamente como hoje. Modo simples é o default.

## Como testar manualmente

1. Abrir program builder, criar programa novo.
2. Adicionar um exercício, clicar "Avançado".
3. Aplicar chip "Pirâmide ↓" — tabela vira 4 linhas (12-10-8-6 reps).
4. Editar uma célula — chip do método vira "Customizado".
5. Salvar.
6. Reabrir o programa — estado preservado.

## Critérios de Aceite (Fase 2 da spec)

Ver "Critérios de Aceite → Fase 2" da spec — todos marcados como [x] no commit final.
EOFB
)"
```

## 5. Reporte final

Imprime EXATAMENTE este formato no fim:

```
FASE 2 — completa

PR: <link>
Arquivos novos: <lista>
Arquivos modificados: <lista>
Testes: <X> novos verdes

Próximo passo do Gustavo:
1. Acessar o PR e clicar "Squash and merge" → "Confirm".
2. Após merge, eu (próxima sessão Claude Code) começo a Fase 3 (mobile).
```

## 6. Se algo der errado

- **Tipos do shared não disponíveis**: rode `cd shared && npx tsc --noEmit` — se falhar, `cd .. && git pull` primeiro.
- **Conflito ao criar branch**: você está partindo de main atualizado? Se não, `git checkout main && git pull origin main`.
- **Confuso sobre arquitetura**: leia `web/CLAUDE.md` — define convenções do workspace web.

Tudo claro? Confirme com "Fase 2 — começando" e parta da pré-checagem.
