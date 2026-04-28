# Prompt Claude Code — Fase 4.4: Paridade Web + Polimento UX do modo Avançado

> Cole numa nova sessão do Claude Code. **Não precisa de migration nova** — a 112 da Fase 4.3 já cobre. Push direto em main como nas anteriores.

---

A Fase 4.3 entregou o modelo de rodadas no mobile e na Edge Function, mas **não atualizou o builder web** (gap conhecido). Além disso, o Gustavo (não-dev, dono do app) testou em produção e identificou pontos de UX que precisam polimento na tela de prescrição avançada — tanto web quanto mobile.

Esta fase tem duas partes coordenadas:

**Parte A — Paridade web (gap da Fase 4.3):** o `SetSchemeTable.tsx` no web ainda renderiza o modelo antigo (sem rodadas, sem campo materializado). Replica no web tudo o que está no `SetSchemeEditor.tsx` mobile.

**Parte B — Polimento UX:** três mudanças decididas com o Gustavo:
1. **Esconder campos avançados** (RIR, Tempo) atrás de toggle "+ Mais campos". Default mostra só Tipo, Reps, Carga, Descanso.
2. **Banner indicador de rodadas** quando método é compound: "Esta estrutura será repetida 3 vezes. Aluno fará 9 fases no total."
3. **Chip do método no card colapsado** (mobile + web simple mode) + renomear "AVANÇADO" → "Editar séries" com ícone.

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -10
# Você deve ver os commits da Fase 4.3 (5caf796, 8cc6dc6, 9287995, 92a8557, da93bdc, 1644e48)
```

## 1. Ler o que já existe (referência)

Antes de codar, leia os arquivos do mobile que você atualizou na Fase 4.3 — esses são a referência de paridade pra Parte A:

```bash
cat mobile/components/trainer/program-builder/SetSchemeEditor.tsx
cat mobile/components/trainer/program-builder/SetSchemeCard.tsx
cat mobile/components/trainer/program-builder/SetSchemePresetChips.tsx
cat mobile/stores/program-builder-store.ts | head -100
cat mobile/hooks/useProgramBuilder.ts | head -150
```

Isso mostra a fonte da verdade do comportamento. Web tem que se comportar igual onde fizer sentido (ajustando pra HTML/Tailwind v4 em vez de NativeWind).

E lê o web atual pra saber o que mudar:

```bash
cat web/src/components/programs/SetSchemeTable.tsx
cat web/src/components/programs/SetSchemePresetChips.tsx
cat web/src/components/programs/program-builder-client.tsx | grep -A 50 "saveProgram\|set_scheme\|method_key" | head -200
cat web/src/components/programs/workout-item-card.tsx | head -100
```

## 2. Parte A — Paridade Web

### 2.1 `web/src/components/programs/SetSchemeTable.tsx`

Adiciona suporte a rodadas espelhando o mobile:

- **Quando `method_key` é compound** (`drop_set`, `cluster`):
  - Mostra campo "**Rodadas: [3 ↕]**" no header da tabela. Stepper visual com ➖ e ➕, range 1-20.
  - Header da tabela vira "**Estrutura de uma rodada**".
  - Botão "+ Adicionar série" → "**+ Adicionar fase**".
  - Aplica o `defaultRounds` do preset ao trocar pra um método compound.
- **Quando linear** (pirâmide, 5×5, top+backoff, ou customizado simples):
  - Oculta o campo "Rodadas" (rounds=1 implícito).
  - Mantém "Adicionar série" e "Estrutura" como hoje.
- Ao mudar `method_key`, dispara `applyPreset(key)` do shared (já existe), que retorna `{ scheme, defaultRounds }`. Popula ambos.
- Editar qualquer linha após aplicar preset → `method_key` vira `'custom'` (já existe esse comportamento). Preserva o `rounds` setado.
- **Footer da tabela** quando rounds > 1: texto pequeno cinza "Aluno verá: 3 rodadas × N fases = M fases no total."

### 2.2 `web/src/components/programs/program-builder-client.tsx` — `saveProgram()`

Atualmente (pós-Fase 4.3 incompleta) o web salva apenas as filhas como o trainer prescreveu na tabela (1 rodada). Precisa **materializar** igual o mobile:

- No INSERT em `workout_item_templates`, inclui `rounds: item.set_scheme ? item.rounds ?? 1 : null`.
- Se `item.rounds > 1`, antes do INSERT em `workout_item_set_templates`, **expande** via `expandSchemeByRounds(item.set_scheme, item.rounds)` do shared.
- Cada linha materializada vai com `set_number` físico (1..N total) E `round_number` (1..rounds).

Use o helper `expandSchemeByRounds` que já está em `shared/lib/prescription/set-scheme.ts`. Não duplique a lógica.

Confira que load (LEFT JOIN com `workout_item_set_templates`) já preserva o set_scheme corretamente. Como vem materializado, ao re-abrir um programa salvo, o builder precisa reconstruir o "scheme de uma rodada" pra exibir na tabela. Helper sugerido em `shared/lib/prescription/set-scheme.ts`:

```ts
/**
 * Inverso de expandSchemeByRounds: pega um array materializado e retorna
 * apenas as fases de UMA rodada. Assume que todas as rodadas têm a mesma
 * estrutura (invariante mantido pelo save). Retorna { scheme, rounds }.
 */
export function collapseExpandedScheme(
  expandedScheme: WorkoutSet[],
  roundsHint: number
): { scheme: WorkoutSet[]; rounds: number } {
  if (roundsHint <= 1 || expandedScheme.length === 0) {
    return { scheme: expandedScheme, rounds: 1 }
  }
  const phasesPerRound = Math.floor(expandedScheme.length / roundsHint)
  if (phasesPerRound === 0) return { scheme: expandedScheme, rounds: 1 }
  // Pega só a 1ª rodada e reseta set_number
  const firstRound = expandedScheme.slice(0, phasesPerRound).map((s, idx) => ({
    ...s,
    set_number: idx + 1,
  }))
  return { scheme: firstRound, rounds: roundsHint }
}
```

Adiciona testes Vitest. Roundtrip: `collapseExpandedScheme(expandSchemeByRounds(scheme, 3), 3)` retorna `{ scheme: scheme, rounds: 3 }`.

### 2.3 `web/src/components/programs/workout-item-card.tsx`

Quando o exercício tem `set_scheme` E rounds > 1, o card colapsado (modo simples antes de entrar Avançado) deve mostrar resumo correto. A `summarizeSetScheme` já foi atualizada na Fase 4.3 — só garante que está sendo chamada com `rounds` no web.

**E também aplica a Decisão 3 da Parte B aqui** — chip do método no card simple-mode (ver 3.3 abaixo).

## 3. Parte B — Polimento UX

### 3.1 Toggle "+ Mais campos" — esconder RIR e Tempo por default

**Aplica em ambos os builders (web e mobile).**

Web (`SetSchemeTable.tsx`):
- Estado local `showAdvancedFields: boolean` (default `false`).
- Header da tabela tem um link/botão "**+ Mais campos**" alinhado à direita (ao lado de "Voltar para modo simples").
- Quando colapsado: colunas visíveis = `# | TIPO | REPS | CARGA | DESCANSO | ações`.
- Quando expandido: + colunas `RIR | TEMPO`. Link vira "**− Menos campos**".
- Persistência: localStorage (`kinevo_setscheme_advanced_fields`) pra lembrar a preferência do trainer.

Mobile (`SetSchemeEditor.tsx` ou `SetSchemeCard.tsx`):
- Cada card de fase já tem layout vertical. Esconde os campos `RIR` e `Tempo` por default.
- Header do bottom sheet ganha um chevron/toggle "Mais campos" (também persistido em MMKV: `kinevo_setscheme_advanced_fields_mobile`).
- Ao expandir, os cards crescem verticalmente pra acomodar os campos extras.

### 3.2 Banner indicador de rodadas

**Aplica em ambos os builders.**

Web (acima da tabela, dentro de `SetSchemeTable.tsx`):
- Renderiza só quando `rounds > 1`.
- Visual: card azul-claro, bordas arredondadas, ícone `Repeat` (Lucide), texto:
  > "Esta estrutura de N fases será repetida 3 vezes. O aluno fará 9 fases no total."
- Discreto: padding pequeno, sem botão.

Mobile (no header do `SetSchemeEditor`):
- Mesma mensagem, adaptada pra largura de mobile (texto pode quebrar 2 linhas).
- Visual: faixa pastel acima da tabela de fases, ícone `Repeat`.

Footer informativo (rodapé da tabela) em ambos:
- Texto pequeno cinza, sempre visível quando rounds > 1: "Aluno verá: N rodadas × M fases = (N×M) fases no total."

### 3.3 Chip do método no card colapsado + renomear "AVANÇADO"

**Mobile (`mobile/components/trainer/program-builder/WorkoutItemRow.tsx` ou equivalente):**
- No card colapsado do exercício (modo simples), adiciona chip do `method_key` ao lado do nome do exercício, **igual já aparece no `ExerciseCard.tsx`** da sala de treino. Reutiliza `METHOD_KEY_LABELS` do shared.
- Chip só aparece se `method_key !== 'standard'` && `method_key !== null`.
- Botão "**AVANÇADO**" → "**Editar séries**" com ícone `Sliders` da Lucide à esquerda. Mantém estilo de botão (não vira link).

**Web (`web/src/components/programs/workout-item-card.tsx`):**
- No modo simples (3 inputs inline), adiciona chip do `method_key` na mesma linha do nome do exercício.
- Botão "Avançado" → "**Editar séries**" com ícone `Sliders`. Mantém o mesmo padrão.

## 4. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
```

Sem erros novos. Erros pré-existentes de `program-calendar.test.tsx` ou outros arquivos não relacionados a per-set podem ser ignorados.

## 5. Commits e push

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd web && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

# Parte A — paridade web
git add shared/lib/prescription/set-scheme.ts shared/lib/prescription/__tests__/set-scheme.test.ts
git commit -m "feat(per-set): add collapseExpandedScheme helper for web load"

git add web/src/components/programs/SetSchemeTable.tsx \
        web/src/components/programs/SetSchemePresetChips.tsx
git commit -m "feat(per-set): web SetSchemeTable supports rounds (parity with mobile)"

git add web/src/components/programs/program-builder-client.tsx
git commit -m "feat(per-set): web saveProgram materializes rounds × phases on save"

# Parte B — UX
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): hide advanced fields (RIR, Tempo) behind '+ Mais campos' toggle"

git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): banner explaining rounds × phases in compound methods"

git add mobile/components/trainer/program-builder/WorkoutItemRow.tsx \
        web/src/components/programs/workout-item-card.tsx
git commit -m "feat(per-set): show method chip on collapsed card and rename 'Avançado' → 'Editar séries'"

# Spec
git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.4 web parity and UX polish"

git push origin main
```

(Os comandos acima podem ter overlap em `git add`. Se um arquivo já foi commitado num passo anterior, o git pula sem erro. Se preferir, agrupa os commits do jeito que fizer sentido — o importante é manter mensagens descritivas.)

## 6. Reporte final

```
FASE 4.4 — paridade web + polimento UX

Parte A — paridade web:
  - SetSchemeTable.tsx ganha campo Rodadas, "Estrutura de uma rodada", 
    "+ Adicionar fase" pra métodos compound
  - saveProgram materializa rounds × phases no save (web)
  - collapseExpandedScheme helper no shared pra reconstruir scheme ao 
    re-abrir programa salvo

Parte B — UX:
  - Toggle "+ Mais campos" esconde RIR e Tempo por default (persiste em
    localStorage no web e MMKV no mobile)
  - Banner azul "Esta estrutura será repetida N vezes" + footer 
    informativo quando rounds > 1
  - Chip do método_key no card colapsado (web simple mode + mobile builder)
  - Botão "Avançado" → "Editar séries" com ícone Sliders

Commits: <X> empurrados em main

Próximo passo do Gustavo:
1. Web — abrir o builder do trainer (kinevoapp.com), criar exercício novo,
   tocar "Editar séries":
   a. Aplicar Drop-set → conferir campo "Rodadas: 3" + banner azul +
      "Estrutura de uma rodada" + "Adicionar fase".
   b. Toggle "+ Mais campos" — esconder/mostrar RIR e Tempo.
   c. Salvar programa. Re-abrir. Conferir que estrutura volta exatamente
      como prescrita (1 rodada visível, rounds=3).
   d. Conferir chip "Drop-set" no card colapsado.
2. Mobile — reload do simulador:
   a. Builder → conferir chip do método no card colapsado.
   b. "Editar séries" → conferir banner de rodadas.
   c. Toggle "+ Mais campos" no editor.
3. Atribuir um programa novo pra aluno → abrir como aluno → conferir que 
   nada na execução quebrou (deve seguir igual à Fase 4.3).
```

## 7. Edge cases

- **Trainer ativa "Mais campos" em um navegador, abre em outro**: cada navegador tem seu localStorage; preferência é por-device. OK.
- **Trainer abre programa salvo com rounds=3 mas tabela visível mostra 1 rodada**: comportamento esperado — `collapseExpandedScheme` reduz pra exibição, salva preserva expansão.
- **`expandSchemeByRounds(scheme, 3)` então `collapseExpandedScheme(expanded, 3)`**: roundtrip preservado (testado).
- **Trainer muda rounds de 3 pra 5 num programa já editado**: aplica novo rounds no save, materializa 5 cópias da estrutura atual.

## 8. Reverter (se quebrar)

```bash
git revert HEAD~7..HEAD --no-edit
git push origin main
```

(Ajusta o número de commits.)

## 9. Se algo der errado

- **Web salvar mas re-abrir vazio**: `collapseExpandedScheme` está dividindo errado. Verifique se `phasesPerRound = total / rounds` está dando inteiro. Se não, programa foi salvo de forma inconsistente — log + abort.
- **Toggle "+ Mais campos" não persiste**: verifique localStorage key e que está escrevendo no `onChange`.
- **Chip do método não aparece**: pode ser que o load não esteja trazendo `method_key`. Confirme query do `program-builder-client.tsx`.

Tudo claro? Confirme com "Fase 4.4 — começando" e parta da pré-checagem.
