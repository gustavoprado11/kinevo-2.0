# Prompt Claude Code — Fase 4.5c: Polimento profundo do modo Avançado (web + mobile)

> Cole numa nova sessão do Claude Code. Sem migration, sem deploy de Edge Function. Mudanças puramente visuais. Push direto em main.

---

A Fase 4.5b entregou as 4 mudanças prometidas (toggle, banner, chip, rename). Ao validar visualmente, o Gustavo (não-dev, dono do app) identificou 6 pontos adicionais de polimento UX/UI que ainda incomodam. Esta fase resolve todos os 6 numa entrega coesa.

**Princípio:** mudanças puramente visuais, zero impacto em comportamento/persistência. Cada um dos 6 pontos vira 1 commit separado pra revert granular se necessário.

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Você deve ver commits da Fase 4.5b
```

## 1. Ler estado atual

```bash
cat web/src/components/programs/SetSchemeTable.tsx
cat web/src/components/programs/SetSchemePresetChips.tsx
cat web/src/components/programs/workout-item-card.tsx
cat mobile/components/trainer/program-builder/SetSchemeEditor.tsx
cat mobile/components/trainer/program-builder/SetSchemeCard.tsx
cat mobile/components/trainer/program-builder/SetSchemePresetChips.tsx
```

## 2. Os 6 pontos (cada um vira 1 commit)

### Ponto 1 — Chips do método com hierarquia clara

**Problema atual:** os 6 chips (Pirâmide ↓, Pirâmide ↑, Drop-set, Top + backoff, 5×5, Cluster (rest-pause)) parecem botões empilhados sem hierarquia. Quando o método é "Customizado", há um chip separado em cima (`MÉTODO [Customizado]`), o que duplica visualmente.

**Solução:**

- **Web (`SetSchemeTable.tsx` + `SetSchemePresetChips.tsx`):**
  - Transforma a barra de chips em **segmented control horizontal coeso**: borda compartilhada entre os chips ou pequeno gap.
  - Chip ativo: `bg-violet-600 text-white shadow-sm`. Chip inativo: `bg-transparent text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600`.
  - Ao aplicar um preset, o chip dele fica ativo. Se trainer edita pós-preset, fica `'custom'` → adicionar chip "**Customizado**" como 7º opção, no mesmo padrão visual, mas só visível quando ativo (some quando não-custom).
  - **Remove o badge `MÉTODO [Customizado]`** que existe acima da barra — virou redundante. Header da seção fica só com o título da tabela ("Estrutura de uma rodada" ou "Estrutura").
  - Mantém o stepper "Rodadas" (Fase 4.4) intocado.

- **Mobile (`SetSchemePresetChips.tsx`):**
  - Mesma lógica. Use ScrollView horizontal pros chips se necessário (provavelmente já é).
  - "Customizado" como chip dinâmico no fim, só visível quando ativo.
  - Remove badge duplicado se existir.

### Ponto 2 — Campos CARGA mais limpos

**Problema atual:** input de carga vazio + chip pequeno "kg" do lado fica visualmente "morto". Toggle %1RM é confuso.

**Solução:**

- **Web (`SetSchemeTable.tsx`, célula CARGA):**
  - Input numérico com placeholder cinza claro `0` (em vez de vazio).
  - Unidade vira **dropdown inline** logo após o input: pequeno `<select>` (ou popover custom) com 2 opções: "kg" e "% 1RM". Visual: pílula clicável `bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs flex items-center gap-1` + ícone `ChevronDown` sutil.
  - O "kg" atual (que é toggle) é substituído por esse picker — clica nele, abre popover/select, escolhe.
  - O estado interno continua sendo `weight_kg` ou `weight_pct1rm` (mutuamente exclusivos por linha). Trocar a unidade limpa o outro campo.

- **Mobile (`SetSchemeCard.tsx`, campo carga):**
  - Mesma ideia: stepper numérico + chip clicável da unidade ao lado direito do input.
  - Tap no chip da unidade abre ActionSheet/Modal com 2 opções (kg / % 1RM) — alinha com padrões iOS/Android nativos.

### Ponto 3 — "Mais campos" e "Voltar para modo simples" separados visualmente

**Problema atual:** os dois ficam grudados no canto superior direito, mas têm naturezas diferentes (toggle vs ação destrutiva).

**Solução:**

- **Web (`SetSchemeTable.tsx`):**
  - "**Voltar para modo simples**" → vira **botão secundário pequeno** com ícone `Undo2` à esquerda. Posicionado no canto superior **esquerdo** da seção (acima da barra de chips), separado da área de toggle. Estilo: `text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800`.
  - "**+ Mais campos / − Menos campos**" → fica no canto superior **direito**, mas acima da tabela (não da seção inteira). Visual: link discreto, ícone `ChevronDown`/`ChevronUp` à esquerda.

- **Mobile (`SetSchemeEditor.tsx`):**
  - Header do bottom sheet ganha 2 áreas:
    - Esquerda: "Voltar para modo simples" como botão pequeno discreto.
    - Direita: "Mais campos" como chip toggle.

### Ponto 4 — Linhas da tabela com indicador visual de tipo

**Problema atual:** linhas Normal/Drop/Drop ficam visualmente idênticas. Aluno-treinador não distinguem o tipo sem ler a coluna TIPO.

**Solução:**

- **Web (`SetSchemeTable.tsx`):**
  - Cada linha ganha **borda esquerda colorida 3-4px de espessura** quando o tipo não é Normal:
    - `warmup` → `border-l-zinc-400`
    - `top` → `border-l-orange-400`
    - `backoff` → `border-l-sky-400`
    - `drop` → `border-l-rose-500`
    - `failure` → `border-l-red-600`
    - `cluster` → `border-l-violet-500`
    - `amrap` → `border-l-blue-500`
    - `normal` → sem borda colorida (ou `border-l-transparent`)
  - Padding-left da célula # aumentado pra acomodar a borda sem sobrepor o número.
  - **Não mexa** no `<select>` da coluna TIPO em si — só na borda da linha.

- **Mobile (`SetSchemeCard.tsx`):**
  - Cada card já é independente — adiciona uma `borderLeftWidth: 3` com a cor do tipo. Mesma paleta acima.
  - `borderLeftColor: 'transparent'` quando type === 'normal'.

### Ponto 5 — Síntese visual da estrutura (acima dos chips)

**Problema atual:** quando o método é compound (drop-set/cluster, rounds > 1), o trainer só percebe a estrutura lendo o footer "Aluno verá: 3 rondas × 3 fases = 9 fases". Falta um "header card" no topo da seção que sintetiza visualmente.

**Solução:**

- **Web (`SetSchemeTable.tsx`, no topo da seção, antes dos chips):**
  - Banner sutil ao lado direito da área onde fica o título da seção:
    - Quando rounds > 1 (compound): mostra pílula `bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full text-sm flex items-center gap-2` com ícone `Repeat` e texto "**3 rondas × 3 fases · 9 fases totais**".
    - Quando rounds = 1 e set_scheme.length > 1 (linear customizado): pílula similar mas verde-azulada com texto "**N fases**".
    - Quando set_scheme tem só 1 fase ou rounds=1: nada (não exibe).
  - Esse banner **substitui** o footer "Aluno verá: ..." que existia da Fase 4.4. Não precisa ter a info em dois lugares — manter só o banner do topo (mais visível).

- **Mobile (`SetSchemeEditor.tsx`):**
  - Mesma pílula no header do sheet, abaixo do nome do método. Adapta tamanho.
  - Remove o footer redundante.

### Ponto 6 — Ícones de ação mais legíveis

**Problema atual:** ícones de "duplicar" e "excluir" no fim de cada linha são pequenos e sem feedback claro.

**Solução:**

- **Web (`SetSchemeTable.tsx`, células de ação):**
  - Aumenta o tamanho do ícone de ~14px pra `16px` (Lucide `size={16}`).
  - Wrap cada ícone em um botão com `p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800` pra dar feedback de hover.
  - Cor padrão: `text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200`.
  - Tooltips: `title="Duplicar fase"` e `title="Remover fase"`.

- **Mobile (`SetSchemeCard.tsx`):**
  - Botões de duplicar/remover já existem; aumenta tamanho do hit area (mínimo 44×44 segundo Apple HIG).
  - Use `PressableScale` (já existe no projeto) pra feedback tátil.

## 3. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baseline TS web em 11 erros (pré-existentes). Sem regressões.

## 4. Commits e push

Cada ponto vira 1 commit (ou agrupar 1+2 se overlap), pra revert granular:

```bash
git pull --rebase origin main

cd shared && npx tsc --noEmit && cd ..
cd web && npx tsc --noEmit && cd ..
cd mobile && npx tsc --noEmit && cd ..

# Ponto 1
git add web/src/components/programs/SetSchemePresetChips.tsx \
        web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemePresetChips.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): unified segmented control for method chips with active 'Customizado' state"

# Ponto 2
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx
git commit -m "feat(per-set): inline unit picker (kg/%1RM) replaces toggle in CARGA cell"

# Ponto 3
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): separate 'Voltar para modo simples' (left) from 'Mais campos' toggle (right)"

# Ponto 4
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx
git commit -m "feat(per-set): colored left border on rows by set_type for visual differentiation"

# Ponto 5
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeEditor.tsx
git commit -m "feat(per-set): structure summary pill at top of advanced editor (replaces footer)"

# Ponto 6
git add web/src/components/programs/SetSchemeTable.tsx \
        mobile/components/trainer/program-builder/SetSchemeCard.tsx
git commit -m "feat(per-set): larger action icons with hover feedback and tooltips"

# Spec
git add mobile/specs/active/prescricao-per-set-manual.md
git commit -m "docs(per-set): document Fase 4.5c — UX overhaul (6 polish points)"

git push origin main
```

## 5. Reporte final

```
FASE 4.5c — UX overhaul do modo Avançado (em main)

6 pontos endereçados em commits separados:
  ✓ Chips do método em segmented control com 'Customizado' dinâmico
  ✓ Picker inline kg/%1RM no campo CARGA
  ✓ "Voltar" e "Mais campos" separados visualmente
  ✓ Borda esquerda colorida por set_type
  ✓ Pílula de síntese (rondas × fases) no topo
  ✓ Ícones de ação maiores com hover e tooltip

Arquivos tocados:
  web: SetSchemeTable.tsx, SetSchemePresetChips.tsx
  mobile: SetSchemeEditor.tsx, SetSchemePresetChips.tsx, SetSchemeCard.tsx

Commits: 7 empurrados em main (6 features + 1 doc)

Validações:
  shared: <X>/<X> (sem testes novos — só UI)
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: <X> erros baseline (idêntico)
  mobile vitest: <X>/<X>

Próximo passo do Gustavo:
1. Web (kinevoapp.com após Vercel): builder → entrar Avançado:
   a. Chips parecem segmented control unificado.
   b. Aplica Drop-set → vê pílula "3 rondas × 3 fases · 9 fases totais" no topo.
   c. Edita uma fase → chip "Customizado" aparece destacado.
   d. Confere bordas coloridas: linha Drop tem borda rosa, Top tem laranja, etc.
   e. Picker kg/% 1RM clicável no input de CARGA.
   f. Hover nos ícones de duplicar/excluir mostra fundo cinza sutil.
2. Mobile: mesmo roteiro no SetSchemeEditor.
3. Programa antigo sem set_scheme: continua sem chip, sem banner — comportamento normal.
```

## 6. Edge cases

- **Chip "Customizado" e "Voltar para modo simples"**: ambos lidam com transições. Garante que clicar em "Voltar" zera tudo (set_scheme, method_key, rounds → null/standard/1). E aplicar um preset com chip "Customizado" ativo deve **sobrescrever** o estado custom (com confirm dialog se já houver edits).
- **Picker kg/%1RM em programa antigo**: se o programa não tem nem `weight_kg` nem `weight_pct1rm` preenchido, o picker mostra "kg" como default (escolha mais comum).
- **Borda colorida em modo dark**: testa cores em ambos os temas; se contraste ficar fraco, ajusta tons (`-400` vs `-500` por tema).
- **Pílula de síntese**: quando set_scheme está vazio (recém-entrou em Avançado), não exibir.

## 7. Reverter (se algum ponto ficar ruim)

Como cada ponto é 1 commit, dá pra reverter individualmente:

```bash
git log --oneline | head -10
# Identifique o hash do ponto que quer reverter
git revert <hash> --no-edit
git push origin main
```

Tudo claro? Confirma com "Fase 4.5c — começando" e parta da pré-checagem.
