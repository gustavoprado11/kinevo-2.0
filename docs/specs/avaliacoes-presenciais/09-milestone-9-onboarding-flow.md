# Milestone 9 — Onboarding Flow Guiado (Fase 2)

**Pré-requisitos:** Fase 1 completa, M7 + M8 em prod. Componentes shared (`<ModalShell>`, `<StudentPicker>`, `<TemplatePicker>`) disponíveis.

**Goal:** ao criar um aluno novo, o trainer entra automaticamente num wizard de 2 steps que cobre as 2 ações mais comuns do onboarding: enviar anamnese + agendar primeira avaliação. Cada step pulável. Substitui os 5 contextos manuais de hoje por 1 fluxo coeso.

**Plataforma:** web only (mobile = M10).

**Dura:** 1-2 semanas (B1 + B2 + B3).

**Branch:** `m9-onboarding-flow` (mesmo padrão M8 — sub-blocos como commits, merge final via PR).

---

## 1. Estado atual vs. desejado

### Hoje
1. Trainer vai em `/students` → cria aluno (modal)
2. Vai em `/forms` → "Enviar para aluno" → escolhe anamnese → assigna
3. Volta em `/avaliacoes` → "Nova avaliação" → escolhe template + sexo + idade
4. (mobile) → captura medições
5. (web) volta no detalhe do aluno → cria programa

5 contextos distintos pra um workflow que é mentalmente uma coisa só ("vou onboardar a Marina").

### Pós M9
1. Trainer vai em `/students` → cria aluno (modal)
2. Modal fecha → **wizard de 2 steps abre automaticamente**:
   - Step 1: enviar anamnese (skippable)
   - Step 2: agendar primeira avaliação (skippable)
3. Wizard fecha → trainer cai no detalhe do aluno com toasts de confirmação

Steps 4 e 5 do flow original (mobile + programa) ficam fora de M9.

---

## 2. Design do wizard

### Layout
- Slide-in sheet do lado direito (mobile-first responsive)
- Width fixo desktop: 480px
- Width mobile: 100vw
- Animação: slide com fade do backdrop
- Overlay backdrop (escuro semi-transparente) — click fecha tudo (com confirmação se houver mudanças)
- Esc fecha (com confirmação se houver mudanças)

### Header
- Avatar do aluno + nome ("Marina Lanza" ou similar)
- Subtitle: "Onboarding · Step N de 2"
- Close X no canto direito

### Step 1 — Anamnese (opcional)
- Title: "Envie uma anamnese para começar"
- Description: "A anamnese ajuda você a conhecer a Marina antes da primeira sessão. Pule se preferir capturar tudo presencialmente."
- `<TemplatePicker category="form">` (filtra anamnese/checkin/survey — só template tipo `anamnese` por default? ou todos os forms? começar com `category='form'` general)
- Optional textarea: "Mensagem pessoal (opcional)"
- Footer: `[Pular]` `[Enviar e continuar]`

### Step 2 — Avaliação (opcional)
- Title: "Agende a primeira avaliação presencial"
- Description: "Agende a captura de medições. Pode ser hoje ou daqui umas semanas."
- `<TemplatePicker category="assessment">` (5 templates Kinevo + custom)
- Sexo biológico (botões Masculino/Feminino — mesmo padrão CreateSessionModal)
- Idade (input number 5-120)
- Quando (datetime-local, opcional — placeholder "Deixe em branco para começar agora")
- Observações (textarea, opcional)
- Footer: `[Voltar]` `[Pular]` `[Agendar e finalizar]`

### Done state
- Wizard fecha
- Redireciona pra `/students/[novoAlunoId]`
- Toasts (1 por ação completada, ordem cronológica):
  - "Anamnese enviada para Marina" (se step 1 não pulado)
  - "Avaliação agendada para 15/05" (se step 2 não pulado e tem date)
  - "Avaliação criada e em andamento" (se step 2 não pulado e sem date)
- Se ambos pulados: sem toast — só navega

---

## 3. Decisões registradas

### 3.1 Sem persistência de wizard incompleto

Se trainer fechar o wizard com só step 1 completo, o avaliação não é criada — ele teria que ir manualmente em `/avaliacoes`. Aceito por simplicidade. Reabrir wizard no detalhe do aluno é Tier 2 (não M9).

### 3.2 Reaproveitar actions existentes

- Step 1: `assignFormToStudents` (single aluno)
- Step 2: `createAssessmentSession`

Sem novas actions server-side. O wizard é UI pura que orquestra ações existentes.

### 3.3 Wizard usa `<ModalShell>` ou novo `<WizardShell>`?

Decisão: criar `<WizardShell>` próprio em `web/src/components/shared/wizard-shell.tsx` que reusa estrutura do ModalShell mas:
- Header com step indicator
- Footer com Voltar/Pular/Próximo configurável
- Sem botão close X redundante quando há Voltar (volta a step 1 via Voltar)
- Animação slide-in (vs fade do ModalShell)

Se ficar muito parecido com ModalShell, fundir depois (refatoração baixa).

### 3.4 Trigger via callback do StudentModal

`student-modal.tsx` (ou onde a criação acontece) ganha prop opcional `onSuccess(newStudentId)`. Quando preenchida, é chamada após sucesso. `students-client.tsx` passa um handler que abre o wizard.

Fluxo alternativo: não passa `onSuccess` → modal segue comportamento atual (toast + close). Mantém retro-compat.

### 3.5 Skippability

Cada step tem botão `[Pular]` que avança sem submeter aquela ação. Cancelar tudo é via Esc/click outside/X — exige confirmação se há dados não submetidos.

### 3.6 Naming

- Componente: `<OnboardingWizard>` ou `<NewStudentWizard>` — decidir no Bloco A
- Action que dispara: ver Bloco A

### 3.7 Mobile (web responsive, não app)

Wizard funciona em viewport mobile do app web (PWA), com sheet ocupando 100vw. Não envolve mobile nativo — esse é M10.

---

## 4. Acceptance criteria

- ✅ Cadastro de aluno via modal abre wizard automaticamente após sucesso
- ✅ Wizard tem 2 steps com nomes do aluno no header
- ✅ Step 1: TemplatePicker forms + opcional message + Pular/Enviar
- ✅ Step 2: TemplatePicker assessment + sex + age + datetime + Voltar/Pular/Agendar
- ✅ Pular step 1 → vai pra step 2 sem assignar form
- ✅ Pular step 2 → fecha wizard, sem criar avaliação
- ✅ Cancelar tudo (Esc/click outside/X) com dados → confirmação
- ✅ Cancelar sem dados → fecha sem confirmação
- ✅ Wizard fecha → redireciona pra `/students/[id]`
- ✅ Toasts apropriados aparecem
- ✅ TypeScript zero novos erros
- ✅ MILESTONE-9-STATUS.md final

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Trainer experiente acha o wizard intrusivo | Pular fácil (1 click), Esc/click outside fecha tudo, configuração em settings (Tier 2) |
| Wizard quebra se trainer não tem template de anamnese | Detectar lista vazia → empty state inline com "Crie um template de anamnese primeiro" + link para `/forms/templates/new` |
| Animação slide-in pesada em mobile | Reaproveitar framer-motion já usado no AssignFormModal |
| Race condition: trainer fecha modal de criar aluno antes do success | onSuccess só dispara após confirmação do server |
| Wizard re-abre se trainer recarregar a página com query param | Usar query param efêmero (limpa via router.replace após abrir) |

---

## 6. Sub-blocos

### B1 — `<WizardShell>` + Step 1 (anamnese) + trigger integration (~5 dias)

- Criar `web/src/components/shared/wizard-shell.tsx`
- Criar `web/src/components/students/new-student-wizard.tsx` com Step 1
- Step 1: usa TemplatePicker + handle assign
- Hook trigger: student modal `onSuccess` callback → abre wizard com novo studentId
- Integração `students-client.tsx`

**Critério de saída:** criar aluno → wizard abre → step 1 visível → "Pular" funciona → "Enviar e continuar" envia anamnese e avança pra step 2 (placeholder por enquanto).

### B2 — Step 2 (avaliação) + done state (~3 dias)

- Step 2: campos (template + sex + age + datetime + notes)
- Action: createAssessmentSession (existente)
- Done state: fechar wizard + redirect + toasts apropriados
- Cancelar/X com confirmação se dirty

**Critério de saída:** flow completo do início ao fim funciona em 4 cenários (ambos / só anamnese / só avaliação / ambos pulados).

### B3 — Polish + tour novo + status doc + commit (~3 dias)

- Empty states (sem template anamnese, sem template assessment)
- Tour `tour_new_student_wizard` (3-4 steps explicando o flow na primeira vez que aparece)
- MILESTONE-9-STATUS.md
- Commit + PR + merge final

---

## 7. Validação manual

1. **Happy path completo**: criar aluno → wizard abre → step 1 envia anamnese → step 2 agenda avaliação → fecha → cai em `/students/[id]` com 2 toasts
2. **Pular step 1**: criar aluno → wizard abre → "Pular" → step 2 → agendar → toast só de avaliação
3. **Pular step 2**: criar aluno → step 1 envia → step 2 "Pular" → fecha → toast só de anamnese
4. **Pular ambos**: criar aluno → step 1 "Pular" → step 2 "Pular" → fecha → sem toast, só navega
5. **Cancelar com dados**: criar aluno → step 1 escolhe template → click outside → confirmação aparece
6. **Sem template de anamnese**: criar aluno (assumindo state limpo) → step 1 mostra empty state com CTA pra criar template
7. **Re-abertura via reload**: criar aluno → wizard abre → recarregar página → wizard NÃO reabre (query param efêmero)
8. **Tour primeira vez**: trainer novo cria primeiro aluno → wizard abre + tour com 3-4 highlights explicando o flow
9. **Voltar no step 2**: step 2 → "Voltar" → step 1 com dados preservados

---

## 8. Fora de escopo

- ❌ Mobile nativo (M10)
- ❌ Step 3 mensagem de boas-vindas
- ❌ Onboarding state persistente (continuar de onde parou)
- ❌ Reabertura via banner no detalhe do aluno
- ❌ Configuração "desabilitar wizard" em settings
- ❌ Wizard pra alunos existentes (só dispara em criação)
