# Milestone 9 — Onboarding Flow Guiado — STATUS

**Data:** 2026-05-09
**Branch:** `m9-onboarding-flow` (PR pendente para `main`)
**Spec:** [`09-milestone-9-onboarding-flow.md`](./09-milestone-9-onboarding-flow.md)

**Status:** ✅ COMPLETO — entregue em 3 sub-blocos.

---

## Sumário

Após criar um aluno, um **wizard de 2 steps** abre automaticamente cobrindo as 2 ações mais comuns do onboarding: enviar anamnese + agendar primeira avaliação. Cada step pulável, dirty-check no cancelamento, toasts contextuais no done state.

Substitui os 5 contextos manuais de hoje por 1 fluxo coeso:

- **B1** (`b448598`): `<WizardShell>` slide-in 480px direita + `<NewStudentWizard>` com Step 1 (anamnese) + trigger via callback novo no `student-modal`.
- **B2** (`db5e58e`): Step 2 (avaliação presencial) + done state com toasts cronológicos + 4 cenários completos.
- **B3** (este commit): empty states + tour `tour_new_student_wizard` + status doc.

Sem mudança de DB schema. Sem novas server actions. Reusa `assignFormToStudents` (M3) e `createAssessmentSession` (M4).

---

## Componentes criados

### `<WizardShell>` — `web/src/components/shared/wizard-shell.tsx`
- Sheet slide-in da direita (480px desktop / 100vw mobile).
- Animação framer-motion: spring transition, `damping: 30, stiffness: 280`.
- Header: avatar + nome + "Onboarding · Step N de M" + close X.
- Step indicator: barras horizontais que pintam violet conforme avança.
- Body scrollable + footer fixo.
- **Esc** dispara `onRequestClose` (caller decide confirmação).
- **Backdrop click** idem.
- Z-index: `Z.MODAL` (overlay) + `Z.MODAL + 1` (sheet).
- **Distinto do `<ModalShell>`** (centered fade vs lateral slide). Se virar redundante no futuro, vale fundir.

### `<NewStudentWizard>` — `web/src/components/students/new-student-wizard.tsx`
- State machine com 2 steps internos.
- Reset on `open=true` (preserva `preassignedAnamnese` quando trainer usou o atalho do StudentModal).
- **Decisão B preservada**: prop `preassignedAnamnese` injeta direto em `anamneseSent`, fazendo Step 1 mostrar "já enviada" + botão Continuar — sem regredir o atalho de envio dentro do StudentModal.
- Done state: navega pra `/students/${student.id}` + toast cronológico do que foi feito.

---

## Step 1 — Anamnese (opcional)

**Arquivo:** [`new-student-wizard.tsx`](../../web/src/components/students/new-student-wizard.tsx) — `Step1Anamnese`.

- Title: "Envie uma anamnese para começar"
- Description: "A anamnese ajuda você a conhecer {firstName} antes da primeira sessão. Pule se preferir capturar tudo presencialmente."
- `<TemplatePicker category="form">` com array filtrado pra `category='anamnese'` (4 opções no seed Kinevo).
- Textarea opcional "Mensagem pessoal".
- **Submit**: `assignFormToStudents({ formTemplateId, studentIds: [novoAlunoId], message })` — reusa action existente. Após sucesso, lock visual com badge verde "Anamnese enviada" + título do template.
- **Pular**: `setAnamneseSkipped(true)` + avança pra Step 2.

### Empty state (sem templates de anamnese)
- Card com ícone violet + "Você ainda não tem templates de anamnese" + CTA `[Criar template de anamnese]` → `/forms/templates/new`.
- Footer: só botão **Continuar** (que avança o flow sem assignar — equivalente a Pular).
- O trainer pode criar template em outra aba e voltar — mas o wizard é por-sessão, não persiste.

---

## Step 2 — Avaliação (opcional)

**Arquivo:** [`new-student-wizard.tsx`](../../web/src/components/students/new-student-wizard.tsx) — `Step2Assessment`.

- Title: "Agende a primeira avaliação presencial"
- Description: "Agende a captura de medições com {firstName}. Pode ser hoje ou daqui umas semanas."
- `<TemplatePicker category="assessment">` (5 templates Kinevo + customs) — pre-selecionado com primeiro template.
- **Sexo biológico** (botões Masculino/Feminino, required) + hint "Necessário p/ cálculos".
- **Idade** (input number 5–120, required) — validação inline.
- **Quando** (datetime-local, opcional) + hint "Deixe em branco para começar agora.".
- **Observações** (textarea, opcional).
- **Submit**: `createAssessmentSession({ studentId, templateId, scheduledAt, notes, subjectSex, subjectAgeYears })`. Trata caso especial `'Sessão criada mas contexto'` (replicado do CreateSessionModal).
- **Voltar**: preserva dados do step 1 e step 2 (state vive no componente, não destrói).
- **Pular**: emite toasts do que foi feito + navega.

### Empty state (sem templates de avaliação)
- Card com ícone violet + "Você ainda não tem templates de avaliação" + CTA `[Criar template de avaliação]` → `/avaliacoes/templates/new`.
- Footer: só botões **Voltar** + **Concluir** (que finaliza o wizard como pular).

---

## Done state — toasts (4 cenários da spec)

Ordem cronológica: anamnese → avaliação. Só do que foi feito.

| Cenário | Toasts emitidos |
|---|---|
| Ambos completos | `Anamnese enviada para {Nome}` + `Avaliação agendada para DD/MM` (ou `…criada e em andamento` se sem datetime) |
| Só anamnese (Step 2 pulado) | `Anamnese enviada para {Nome}` |
| Só avaliação (Step 1 pulado) | `Avaliação agendada para DD/MM` (ou `…em andamento`) |
| Ambos pulados | sem toast — só navega |

Em todos os casos: `router.push('/students/${student.id}')` + fecha o wizard.

### Detalhe técnico — setState batching
React 19 às vezes mantém valor antigo em closures imediatamente após `setState(...)`. Para evitar race conditions, `emitDoneToasts(scheduledOverride?)` aceita override explícito. `finishWizardSuccess(scheduled)` passa o valor recém-calculado, sem depender do closure.

---

## Trigger integration

### Mudança em `student-modal.tsx`
Nova prop `onAccessDialogClosed?({ student, assignedFormId, assignedFormTitle })` chamada quando o `<StudentAccessDialog>` (modal de credenciais) fecha pós-criação. **Backward-compat**: prop opcional, não regride callers existentes.

### Hand-off do form atalho (decisão B)
O StudentModal já tinha dropdown "Selecione formulário (opcional)" que disparava `assignFormToStudents` na criação. Decisão B mantém esse atalho mas faz hand-off com o wizard:

- Se trainer **selecionou** form no modal → wizard abre com `preassignedAnamnese` populado → Step 1 mostra "Anamnese enviada [título]" + botão Continuar.
- Se **não** selecionou → Step 1 normal.

Documenta como **atalho preservado, candidato a unificação em milestone futuro**. Não há regressão para usuários que adotaram o atalho.

### Mudança em `students-client.tsx`
- 2 props novas: `anamneseTemplates`, `assessmentTemplates`.
- State `wizardStudent` + `wizardPreassigned`.
- Handler `handleAccessDialogClosed` faz hand-off do StudentModal pro wizard.
- Renderiza `<NewStudentWizard>` no fim do JSX.

### Mudança em `students/page.tsx`
- SELECT de `form_templates` ganhou `category` (zero custo extra).
- `formTemplates` (legacy, alimenta dropdown atalho) agora filtra `category !== 'assessment'` — antes mostrava assessments também (pseudo-bug latente corrigido).
- 2 arrays novos: `anamneseTemplates` (filter `'anamnese'`) e `assessmentTemplates` (filter `'assessment'`).

---

## Tour `tour_new_student_wizard` (B3)

**Arquivo:** [`tour-definitions.ts`](../../web/src/components/onboarding/tours/tour-definitions.ts).

3 steps que disparam na primeira vez que o wizard aparece:

1. `wizard-step-1` (placement `left`) — explica que aluno recém-criado pode receber anamnese + avaliação sem sair da tela.
2. `wizard-skip` (placement `top`) — destaca que skipping não cancela o flow.
3. `wizard-step-1` (placement `left`) — antecipa que step 2 é avaliação presencial.

`<TourRunner>` montado **dentro** do wizard com `currentStep === 1` guard — selectors do step 2 só existem após avançar; o auto-skip do TourRunner cobre selectors ausentes naturalmente.

---

## Acceptance criteria — checklist

- ✅ Cadastro de aluno via modal abre wizard automaticamente após o dialog de credenciais
- ✅ Wizard tem 2 steps com nome do aluno no header
- ✅ Step 1: TemplatePicker forms + opcional message + Pular/Enviar
- ✅ Step 2: TemplatePicker assessment + sex + age + datetime + Voltar/Pular/Agendar
- ✅ Pular Step 1 → vai pra step 2 sem assignar form
- ✅ Pular Step 2 → fecha wizard, sem criar avaliação
- ✅ Cancelar tudo (Esc/click outside/X) com dados → confirmação
- ✅ Cancelar sem dados → fecha sem confirmação
- ✅ Wizard fecha → redireciona pra `/students/[id]`
- ✅ Toasts apropriados aparecem
- ✅ Empty states em ambos os steps
- ✅ Tour novo dispara na primeira vez
- ✅ TypeScript zero novos erros

---

## Cenários de validação (seção 7 da spec)

| # | Cenário | Estado |
|---|---|---|
| 1 | Happy path completo: ambos enviados → 2 toasts | ✅ B2 |
| 2 | Pular step 1 → step 2 → 1 toast (avaliação) | ✅ B2 |
| 3 | Step 1 envia → step 2 pular → 1 toast (anamnese) | ✅ B2 |
| 4 | Pular ambos → sem toast, só navega | ✅ B2 |
| 5 | Cancelar com dados → confirmação aparece | ✅ B1/B2 |
| 6 | Sem template de anamnese → empty state com CTA | ✅ B3 |
| 7 | Re-abertura via reload → wizard NÃO reabre | ✅ (state local, sem query param) |
| 8 | Tour primeira vez → 3 steps automáticos | ✅ B3 |
| 9 | Voltar no step 2 → step 1 com dados preservados | ✅ B2 |

---

## Decisões registradas

- **`category='anamnese'` no Step 1** — 4 templates focados, em vez de todos os forms (9). UX coerente com o título "Envie uma anamnese".
- **`<WizardShell>` separado do `<ModalShell>`** — slide-in vs centered fade, lifecycle distinto. Sem unificação por enquanto.
- **`onAccessDialogClosed` callback novo** vs reuso do `onStudentCreated` — mais limpo, separa "aluno criado" de "trainer pronto pra próximo passo" (que só vale após fechar dialog de credenciais).
- **Decisão B — atalho preservado** — dropdown do StudentModal continua funcional, hand-off via `preassignedAnamnese`. Candidato a unificação em milestone futuro (não regride power users).
- **Sem persistência do wizard incompleto** — fechar com step 1 enviado mas step 2 pendente → o assign do step 1 já foi feito (DB), step 2 não. Trainer faz manual em `/avaliacoes`. Reabrir automaticamente é Tier 2.
- **Sem query param de trigger** — wizard state local em `students-client.tsx`. Reload limpa. Spec achava query param efêmero como ideia; state local é mais simples.
- **`emitDoneToasts(override?)`** — contorna setState batching do React 19 sem `setTimeout(0)` frágil.

---

## Não-regressão

- M3 (`assignFormToStudents`): action inalterada, agora chamada do wizard com array de 1 aluno.
- M4 (`createAssessmentSession`): action inalterada, mesma signature usada pelo CreateSessionModal.
- M7 QW2 (preset student no CreateSessionModal): preservado — wizard só dispara em **criação** de aluno, fluxo de re-avaliação a partir do detalhe permanece via HealthMetricsCard `+`.
- M8 (componentes shared): `<TemplatePicker>` reusado nos dois steps com filtros de categoria diferentes; `<ModalShell>` não tocado.
- StudentModal dropdown atalho: continua funcional, agora com hand-off pro wizard (sem regressão para callers que não passam `onAccessDialogClosed`).

---

## TypeScript

`npx tsc --noEmit` em `web/`: **0 novos erros** (11 pré-existentes em `__tests__` herdados de M7/M8).

---

## Follow-ups (não bloqueiam ship — vão para backlog)

1. **Reabertura via banner no detalhe do aluno** — se trainer fechou wizard com só anamnese enviada, banner "Você ainda não agendou avaliação pra Marina. [Agendar]" no `/students/[id]`. Tier 2.
2. **Configuração "desabilitar wizard" em settings** — power users que não querem o sheet pop-up. Tier 2.
3. **Step 3 — mensagem de boas-vindas** — `messages` table já existe; passo opcional pra trainer mandar primeira mensagem. Tier 2.
4. **Wizard pra alunos existentes** — flow disparável de `/students/[id]/onboarding` pra alunos pré-M9. Backlog.
5. **Unificação `<WizardShell>` ↔ `<ModalShell>`** — se M10 trouxer outro wizard com lifecycle parecido, vale extrair base comum.
6. **Unificação atalho do StudentModal ↔ Step 1 do wizard** — remover dropdown e deixar só wizard. Decisão de produto.

---

## Próximos passos

**M9 COMPLETO. Fase 2 está 80% completa (M7 + M8 + M9 done; M10 last).**

| Milestone | Escopo | Status |
|---|---|---|
| M7 | Tier 1 polish + bug fixes | ✅ prod |
| M8 | Reestruturação Avaliações + Formulários (cascade D1+D2+D3) | ✅ prod (`v0.8.0-m8`) |
| **M9** | **Onboarding flow guiado** | ✅ **este milestone** |
| M10 | Cross-platform parity (mobile builder, web capture, IA mobile) | pendente |

M10 é o último item da Fase 2 e provavelmente o maior — paridade web/mobile. Recomendação: planejar separadamente após smoke test de M9 em prod.
