# PROMPT — Milestone 9: Onboarding Flow Guiado

> Cole este prompt no Claude Code. M8 em prod (PR #7 mergeado, tag v0.8.0-m8).
> Componentes shared do M8 disponíveis (ModalShell, StudentPicker, TemplatePicker).

---

Você vai implementar o **M9 — Onboarding Flow Guiado**. Após criar um aluno, um
wizard de 2 steps abre automaticamente cobrindo: enviar anamnese + agendar
primeira avaliação. Cada step pulável.

## Antes de começar

1. Leia, na ordem:
   - `docs/specs/avaliacoes-presenciais/FASE-2-DECISIONS.md`
   - `docs/specs/avaliacoes-presenciais/09-milestone-9-onboarding-flow.md` (a spec)
   - `docs/specs/avaliacoes-presenciais/MILESTONE-8-STATUS.md` (M8 deps)

2. Examine arquivos existentes:
   - `web/src/components/student-modal.tsx` (ou onde criação de aluno acontece)
   - `web/src/app/students/students-client.tsx`
   - `web/src/components/shared/modal-shell.tsx` (referência pra novo WizardShell)
   - `web/src/components/shared/student-picker.tsx`
   - `web/src/components/shared/template-picker.tsx`
   - `web/src/components/forms/assign-form-modal.tsx` (referência de side-effects)
   - `web/src/components/assessments/create-session-modal.tsx` (referência)
   - `web/src/actions/forms/assign-form.ts`
   - `web/src/actions/assessments/create-session.ts`

3. Confirme entendimento:
   - Wizard slide-in da direita, 480px desktop / 100vw mobile
   - 2 steps: anamnese + avaliação, cada um pulável
   - Trigger: student modal onSuccess callback → abre wizard
   - Reusa actions existentes (assignFormToStudents + createAssessmentSession)
   - Sem persistência: fechar = perde dados não submetidos
   - Sem mudança de DB schema

4. Se algo for ambíguo, **PARE e pergunte**.

## Workflow

- **Branch dedicada `m9-onboarding-flow`** (mesmo padrão M8)
- **Sem `git commit` em main durante desenvolvimento** — commits no branch
- **3 sub-blocos** (B1 → B2 → B3) com paradas obrigatórias
- **PR final pro merge em main** após B3 reportado e validado

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO + PLANEJAMENTO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

Execute e reporte:

1. `git status --short` (limpo)
2. `git log --oneline -5` (último: M8 squash em main)
3. Cria branch: `git checkout -b m9-onboarding-flow && git push -u origin m9-onboarding-flow`
4. Inspeção:
   - Onde a criação de aluno acontece (componente + action server)?
   - Tem callback de sucesso já existente?
   - Como o student modal é montado em `students-client.tsx`?
5. Inspeção dos componentes shared do M8 — confirma APIs:
   - `<ModalShell>` props
   - `<TemplatePicker>` props (category prop, value, onChange)
6. Confirma que tem template de anamnese disponível pra trainers (do contrário empty state)
7. Decisão de naming: `<NewStudentWizard>` ou `<OnboardingWizard>`?

PARE e me reporte com:
- Plano concreto de extração / criação
- Naming decidido
- Surpresas que recalibram escopo

═══════════════════════════════════════════════════════════════════════
BLOCO B1 — WizardShell + Step 1 + Trigger (~5 dias)
═══════════════════════════════════════════════════════════════════════

Só execute depois da minha aprovação do diagnóstico.

### Mudanças

1. **`<WizardShell>`** em `web/src/components/shared/wizard-shell.tsx`:
   - Props: `open`, `onClose`, `studentName`, `studentAvatar?`, `currentStep`, `totalSteps`, `children`, `footer`
   - Layout: slide-in sheet 480px direita (mobile 100vw)
   - Header: avatar + nome + "Onboarding · Step N de M" + close X
   - Backdrop click → onClose (com confirmação se dirty)
   - Esc → onClose (com confirmação se dirty)
   - Animação framer-motion (igual ao AssignFormModal pattern)

2. **`<NewStudentWizard>`** em `web/src/components/students/new-student-wizard.tsx` (ou `/components/shared/`):
   - State: `currentStep` (1 ou 2), `dirty` (boolean), data dos 2 steps
   - Renderiza step atual conforme estado
   - Footer dinâmico com Pular/Voltar/Próximo/Finalizar

3. **Step 1 — Anamnese**:
   - Title: "Envie uma anamnese para começar"
   - Description: "A anamnese ajuda você a conhecer [Nome] antes da primeira sessão. Pule se preferir capturar tudo presencialmente."
   - `<TemplatePicker category="form">` (atualmente o filter pode pegar `form` general; se ficar muito amplo, filtra mais por `category='anamnese'` — verifica e decide)
   - Optional `<textarea>` mensagem pessoal
   - Footer: `[Pular]` `[Enviar e continuar]`
   - Action ao clicar Enviar: `assignFormToStudents({ formTemplateId, studentIds: [novoAlunoId], message })`
   - Toast de sucesso aparece SÓ no done state (não inline)

4. **Trigger integration**:
   - `student-modal.tsx` ganha prop opcional `onSuccess?(newStudentId: string)`
   - Quando sucesso, chama `onSuccess` antes de fechar
   - `students-client.tsx` passa handler que abre `<NewStudentWizard>` com `newStudentId`
   - Wizard state local em students-client (open + studentId)

### Critério de saída B1

- Cadastrar aluno via modal → wizard abre automaticamente
- Step 1 mostra TemplatePicker e textarea
- "Enviar e continuar" assina anamnese e avança pra step 2 (placeholder OK por enquanto)
- "Pular" avança pra step 2 sem assignar
- Esc / click outside / X → confirmação se dirty

PARE e reporte. Eu valido via Chrome MCP em localhost.

═══════════════════════════════════════════════════════════════════════
BLOCO B2 — Step 2 + Done state (~3 dias)
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B1.

### Mudanças

1. **Step 2 — Avaliação**:
   - Title: "Agende a primeira avaliação presencial"
   - Description: "Agende a captura de medições. Pode ser hoje ou daqui umas semanas."
   - `<TemplatePicker category="assessment">`
   - Sexo biológico (botões Masculino/Feminino) — replicar pattern do CreateSessionModal
   - Idade (input number 5-120) — replicar
   - Quando (datetime-local, opcional)
   - Observações (textarea, opcional)
   - Footer: `[Voltar]` `[Pular]` `[Agendar e finalizar]`
   - Action ao clicar Agendar: `createAssessmentSession(...)`

2. **Voltar do Step 2 → Step 1**:
   - Preserva dados do step 1 (templateId + message)
   - Botão "Enviar e continuar" reusa dados (não re-assigna se já foi)
   - Lock visual: se já assignou, mostra "Anamnese enviada" em vez de TemplatePicker

3. **Done state**:
   - Fecha wizard
   - `router.push('/students/${novoAlunoId}')`
   - Toasts (1 por ação completada):
     - "Anamnese enviada para [Nome]" (se step 1 não pulado)
     - "Avaliação agendada para DD/MM" (se step 2 com data) OU "Avaliação criada e em andamento" (se sem data)
   - Se ambos pulados: sem toast — só navega

### Critério de saída B2

Os 4 cenários básicos funcionam:
- Happy: ambos completos → 2 toasts
- Só anamnese → 1 toast
- Só avaliação → 1 toast
- Ambos pulados → sem toast, só navega

PARE e reporte.

═══════════════════════════════════════════════════════════════════════
BLOCO B3 — Polish + Tour novo + Status doc + PR
═══════════════════════════════════════════════════════════════════════

Só execute depois da aprovação do B2.

### Mudanças

1. **Empty states**:
   - Sem template de anamnese: step 1 mostra "Você ainda não tem templates de anamnese. [Criar template]" → link `/forms/templates/new`. Botão Pular ainda funciona.
   - Sem template de assessment: step 2 mostra "Você ainda não tem templates de avaliação. [Criar template]" → link `/avaliacoes/templates/new`. Botão Pular ainda funciona.

2. **Tour `tour_new_student_wizard`**:
   - 3-4 steps explicando o wizard pra primeira vez
   - Selectors `data-onboarding`:
     - `wizard-step-1` (no card do step 1)
     - `wizard-step-2` (no card do step 2)
     - `wizard-skip` (no botão Pular)
   - Adicionar entrada no `tour-definitions.ts`
   - Trigger automático na primeira vez que o wizard aparece

3. **`MILESTONE-9-STATUS.md`**:
   - Sumário B1+B2+B3
   - Decisões registradas
   - 9 cenários de validação (seção 7 da spec)
   - Tour novo
   - Próximo passo: M10 (Cross-platform Parity)
   - "M9 COMPLETO. Fase 2 está 80% completa (M7+M8+M9 done; M10 last)."

4. **Commit + PR**:
   ```
   feat(onboarding): M9 onboarding flow guiado pra novo aluno

   - WizardShell + NewStudentWizard com 2 steps (anamnese + avaliação)
   - Trigger via student modal onSuccess callback
   - Reusa assignFormToStudents + createAssessmentSession (sem novas actions)
   - Empty states pra trainers sem templates
   - Tour novo tour_new_student_wizard com 3-4 steps
   - Cada step pulável, dirty-check no cancelamento

   M9 COMPLETO. Próximo: M10 (Cross-platform Parity).

   Co-authored-by: Claude <claude@anthropic.com>
   ```

5. **PR pra main** com smoke test detalhado no body.

PARE e reporte com hash + URL do PR + URL do Vercel preview.

═══════════════════════════════════════════════════════════════════════
BLOCO C — VALIDAÇÃO MANUAL EM PROD
═══════════════════════════════════════════════════════════════════════

Eu valido via Chrome MCP em prod após merge:
1. Cria aluno fictício → wizard abre → 4 cenários básicos
2. Cleanup do aluno fictício pós-test

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR E PERGUNTAR
═══════════════════════════════════════════════════════════════════════

- Student modal não tem hook de sucesso ou tem state machine complexa que dificulta plug-in
- TemplatePicker filter por category 'form' pega forms demais (anamnese vs checkin vs survey) — decidir filtro mais estreito
- Animação slide-in conflita com algum z-index existente
- assignFormToStudents action não suporta single aluno facilmente
- Tour `tour_new_student_wizard` requer mudanças estruturais no TourRunner

═══════════════════════════════════════════════════════════════════════
ORDEM RECOMENDADA
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar → aguardar aprovação
2. BLOCO B1 → reportar → aguardar aprovação visual
3. BLOCO B2 → reportar → aguardar aprovação visual
4. BLOCO B3 → reportar → eu valido Vercel preview e mergeio

NÃO commit, NÃO push até autorização explícita.

COMECE PELO BLOCO A.
