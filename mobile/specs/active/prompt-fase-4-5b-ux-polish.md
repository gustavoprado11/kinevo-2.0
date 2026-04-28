# Prompt Claude Code — Fase 4.5b: UX Polish do modo Avançado (web + mobile)

> Cole numa nova sessão do Claude Code. **Sem migration, sem deploy de Edge Function**. Apenas código UI. Push direto em main.

---

A frente de "métodos avançados" está quase fechada. Faltam 4 pequenas melhorias de UX que vão deixar a feature limpa pra produção:

1. **Toggle "+ Mais campos"** — esconde colunas RIR e Tempo por default (que poucos trainers preenchem), reduz densidade visual.
2. **Banner explicativo** — quando o método é compound (drop-set/cluster), banner azul-claro informa "Esta estrutura será repetida 3 vezes. Aluno fará 9 fases no total".
3. **Chip do método no card colapsado** — antes de o trainer entrar em "Avançado", o card já mostra de qual método é (Drop-set, Pirâmide ↓, Customizado).
4. **Renomear "Avançado" → "Editar séries"** com ícone `Sliders`.

Aplica em web e mobile. Paridade total.

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Confira commits recentes da Fase 4.5a (volume correto)
```

## 1. Ler arquivos atuais (referência)

```bash
cat web/src/components/programs/SetSchemeTable.tsx
cat web/src/components/programs/workout-item-card.tsx
cat mobile/components/trainer/program-builder/SetSchemeEditor.tsx
cat mobile/components/trainer/program-builder/WorkoutItemRow.tsx
```

## 2. Mudança 1 — Toggle "+ Mais campos"

### 2.1 Web (`SetSchemeTable.tsx`)

- Estado local: `showAdvancedFields: boolean` (default `false`).
- Persistência: localStorage com chave `kinevo_setscheme_advanced_fields`.
- Header da tabela ganha um link/botão pequeno alinhado à direita (na mesma linha de "Voltar para modo simples"): "**+ Mais campos**" (ou "**− Menos campos**" quando expandido).
- Quando colapsado: colunas visíveis = `# | TIPO | REPS | CARGA | DESCANSO | ações`.
- Quando expandido: + colunas `RIR | TEMPO`.
- A toggle persiste a preferência por device.

### 2.2 Mobile (`SetSchemeEditor.tsx` ou `SetSchemeCard.tsx`)

- Estado local equivalente, persistido em MMKV: `kinevo_setscheme_advanced_fields_mobile`.
- Header do bottom sheet ganha um chip/botão "Mais campos" (ícone `ChevronDown`/`ChevronUp` que reflete estado).
- Cada `SetSchemeCard` esconde os campos `RIR` e `Tempo` quando colapsado.
- Quando expandido, os cards crescem verticalmente pra acomodar os campos extras com spacing consistente.

## 3. Mudança 2 — Banner explicativo de rodadas

### 3.1 Web (`SetSchemeTable.tsx`, acima da tabela)

- Renderiza só quando `rounds > 1`.
- Visual: card com `bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200`, padding pequeno (~12px), bordas arredondadas.
- Ícone `Repeat` da Lucide à esquerda (16px, mesma cor do texto).
- Texto:
  > **Esta estrutura de N fases será repetida X vezes.** O aluno fará Y fases no total.
- N = `setScheme.length`, X = `rounds`, Y = `N × X`.

### 3.2 Mobile (no header do `SetSchemeEditor`, abaixo do campo Rodadas)

- Mesma lógica, adaptada pra largura mobile (texto pode quebrar 2 linhas).
- Use as mesmas cores/ícone.

## 4. Mudança 3 — Chip do método no card colapsado

### 4.1 Web (`workout-item-card.tsx`, modo simples)

- No modo simples (3 inputs inline antes de entrar Avançado), adiciona chip do `method_key` na MESMA linha do nome do exercício, à direita.
- Só aparece se `method_key && method_key !== 'standard'`.
- Reutiliza `METHOD_KEY_LABELS` do shared (já existe).
- Visual: pílula compacta com `bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300`, borda sutil, ícone Lucide opcional à esquerda (`Zap` para drop-set, `TrendingDown` pra pirâmide ↓, etc. — mantenha consistente com o que já é mostrado na sala de treino do aluno).

### 4.2 Mobile (`WorkoutItemRow.tsx`)

- No card colapsado do exercício, adiciona chip do `method_key` ao lado do nome do exercício.
- Mesma lógica e visual.

## 5. Mudança 4 — Renomear "Avançado" → "Editar séries"

### 5.1 Web (`workout-item-card.tsx`)

- Botão "Avançado" vira "**Editar séries**" com ícone `Sliders` (Lucide) à esquerda.
- Mantém estilo de botão (não vira link/texto puro).
- Posicionamento idêntico.

### 5.2 Mobile (`WorkoutItemRow.tsx`)

- Botão "AVANÇADO" vira "**Editar séries**" com ícone `Sliders`.
- Idem padrão visual.

## 6. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baseline TS web em 11 erros (pré-existentes). Sem regressões em testes.

## 7. Commits e push

```bash
git pull --rebase origin main

# Re-valida após rebase
cd shared && npx tsc --noEmit && cd ..
cd web && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx
git commit -m "feat(per-set): hide RIR and Tempo behind '+ Mais campos' toggle (web + mobile)"

git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): banner explaining rounds × phases for compound methods"

git add web/src/components/programs/workout-item-card.tsx \
        mobile/components/trainer/program-builder/WorkoutItemRow.tsx
git commit -m "feat(per-set): show method_key chip on collapsed card (web + mobile)"

git add web/src/components/programs/workout-item-card.tsx \
        mobile/components/trainer/program-builder/WorkoutItemRow.tsx
git commit -m "feat(per-set): rename 'Avançado' to 'Editar séries' with Sliders icon"

git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.5b — UX polish"

git push origin main
```

(Se um arquivo apareceu em mais de um commit acima por sobreposição lógica, agrupe os commits do jeito que fizer sentido — o importante é que cada commit tenha mensagem clara e os 4 itens fiquem rastreáveis.)

## 8. Reporte final

```
FASE 4.5b — UX polish do modo Avançado (em main)

Mudanças aplicadas (web + mobile):
  ✓ Toggle "+ Mais campos" esconde RIR e Tempo por default 
    (persistido em localStorage / MMKV)
  ✓ Banner azul "Esta estrutura será repetida N vezes" quando rounds > 1
  ✓ Chip do método no card colapsado simple-mode
  ✓ Botão "Avançado" → "Editar séries" com ícone Sliders

Arquivos tocados:
  web: SetSchemeTable.tsx, workout-item-card.tsx
  mobile: SetSchemeEditor.tsx, SetSchemeCard.tsx, WorkoutItemRow.tsx
  spec atualizada

Commits: <X> empurrados em main

Validações:
  shared: <X>/<X>
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: <X> erros baseline (idêntico)
  mobile vitest: <X>/<X>

Próximo passo do Gustavo:
1. Web (kinevoapp.com): builder → criar exercício → entrar Avançado:
   a. Apply Drop-set → banner azul aparece com "3 vezes / 9 fases".
   b. Toggle "+ Mais campos" esconde/mostra RIR e Tempo.
   c. Voltar para modo simples → chip "Drop-set" aparece no card colapsado.
   d. Botão diz "Editar séries" com ícone.
2. Mobile (simulador): mesmo roteiro.
3. Programa antigo sem set_scheme: card colapsado sem chip (esperado);
   sem banner; sem toggle. Comportamento normal preservado.
```

## 9. Edge cases

- **localStorage indisponível** (modo privado, etc.): toggle funciona em memória, perde a preferência ao recarregar. OK.
- **Trainer não preencheu RIR nem Tempo**: toggle esconde colunas vazias mesmo. OK.
- **`method_key === null`**: chip não aparece. Comportamento esperado.
- **`method_key === 'standard'`**: chip não aparece. Comportamento esperado.
- **Usuário com tema dark**: banner usa cores `dark:` apropriadas (testar visualmente).
- **Card colapsado de superset**: o chip do método_key deve aparecer no exercício, não no superset parent. Garante via condicional.

## 10. Reverter (se quebrar)

```bash
git revert HEAD~5..HEAD --no-edit
git push origin main
```

(Ajusta o número de commits.)

Tudo claro? Confirme com "Fase 4.5b — começando" e parta da pré-checagem.
