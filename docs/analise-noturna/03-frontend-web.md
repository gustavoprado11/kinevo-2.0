# Análise Noturna — 03. Frontend Web (Next.js App Router)

Data: 09/06/2026 · Escopo: `web/src` (350 arquivos .tsx fora testes, ~80k linhas em componentes) · Análise somente leitura.
Contexto considerado: COMPARATIVO (não repito o que já está corrigido), ROADMAP (convergência de design Fase 2, performance audit LCP 6.08s baseline e dashboard-aluno já planejados — aqui só agrego causa).

---

## 0. Verificações automatizadas — números reais

### Typecheck: FALHA — 11 erros (todos em TESTES)
- `src/components/students/__tests__/program-calendar.test.tsx` — 10× TS2322.
  **Causa diagnosticada**: `ScheduledWorkoutRef` foi movido para `@kinevo/shared/utils/schedule-projection` com shape snake_case (`id`, `name`, `scheduled_days`); os testes ainda montam o shape camelCase antigo (`workoutId`, `workoutName`, `scheduledDays`). O componente (`program-calendar.tsx:22-37`) está correto — **teste desatualizado**.
- `src/components/students/__tests__/student-insights-card.test.tsx:17` — 1× TS2352, cast de mock do módulo `actions/insights` que não sobrepõe mais o tipo real (assinatura das actions mudou). Teste desatualizado.

### Lint: FALHA — 755 problemas (599 errors, 156 warnings)
Por regra:
| Regra | Qtde |
|---|---|
| `@typescript-eslint/no-explicit-any` | 496 |
| `@typescript-eslint/no-unused-vars` | 133 |
| `@typescript-eslint/ban-ts-comment` | 46 |
| `react-hooks/set-state-in-effect` | 27 |
| `react-hooks/purity` | 15 |
| `@next/next/no-img-element` | 15 |
| `prefer-const` | 5 |
| `react-hooks/rules-of-hooks` | **3 (bugs reais — ver F-01)** |
| `react-hooks/static-components` | 3 |
| `react-hooks/exhaustive-deps` | 3 |
| `react-hooks/preserve-manual-memoization` | 2 |
| `jsx-a11y/alt-text` | 1 |

Hotspots (problemas/arquivo): `actions/prescription/generate-program.ts` (34), `lib/prescription/context-enricher.ts` (22), `components/forms/checkin-responses-viewer.tsx` (21), `app/students/[id]/actions/get-session-details.ts` (19), `components/programs/edit-assigned-program-client.tsx` (18), `components/forms/submission-detail-sheet.tsx` (17), `app/students/[id]/page.tsx` (16), `app/api/programs/assign/route.ts` (15). O módulo de **prescrição IA** concentra a dívida de tipagem.

### Testes: 978 passed / 4 FAILED / 1 skipped (983)
Os 4 falhos em `src/components/programs/__tests__/SetSchemeTable.test.tsx`. **Diagnóstico: testes desatualizados, componente NÃO quebrou.** O `SetSchemeTable.tsx` foi redesenhado depois dos testes:
1. A "pill de resumo de estrutura" ("3 rodadas × 3 fases · 9 fases totais") foi removida da UI; a informação virou tooltip `title` num ícone Info (`SetSchemeTable.tsx:192-215`, aria-label "Como funciona a estrutura de rodadas").
2. O banner de rodadas ("repetida 3 vezes… 1 série efetiva") também vive só no `title` do tooltip (linha 193) — `getByText` não encontra.
3. O toggle único "Prescrever RIR e Cadência" virou **dois ToggleChips independentes** "RIR" e "Cadência" (`SetSchemeTable.tsx:229-230`); o teste clica num botão que não existe mais.
4. A chave de localStorage mudou de `kinevo_setscheme_advanced_fields` para `kinevo_setscheme_show_rir`/`show_tempo` (`SetSchemeTable.tsx:44-48`) — o reset do teste limpa a chave errada.
Correção sugerida: reescrever os 4 testes para a UI atual (tooltips via `title`, dois chips, novas chaves) e atualizar as fixtures do `program-calendar.test.tsx` para o shape snake_case.

---

## 1. Achados

### F-01 · ALTO · Hooks condicionais — crash em runtime possível (rules-of-hooks)
- `web/src/app/financial/wallet/wallet-client.tsx:927` — `useState(payoutResult)` declarado **depois** de um early return (`if` sem chave PIX → `return <ModalShell…>`). Se a lista de chaves mudar enquanto o modal está montado (0→1 chaves), React lança "Rendered more hooks than during the previous render" e derruba a árvore.
- `web/src/components/prescription/form-submissions-card.tsx:68,71` — dois `useState` após `if (submissions.length === 0) return null`. Submissions chegam por realtime/refetch no fluxo de prescrição; lista indo de vazia→cheia com o componente montado = crash.
**Impacto**: tela branca no fluxo de saque PIX e na prescrição IA. **Correção**: mover os `useState` para antes dos early returns (mudança de 2 linhas em cada arquivo).

### F-02 · ALTO · Zero `error.tsx` em todo o app
`find web/src/app -name 'error.tsx'` → **0 resultados** (nem `global-error.tsx`). Qualquer exceção não capturada em qualquer rota (incluindo as 268 ilhas client e os fetches server-side de `financial/page.tsx`, `settings/page.tsx` etc.) cai na página de erro genérica do Next, sem branding, sem retry, sem telemetria. Combinado com F-01, um crash de hooks derruba a página inteira.
**Correção**: `error.tsx` por grupo de rotas (mínimo: um no layout autenticado + um em `(public)`) com botão "Tentar novamente" (`reset()`) e log.

### F-03 · ALTO · `loading.tsx` em só 6 de ~15 rotas principais — navegação sem feedback
Existem: `dashboard`, `students`, `students/[id]`, `programs`, `program/new`, `program/[programId]/edit`.
**Faltam**: `financial` (page.tsx com 270 linhas de fetch server-side!), `financial/wallet|subscriptions|plans|pix-keys|settings`, `schedule`, `exercises`, `forms` (+inbox/templates), `marketing` (+leads/landing, `force-dynamic` = sempre lento), `settings` (243 linhas de fetch), `training-room`, `avaliacoes`, `messages`. Como as pages são Server Components que bloqueiam no fetch, clicar nesses itens da sidebar congela a UI até o servidor responder — percepção direta de lentidão (conecta com o audit LCP 6.08s já planejado; aqui é TTFB/navegação, causa distinta e barata de resolver).
**Correção**: `loading.tsx` skeleton por rota (o design system já tem `ui/skeleton.tsx`).

### F-04 · ALTO · Duplicação estrutural: builder × editor de programa atribuído (~5.000 linhas)
- `components/programs/program-builder-client.tsx` — **2.844 linhas** (suspeita confirmada)
- `components/programs/edit-assigned-program-client.tsx` — **2.133 linhas**
O editor declara explicitamente "paridade com ProgramBuilderClient" (comentário na linha ~38) e reimplementa o mesmo domínio (itens, supersets, set_scheme/rounds, drag-and-drop, compare). Toda feature nova precisa ser portada 2× — os TODOs idênticos em `program-builder-client.tsx:936` e `:1022` ("client model has single rest_seconds") mostram o drift começando. É a maior fonte de risco de regressão do web.
**Correção sugerida**: extrair o estado/reducers do programa para hook compartilhado (já existe `helpers/use-builder-draft.ts` como semente) e fazer os dois clients serem cascas finas (modo `create` vs `edit-assigned`).

### F-05 · ALTO · Tratamento de erro de mutation via `window.alert`/`confirm` nativos
**45 `alert()`** e **~16 `confirm()`** em fluxos de produção: `financial/subscriptions/subscriptions-client.tsx` (7), `students/[id]/student-detail-client.tsx` (6), `forms/templates/new/builder-client.tsx` (6), `wallet-client.tsx` (4), `health-metrics-card.tsx` (4), `training-room-client.tsx` (2)… Existe `ToastProvider` global (`ui/toast.tsx`), mas só **9 arquivos** o usam. Falha de rede em cobrança/assinatura mostra popup nativo do browser, sem retry, bloqueando a thread.
**Correção**: padronizar `useToast` para erros + modal de confirmação custom (já existem 29 modais no projeto) para ações destrutivas.

### F-06 · ALTO · Hero da landing pública do trainer com `<img>` cru — candidata direta ao LCP 6.08s
`app/(public)/com/[slug]/page.tsx` tem 6 `<img>` (linhas 163, 241, 318, 476, 632, 643). A da **linha 241** (`<img src={heroImage} alt={trainer.name} />`) é o elemento hero acima da dobra — sem `next/image`, sem `priority`/preload, sem dimensionamento responsivo, carregando original do Supabase Storage. Esta é a página pública de aquisição (ISR `revalidate=60` já está OK).
**Correção**: `next/image` com `priority` e `sizes` no hero; lazy nos depoimentos (linha 476). Agregar ao performance audit planejado como causa provável nº 1.

### F-07 · MÉDIO · 175 `as any` no código de produção (fora testes)
Hotspots: `actions/prescription/generate-program.ts` (14), `app/students/[id]/page.tsx` (13), `lib/prescription/context-enricher.ts` (10), `edit-assigned-program-client.tsx` (9), `api/programs/assign/route.ts` (9), `approve-program.ts` (7). Somado aos 46 `@ts-expect-error/ban-ts-comment` (12 só em generate-program.ts). Padrão conhecido do repo (gotcha do gen:types truncado — ver memória), mas o módulo de prescrição escreve programas no banco através desses casts: erro de shape só aparece em runtime, no dado do aluno.
**Correção**: regenerar `database.ts` e tipar os payloads de prescrição com os tipos de `@kinevo/shared/types/prescription` (já existem).

### F-08 · MÉDIO · 27× `set-state-in-effect` + 15× `purity` — re-renders e estado derivado em effect
Espalhado em ~24 arquivos (1 cada): `training-room/exercise-swap-modal.tsx:34,46`, `student-picker-modal.tsx:51`, `students/session-detail-sheet.tsx:239`, `volume-preview-card.tsx:358`, `onboarding-checklist.tsx:176`, `theme-selector.tsx:25`, `inline-exercise-search.tsx:43`, hooks `use-muscle-groups.ts:31` e `use-spotlight-position.ts:87`… Padrão típico: sincronizar prop→state via `useEffect` em vez de derivar com `useMemo`/key. `react-hooks/purity` concentrado em `student-status-bar.tsx` (3×, `new Date()` em render), `avaliacoes-client.tsx` (4×). 177 `useEffect` totais no app para 97 componentes — proporção alta.
**Correção**: derivar estado no render; `Date.now()` para fora do render ou em `useMemo` com tick.

### F-09 · MÉDIO · Acessibilidade — teclado e modais
- **26 `<div onClick=…>` sem nenhum `role`/`tabIndex`** (0 dos 26 têm role) em 18+ arquivos: cards clicáveis de `programs-client.tsx`, `dashboard-client.tsx`, `student-detail-client.tsx`, backdrop+card em `plans-client.tsx:319`, `leads-client.tsx:367`, `financial-onboarding-modal.tsx:154`… Inacessível por teclado.
- **29 modais custom sem focus trap**: nenhuma lib/hook de focus-trap no projeto; só **10 arquivos** com `role="dialog"` e **6** com `aria-modal`; `Escape` tratado em 20. Não há Radix/shadcn Dialog — tudo manual. Foco vaza para trás do overlay (leitor de tela lê a página inteira).
- 798 `<button>` para 160 `aria-label` — botões icon-only (lucide) sem nome acessível são comuns (ex.: toolbar do builder).
- 1 `jsx-a11y/alt-text` pendente no lint; labels: 213 `<input>` × 172 `<label>/htmlFor` (gap moderado, maioria dos forms grandes usa label).
**Correção**: componente `Modal` base único com focus trap + role/aria; trocar divs clicáveis por `<button>`; varredura de aria-label em icon buttons.

### F-10 · MÉDIO · 133 `console.log` em código de produção
`actions/prescription/generate-program.ts` (25), `api/webhooks/stripe-connect/route.ts` (18), `lib/prescription/program-builder.ts` (16), `ai-optimizer.ts` (8), webhooks stripe (7)… Server-side vai para os logs da Vercel — em prescrição isso pode logar contexto do aluno (dado sensível, atenção LGPD); nos webhooks é aceitável como observabilidade, mas sem níveis.
**Correção**: logger mínimo com níveis + redação de PII; remover logs de debug do fluxo de prescrição.

### F-11 · MÉDIO · 23 componentes com `'use client'` sem hooks/handlers — poderiam ser Server Components
Inclui 7 seções da landing SaaS (`landing-problem`, `landing-social-proof`, `landing-stripe`, `landing-how-it-works`, `landing-cta-footer`, `landing-testimonials`, `landing-student-app`), 5 de assessments (`assessment-status-badge`, `ComputedDisplayWeb`, `result-comparison-table`, `result-stats-card-web`, `session-checklist-card`), widgets de dashboard (`expiring-programs`, `weekly-goals-widget`, `student-ranking-widget`), `schedule/time-grid.tsx`, `programs/volume-summary.tsx`, previews do builder. Viram bundle JS desnecessário — na landing isso pesa no LCP.
**Nota**: alguns importam framer-motion via pai client, então o ganho real exige mover a fronteira client para os nós interativos.

### F-12 · MÉDIO · Bundle: framer-motion em 49 arquivos; dynamic import raro fora do builder
`framer-motion` aparece em 49 .tsx, incluindo TODAS as seções da landing (hero, pillars, apple-watch, testimonials…) — a página de marketing carrega a lib inteira no first load. `next/dynamic` é usado em só 6 arquivos (builder/edit/preview/app-layout — bem aplicado lá). Sem recharts (gráficos são SVG custom — bom). dnd-kit fica restrito ao builder (ok).
**Correção**: na landing, trocar animações de entrada por CSS (`@media (prefers-reduced-motion)` de brinde) ou `LazyMotion`/`m.` do framer (reduz ~80% do peso da lib).

### F-13 · MÉDIO · CI vermelho permanente mascara regressões novas
Typecheck (11 erros), lint (599 errors) e testes (4 falhos) falham hoje por dívida conhecida — qualquer regressão NOVA entra sem ruído adicional. Os 4 testes do SetSchemeTable falham desde o redesign e ninguém notou porque a suíte "já falha mesmo".
**Correção**: consertar os 15 erros de teste/typecheck (são mecânicos — fixtures), e travar lint nas regras de bug (`rules-of-hooks`, `set-state-in-effect`) via CI, deixando `no-explicit-any` como warning até a limpeza.

### F-14 · BAIXO · Componentes gigantes — inventário completo
**84 arquivos .tsx > 300 linhas** (fora testes). Os >1000:
| Linhas | Arquivo |
|---|---|
| 2.844 | components/programs/program-builder-client.tsx |
| 2.133 | components/programs/edit-assigned-program-client.tsx |
| 1.513 | app/financial/wallet/wallet-client.tsx |
| 1.064 | app/marketing/landing/landing-editor.tsx |
| 1.018 | app/forms/templates/new/builder-client.tsx |
900–1000: financial-client (986), subscriptions-client (978), student-detail-client (974), prescription-profile-form (944). 600–900: active-program-dashboard (810), exercise-form-modal (794), student-financial-modal (772), landing-hero (761), configure-billing-modal (741), create-appointment-modal (721), forms-dashboard-client (690), new-student-wizard (687), com/[slug]/page (651), leads-client (647), landing-pillars (641), training-room-client (634), assessment-builder-canvas (633), health-metrics-card (618), program-calendar (612). (lista completa via `wc -l`, 84 itens)
**Padrão**: page.tsx server fino → `*-client.tsx` monolítico. O financeiro inteiro vive em 5 monolitos client.

### F-15 · BAIXO · Props drilling no builder
`components/programs/workout-panel.tsx:98-122` — `WorkoutPanelProps` com **20 props**, 15 delas callbacks (onUpdateItem, onDeleteItem, onDuplicateItem, onMoveItem, onReorderItem, 4 de superset…) drillados do monolito de 2.844 linhas para panel → cards → seções. Mesmo padrão no espelho `edit-assigned-…`. Um context/reducer do builder eliminaria 2 níveis de repasse. (O plano antigo de Zustand para training-room — `docs/architecture/plan.md` — está listado como abandonado; o store `useTrainingRoomStore` existe e funciona bem lá, é o modelo a seguir.)

### F-16 · BAIXO · Qualidade — miudezas
- TODO/FIXME reais: ~5 (schedule-client.tsx:232 modal que não aceita null; android/actions.ts:17 rate-limit sem Turnstile; program-builder ×2 rest_isolation v2; generate-program.ts:1096 stall detection não implementado). Os demais 14 hits são falso-positivo ("TODOS"/"MÉTODO" em pt-BR).
- Resíduos do Estúdios (conhecido): `actions/organizations/add-coach.ts` (4 problemas de lint), `lib/studio/get-organization.ts` (3) — código morto build-crítico já mapeado na memória do projeto.
- `app/leads/page.tsx` é redirect legado INTENCIONAL e documentado (deep links de push antigos) — não é rota morta.
- B10 "presential": 24 ocorrências seguem (já conhecido/aceito no comparativo — sem novidade).
- 3.921 hex hardcoded em .tsx (`#1D1D1F`, `#86868B`…) — não reporto como achado novo: é exatamente o escopo da convergência de design Fase 2 já planejada.
- `prefer-const` ×5, `static-components` em `students-client.tsx:265` (componente definido dentro do render — remonta a cada render), `preserve-manual-memoization` em `quick-message-card.tsx:41`.
- 133 `no-unused-vars` — maioria imports/args órfãos; limpeza mecânica.

---

## 2. Verificado e OK
- **Pages são Server Components**: 0 `'use client'` em todas as page.tsx principais (dashboard, students, programs, financial, schedule, exercises, forms, marketing, settings, training-room, avaliacoes, messages). Só auth/login/signup/update-password são client — correto, são forms.
- **Fetch paralelo**: `Promise.all` em 8 pages.
- **Empty states presentes** nas listas principais: students ("Nenhum aluno cadastrado" + variação por filtro/busca), programs ("Nenhum programa encontrado"/"Nenhum modelo salvo"), forms ("Nenhum template criado").
- **Strings de UI em inglês**: nenhuma encontrada por heurística (JSX text e placeholders comuns) — UI consistente em pt-BR.
- **Dynamic imports bem aplicados onde existem**: builder e editor code-splitam preview/compare (`workout-execution-preview`, `program-selector` com `ssr:false`).
- **`next/image` configurado** (remotePatterns p/ Supabase Storage) e usado em 29 arquivos.
- **Landing pública** com ISR (`revalidate=60`) e `not-found.tsx` próprio.
- **Sem recharts/moment/lodash** — gráficos SVG custom, datas nativas.
- **ToastProvider global existe** com política de replace documentada (o problema é adoção — F-05).
- **`/leads`** legado é redirect intencional documentado.
- Testes: 978/983 passando; mobile 292/292; a saúde geral da suíte é boa — as falhas são fixtures desatualizadas, não regressões funcionais.

## 3. Priorização sugerida (esforço × impacto)
1. F-01 (4 linhas, remove crash) → 2. F-13 fixtures de teste/typecheck (CI verde) → 3. F-02+F-03 (error.tsx + loading.tsx, ~1 dia, maior ganho de percepção) → 4. F-06 (hero next/image, alimenta o perf audit) → 5. F-05 (toast em vez de alert, mecânico) → 6. F-04 (refactor builder/edit — projeto de uma semana, planejar junto com convergência de design Fase 2 para não retrabalhar).
