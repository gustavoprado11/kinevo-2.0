# Prompt Claude Code — Fase 4.5d: Reestruturação visual + preservação de intenção do método

> Cole numa nova sessão do Claude Code. Sem migration, sem deploy de Edge Function.
>
> **Workflow:** apenas modificações no working tree — **NÃO faça commits, NÃO faça push**. O Gustavo vai continuar iterando esta funcionalidade (Fase 4.5d + possível Fase 5 — Texto para Treino) localmente. Quando a funcionalidade inteira estiver pronta e validada visualmente, ele autoriza commits atômicos e push numa tacada. Até lá, working tree é a fonte da verdade.

---

A Fase 4.5c entregou os pontos de polish (3, 4, 6). Esta fase fecha os pontos restantes que envolvem reestruturação visual mais profunda + uma mudança de comportamento sobre persistência da intenção do método.

**Os 4 pontos:**

1. **Chips do método em segmented control unificado** — sem badge "Customizado" duplicado.
2. **Picker inline kg / % 1RM** no campo CARGA (`Alert.alert` no mobile, dropdown no web).
5. **Pílula de síntese** "3 rondas × 3 fases · 9 fases totais" no topo, **substituindo** o footer atual da Fase 4.4.
7. **Preservar `method_key` nas edições** — princípio de "intenção sacra do treinador". O Customizado vira chip manualmente clicável (não auto-aplicado).

**Decisão de empacotamento:**
- Pontos 1 + 7 ficam num commit único (tocam os mesmos arquivos e a mudança de regra do método_key é parte da refatoração dos chips).
- Pontos 2 e 5 são independentes, cada um vira 1 commit.
- Total: 3 commits feature + 1 doc.

## 0. Pré-checagens

```bash
gh auth status
git checkout main
git pull origin main
git log --oneline -5
# Confira commits da Fase 4.5c
```

## 1. Ler estado atual

```bash
cat web/src/components/programs/SetSchemeTable.tsx
cat web/src/components/programs/SetSchemePresetChips.tsx
cat web/src/components/programs/workout-item-card.tsx
cat mobile/components/trainer/program-builder/SetSchemeEditor.tsx
cat mobile/components/trainer/program-builder/SetSchemeCard.tsx
cat mobile/components/trainer/program-builder/SetSchemePresetChips.tsx
cat shared/lib/prescription/set-scheme.ts | grep -A 30 "inferMethodKey"
```

## 2. Pontos 1 + 7 — Segmented control + Customizado manual + preservação da intenção

### Comportamento alvo

- **6 chips de preset** + **1 chip "Customizado"** (sempre visível, no fim da linha) = 7 chips visualmente unificados como segmented control.
- Trainer clica num **preset** (ex.: Drop-set):
  - `method_key = 'drop_set'`
  - `set_scheme` é sobrescrito com o `defaultSetsConfig` do preset
  - `rounds` é setado pra `defaultRounds`
- Trainer clica no chip **"Customizado"**:
  - `method_key = 'custom'`
  - **NÃO toca em `set_scheme`** (preserva a estrutura atual)
  - **NÃO toca em `rounds`**
- Trainer **edita qualquer campo** (reps, carga, descanso, set_type, número de fases):
  - `method_key` permanece como está. **NÃO flipa pra `'custom'` automaticamente.**
- Confirm dialog ao clicar num preset que **sobrescreveria** edits manuais (já existe — manter).
- Remove o badge `MÉTODO [Customizado]` que existia acima dos chips — virou redundante (o próprio chip Customizado mostra o estado).

### Visual dos chips — segmented control

**Web (`SetSchemePresetChips.tsx`):**
- Container: `inline-flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5`.
- Cada chip: `px-3 py-1.5 rounded-md text-sm font-medium transition-colors`.
- Chip ativo: `bg-violet-600 text-white shadow-sm`.
- Chip inativo: `text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100`.
- O 7º chip "Customizado" sempre aparece no fim, mesmo padrão.
- Se você precisar quebrar em duas linhas em telas pequenas, OK — mantém a aparência de "grupo" coeso.

**Mobile (`SetSchemePresetChips.tsx`):**
- ScrollView horizontal com os 7 chips.
- Container similar visualmente (cinza claro), chips internos com mesmo padrão.
- Use `bg: '#7c3aed'` (violet-600) pro ativo, texto branco. Mantém consistência com web.

### Mudança de regra (`shared/lib/prescription/set-scheme.ts`)

- O helper `inferMethodKeyFromScheme` permanece exportado, mas marcar como `@deprecated` no JSDoc (motivo: "method_key agora reflete intenção declarada do trainer, não estrutura derivada").
- Os callsites no builder web e mobile que chamavam essa função após edits **são removidos**. Editar uma fase NÃO atualiza o `method_key` mais.
- Aplicar preset (handler do clique no chip de preset) continua setando `method_key` pra o preset escolhido.
- Clicar no chip Customizado seta `method_key = 'custom'` direto, sem chamar inferência.

### Edge case importante

- **Programas antigos com `method_key='custom'` flipado automaticamente:** ficam como estão. Não é regressão — é histórico. Trainer pode reabrir e clicar num preset pra re-categorizar se quiser.
- **Trainer aplica Drop-set, edita uma fase, salva:** programa salvo com `method_key='drop_set'`. Ao reabrir, vê chip Drop-set ativo. Aluno vê chip Drop-set na execução. ✓

### Helper handler sugerido (web e mobile)

```ts
function handlePresetClick(key: MethodKey, opts: { hasEdits: boolean }) {
  if (key === 'custom') {
    // Mantém estrutura, só rotula como customizado
    onMethodKeyChange('custom')
    return
  }
  // Preset real: confirma se há edits a sobrescrever
  if (opts.hasEdits) {
    const confirmed = confirm('Aplicar preset vai sobrescrever as fases atuais. Continuar?')
    if (!confirmed) return
  }
  const preset = SYSTEM_PRESETS[key]
  onSchemeChange(preset.defaultSetsConfig)
  onRoundsChange(preset.defaultRounds)
  onMethodKeyChange(key)
}
```

(Adapta o `confirm` pra `Alert.alert` no mobile.)

### Mensagem de commit (quando a funcionalidade for fechada — não execute agora)

```
feat(per-set): unified segmented control with manual Customizado + preserve method_key on edits

- Chips render as segmented control on web and mobile
- 7th 'Customizado' chip always visible, manually clickable (preserves set_scheme)
- Editing fields no longer auto-flips method_key to 'custom'
- inferMethodKeyFromScheme deprecated — method_key reflects trainer's declared intent
- Removes redundant MÉTODO [Customizado] badge
```

Arquivos a serem agrupados nesse commit (futuro):
`web/src/components/programs/SetSchemePresetChips.tsx`, `SetSchemeTable.tsx`, `workout-item-card.tsx`, `mobile/components/trainer/program-builder/SetSchemePresetChips.tsx`, `SetSchemeEditor.tsx`, `SetSchemeCard.tsx`, `shared/lib/prescription/set-scheme.ts`.

## 3. Ponto 2 — Picker inline kg / % 1RM

### Web (`SetSchemeTable.tsx`, célula CARGA)

- Substitui o toggle atual ("kg" como pílula) por um **dropdown inline** logo após o input numérico.
- Visual: input + pílula clicável `bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs flex items-center gap-1` com ícone `ChevronDown`.
- Clicar abre popover/select com 2 opções: "kg" e "% 1RM".
- Trocar a unidade limpa o outro campo (mutuamente exclusivos).
- Placeholder do input: cinza claro `0`.

### Mobile (`SetSchemeCard.tsx`, campo carga)

- Stepper numérico já existente continua.
- Chip da unidade ao lado direito vira **clicável**: tap abre `Alert.alert` com 2 botões: "kg" e "% 1RM" (sem botão Cancel — escolha sempre uma das 2 opções, ou tap fora pra cancelar).
- Mesma lógica de unidade exclusiva: trocar limpa o outro.

### Estado

- `weight_kg` e `weight_pct1rm` continuam mutuamente exclusivos no `WorkoutSet` do shared.
- Ao trocar unidade, o valor numérico atual **é preservado** se possível (transferido pra outro campo). Se isso ficar confuso, simplesmente zera o campo destino e deixa o trainer digitar de novo.

### Mensagem de commit (quando a funcionalidade for fechada — não execute agora)

```
feat(per-set): inline unit picker (kg / % 1RM) replaces toggle in CARGA cell
```

Arquivos: `web/src/components/programs/SetSchemeTable.tsx`, `mobile/components/trainer/program-builder/SetSchemeCard.tsx`.

## 4. Ponto 5 — Pílula de síntese substituindo o footer

### Comportamento alvo

- **Remove** o footer atual "Aluno verá: 3 rondas × 3 fases = 9 fases no total" (introduzido na Fase 4.4).
- **Adiciona** uma pílula no **topo** da seção de Avançado, como header destacado da estrutura.

### Web (`SetSchemeTable.tsx`)

- Posicionamento: acima dos chips de preset, ao lado direito do título da seção (ou em uma linha própria, conforme couber).
- Visual: pílula pequena `bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full text-sm flex items-center gap-2`.
- Ícone `Repeat` da Lucide (16px) à esquerda.
- Texto:
  - **Quando rounds > 1 (compound):** "**3 rondas × 3 fases · 9 fases totais**".
  - **Quando rounds = 1 e set_scheme.length > 1:** "**N fases**" (sem rondas).
  - **Quando set_scheme.length ≤ 1:** não exibe.

### Mobile (`SetSchemeEditor.tsx`)

- Mesma pílula no header do bottom sheet, abaixo do nome do método e do stepper Rodadas.
- Adapta tamanho pra largura mobile (texto pode quebrar 2 linhas se necessário).

### Teste — converter, não deletar

A Fase 4.5b adicionou um teste em `web/src/components/programs/__tests__/SetSchemeTable.test.tsx` (ou similar) que asserta o footer "9 fases no total". Você precisa:

- **NÃO deletar** o teste.
- Reescrever a asserção pra verificar a pílula no topo. O teste continua validando que a info é mostrada — só muda o lugar.

### Mensagem de commit (quando a funcionalidade for fechada — não execute agora)

```
feat(per-set): structure summary pill at top of advanced editor (replaces footer)

- Pill 'N rondas × M fases · NxM fases totais' on top of section
- Removes redundant footer from Fase 4.4
- Test converted (not deleted) to assert pill location
```

Arquivos: `web/src/components/programs/SetSchemeTable.tsx`, `web/src/components/programs/__tests__/SetSchemeTable.test.tsx`, `mobile/components/trainer/program-builder/SetSchemeEditor.tsx`.

## 5. Validações locais (BLOQUEANTES)

```bash
cd shared && npx tsc --noEmit && npx vitest run && cd ..
cd web && npx tsc --noEmit && npx vitest run && cd ..
cd mobile && npx tsc --noEmit && npx vitest run && cd ..
```

Mantém baseline TS web em 11 erros (pré-existentes). Sem regressões em testes.

**Atenção especial:** o teste do footer (mencionado em Ponto 5) deve passar após a conversão. Se o seletor não encontrar a pílula nova, ajusta o seletor antes do commit.

## 6. Finalização — SEM commit, SEM push

**Importante:** **NÃO faça `git add`, `git commit` ou `git push`.** Apenas:

1. Atualize a spec `mobile/specs/active/prescricao-per-set-manual.md` com as notas da Fase 4.5d (modificação no working tree, sem commit).
2. Rode `git status` pra confirmar que o working tree reflete todas as mudanças que você fez.
3. Imprima o reporte final (seção 7).
4. Pare.

O Gustavo vai continuar iterando com as próximas fases (potencialmente Fase 5 — Texto para Treino) acumulando mudanças no working tree. Quando a funcionalidade inteira de "métodos avançados" estiver pronta e validada, ele vai pedir explicitamente: "agora commita tudo e faz push". Aí, e só aí, você organiza os commits atômicos seguindo as mensagens documentadas em §2/§3/§4 acima e roda `git push origin main`.

## 7. Reporte final

```
FASE 4.5d — reestruturação visual + preservação da intenção (working tree, sem commit ainda)

4 pontos endereçados (commits a serem agrupados quando funcionalidade for fechada):
  ✓ Pontos 1+7: chips em segmented control + Customizado manual + 
    method_key preservado em edits
  ✓ Ponto 2: picker inline kg / % 1RM no campo CARGA
  ✓ Ponto 5: pílula de síntese no topo (substitui footer)

Mudanças de comportamento:
  - inferMethodKeyFromScheme deprecated (não chamado no save/edit)
  - Editar uma fase não muda mais o method_key
  - Customizado vira chip clicável (não auto-aplicado)
  - Trocar unidade kg/%1RM via dropdown (web) / Alert (mobile)

Arquivos tocados:
  shared: set-scheme.ts (deprecation + JSDoc)
  web: SetSchemeTable, SetSchemePresetChips, workout-item-card, __tests__
  mobile: SetSchemeEditor, SetSchemePresetChips, SetSchemeCard

Validações:
  shared: <X>/<X>
  web TS: 11 erros baseline (idêntico)
  web vitest: <X>/<X>
  mobile TS: <X> erros baseline (idêntico)
  mobile vitest: <X>/<X>

Estado: working tree modificado, sem commits feitos. Aguardando suas próximas iterações + autorização final pra commitar+push.

Próximo passo do Gustavo:
1. Web local (`cd web && npm run dev`, abrir http://localhost:3000):
   a. Builder → Avançado → conferir chips em segmented control unificado.
   b. Aplicar Drop-set → editar reps de uma fase → confere que chip Drop-set 
      continua ativo (NÃO flipa pra Customizado).
   c. Clicar no chip Customizado → vira ativo, set_scheme preservado.
   d. Clicar em outro preset → confirm dialog antes de sobrescrever.
   e. Pílula "3 rondas × 3 fases · 9 fases totais" no topo (não mais no footer).
   f. CARGA: clicar na pílula "kg" abre dropdown com kg / % 1RM.
2. Mobile no simulador: mesmo roteiro, picker via Alert.alert.
3. Programa antigo: chip "Customizado" pode aparecer ativo se método_key 
   foi flipado pelo bug antigo. Comportamento esperado — trainer pode 
   re-aplicar preset pra corrigir.
```

## 8. Edge cases

- **Picker kg/%1RM com valor preenchido**: ao trocar unidade, decide se preserva ou zera. Se preservar, o valor numérico fica idêntico (interpretado na nova unidade). Se zerar, fica em branco. **Recomendação: zerar** — evita confusão visual de "100 virou 100% de 1RM" sem o trainer querer.
- **Confirm dialog**: usar nativo (`window.confirm` no web, `Alert.alert` no mobile). Texto: "Aplicar este preset vai sobrescrever as fases atuais. Continuar?".
- **Chip Customizado em programa novo (sem set_scheme)**: não exibe nada. Só aparece quando trainer entrou em modo Avançado.
- **Test do footer**: se outro teste (que não seja o da pílula) estiver acoplado ao texto antigo, ajusta também.

## 9. Iterar / desfazer

Como nada foi commitado, qualquer mudança fica no working tree. Se o Gustavo pedir ajuste após testar:

- **Pequeno ajuste:** edita os arquivos in place. Working tree continua acumulando.
- **Desfazer um arquivo específico:** `git checkout -- caminho/do/arquivo.tsx` (volta ao último estado em main).
- **Recomeçar do zero:** `git reset --hard origin/main` apaga tudo no working tree (use só se Gustavo pedir explicitamente — pode perder trabalho de fases anteriores que ainda não foram commitadas).

Quando ele autorizar o push (provavelmente após Fase 5 ou outra finalização), aí você organiza commits atômicos seguindo as mensagens documentadas neste prompt e roda `git push origin main`.

Tudo claro? Confirma com "Fase 4.5d — começando" e parta da pré-checagem.
