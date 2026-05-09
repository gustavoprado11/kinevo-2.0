# Milestone 8 — Reestruturação Avaliações + Formulários (Fase 2 — Tier 2+3 cascade)

**Pré-requisitos:** Fase 1 completa (M1–M6), M7 polish em prod, audit `FASE-2-AUDIT.md` lido, decisões `FASE-2-DECISIONS.md` ratificadas.

**Goal:** executar a cascade completa das decisões D1+D2+D3 do workshop estratégico. Nova IA do produto (2 itens no menu), rotas separadas, componentes compartilhados, tours reescritos, migração in-app. **Polimento estrutural sem novas features.**

**Plataforma:** web only (mobile fica para M10).

**Dura:** 3-4 semanas (B1+B2+B3+B4).

**Branch:** sem branch — direto em main, sem commit/push até validação. Padrão dos M1-M7.

⚠️ **Risco:** este é o maior milestone da Fase 2. Mexe em IA do produto que trainers já usam. Migração in-app tem que estar polida pra não causar abandono. Cada sub-bloco tem critério de saída claro pra não acumular risco.

---

## 1. Por que M8 é estratégico

A Fase 1 entregou Avaliações Presenciais como feature funcional. M7 corrigiu polish + bugs. **Mas a IA do produto continua confundindo conceitos** (bug crônico do produto crescer em camadas).

M8 endereça a base da casa: separa Formulários e Avaliações como conceitos de 1ª classe, infraestrutura compartilhada onde faz sentido (BuilderShell, componentes de modal), tour novo, migração suave. Sem isso, M9 (Onboarding flow guiado) fica em cima de IA confusa.

---

## 2. Escopo (cascade completa das decisões)

### 2.1 Cascade D1 — Nova IA + rotas separadas

**Sidebar:**
- Item **"Formulários"** (ícone `FileText` ou similar, cor azul `#007AFF`)
  - Rota: `/forms` — só forms (anamnese, check-in, survey, feedback)
- Item **"Avaliações"** (ícone `Activity`, cor violet `#7c3aed`)
  - Rota: `/avaliacoes` — só assessments (presencial hoje)

**Decisão de naming:** "Avaliações" no singular conceito (sem "Presenciais"), pois vai virar família.

**Rota `/forms` redesenhada:**
- Header: "Formulários" + contador `submissions.length`
- CTAs do header: "Enviar para aluno" (primary azul) + "Novo template" (ghost)
- Sem tabs internas — só forms
- Conteúdo atual da tab "Respostas" sobe pra raiz da página

**Rota nova `/avaliacoes`:**
- Header: "Avaliações" + contador `assessmentSessions.filter(s => s.status !== 'cancelled').length`
- CTAs do header: "Nova avaliação" (primary violet) + "Novo template de avaliação" (ghost)
- Sem tabs internas — só assessments
- Conteúdo atual da tab "Avaliações Presenciais" sobe pra raiz, com possibilidade de seções estruturadas (similar ao "Aguardando Feedback" / "Enviados pendentes" da página de forms)

**Migração:**
- `/forms?tab=assessments` redireciona pra `/avaliacoes` por 90 dias (HTTP 301)
- Banner in-app na primeira visita pós-deploy: "Renomeamos para Formulários e Avaliações. Os 2 estão no menu lateral."
- Persistência via `trainer.onboarding_state.fase2_migration_seen` (jsonb existente)

### 2.2 Cascade D2 — BuilderShell + builders distintos

**Componente novo `<BuilderShell>`:**
- Header (← Voltar / título / "Alterações não salvas" / [Salvar])
- Auto-save em draft (`localStorage` key `builder-draft:{type}:{templateId}`)
- Modal "Sair sem salvar?" reutilizável
- Breadcrumb dinâmico
- Aceita `children` como prop (canvas injetável)

**Refator de builders existentes:**
- `/forms/templates/new` (form) — embrulhado em `<BuilderShell>`, mantém wizard 3-step + IA
- `/avaliacoes/templates/new` (assessment) — embrulhado em `<BuilderShell>`, mantém canvas drag-drop
- Rota antiga `/forms/templates/new?category=assessment` redireciona pra `/avaliacoes/templates/new` (HTTP 301)

**Templates listing:**
- `/forms/templates` — só forms
- `/avaliacoes/templates` — só assessments
- Ambas usam `<TemplatesList>` componente compartilhado, com filtros próprios

### 2.3 Cascade D3 — Componentes de modal compartilhados

**Componente novo `<StudentPicker>`:**
- Modes: `single` (com `value: string`) ou `multi` (com `value: string[]`)
- Search + filter integrados
- Aceita `lockedStudentId?: string` (caso preset, vide M7 QW2)
- Estados: idle, searching, error

**Componente novo `<TemplatePicker>`:**
- Filtra por categoria via prop
- Mostra "Avaliação Presencial" badges quando assessment
- Search integrado

**Componente `<ModalShell>`:**
- Header consistente (título + close)
- Footer com Cancelar/Confirmar
- Loading states
- Esc + click outside = close
- Aceita `children` como conteúdo principal

**Refactor de modais existentes:**
- `AssignFormModal` — usa `<ModalShell>` + `<StudentPicker mode='multi'>` + `<TemplatePicker category='form'>`
- `CreateSessionModal` — usa `<ModalShell>` + `<StudentPicker mode='single' lockedStudentId={...}>` + `<TemplatePicker category='assessment'>` + campos sex/age/scheduled_at específicos

### 2.4 Tours reescritos

**Estado anterior:** 2 tours (`forms` + `assessments_first_time`) coabitam na mesma página com risco de competição.

**Estado novo:**
- `tour_forms_first_time` — só dispara em `/forms` (forms-only). 3-4 steps.
- `tour_assessments_first_time` — só dispara em `/avaliacoes`. 3-4 steps.
- Sem cross-page interactions.

**Persistência:** `trainer.onboarding_state.tours_completed` continua sendo a fonte da verdade. Adicionar entry pra cada tour novo.

### 2.5 HealthMetricsCard — link updates

`web/src/components/students/health-metrics-card.tsx` (na sidebar do detalhe do aluno):

- Links pra `/forms?tab=assessments&...` → atualizar pra `/avaliacoes/...`
- "Enviar formulário" continua apontando pra forms inbox via assignFormToStudents
- Manter o `+` na seção "Avaliação Presencial" funcionando (preserva M7 QW2)
- Verificar se há outros links cross-cutting

---

## 3. Decisões registradas durante M8

### 3.1 Sem mudança de schema no DB

`form_templates.category='assessment'` continua como discriminador. Decisão de UX é só de apresentação.

Em algum momento futuro, pode fazer sentido criar tabelas separadas (`form_templates` vs `assessment_templates`) — mas isso é Fase 3+. Por agora reusa.

### 3.2 Redirect HTTP 301 (não soft redirect via JS)

Implementado em `next.config.ts` (ou middleware). HTTP 301 preserva SEO e bookmarks.

### 3.3 Banner in-app desaparece após confirmação

User clica "Entendi" → grava em `trainer.onboarding_state.fase2_migration_seen=true` → não reaparece. Assim como o card mobile do M6.

### 3.4 Componentes shared vivem em `web/src/components/shared/`

Subpasta nova:
- `web/src/components/shared/builder-shell.tsx`
- `web/src/components/shared/student-picker.tsx`
- `web/src/components/shared/template-picker.tsx`
- `web/src/components/shared/modal-shell.tsx`

Fica claro que são reutilizáveis cross-feature.

### 3.5 CSS de identidade por rota

- `/forms*` recebe data attribute `data-section="forms"` no body — Tailwind variant pode pintar elementos com a paleta azul
- `/avaliacoes*` recebe `data-section="avaliacoes"` — paleta violet
- Componentes shared lêem CSS variables que mudam por rota (`--accent-color`)

Alternativa simples: cada página passa cor explícita pros componentes. Decisão final no Bloco A.

---

## 4. Acceptance criteria

- ✅ Sidebar tem 2 items: Formulários + Avaliações, ícones e cores corretos
- ✅ `/forms` mostra só forms; `/avaliacoes` mostra só assessments
- ✅ `/forms?tab=assessments` retorna 301 → `/avaliacoes`
- ✅ `/forms/templates/new?category=assessment` retorna 301 → `/avaliacoes/templates/new`
- ✅ Builders rodando dentro de `<BuilderShell>`, com header e save/exit unificados
- ✅ Modais usam `<StudentPicker>` + `<TemplatePicker>` + `<ModalShell>`
- ✅ Tour `forms_first_time` dispara em `/forms` na primeira visita; tour `assessments_first_time` em `/avaliacoes`. Não competem.
- ✅ HealthMetricsCard aponta pras novas rotas (M7 QW2 preservado)
- ✅ Banner in-app de migração aparece na primeira visita pós-deploy, some após "Entendi"
- ✅ TypeScript zero novos erros
- ✅ Smoke test em prod cobre os 8 cenários da seção 7
- ✅ MILESTONE-8-STATUS.md final

---

## 5. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Trainers já bookmarkados em `/forms?tab=assessments` perdidos | HTTP 301 redirect garante (browsers atualizam bookmark) |
| Memória muscular: trainer abre Avaliações esperando ver forms | Banner in-app visível na primeira visita; tooltip no item Formulários se vier do Avaliações |
| BuilderShell genérico demais e quebra UX | Cada sub-bloco testa visualmente os 2 builders antes de prosseguir |
| Refactor dos modais regride flow do M7 QW2 (preset student) | Test scenário: clicar `+` no detalhe do aluno → modal abre preenchido |
| Tour `assessments_first_time` reseta pra trainers que já completaram (renomeio) | Migration: detectar tours antigos completados e copiar para os novos IDs |
| Mobile não acompanha — links do mobile podem apontar pra rotas antigas | Inventory de links no mobile → corrigir em paralelo (não bloqueia M8) |
| Performance — 2 rotas + componentes shared + new builder | Verificar bundle size pós-build, sem regressão crítica |
| LocalStorage drafts de builder antigo se perdem | Migration de keys: `builder-draft:assessment:*` e `builder-draft:form:*` lendo dos antigos por compat |

---

## 6. Sub-blocos sugeridos

### B1 — Nova IA + rotas separadas + redirects (~1 semana)

- Adicionar item "Formulários" no sidebar (separado do "Avaliações")
- Criar rota `/avaliacoes` clonando `forms-dashboard-client.tsx` mas só com a parte de assessments
- Refatorar `/forms` para mostrar só forms (remover tab Avaliações Presenciais)
- HTTP 301 redirects: `/forms?tab=assessments` → `/avaliacoes`
- HealthMetricsCard atualiza links
- Banner in-app de migração

**Critério de saída B1:**
- Trainer abre /forms — vê só forms, sem tab Avaliações Presenciais
- Trainer abre /avaliacoes — vê só assessments
- Bookmark antigo redirecciona corretamente
- Banner aparece + "Entendi" persiste

### B2 — BuilderShell + refactor builders (~1 semana)

- Extrair `<BuilderShell>` em `web/src/components/shared/`
- Refatorar `/forms/templates/new` pra usar shell
- Criar `/avaliacoes/templates/new` usando shell
- HTTP 301: `/forms/templates/new?category=assessment` → `/avaliacoes/templates/new`
- Templates listing splits em 2 rotas (`/forms/templates` + `/avaliacoes/templates`)

**Critério de saída B2:**
- Ambos os builders tem header consistente
- Save/exit funciona idêntico nos 2
- Drafts em localStorage são preservados

### B3 — StudentPicker + TemplatePicker + ModalShell (~1 semana)

- Extrair componentes compartilhados
- Refactor AssignFormModal e CreateSessionModal pra usar shared
- Test M7 QW2 (preset student) ainda funciona
- Test M7 QW1 (categoria) ainda funciona

**Critério de saída B3:**
- Modais visualmente coerentes
- Cenários M7 não regrediram
- Components reutilizáveis em testes isolados

### B4 — Tours reescritos + status doc + commit (~1 semana)

- Splitar TOUR_STEPS em `forms_first_time` + `assessments_first_time` (separados, sem competição)
- Atualizar selectors `data-onboarding`
- Migration de tours antigos completados → marca novos como completados
- MILESTONE-8-STATUS.md
- Commit + push

**Critério de saída B4:**
- Tours dispararam em isolamento
- Trainers existentes (com tours antigos completados) não veem tour de novo
- Status doc completo

---

## 7. Validação manual (cenários de smoke test)

1. **Trainer existente**: abrir prod após deploy → banner "Renomeamos..." aparece → clicar Entendi → não reaparece
2. **Bookmark antigo**: visitar `https://www.kinevoapp.com/forms?tab=assessments` → redireciona pra `/avaliacoes`
3. **Sidebar**: 2 items (Formulários + Avaliações), ícones e cores corretos
4. **Cross-cutting**: ir em `/students/[Marina]` → seção AVALIAÇÃO PRESENCIAL no HealthMetricsCard → clica `+` → abre modal preenchido em `/avaliacoes` (não `/forms`)
5. **Builder forms**: criar template anamnese via `/forms/templates/new` → save funciona → volta pra listagem
6. **Builder assessment**: criar template via `/avaliacoes/templates/new` → save funciona → volta pra listagem
7. **Tour forms novo trainer**: limpar `tours_completed.forms_first_time` no DB → abrir `/forms` → tour dispara
8. **Tour avaliações novo trainer**: limpar `tours_completed.assessments_first_time` → abrir `/avaliacoes` → tour dispara
9. **Modal flows**:
   - "Enviar para aluno" em `/forms` → abre AssignFormModal → multi-aluno + form template
   - "Nova avaliação" em `/avaliacoes` → abre CreateSessionModal → single aluno + assessment template + sex/age
   - Preset student funciona (caso M7 QW2)
10. **Sem regressão de mobile**: app mobile continua funcionando (não precisa OTA pra M8 — backend e API não mudam)

---

## 8. Fora de escopo

- ❌ Mudanças no schema do banco (M8 é só apresentação)
- ❌ Timeline cronológica do aluno (D4 — backlog)
- ❌ Onboarding flow guiado de aluno novo (M9)
- ❌ Mobile parity (M10)
- ❌ Custom font Inter no PDF (backlog)
- ❌ "Criar com IA" pra assessment templates (backlog)
- ❌ Cache de PDF em Storage (backlog)
- ❌ Refactor da Edge Function de PDF (M5 stable, não tocar)
