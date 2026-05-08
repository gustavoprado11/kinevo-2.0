# Milestone 7 — Polish & Bug Fixes (Fase 2 — Tier 1)

**Pré-requisitos:** Fase 1 completa (M1–M6 em main), audit `FASE-2-AUDIT.md` lido. Branch `dashboard-aluno-redesign` consolidada em main via PR #6 (commit 236471e).

**Goal:** entregar o **Tier 1 inteiro** do roadmap de Fase 2: 4 quick wins independentes que corrigem 1 bug confirmado em prod e reduzem atrito em 3 fluxos críticos do dia-a-dia do trainer. Sem refatoração estrutural — apenas correções cirúrgicas.

**Plataforma:** web only (mobile fica para M10 quando a paridade for endereçada).

**Dura:** 3-4 dias úteis.

**Branch:** sem branch — direto em main, sem commit/push até validação.

---

## 1. Por que M7 vem primeiro

O audit identificou **4 quick wins** que não dependem de decisões estratégicas (essas ficam para o workshop pré-M8). Resolvem dores reais do trainer atual e elevam a qualidade percebida do produto **sem mexer em arquitetura**.

São independentes entre si — cada um pode ser feito e validado isoladamente. O único critério de pacote é que todos são "polish na superfície de Avaliações" e fazem sentido shipparem juntos como uma única release.

Razão extra: corrigir o bug de categoria em `/forms/templates` (QW1) é prioridade alta — qualquer trainer que abre essa tela hoje vê os templates de sistema (Petroski, Jackson & Pollock, etc) rotulados como "Pesquisa". Cara de produto inacabado.

---

## 2. Escopo (os 4 quick wins)

### 2.1 QW1 — Fix categoria correta em `/forms/templates` para assessments (BUG)

**Severidade: ALTA** — bug confirmado em prod.

**Estado atual:** templates com `category='assessment'` aparecem na lista geral (`/forms/templates`) com:
- Badge: "Pesquisa" (errado — vem do default do `CATEGORY_CONFIG` em `forms-dashboard-client.tsx:95-99` que só cobre `anamnese`/`checkin`/`survey`)
- Metadata: "0 perguntas" (vocabulário de form, não de assessment)
- Metadata: "0 respostas" (idem)
- Ícone: ícone genérico de form

**Estado desejado:**
- Badge novo: "Avaliação Presencial" (cor violet, alinhado com identidade da tab)
- Ícone: `Ruler` ou `Activity` (`lucide-react`) — já usado no HealthMetricsCard
- Metadata: `<N> seções` (em vez de "perguntas") — contar `schema_json.sections.length`
- Metadata: `<N> sessões` (em vez de "respostas") — contar via JOIN `assessment_sessions WHERE template_id = X` ou via prop pré-computada

**Locais a tocar:**
- `web/src/app/forms/forms-dashboard-client.tsx` — `CATEGORY_CONFIG` ganha entrada `assessment`
- `web/src/app/forms/templates/templates-client.tsx` — investigar como renderiza cards (provavelmente reusa `CATEGORY_CONFIG` ou tem um próprio)
- Possivelmente `web/src/app/forms/templates/page.tsx` — query precisa puxar `sections.length` e `sessions count` para templates de category=assessment

**Cuidado:** se `templates-client.tsx` puxa templates pré-formatados com `questionCount`/`responseCount`, vai precisar ramificar pra calcular `sectionCount`/`sessionCount` quando `category='assessment'`. Verificar onde está o load.

---

### 2.2 QW2 — Pré-preencher aluno no CreateSessionModal a partir de `/students/[id]`

**Estado atual:** clique no `+` da seção "AVALIAÇÃO PRESENCIAL" (ou onde quer que esteja após o redesign Onda 2) navega para `/forms?tab=assessments` e abre o `CreateSessionModal` — sem o aluno pré-selecionado. Trainer perde contexto e seleciona Marina de novo.

**Estado desejado:** quando o trigger vem do detalhe do aluno, o modal já abre com:
- Campo "Aluno" preenchido com o student do contexto
- Foco no campo "Template" (próximo passo lógico)
- Idealmente o campo Aluno fica readonly/disabled (visualmente cinza, com aria-readonly) — permite ver mas não trocar acidentalmente

**Como passar o contexto:**

Opção A — query param: `?createAssessment=1&studentId=<uuid>` na navegação a partir do student detail. `forms-dashboard-client.tsx` lê o param na montagem e abre modal já preenchido.

Opção B — state via Next.js router (mais limpo mas mais código). Ficar com A por simplicidade.

**Locais a tocar:**
- `web/src/components/students/health-metrics-card.tsx` (Onda 2 atual em main após PR #6) — ajustar handler do `+` da subseção de avaliação presencial. Verificar se ainda existe esse `+` ou se mudou de UX no redesign.
- `web/src/app/forms/forms-dashboard-client.tsx` — ler `searchParams.get('createAssessment')` + `studentId`, abrir modal já preenchido se ambos presentes.
- `web/src/components/assessments/create-session-modal.tsx` — aceitar prop opcional `lockedStudentId?: string` que, se passado, força o aluno e desabilita troca.

**Bonus (se baratinho):** o mesmo pattern para "Enviar formulário" a partir do aluno (não obrigatório, mas se o redesign Onda 2 já fez, manter alinhado).

---

### 2.3 QW3 — Contador correto no header de `/forms`

**Estado atual:** o `<h1>Avaliações</h1>` em `forms-dashboard-client.tsx:365` tem badge `{submissions.length}` próximo. Mas isso só conta submissions de formulários — não inclui sessions de avaliação presencial. Quando o trainer está na tab Presenciais, o número não bate com o que ele vê.

**Estado desejado:** contador é **contextual à tab ativa**:
- Tab "Respostas" ativa → badge mostra `submissions.length`
- Tab "Avaliações Presenciais" ativa → badge mostra `assessmentSessions.length` (filtradas: `status !== 'cancelled'`, sem filtro de período)

Alternativa: badge desaparece e cada tab mantém seu pequeno contador inline (já existe um para Avaliações Presenciais com `bg-violet-500/10`).

**Decisão de UX:** ir com a primeira opção (contador contextual). Mais simples, menos ruído visual.

**Locais a tocar:**
- `web/src/app/forms/forms-dashboard-client.tsx` — alterar JSX do header para condicional baseado em `activeTab`.

---

### 2.4 QW4 — Limpar empty state da tab Avaliações Presenciais

**Estado atual:** em `forms-dashboard-client.tsx:742-775`, quando `filteredAssessments.length === 0`, renderiza:
- Card grande tracejado com `+` e empty state copy
- CTA dentro do card: "Nova avaliação" (violet)
- E ainda existe no header da página: "Nova avaliação" (violet) + "Novo template de avaliação" (outlined)

Resultado: 3 pontos de entrada para criação, na mesma viewport, com hierarquia visual confusa.

**Estado desejado (decisão de design):**
- **Quando há 0 templates do trainer**: empty state mostra um único CTA "Criar template de avaliação" (foco na ação que destranca tudo). Header mostra apenas "Novo template" (sem "Nova avaliação", já que ainda não dá pra criar).
- **Quando há templates mas 0 sessões**: empty state mostra "Comece criando uma sessão" + 1 CTA principal "Nova avaliação". Header mostra os 2 CTAs (Nova avaliação primary + Novo template ghost), MAS o card empty state remove o seu CTA duplicado — deixa só copy + ícone.

**Locais a tocar:**
- `web/src/app/forms/forms-dashboard-client.tsx:742-775` — refatorar empty state com lógica diferenciada.

**Cuidado:** o tour `assessments_first_time` aponta `data-onboarding="assessments-new-session"` (que está no botão do header). Não quebrar o selector ao reorganizar.

---

## 3. Decisões registradas

### 3.1 Sem renomeação de categorias no banco

`category='assessment'` fica como está no banco. A correção é **só de apresentação** (CATEGORY_CONFIG). Mexer em data implica migration + backward compat com forms antigos categorizados — fora de escopo.

### 3.2 Sem unificação de modais (AssignFormModal vs CreateSessionModal)

Manter os 2 modais separados. Unificação fica para Tier 3 (M9). Aqui só pré-preenchemos o aluno num deles.

### 3.3 Sem mudar paleta entre tabs

Coerência visual entre tabs (CV1, CV2 do audit) fica para M8. Aqui o badge novo de "Avaliação Presencial" usa violet por consistência interna com o resto da identidade Avaliações Presenciais (que é violet desde M4).

### 3.4 Mobile fica de fora

A tela equivalente no mobile (`mobile/app/(trainer-tabs)/forms.tsx`) tem categoria similar, mas o bug de categoria pode ou não existir lá. Inspeção rápida durante o Bloco A confirma; se existir, **registramos como follow-up**, não corrigimos no M7.

---

## 4. Acceptance criteria

- ✅ `/forms/templates` mostra os 5 templates de sistema com badge "Avaliação Presencial" (não "Pesquisa")
- ✅ `/forms/templates` mostra metadata correta: "N seções · M sessões" (não "N perguntas · M respostas")
- ✅ Clique em "+" na seção AVALIAÇÃO PRESENCIAL do detalhe do aluno (após PR #6) abre CreateSessionModal já com o aluno preenchido
- ✅ Aluno fica visualmente fixo no modal (cinza/disabled) quando vem do contexto do detalhe
- ✅ Header contador de `/forms` corresponde ao tab ativo
- ✅ Empty state da tab Presenciais não tem 3 CTAs duplicados — escolha consciente conforme estado (com/sem templates)
- ✅ Tour `assessments_first_time` continua funcionando (selectors `data-onboarding` preservados)
- ✅ TypeScript zero novos erros
- ✅ MILESTONE-7-STATUS.md final
- ✅ Sem nova migration, sem nova dep, sem mudanças no engine M2

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Templates page (`templates-client.tsx`) tem load de dados pré-formatado que não inclui `sectionCount`/`sessionCount` para assessments | Verificar `page.tsx` server-side, possivelmente adicionar query suplementar ou contar via `schema_json.sections.length` no client |
| `health-metrics-card.tsx` (Onda 2) pode não ter um `+` para criar avaliação — o redesign pode ter movido essa ação pra outro lugar | Bloco A inspeciona estado atual e a gente recalibra QW2 se necessário |
| Tour `assessments_first_time` aponta seletor que pode mudar com a refatoração do empty state | Manter `data-onboarding="assessments-new-session"` no botão do header (que não some) |
| Pré-preenchimento via query param expõe `studentId` na URL — não é PII sensível mas vale evitar log em analytics | OK, é UUID interno, não viola nada |
| Mobile pode ter o mesmo bug de categoria que web | Apenas registrar como follow-up no MILESTONE-7-STATUS.md, não corrigir aqui |

---

## 6. Sub-blocos sugeridos

### B1 — QW1 (categoria correta) + QW3 (contador)

Os dois mais "alinhados" — ambos mexem em `forms-dashboard-client.tsx` e `templates-client.tsx`. ~1.5 dias.

Verificações:
- Visual confere em `/forms/templates` (5 templates de sistema com badge correto)
- Visual confere em `/forms` (badge contextual ao tab)
- Tour ainda dispara corretamente
- TypeScript clean

### B2 — QW2 (pré-preencher aluno)

Mais isolado, mexe em 3 arquivos (student detail, forms dashboard, modal). ~1.5 dias.

Verificações:
- Clique no `+` do health-metrics-card → modal abre com aluno preenchido
- Aluno fica disabled no modal
- Sem regressão: clique em "Nova avaliação" do header de `/forms?tab=assessments` continua abrindo modal com aluno vazio (modo "criar do zero")

### B3 — QW4 (empty state) + status doc + commit

Refatora o empty state, escreve `MILESTONE-7-STATUS.md`, e empacota. ~1 dia.

---

## 7. Validação manual

1. **QW1 — visualmente em prod-deploy local (`npm run dev`)**: abrir `/forms/templates`, verificar todos os 5 templates de sistema (Antropometria mínima, Petroski 4, J&P 3, J&P 7, Avaliação Inicial Presencial) com badge "Avaliação Presencial" violet + metadata "N seções · 0 sessões"
2. **QW1 — não regressão de forms**: confirmar que templates de category `anamnese`/`checkin`/`survey` continuam com seus badges/ícones/labels originais
3. **QW2 — flow do detalhe do aluno**: ir em `/students/[Marina]`, clicar `+` da seção avaliação presencial, modal abre com Marina preenchida e disabled
4. **QW2 — flow standalone**: ir em `/forms?tab=assessments`, clicar "Nova avaliação", modal abre vazio (aluno selecionável normalmente)
5. **QW3 — header contador**: alternar entre tabs Respostas e Presenciais, badge no h1 muda de número apropriadamente
6. **QW4 — empty state com 0 templates**: temporariamente ocultar templates do trainer (via SQL local ou trainer test), verificar que empty state da tab Presenciais mostra 1 CTA correto
7. **QW4 — empty state com templates mas 0 sessões**: estado normal de novo trainer, verificar copy e CTA
8. **Tour M6**: limpar `tours_completed.assessments_first_time` no DB (SQL), recarregar `/forms?tab=assessments`, tour dispara nos 4 selectors corretos

---

## 8. Fora de escopo

- ❌ Mudanças de paleta entre tabs (M8)
- ❌ Estruturação da tab Presenciais com seções tipo Respostas (M8)
- ❌ Unificação de modais (M9)
- ❌ Timeline cronológica do aluno (M9)
- ❌ Onboarding flow guiado (M9)
- ❌ Renomeação "Avaliações" → "Formulários e Avaliações" (M9, decisão estratégica)
- ❌ Mobile (M10)
- ❌ Custom font Inter no PDF (Fase 2 backlog do M5)
