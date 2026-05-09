# PROMPT — Milestone 16: Wizard 3-step padronizado

> Cole no Claude Code. Hotfix-style. 3 sub-blocos com paradas obrigatórias.

---

## Goal

Form builder e Assessment builder usam `<BuilderWizardShell>` compartilhado. Wizard 3-step com Step 1 = Tipo (cards explicativos), Step 2 = Configurar, Step 3 = Editor específico do tipo.

## Antes de começar

1. Leia: `docs/specs/avaliacoes-presenciais/16-milestone-16-builder-wizard.md`
2. Examine:
   - `web/src/app/forms/templates/new/builder-client.tsx` (form wizard atual)
   - `web/src/app/forms/templates/new/page.tsx`
   - `web/src/app/avaliacoes/templates/new/assessment-builder-page-client.tsx`
   - `web/src/app/avaliacoes/templates/new/page.tsx`
   - `web/src/components/shared/builder-shell.tsx` (M8 D2 — existente)

## Workflow

- **Sem branch.** Direto em main.
- **3 sub-blocos** (B1: shell + form refactor, B2: assessment refactor, B3: status + commit)
- **Paradas obrigatórias** após cada B.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

1. `git status --short`, `git log --oneline -5`
2. **Form builder estrutura atual**:
   - Onde está o componente do wizard (3 steps Método/Configurar/Editor)?
   - Como o state machine funciona (passo entre steps)?
   - Onde está o `<BuilderShell>` antigo (M8 D2) sendo usado?
3. **Assessment builder estrutura atual**:
   - Layout single-step canvas direto. Como wrap em wizard?
4. **`<BuilderShell>` M8**:
   - Qual API atual? Posso estender ou criar `<BuilderWizardShell>` ao lado?
   - Recomendo criar novo (evita conflito com consumers existentes)
5. **Edit mode**:
   - Como `?edit=<id>` é detectado hoje?
   - Pular Steps 1+2 e ir direto pra 3 — pattern de implementar

PARE e me reporte:
- Plano de extração (`<BuilderWizardShell>` em `web/src/components/shared/`)
- Lista exata de arquivos a modificar/criar
- Surpresas

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — `<BuilderWizardShell>` + Form refactor (~5 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do diagnóstico.

### Mudanças

1. **`<BuilderWizardShell>`** em `web/src/components/shared/builder-wizard-shell.tsx`:
   - Props:
     ```ts
     interface BuilderWizardShellProps {
       title: string  // "Novo template" ou "Editando [nome]"
       isDirty: boolean
       isSaving: boolean
       currentStep: 1 | 2 | 3
       stepLabels?: [string, string, string]  // default ['Tipo', 'Configurar', 'Editor']
       canAdvance: boolean
       canSave: boolean
       onAdvance: () => void
       onBack: () => void  // se step > 1, volta um step; se step === 1, navega pra exit
       onSave: () => void
       onExit: () => void
       children: ReactNode
     }
     ```
   - Layout:
     - Header: ← Voltar + título + status indicator (Alterações não salvas / Salvando / Salvo)
     - Progress indicator horizontal (mesmo visual atual do form: bolinha numerada + label + linha)
     - Body com `children`
     - Footer: Cancelar (sempre) + Próximo (steps 1-2) ou Salvar (step 3)
   - Sem auto-save próprio (caller gerencia)

2. **Form builder refactor** (`forms/templates/new/builder-client.tsx`):
   - Embrulha em `<BuilderWizardShell>` em vez de `<BuilderShell>` antigo
   - **Step 1**: substitui "Método" (IA/Manual) por 4 cards de tipo:
     - Anamnese, Check-in, Pesquisa, Feedback do programa
     - Cada card: ícone + título + descrição curta + exemplo
     - Click → setCategory(<tipo>) + advance pra Step 2
   - **Step 2**: 
     - Nome do template (input required)
     - Descrição opcional
     - Toggle "Criar com IA" (opt-in, só pra forms)
   - **Step 3**: editor existente
     - Se `aiEnabled === true` no Step 2: abre prompt textual em vez do editor manual (já existe esse fluxo? confirma no diagnóstico)
     - Senão: editor normal de perguntas

3. **Edit mode** (`?edit=<id>`):
   - Detecta no page.tsx server component
   - Quando edit: passa `initialStep={3}` pro builder client (skipping 1 e 2)
   - Header muda pra "Editando [nome]"
   - Steps 1+2 ficam acessíveis mas com warning "Edit não muda tipo nem nome facilmente" — ou simplesmente desabilitados nessa pass

### Critério B1
- Form builder com wizard novo funciona end-to-end
- Edit mode entra direto no Step 3
- Auto-save preservado
- TypeScript clean

PARE e reporte. Eu valido em localhost.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — Assessment refactor (~3-4 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do B1.

### Mudanças

1. **Assessment builder refactor** (`avaliacoes/templates/new/assessment-builder-page-client.tsx`):
   - Embrulha em `<BuilderWizardShell>`
   - **Step 1**: 2 cards
     - "Em branco" → vai pra Step 2 com schema vazio
     - "Partir de template Kinevo" → modal/sheet com 5 Kinevo (Antropometria mínima, J&P 3, J&P 7, Petroski 4, Avaliação Inicial). Escolhe um → vai pra Step 2 com schema clonado
   - **Step 2**:
     - Nome do template
     - Descrição opcional
   - **Step 3**: canvas drag-drop existente (layout 3-col Biblioteca/Estrutura/Propriedades inalterado)

2. **Edit mode** análogo ao form:
   - `?edit=<id>` → entra direto Step 3
   - Header "Editando [nome]"

### Critério B2
- Assessment builder com wizard novo funciona end-to-end
- "Partir de Kinevo" clona schema corretamente
- Edit mode preservado

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — Status doc + commit
═══════════════════════════════════════════════════════════════════════

Após meu OK do B2.

1. `MILESTONE-16-STATUS.md`
2. Commit direto em main:

```
feat(visual): M16 wizard 3-step padronizado pros 2 builders

User flagou divergência grande entre form builder e assessment builder.
Padronizar chrome via <BuilderWizardShell> compartilhado, com Step 1 =
Tipo (cards explicativos), Step 2 = Configurar, Step 3 = Editor específico.

- <BuilderWizardShell> novo em components/shared
- Form: 4 cards de tipo (Anamnese, Check-in, Pesquisa, Feedback) + toggle IA opt-in
- Assessment: 2 cards (Em branco, Partir de template Kinevo)
- Edit mode pula Steps 1+2 (vai direto pro editor)
- Auto-save e exit confirmation preservados
- Editor de cada lado mantém especificidade (linear vs canvas drag-drop)

Co-authored-by: Claude <claude@anthropic.com>
```

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- BuilderShell M8 D2 entrelaçado em outros componentes — extração não-trivial
- IA prompt mode no form Step 3 não existe atualmente — precisa decidir (port da feature ou manter como opção pré-selecionada do Step 1 antigo)
- Schema clonagem do "Partir de Kinevo" tem edge cases (system_key, trainer_id NULL)

═══════════════════════════════════════════════════════════════════════
ORDEM
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. B1 → reportar (eu valido localhost)
3. B2 → reportar (eu valido localhost)
4. B3 (commit + push após meu OK)

COMECE PELO BLOCO A.
