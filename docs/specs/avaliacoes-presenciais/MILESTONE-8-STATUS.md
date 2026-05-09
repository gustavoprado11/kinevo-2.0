# Milestone 8 — Reestruturação Avaliações + Formulários — STATUS

**Data:** 2026-05-09
**Branch:** `m8-restructure` (PR pendente para `main`)
**Spec:** [`08-milestone-8-restructure.md`](./08-milestone-8-restructure.md)
**Decisões que motivaram:** [`FASE-2-DECISIONS.md`](./FASE-2-DECISIONS.md) (D1+D2+D3)

**Status:** ✅ COMPLETO — Tier 2+3 da Fase 2 entregue em 4 sub-blocos.

---

## Sumário

A cascade completa das decisões D1, D2 e D3 do workshop estratégico foi entregue em 4 sub-blocos commitados isoladamente no branch `m8-restructure`:

- **B1** ([`d581cf3`](https://github.com/gustavoprado11/kinevo-2.0/commit/d581cf3)): nova IA do produto + rotas separadas + redirects + banner in-app de migração
- **B2** ([`5532be4`](https://github.com/gustavoprado11/kinevo-2.0/commit/5532be4)): `<BuilderShell>` compartilhado + builders distintos + listings split por categoria
- **B3** ([`135ef7f`](https://github.com/gustavoprado11/kinevo-2.0/commit/135ef7f)): `<ModalShell>` + `<StudentPicker>` + `<TemplatePicker>` compartilhados; modais distintos preservando lógica específica
- **B4** (este commit): tours reescritos sem competição cross-page + migration de tours antigos + status doc

Sem mudança no schema do DB (categoria `assessment` em `form_templates` continua como discriminador). Sem mudança no engine M2 ou na Edge Function de PDF (M5).

---

## Cascade D1 — Nova IA + rotas separadas (B1)

### Sidebar
- 2 items distintos no nav: **Formulários** (azul `#007AFF`, ícone `FileText`, `/forms`) e **Avaliações** (violet `#7c3aed`, ícone `Activity`, `/avaliacoes`).
- Cor da Avaliações via `style` inline para preservar Shield Strategy do CLAUDE.md (sem migrar hex hardcoded).

### Rotas
- `/forms` redesenhada como forms-only: header "Formulários", contador `submissions.length`, sem tabs internas, seções "Aguardando Feedback" + "Enviados pendentes" + "Todas as Respostas" + "Templates de Formulário".
- `/avaliacoes` nova: header "Avaliações", contador de sessões ativas, filter chips (Todas/Em atraso/Próximas/Concluídas), lista de sessões via `<SessionListItem>`, footer leve com link "Gerenciar →" para listing.

### Redirects (HTTP 308 — equivalente moderno do 301)
- `/forms?tab=assessments` → `/avaliacoes`
- `/forms/templates/new?category=assessment` → `/avaliacoes/templates/new` (ativado em B2)
- `/forms/templates/new?edit=<id>` para template com `category='assessment'` → server `redirect()` para `/avaliacoes/templates/new?edit=<id>` (cobre cliques legados em listings antigas)

### Banner in-app de migração
- `<MigrationBanner>` aparece no top de qualquer página dentro do `AppLayout`.
- Texto: "Renomeamos para **Formulários** e **Avaliações**. Os 2 estão no menu lateral." + botão "Entendi" + X.
- Persiste via `onboarding_state.tips_dismissed[id='fase2_migration_banner']` (sem mudança de schema; reusa array existente).
- Sync **síncrono via server action** antes do banner sumir (não usa o debounce do store de 800ms — protege contra F5 imediato). `revalidatePath('/', 'layout')` na action mantém pages que recebem `trainer.onboarding_state` atualizadas.

### HealthMetricsCard
- Link do `+` em "Avaliação Presencial" (sem sessão) atualizado de `/forms?tab=assessments&...` para `/avaliacoes?createAssessment=1&studentId=...`. Preserva M7 QW2 (modal abre com aluno preenchido e disabled).

### Cross-cutting links atualizados
- `session-detail-client.tsx` e `result-client.tsx`: botão "Voltar para Avaliações" → `/avaliacoes`.
- `theme-provider.tsx`: `LOGGED_AREA_PREFIXES` ganhou `/avaliacoes`.
- `next.config.ts`: `redirects()` adicionados.

### Bug encontrado e corrigido durante validação B1
- **Sintoma:** click "Entendi" no banner → F5 → banner reaparece.
- **Diagnóstico:** `OnboardingProvider` recebia `initialState=null` em `/forms` e `/avaliacoes` (apenas `dashboard-client.tsx` propagava). Combinado com `skipHydration: true` no zustand-persist, o estado do localStorage não era restaurado e o tip parecia "esquecido".
- **Fix:** `onboardingState` propagado em `forms/page.tsx`, `avaliacoes/page.tsx`, `forms/templates/page.tsx`, `avaliacoes/templates/page.tsx`, `forms/templates/new/page.tsx`, `avaliacoes/templates/new/page.tsx`, e nos respectivos clients que rendem `<AppLayout>`. Banner agora persiste corretamente.

---

## Cascade D2 — BuilderShell + builders distintos (B2)

### `<BuilderShell>` — `web/src/components/shared/builder-shell.tsx`
- Header consistente: ← Voltar / título / "Alterações não salvas" / botão Salvar
- Modal "Sair sem salvar?" (Esc / click outside fecham overlay; "Continuar editando" / "Sair sem salvar")
- `beforeunload` guard quando `isDirty=true` — protege F5/fechar aba
- Props: `title`, `subtitle?`, `onExit`, `onSave?`, `canSave`, `isDirty`, `isSaving`, `draftKey?` (informativa), `saveLabel?`, `hideSave?`
- **Não escreve drafts** — quem conhece o shape dos dados é o canvas filho. Shell só expõe o key padronizado como referência.

### Form builder (`/forms/templates/new`)
- `BuilderClient` envolvido em `<BuilderShell>`.
- Header próprio (Link "Voltar para Templates" + h1 "Criar/Editar Template") removido — substituído pelo header do shell.
- Sticky save footer mantido como segunda affordance (contador de perguntas + verbosidade "Salvar Alterações" / "Salvar Template" / "Salvar como Meu Template").
- Wizard 3-step (`choose` / `ai_setup` / `editor`) preservado — `hideSave={step !== 'editor'}` no shell.
- IA preservada (Anthropic Claude para draft + audit).

### Assessment builder (`/avaliacoes/templates/new` — rota nova)
- Wrapper novo: `<BuilderShell>` envolvendo `<AssessmentBuilderCanvas renderTopbar={false}>`.
- `AssessmentBuilderCanvas` ganhou props `renderTopbar?: boolean` (default `true` para retro-compat) e `onStateChange?` callback que propaga `{ title, isDirty, canSave, save }` para o shell pai.
- Quando `renderTopbar=false`, canvas renderiza par mínimo de inputs título/descrição no topo (sem botão Salvar duplicado).
- Drag-drop de testes + 3 colunas (biblioteca/canvas/props) preservados.
- Drafts em localStorage **inalterados**: key `assessment-builder-draft:{templateId|new}` continua sendo lida e gravada pelo canvas. Nada se perde.

### Listings split
- `/forms/templates`: query ganhou `.neq('category', 'assessment')`. Header "Templates", CTA "Criar Template", `editBase = /forms/templates/new`.
- `/avaliacoes/templates`: nova rota. Reusa `<TemplatesClient>` via prop `mode: 'forms' | 'assessments'` (default `'forms'`). Header "Templates de avaliação", CTA "Criar Template de avaliação", `editBase = /avaliacoes/templates/new`. Filtro server-side `.eq('category', 'assessment')`.

### Código morto removido
- `web/src/app/forms/templates/new/assessment-builder-page-client.tsx` deletado (substituído pelo equivalente em `/avaliacoes/templates/new/`).

---

## Cascade D3 — Componentes de modal compartilhados (B3)

### `<ModalShell>` — `web/src/components/shared/modal-shell.tsx`
- Overlay (framer animation: fade + spring scale) + header (title/description/X) + footer slot
- Esc fecha + click outside fecha
- Tamanhos `sm`/`md`/`lg` (max-width)
- Z-index via `Z.MODAL` constant

### `<StudentPicker>` — `web/src/components/shared/student-picker.tsx`
- Mode `single`: select dropdown. Quando `lockedStudentId` provido → `disabled`.
- Mode `multi`: lista checkbox + busca integrada (renderiza quando >4 alunos) + "Selecionar todos" / "Desmarcar todos" filtrado. `lockedStudentId` desabilita unselect daquele aluno.
- Empty state quando lista vazia ou filtro sem match.
- Avatar render preservado (Image fallback com initials).

### `<TemplatePicker>` — `web/src/components/shared/template-picker.tsx`
- Select dropdown filtrado por `category: 'form' | 'assessment'`. Placeholder dinâmico.
- Helper `cleanTemplateName` portado.
- Mostra `(v{N})` quando prop `version` provida.

### `AssignFormModal` refatorado
- Embrulhado em `<ModalShell title="Enviar Formulário" size="lg">`.
- Template select substituído por `<TemplatePicker category="form">`.
- Lista de alunos substituída por `<StudentPicker mode="multi">`.
- Lógica preservada: deadline chips, recurring toggle + frequência (daily/weekly/biweekly/monthly), mensagem pessoal, success message com timeout 2s, milestone `first_form_sent`.
- Botão "Enviar para N alunos" como `footer` do shell.

### `CreateSessionModal` refatorado
- Embrulhado em `<ModalShell title="Nova avaliação" description="Avaliação presencial">`.
- Aluno via `<StudentPicker mode="single" lockedStudentId={presetStudentId}>` — preserva M7 QW2 (modal abre com aluno preenchido e disabled).
- Template via `<TemplatePicker category="assessment">`.
- Form usa `id="create-session-form"` + botão Submit no footer com `form` attribute (footer fica fora do `<form>` por design do shell).
- Side-effects preservados: sex/age/scheduled_at/notes, validação 5–120 anos, toast success/error, redirect pra detalhe da sessão.

---

## Tours reescritos + migration (B4)

### Estado anterior
- `forms` (3 steps) — selectors `forms-templates-card`, `forms-inbox-card` (quebrado, não existia no DOM), `forms-pending`. Tour parcialmente disfuncional pré-M8.
- `assessments_first_time` (4 steps) — selectors `assessments-tab` (steps 1 e 4) e `assessments-new-template`/`assessments-new-session`. O `assessments-tab` apontava pra tab interna que **deixou de existir** após B1 (split em rotas).

### Estado novo (`tour-definitions.ts`)
- `tour_forms_first_time` (3 steps): selectors funcionais
  - `forms-send-cta` (botão "Enviar para aluno" no header de `/forms`)
  - `forms-templates-card` (botão "Novo Template" — selector legado preservado)
  - `forms-pending` (seção "Aguardando Feedback")
- `tour_assessments_first_time` (3 steps): selectors em `/avaliacoes`
  - `avaliacoes-header` (header da página inteira)
  - `assessments-new-template` (botão "Novo template de avaliação")
  - `assessments-new-session` (botão "Nova avaliação")
- Tours antigos `forms` e `assessments_first_time` mantidos como `[]` em `TOUR_STEPS` para retro-compat de checkers que ainda escrevam esses ids em `tours_completed`.

### Sem competição cross-page
Cada tour só monta na rota correspondente (split físico via componentes diferentes). Não há mais possibilidade de dois tours brigarem por foco na mesma viewport.

### Migration de tours antigos completados
SQL one-shot rodado contra a coluna `trainer.onboarding_state.tours_completed`:
- Trainers que tinham `'forms'` agora também têm `'tour_forms_first_time'`
- Trainers que tinham `'assessments_first_time'` agora também têm `'tour_assessments_first_time'`
- Idempotente (não duplica entradas)
- Não reseta nem remove tours antigos (preservação histórica)

**Resultado da migration (4 trainers afetados):**
- `gustavoprado11@hotmail.com`: ambos tours novos adicionados (tinha ambos antigos)
- `damianilucas23@gmail.com`, `faeloliveira514@gmail.com`, `agente.auditor.kinevo@gmail.com`: `tour_forms_first_time` adicionado (tinham apenas o antigo `'forms'`)

---

## Acceptance criteria — checklist final

- ✅ Sidebar tem 2 items: Formulários (azul) + Avaliações (violet), ícones e cores corretos
- ✅ `/forms` mostra só forms; `/avaliacoes` mostra só assessments
- ✅ `/forms?tab=assessments` retorna 308 → `/avaliacoes`
- ✅ `/forms/templates/new?category=assessment` retorna 308 → `/avaliacoes/templates/new`
- ✅ Builders rodando dentro de `<BuilderShell>`, header e save/exit unificados, modal "Sair sem salvar?"
- ✅ Modais usam `<ModalShell>` + `<StudentPicker>` + `<TemplatePicker>`
- ✅ Tour `tour_forms_first_time` dispara em `/forms`; tour `tour_assessments_first_time` em `/avaliacoes`. Não competem (rotas separadas).
- ✅ HealthMetricsCard aponta pra `/avaliacoes` (M7 QW2 preservado)
- ✅ Banner in-app de migração aparece + "Entendi" persiste
- ✅ TypeScript zero novos erros (11 pré-existentes em `__tests__` herdados de M7)
- ✅ Drafts em localStorage do AssessmentBuilder preservados (key inalterada)
- ✅ Trainers existentes que completaram tour antigo herdam o novo (sem reset)

---

## Cenários de smoke test (seção 7 da spec)

| # | Cenário | Estado |
|---|---|---|
| 1 | Trainer existente abre prod → banner "Renomeamos…" aparece → Entendi → não reaparece após F5 | ✅ B1 |
| 2 | Bookmark antigo `/forms?tab=assessments` redireciona pra `/avaliacoes` | ✅ B1 |
| 3 | Sidebar mostra 2 items (Formulários + Avaliações) com ícones e cores corretos | ✅ B1 |
| 4 | `/students/[Marina]` → seção AVALIAÇÃO PRESENCIAL → `+` → modal abre preenchido em /avaliacoes (não /forms) | ✅ B1 |
| 5 | Builder forms `/forms/templates/new` cria template — wizard 3-step + IA + sticky footer save | ✅ B2 |
| 6 | Builder assessment `/avaliacoes/templates/new` cria template — drag-drop + header consistente do shell | ✅ B2 |
| 7 | Tour `tour_forms_first_time` dispara em `/forms` na primeira visita; auto-skip steps com selector ausente | ✅ B4 |
| 8 | Tour `tour_assessments_first_time` dispara em `/avaliacoes` na primeira visita | ✅ B4 |
| 9 | Modal flows preservam M7 QW2 (preset student) e M7 QW1 (categoria correta no listing) | ✅ B3 |
| 10 | Mobile não regrediu (backend e API não mudam — sem necessidade de OTA) | ✅ pré-M8 |

---

## Performance

- Bundle size: não medido formalmente neste milestone (disco apertado bloqueou `next build` local). Vercel preview compilou com sucesso em B1; preview B4 confirmará.
- Routes adicionadas: `/avaliacoes`, `/avaliacoes/templates`, `/avaliacoes/templates/new` — chunks novos pequenos (componentes shared reaproveitados).
- Componentes shared (`ModalShell`, `StudentPicker`, `TemplatePicker`, `BuilderShell`) reduzem duplicação cross-route.

## TypeScript

- `npx tsc --noEmit` em `web/`: **0 novos erros** introduzidos por M8.
- 11 erros pré-existentes em `web/src/components/students/__tests__/program-calendar.test.tsx` e `student-insights-card.test.tsx` (herdados de M7 — fora do escopo de M8).

---

## Não-regressão

- M5 (PDF Edge Function): não tocado.
- M6 (templates seedados): 5 templates Kinevo continuam visíveis e editáveis em `/avaliacoes/templates`.
- M7 QW1 (categoria correta no listing): preservado — mode 'assessments' do `<TemplatesClient>` mantém badge "Avaliação Presencial" violet + metadata "N seções · M sessões".
- M7 QW2 (preset student no modal): preservado — `presetStudentId` mapeia para `lockedStudentId` no novo `<StudentPicker mode="single">`.
- M7 QW3 (contador contextual no header): obsoleto após split (cada rota tem seu próprio contador).
- M7 QW4 (empty state limpo): preservado em `/avaliacoes` (3 casos: 0 templates / 0 sessões / filtro vazio).

---

## Decisões registradas (consolidadas)

- **Sem mudança de schema DB.** `form_templates.category='assessment'` continua como discriminador.
- **HTTP 308 em vez de 301** (Next 16 padrão moderno; equivalente funcional para o use case).
- **Cores de sidebar via `style` inline** para preservar Shield Strategy (sem migrar hex hardcoded existente).
- **`tips_dismissed` em vez de novo campo** para `fase2_migration_seen` (zero migration de schema).
- **Sync síncrono no banner** (não debounced) para proteger F5 imediato pós "Entendi".
- **`<BuilderShell>` não escreve drafts** — canvas filho conhece o shape e mantém a key existente.
- **Tours antigos preservados como `[]`** em `TOUR_STEPS` para retro-compat de stale references.
- **Migration de tours** sem reset agressivo — quem completou antigo herda novo.
- **Mobile fora de escopo** (backend/API não mudaram; M10 cuidará da paridade UI).

---

## Follow-ups (não bloqueiam ship — vão para backlog)

1. **Mobile** — `mobile/app/(trainer-tabs)/forms.tsx` ainda tem 3 tabs internas (responses/templates/assessments). M10 (Cross-platform Parity) trata.
2. **Bundle size formal** — rodar `next build` em ambiente com disco e capturar baseline pós-M8 vs pré-M8 (Vercel Speed Insights cobrirá organicamente).
3. **CSS de identidade por rota** (seção 3.5 da spec) — não implementado. Cores aplicadas pontualmente via `style` inline; se a demanda crescer, vale considerar `data-section` no body para themes Tailwind variants.
4. **`<BuilderShell>` auto-save** — drafts continuam responsabilidade dos canvases. Se quiser unificar futuramente, é tarefa pequena.
5. **Remoção definitiva** dos arrays `forms: []` e `assessments_first_time: []` em `tour-definitions.ts` — após ~30 dias quando nenhum cliente em produção referenciar mais.
6. **CV1/CV2 do audit** (paleta unificada entre forms e avaliações) — intencionalmente fora de M8. Foi decidido em D1 que cada uma tem sua identidade visual (azul vs violet).
7. **INT2 (timeline cronológica do aluno)** — D4 backlog ratificado. Voto carinhoso registrado.

---

## Próximos passos

**M8 COMPLETO. Próximo: M9 (Onboarding Flow Guiado).**

Conforme `FASE-2-DECISIONS.md`:

| Milestone | Escopo | Dura |
|---|---|---|
| **M9** — Onboarding Flow Guiado | "Onboardar aluno novo" em 3 cliques (criar aluno → enviar anamnese → agendar avaliação) | 1-2 semanas |
| **M10** — Cross-platform Parity | Builder mobile simplificado, modo "preencher agora" no web, "Criar com IA" mobile | 2-3 semanas |

M9 fica significativamente mais simples agora que a IA do produto separa Formulários de Avaliações com clareza.
