# Milestone 16 — Wizard 3-step padronizado para Form e Assessment Builders

**Pré-requisitos:** Fase 2 + M11-M15 em prod.

**Goal:** unificar a experiência de criação de templates (forms e assessments) via wizard 3-step compartilhado. Cada Step 1 explica o propósito do tipo escolhido. Chrome (header, progress, save, footer) idêntico em ambos os builders. Editor de Step 3 mantém especificidade por tipo (linear pra forms, canvas drag-drop pra assessments).

**Plataforma:** web only.

**Dura:** ~2 semanas.

**Branch:** sem branch — direto em main, hotfix-style sub-blocos.

---

## 1. Estado atual vs. desejado

### Hoje
- **Form builder** (`/forms/templates/new`): wizard 3-step (Método → Configurar → Editor). Step 1 = escolha entre IA/Manual.
- **Assessment builder** (`/avaliacoes/templates/new`): vai direto pro canvas drag-drop. Sem wizard.
- Chrome divergente: tipografia, espaçamentos, posição do botão Salvar diferem.
- Propósito de cada tipo de template não é explicado em lugar nenhum.

### Pós-M16
- **Ambos** com wizard 3-step idêntico em chrome:
  - Step 1: Tipo (cards explicativos)
  - Step 2: Configurar (nome + descrição + opções específicas)
  - Step 3: Editor (linear pra forms, canvas drag-drop pra assessments)
- Chrome compartilhado (`<BuilderWizardShell>`): header, progress indicator, footer com Cancelar/Salvar
- Step 1 explica propósito de cada tipo

---

## 2. Step 1 — Tipo

### `/forms/templates/new`
4 cards (cada com ícone + título + descrição curta + exemplo de uso):

| Card | Título | Descrição | Exemplo |
|---|---|---|---|
| 1 | **Anamnese** | Conheça o aluno antes de prescrever | Histórico de saúde, lesões, objetivos |
| 2 | **Check-in** | Acompanhe periodicamente como o aluno está | Sono, energia, dor, motivação |
| 3 | **Pesquisa** | Recolha opiniões e dados pontuais | NPS, satisfação, feedback rápido |
| 4 | **Feedback do programa** | Avalie o programa concluído | Avaliação geral, pontos fortes/fracos |

Click → Step 2 com `category` pré-definido.

### `/avaliacoes/templates/new`
2 cards:

| Card | Título | Descrição |
|---|---|---|
| 1 | **Em branco** | Comece do zero (seções e testes que você escolher) |
| 2 | **Partir de template Kinevo** | Clone Antropometria, J&P, Petroski ou Avaliação Inicial |

Click "Em branco" → Step 2 normal.
Click "Partir de template Kinevo" → modal/sheet com os 5 Kinevo, escolhe um → vai pra Step 2 com schema pré-preenchido.

---

## 3. Step 2 — Configurar

Idêntico em ambos:
- Nome do template (text input, required)
- Descrição opcional (textarea curta)

### Forms only
- Toggle "Criar com IA" (default off) — quando ligado, Step 3 abre prompt textual em vez do editor manual

### Assessment only
- Nada extra (categoria já é fixa no Step 1)

---

## 4. Step 3 — Editor

Layout específico do tipo. Sem mudança no canvas existente:
- **Forms**: lista de perguntas (preserva preview phone à direita)
- **Assessments**: canvas 3-col (Biblioteca / Estrutura / Propriedades)

Chrome do Step 3 (header + footer Salvar) é parte do `<BuilderWizardShell>` — não muda por tipo.

---

## 5. Componente novo `<BuilderWizardShell>`

Em `web/src/components/shared/builder-wizard-shell.tsx`. Substitui parcialmente o `<BuilderShell>` existente (M8 D2):

- Header: ← Voltar + "Novo template" + status indicator (Alterações não salvas / Salvando / Salvo) + botão Salvar (só visível em Step 3)
- 3-step progress horizontal (mesmo visual do form atual: bolinha numerada + nome do step + linha conectando)
- Slot pra `children` (Step 1 / 2 / 3 conteúdo)
- Footer: Cancelar (sempre) + Salvar (só Step 3) ou Próximo (Step 1 e 2)

Pattern reusável pra futuros builders.

---

## 6. Decisões registradas

### 6.1 IA fica só em forms
M16 não adiciona IA pra assessments. Backlog se virar dor.

### 6.2 Preview phone fica só em forms
Assessments não ganham preview no Step 3. Adicional baixo retorno.

### 6.3 Step 1 do assessment: 2 opções
"Em branco" e "Partir de template Kinevo". Quando trainer clica em "Partir de Kinevo", abre seleção. Não é redundante com tipo Step 1 do forms.

### 6.4 Save/Exit lógica preservada
Auto-save em localStorage continua. Modal "Sair sem salvar?" continua. M16 só padroniza chrome.

### 6.5 Templates page (M8) inalterada
`/forms/templates` e `/avaliacoes/templates` continuam separadas. Wizard só altera `/new` e `?edit=<id>`.

### 6.6 Mobile builder (M10A) sem mudança
Mobile já tem fluxo próprio (list-based, sem wizard). M16 web only.

---

## 7. Acceptance criteria

- ✅ Form builder e Assessment builder usam `<BuilderWizardShell>` (chrome idêntico)
- ✅ Step 1 forms: 4 cards de tipo com descrições
- ✅ Step 1 assessment: 2 cards (Em branco / Partir de Kinevo)
- ✅ Step 2: nome + descrição em ambos. Forms tem toggle IA opcional
- ✅ Step 3 forms: editor linear (preserva preview phone)
- ✅ Step 3 assessment: canvas drag-drop
- ✅ Header, progress indicator, footer idênticos visualmente
- ✅ Save/exit/auto-save preservados
- ✅ Edit existing template (`?edit=<id>`) pula Step 1 e Step 2 (já tem dados), abre direto Step 3
- ✅ MILESTONE-16-STATUS.md

---

## 8. Riscos

| Risco | Mitigação |
|---|---|
| BuilderShell M8 D2 ainda existe — coexistência | Migrar gradualmente. Form builder usa novo shell, assessment usa novo, BuilderShell antigo pode ser removido depois |
| Step 1 do assessment com só 2 opções fica vazio | Visual generoso (cards grandes), explicação clara |
| Edit mode pula Step 1 — UX pode confundir | Em edit, header mostra "Editando [nome]" em vez de "Novo template" |
| IA toggle em forms breaking flow se não implementado | M16 mantém IA opção atual (vira pré-selecionado se trainer marcar toggle) |

---

## 9. Plano de implementação

### Bloco único enxuto, ~2 semanas

1. **`<BuilderWizardShell>`**:
   - Cria componente em `web/src/components/shared/builder-wizard-shell.tsx`
   - Aceita props: `currentStep`, `totalSteps` (sempre 3), `stepLabels`, `title`, `onSave`, `onExit`, `isDirty`, `isSaving`, `canSaveStep`, `children`, `footerExtra?`

2. **Form builder refactor**:
   - `forms/templates/new/builder-client.tsx` — embrulha em `<BuilderWizardShell>` em vez de `<BuilderShell>` antigo
   - Step 1: substitui IA/Manual por 4 cards de tipo
   - Step 2: ganha toggle "Criar com IA" (opt-in)
   - Step 3: mantém editor + preview existente

3. **Assessment builder refactor**:
   - `avaliacoes/templates/new/assessment-builder-page-client.tsx` — embrulha em `<BuilderWizardShell>`
   - Cria Step 1 (Em branco / Partir de Kinevo) — novo
   - Cria Step 2 (nome + descrição) — novo
   - Step 3: mantém canvas existente

4. **Edit mode**:
   - Quando `?edit=<id>`, pula Steps 1+2 e renderiza direto Step 3
   - Header: "Editando [nome]"

5. **Status doc + commit**

---

## 10. Validação

1. `/forms/templates/new`:
   - Step 1: 4 cards visíveis, click "Anamnese" → Step 2 com category=anamnese
   - Step 2: digita nome + descrição → Próximo → Step 3 com editor
   - Step 3: adiciona pergunta → Salvar → volta pra `/forms/templates`
   - Edit existing: `/forms/templates/new?edit=<id>` → vai direto Step 3 com schema preenchido
2. `/avaliacoes/templates/new`:
   - Step 1: 2 cards. Click "Em branco" → Step 2
   - Step 2: nome + descrição → Próximo → Step 3 com canvas vazio
   - Click "Partir de Kinevo" no Step 1: modal com 5 templates → escolhe Petroski 4 → Step 2 com nome pre-preenchido → Step 3 com canvas pré-preenchido
3. Chrome:
   - Header idêntico em ambos
   - Progress indicator idêntico
   - Footer idêntico
4. Save/exit/auto-save preservados em ambos os builders

---

## 11. Fora de escopo

- ❌ IA para assessment templates (backlog)
- ❌ Preview phone para assessment (backlog)
- ❌ Auditar Qualidade pra assessment (backlog — feature avançada)
- ❌ Mobile builder (M10A mantém pattern atual)
- ❌ Mudança nos canvases existentes
