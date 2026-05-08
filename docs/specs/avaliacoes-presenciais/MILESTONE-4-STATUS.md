# Milestone 4 — Web builder + view: status final

## Estado: pronto para commit

Cobertura completa do flow web (treinador no painel) para avaliações presenciais. Quatro sub-blocos (B1 actions/tipos, B2 builder, B3 view + telas + integração, B4 polish + sidebar + status). Todos os bugs encontrados em smoke tests foram corrigidos e revalidados.

- TypeScript: zero novos erros em `web/`. Baseline pré-existente de 11 erros (todos em `web/src/components/students/__tests__/program-calendar.test.tsx` e `student-insights-card.test.tsx`, herdados de antes do M4).
- Sem nova dependência adicionada — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `framer-motion`, `lucide-react` já estavam no projeto.
- Sem migration nova — schema do M1 (migration 122) cobre tudo do M4.
- Engine M2 NÃO chamada no web — finalize continua mobile-only (decisão de escopo).

## Arquivos criados/modificados

### Server actions (web/src/actions/assessments/)
- `create-session.ts` (estendido) — adiciona `subjectSex` (`'male'|'female'`) + `subjectAgeYears` (5–120) com validação inline; encadeia `save_assessment_measurements` para `subject_sex` (text) e `subject_age_years` (numeric, `is_selected:true`) após o create. Importa as constantes de `@/lib/assessments-constants` (não exporta — `'use server'` files no Next 16 só podem exportar funções async).
- `get-session.ts` (novo) — `getAssessmentSessionDetail(sessionId)`. Wrapper canônico do `get_assessment_session` RPC com retorno `{ success, data?, error? }`.
- `get-session-list.ts` (novo) — lista filtrada por `'all'|'overdue'|'upcoming'|'completed'`. Filtragem em JS sobre o RPC `get_assessment_sessions`.
- `cancel-session.ts` (novo) — soft cancel via UPDATE direto em `assessment_sessions` (RLS protege). Recusa em `completed`/já cancelada. Anexa razão opcional ao `notes`.
- `update-template.ts` (novo) — exporta `updateAssessmentTemplate` (com clone-on-edit de system templates, mesmo padrão de `update-form-template.ts`) e `createAssessmentTemplate`. Valida schema (schema_version, ≥1 seção, metric_keys únicos). Recusa template não-`assessment`.

### Lib (web/src/lib/)
- `assessments-constants.ts` (novo) — `SUBJECT_SEX_KEY` / `SUBJECT_AGE_KEY` em arquivo dedicado para evitar a restrição do Next 16 sobre exports não-async em `'use server'`.

### Componentes builder (web/src/components/assessments/builder/)
- `test-catalog.ts` (novo) — catálogo curado de 25 presets em 6 categorias (Antropometria, Pregas, Força, Condicionamento, Mobilidade, Computado/Protocolos). Cada preset é uma factory que produz um `AssessmentTest` sem id.
- `draggable-test-item.tsx` (novo) — item da library com `useDraggable`. Drag + click-to-add (acessibilidade). Texto com `line-clamp-2` para nomes longos não truncarem.
- `test-library-column.tsx` (novo) — coluna esquerda. Search + agrupamento por categoria. Empty state quando filtro não encontra.
- `section-editor.tsx` (novo) — seção do canvas: header editável (rename inline), collapse, droppable (`useDroppable`), lista de testes sortable (`useSortable`). Marca `obrigatório` e `chave duplicada` inline.
- `test-properties-panel.tsx` (novo) — coluna direita. Renderização condicional por `test.type`. Para `protocol`: nome PT, descrição, sites por sexo (com sites diferentes M/F quando aplicável), outputs computados, fonte/citação. Esconde campo `metric_key` para `protocol` (não se aplica).
- `assessment-builder-canvas.tsx` (novo) — orquestrador: DndContext + sensors + drag overlay; estado central; validação (titleValid + hasSections + hasTests + duplicateMetricKeys); save com botão explícito + dirty flag; rascunho em localStorage com restauração; layout responsivo (3 colunas em ≥1100px, sheet animada com framer-motion abaixo).

### Componentes shared (web/src/components/assessments/)
- `assessment-status-badge.tsx` (novo) — badge para `scheduled` / `in_progress` / `completed` / `cancelled` + variante `overdue` em vermelho. Tons sm/md.
- `session-list-item.tsx` (novo) — card de uma sessão na lista de `/forms?tab=assessments`. Mostra nome, template, data, status badge, e (quando completed) sumário "IMC X · Y% BG".
- `create-session-modal.tsx` (novo) — modal animado (framer-motion). Aluno + template + quando + sexo M/F (toggle) + idade (5–120) + notas. Trata o caso de "sessão criada mas measurements falharam" com toast claro: *"Sessão criada, mas dados do aluno não foram salvos. Abra a sessão e tente novamente."* — fecha o modal sem rollback (alinhado com decisão de B1: não há transação cross-RPC).

### Componentes view (web/src/components/assessments/view/)
- `session-checklist-card.tsx` (novo) — checklist read-only do template, marca capturado/pendente baseado em measurements.
- `result-stats-card-web.tsx` (novo) — grid 3-col primário (BG%/IMC/RCQ com classifications PT do shared) + 3-col secundário (Massa magra/gorda/Densidade).
- `result-comparison-table.tsx` (novo) — comparativo até 4 colunas (atual + 3 anteriores). Trend arrow verde/vermelho na coluna atual baseado em `betterDirection` por linha.
- `history-mini-chart-web.tsx` (novo) — sparkline em SVG puro (mesmo pattern de `load-progression-chart.tsx`). Tooltip por hover, gradient fill, cor por tendência.

### Páginas (web/src/app/)
- `forms/forms-dashboard-client.tsx` (estendido) — adicionado tab nav (Respostas | Avaliações Presenciais), filter chips (Todas | Em atraso | Próximas | Concluídas) com contadores, lista via `SessionListItem`, empty state amigável, botões de header dinâmicos por tab. **Conteúdo de "Respostas" 100% intacto** — apenas envolto em `{activeTab === 'responses' && (...)}`. `AssignFormModal` e `SubmissionDetailSheet` não tocados.
- `forms/page.tsx` (estendido) — fetch de `assessmentSessions` via `getAssessmentSessionList({ filter: 'all' })` + filtro de `assessmentTemplates` por `category==='assessment'`.
- `forms/templates/new/page.tsx` (estendido) — branch novo: se `?category=assessment` OU `existingTemplate.category==='assessment'` → renderiza `AssessmentBuilderPageClient`. Default (anamnese/checkin/survey) inalterado.
- `forms/templates/new/assessment-builder-page-client.tsx` (novo) — wrapper que conecta `AssessmentBuilderCanvas` com `createAssessmentTemplate` / `updateAssessmentTemplate` + toast.
- `students/[id]/avaliacoes/[sessionId]/page.tsx` (novo) — server: fetch + redirect automático para `/result` se `status==='completed'`.
- `students/[id]/avaliacoes/[sessionId]/session-detail-client.tsx` (novo) — header + cancel inline (confirmação 2-step, sem `window.confirm()`) + checklist + nota informativa "captura via app mobile".
- `students/[id]/avaliacoes/[sessionId]/result/page.tsx` (novo) — server: fetch detail + histórico via `getAssessmentSessionList({ studentId, filter: 'completed', limit: 20 })`.
- `students/[id]/avaliacoes/[sessionId]/result/result-client.tsx` (novo) — header + stats + 2 sparklines (BG% / IMC) + tabela comparativa + botão de PDF placeholder (toast "PDF disponível em breve.").
- `students/[id]/page.tsx` (estendido) — fetch de `latestPresencialSession` (`filter: 'completed'`, `limit: 1`) e propaga para o sidebar.
- `students/[id]/student-detail-client.tsx` (estendido) — props passa `latestPresencialSession` adiante para `AssessmentSidebarCard`.

### Sidebar (web/src/components/students/)
- `assessment-sidebar-card.tsx` (estendido) — nova prop opcional `latestPresencialSession`. Bloco "Avaliação Presencial" no topo do card (logo após o header, antes de Pending forms). Empty hint com CTA quando não há sessão. Quando há, mostra `IMC X · Y% BG` + classificação BMI (PT) + data; tap navega para `/students/[id]/avaliacoes/[sessionId]/result`. Não regrediu nenhuma das seções existentes (Pending, Schedules, Last submission, Body Metrics).

## Decisões de design

1. **2 tabs em vez de 3.** A spec mencionava "Respostas | Templates | Avaliações", mas `/forms/templates` já é uma rota separada com sua própria UI. Adicionar uma tab "Templates" duplicaria UX. Mantive **2 tabs** (Respostas + Avaliações Presenciais) e o botão "Novo Template" continua acessível no header.
2. **Save explícito, sem autosave server-side.** Botão "Salvar" commita; dirty flag visível ("Alterações não salvas"). Evita roundtrips desnecessários durante edição.
3. **Rascunho local em `localStorage`** com chave `assessment-builder-draft:{templateId|"new"}`. Resilência a refresh acidental. Banner "Rascunho restaurado" quando a chave for diferente do snapshot inicial. Removido em save bem-sucedido.
4. **Cancel via UPDATE direto, não RPC nova.** Não havia `cancel_assessment_session` RPC. RLS de `assessment_sessions` permite UPDATE só pelo trainer dono. Migration nova evitada — fora do escopo M4.
5. **Subject sex/age como measurements**, não colunas. Mesma convenção do mobile (`mobile/lib/assessmentComputed.ts`). Constantes em `@/lib/assessments-constants`.
6. **Sparklines em SVG puro**, mesmo pattern de `load-progression-chart.tsx`. Sem recharts — zero peso adicional.
7. **PDF placeholder.** Botão "Compartilhar laudo (PDF)" abre toast "PDF disponível em breve." — implementação real fica para fase futura.
8. **Engine M2 NÃO invocada no web.** Página de resultado lê `session.computed_metrics` direto do banco (já calculado pelo mobile no finalize).
9. **Builder de assessment reaproveita `form_templates` (category='assessment')**, não tabela nova. Save usa `supabaseAdmin` (mesmo padrão de `update-form-template.ts`) com clone-on-edit para system templates.

## Bugs corrigidos durante smoke tests do user

### Build / runtime
1. **Pasta `_dev/` não vira rota** — App Router ignora pastas com prefixo `_`. Movida para `dev/` + guard `process.env.NODE_ENV !== 'development'` com `notFound()`. *(Removida em B4.)*
2. **Tema dark forçado em `/dev`** — `theme-provider.tsx` força `dark` em rotas fora de whitelist. `/dev` adicionado a `LOGGED_AREA_PREFIXES` em B2. *(Reverted em B4 com a deleção do harness.)*
3. **Texto invisível no `DraggableTestItem`** — `bg-white` hardcoded conflitava com `text-k-text-primary` em dark mode (branco em branco). Trocado por `bg-surface-elevated` semântico (light=#FFFFFF, dark=#1C1C1E).
4. **Truncamento de labels longos na biblioteca** — "Preensã...", "Salto ve..." etc. Trocado `truncate` por `line-clamp-2 leading-snug`.
5. **`'use server'` rejeitando export de constantes** — `SUBJECT_SEX_KEY` / `SUBJECT_AGE_KEY` exportadas de `create-session.ts` quebravam o build do Next 16. Movidas para `web/src/lib/assessments-constants.ts`.
6. **Properties panel de protocolo sem detalhes** — exibia só Tipo + Rótulo + Chave + Protocolo (id). Estendido com nome PT, descrição, sites por sexo, outputs computados e citação. Campo `metric_key` escondido para `protocol` (não se aplica).

## Verificações finais

- `cd web && npx tsc --noEmit` → 11 erros, **mesmo baseline pré-existente** em testes (program-calendar, student-insights-card). **Zero novos erros**.
- `grep -rn "builder-harness" web/` → zero matches.
- `grep -rnE "alert\(|window\.confirm" web/src/components/assessments/ web/src/app/students/\[id\]/avaliacoes/` → zero matches.
- Smoke test cenários (validados pelo user):
  - Tab "Respostas" inalterada (`AssignFormModal`, `SubmissionDetailSheet` funcionando).
  - Criação de form template não-assessment continua via fluxo existente.
  - `/forms?tab=assessments` mostra filter chips, lista, empty states.
  - "Nova avaliação" cria sessão com sex/age e redireciona para detail.
  - Detail mostra checklist, permite cancelar.
  - Sessão `completed` redireciona para `/result` automaticamente.
  - `/result` mostra stats grid, sparklines, comparativo, botão PDF placeholder.
  - Builder de assessment salva e atualiza com sucesso (toast).
  - Sidebar do aluno mostra "Avaliação Presencial" no topo com última sessão concluída + tap navega para `/result`. Empty state CTA aparece quando aluno não tem sessões presenciais.

## Trabalho deixado para milestones futuros

### Conhecido e fora do escopo M4

- **PDF do laudo** — botão hoje é placeholder. Fase futura.
- **Painel de estúdio em tablet** — fora do escopo M4. Fase futura.
- **Comparativo multi-template** — `ResultComparisonTable` hoje compara mesmo aluno em sessões consecutivas. Cross-template está em backlog.
- **Cancellation reason em coluna dedicada** — hoje é appended ao `notes`. Migration futura se virar requisito de relatório.

### Insight do user para enfatizar no M6 — templates de sistema seedados

> *"Por que preciso criar template em vez de usar protocolo direto?"* — feedback do user durante smoke test do M4.

A resposta correta é que avaliação típica é **composta** (peso + altura + skinfolds + RCQ + computed), não single-test — o template é o envelope que junta tudo. Mas o que o user está pedindo, na prática, é menos atrito.

Solução real: **templates de sistema seedados** (clone-on-edit, mesmo pattern já implementado em `update-form-template.ts` e `update-template.ts`) cobrindo os 80% dos casos:
- "Avaliação Antropométrica Básica" (peso/altura/cinturas/quadril → IMC + RCQ)
- "Composição Corporal Jackson-Pollock 3 dobras"
- "Composição Corporal Jackson-Pollock 7 dobras"
- "Avaliação Petroski 4 dobras" (público brasileiro)
- "Performance — saltos / sprint / preensão"

Trainer vê esses templates já listados em `/forms/templates`. Ao "editar", clone-on-edit produz uma cópia trainer-owned automaticamente — fluxo idêntico ao que já existe para anamneses/check-ins de sistema. **Trabalho recomendado para M6** (não M5).

Anotar como ênfase prioritária quando a spec do M6 for redigida.
