# 05 — Código compartilhado (@kinevo/shared) e qualidade geral

Análise noturna somente-leitura — 09/06/2026, branch `main`, repo `~/kinevo`.
Severidades: 🔴 Alto · 🟠 Médio · 🟡 Baixo · ✅ Verificado e OK.

---

## 1. Sumário executivo

| Tema | Número-chave |
|---|---|
| Testes red há ~6 semanas | shared 1 falha + web 4 falhas, ambas nascidas no commit `519ee80` (29/04); **não existe CI** (`.github/workflows` ausente) |
| Cobertura real do shared | **70,9% stmts** (config oficial mede só `lib/assessment-protocols` e reporta 99,1% — enganoso) |
| Maior módulo do shared sem teste | `utils/schedule-projection.ts` — 533 linhas, **0% coverage**, importado por 21 arquivos (web 7 + mobile 14) |
| Densidade de testes | shared 17 testes/49 fontes (35%) · web 98/728 (13%) · mobile 32/490 (6,5%) · supabase/tests: **1 arquivo** |
| `as any` (fora de testes) | web **185** · mobile **397** · shared 0; `: any`: web 208 · mobile 332 |
| `.from('tabela' as any)` | **196 ocorrências (todas no mobile)** — sintoma direto de `database.ts` dessincronizado |
| `shared/types/database.ts` | gerado do **projeto Supabase errado** + remendos manuais (ver §5.2) |
| Duplicação de formatadores | **19 `formatCurrency` + 7 `formatBRL` locais** (já divergiram); ~157 funções `format*` ad-hoc (web 72 + mobile 85) |
| Lint web | 755 problemas; **3 `rules-of-hooks` = bugs reais de crash** (ver §7.1) |
| TODO/@ts-ignore | web: 10 TODO, 47 `@ts-ignore`, 26 eslint-disable · mobile: 5 TODO, 6 ts-ignore/expect, 15 eslint-disable |
| Migrations não commitadas | `supabase/migrations/135_*.sql` e `136_*.sql` **untracked** |

---

## 2. O que o @kinevo/shared centraliza (inventário)

9.793 linhas de fonte (sem testes), 49 arquivos:

| Área | Arquivos principais (linhas) | Usado por (nº arquivos) |
|---|---|---|
| `types/` | database.ts (4.036), prescription.ts (716), asaas.ts (408), assessments, appointments, workout-items, onboarding, exercise, healthInsights, google-calendar | web 227 imports `@kinevo/shared`; mobile 129 arquivos importam |
| `lib/prescription/` | set-scheme.ts (415), set-scheme-presets, snapshot-from-draft, builder-mapper, set-meta-label, extract-frequency, **volume.ts**, method-labels, set-type-labels | web 10+/mobile 13+ (set-scheme); volume web 4/mobile 2; method-labels web 2/mobile 2 |
| `lib/assessment-protocols/` | formulas (317), classifications (285), index (182), protocols, derived, types | web 8 / mobile 8 |
| `utils/` | **schedule-projection.ts (533)**, appointments-projection (317), format-br-date (73) | schedule-projection: web 7 / mobile 14 |
| `lib/asaas/fees.ts` (125) | taxas + simulação de líquido | web re-exporta em `web/src/lib/asaas/fees.ts` (3 linhas) ✅; mobile usa direto |
| `tokens/` | v2 (colors/elevation/shadows/typography…) e legacy | v2: mobile 17 / web 1 (web consome via `scripts/sync-tokens.mjs` no prebuild) |
| `constants/` | notification-messages (84) | web 9 / mobile 0 (server-side, ok) |
| `lib/http/parseFilename.ts` | — | web 1 / mobile 1 |

✅ Acertos: volume (`effectiveSetsForVolume`), method-labels (`getMethodChipLabel`), set-meta-label, set-scheme e assessment-protocols são consumidos pelos DOIS lados — a centralização da lógica de prescrição funcionou.

---

## 3. Duplicação real entre web e mobile

### 3.1 🔴 Formatação de moeda — 26 implementações, já divergentes

- `formatCurrency` definida localmente **11× no web** (apesar de `web/src/lib/utils/financial.ts:69` exportar a canônica) e **8× no mobile**; `formatBRL` definida **7× localmente no mobile** apesar de `mobile/lib/currency.ts:6` ser a canônica.
  - web: `app/financial/financial-client.tsx:124`, `app/financial/subscriptions/subscriptions-client.tsx:113`, `components/settings/billing-section.tsx:60` (assina em **cents** — semântica diferente!), `components/financial/{new-subscription-modal:152, contract-detail-modal:94, configure-billing-modal:35, student-financial-modal:65, connect-status-card:20}`, `components/dashboard/{assistant-action-cards:105, stat-cards:12}` + `landing-stripe.tsx formatBRL`, `wallet-status-card.tsx formatBRL`.
  - mobile: `app/financial/contract/[id].tsx:60`, `app/(trainer-tabs)/dashboard.tsx:47` (variante compacta "R$ 1,2k"), `app/profile/{subscription:40, payment-history:28}`, `components/financial/{PlanCard:14, ContractCard:29, NewSubscriptionSheet:47, TransactionRow:7}` + `formatBRL` local em `app/payment.tsx:11`, `app/financial/index.tsx:42`, `app/financial/wallet.tsx:25`, `app/financial/wallet/payout.tsx:17`, `components/financial/{AwaitingPayoutBanner:9, AttentionCard:21, PendingChargeRow:11}`.
- **Divergência de comportamento (bug latente)**: `mobile/lib/currency.ts` trata negativo e `NaN/Infinity` (`Number.isFinite`); as 7 cópias locais NÃO — `formatBRL(NaN)` nas cópias rende `"R$ NaN,undefined"`. Web usa `Intl.NumberFormat` (R$ com NBSP), mobile concatena string — o mesmo valor renderiza diferente entre plataformas.
- Correção sugerida: promover um `formatBRL/formatCurrency` para `shared/utils/` (mobile/Hermes não tem Intl completo — usar a versão string-built do `mobile/lib/currency.ts` como canônica) e varrer as 26 cópias.

### 3.2 🟠 "Semana começa na segunda" — 4 implementações, 1 com risco de fuso

Mesma fórmula `(getDay()+6)%7`, mas reimplementada:
- `mobile/lib/history.ts:75` (`startOfWeek`, local-time) ✅ canônica de fato
- `mobile/app/(tabs)/home.tsx:302` — cópia inline da de cima
- `web/src/lib/mcp/tools/dashboard.ts:19-21` — inline
- `web/src/app/api/cron/generate-insights/route.ts:390` — faz a aritmética em horário local do servidor e retorna `toISOString().slice(0,10)` (**UTC**): sessão concluída seg 21h BRT (= ter 00h UTC `completed_at`) pode cair na semana errada vs o que o aluno vê no app. Bug latente de borda de semana nos insights.
- Correção: `getWeekStartMonday()` em `shared/utils/` com contrato de timezone explícito.

### 3.3 🟠 1RM estimado — duas fórmulas diferentes no mesmo produto

- `web/src/lib/reports/program-report-service.ts:508-512`: melhor de **Epley e Brzycki** (com clamp em 37 reps).
- `web/src/lib/mcp/tools/progress.ts:125-128`: **Epley puro**.
- O mesmo treinador vê 1RMs diferentes no relatório PDF vs no chat MCP/Claude para os mesmos set_logs (Brzycki > Epley para reps baixas). Não é cópia idêntica que divergiu — são duas fontes de verdade. Correção: `estimate1Rm()` em `shared/lib/`.

### 3.4 🟠 Labels/cores de status de contrato — ≥6 mapas paralelos

`overdue → "Inadimplente"` etc. mapeado em: `web/src/lib/utils/financial.ts:58` (canônica web), `app/financial/financial-client.tsx:102`, `app/financial/subscriptions/subscriptions-client.tsx:99`, `components/financial/student-financial-modal.tsx:46`; mobile: `components/financial/ContractCard.tsx:15`, `app/financial/contract/[id].tsx:46`, `components/financial/ContractTimeline.tsx:27`, `mobile/app/(tabs)/inbox.tsx:83`. Labels hoje consistentes; cores já divergem (web tokens tailwind, mobile hex hardcoded — colide com a convergência de design). `billing_type` labels também duplicados (ContractCard vs contract/[id]).

### 3.5 🟡 Bi-set/Tri-set — divergência real

- `web/src/components/students/session-detail-sheet.tsx:192` e `mobile/components/trainer/SessionDetailSheet.tsx:275`: `childCount<=2 ? 'Bi-set' : ==3 ? 'Tri-set' : 'Super-set (n)'` — idênticos (414 vs 444 linhas: o sheet inteiro é um port paralelo, ~400 linhas de lógica duplicada).
- `mobile/app/(tabs)/logs.tsx:684`: `<=2 ? 'Bi-set' : 'Tri-set'` — **um superset de 4 exercícios aparece como "Tri-set" pro aluno** e como "Super-set (4)" pro treinador.

### 3.6 🟡 SET_TYPE_LABELS — cópia local no web

`web/src/components/programs/SetSchemeTable.tsx:30-40` redeclara `SET_TYPE_LABELS` byte-a-byte igual ao `shared/lib/prescription/set-type-labels.ts` — e o web importa `set-type-labels` **0 vezes** (mobile 2×). O shared se anuncia como "single source of truth across web/mobile", mas o web não o consome. É exatamente o padrão que gerou o drift do §4. `methodLabel` local em `mobile/components/trainer/program-builder/SetSchemeEditor.tsx:84` reimplementa semântica própria ("Sem preset") por cima dos presets — aceitável, mas frágil.

### 3.7 Quantificação consolidada

| Lógica | Implementações | Estado |
|---|---|---|
| Moeda (formatCurrency/formatBRL) | 26 (11 web + 15 mobile) | **divergiu** (NaN/negativo, cents, Intl vs string) |
| `format*` ad-hoc (data/peso/duração/tonelagem…) | ~157 defs (web 72, mobile 85) | majoritariamente cópias de 3-8 linhas |
| Início de semana (segunda) | 4 | fórmula igual; cron web com risco UTC |
| 1RM estimado | 2 fórmulas | **divergente por construção** |
| Status de contrato (label+cor) | ≥6 mapas | labels ok, cores divergem |
| Bi/Tri/Super-set | 3 | **logs.tsx divergiu** |
| SET_TYPE_LABELS | shared + 1 cópia web | idêntico hoje, drift à espera |
| SessionDetailSheet (treinador) | 2 ports (~858 linhas) | paralelos |

---

## 4. 🔴 Diagnóstico da falha do teste do shared (e das 4 do web)

- `cc28622` (27/04) criou `SET_TYPE_BADGE_LABELS` com siglas caixa-alta (`DROP`, `FAIL`, `W`) + teste.
- **`519ee80` (29/04, "refactor set scheme & workout cards, v1.2.7")** mudou os badges para sentence-case pt-BR (`Drop`, `Falha`, `Aquecimento`) — decisão de UX legítima e documentada no comentário — **mas não atualizou** `shared/lib/prescription/__tests__/set-type-labels.test.ts:22-24`, que ainda espera `'DROP'/'AMRAP'/'CLUSTER'`.
- As 4 falhas do web (`SetSchemeTable.test.tsx` — pill "3 rodadas × 3 fases", coluna RIR/Cadência) vêm da mesma família: componente refatorado em `519ee80` e depois `861ec6d` (22/05, cores), testes não acompanharam.
- Conclusão: **o código está certo, os testes estão obsoletos** — red há ~6 semanas porque **não há CI nem hook de pre-commit** (`.github/workflows` e `.husky` inexistentes). Qualquer regressão real hoje se esconderia atrás dessas falhas "conhecidas".
- Correção: atualizar os 5 asserts + adicionar CI mínimo (typecheck + vitest dos 3 workspaces em push).

---

## 5. Tipos do banco e a epidemia de `any`

### 5.1 Contagens

| Workspace | `as any` (fonte) | `as any` (total) | `: any` | lint `no-explicit-any` |
|---|---|---|---|---|
| web | 185 | 212 | 208 | 496 errors |
| mobile | 397 | 398 | 332 | — (sem script de lint!) |
| shared | 0 | 0 | 0 | — |

Top arquivos (fora de testes):

| Mobile | n | Web | n |
|---|---|---|---|
| hooks/useProgramBuilder.ts | 32 | actions/prescription/generate-program.ts | 14 |
| hooks/useWorkoutSession.ts | 31 | app/students/[id]/page.tsx | 13 |
| lib/finishWorkoutFromWatch.ts | 12 | lib/prescription/context-enricher.ts | 10 |
| hooks/useHealthDashboard.ts | 10 | components/programs/edit-assigned-program-client.tsx | 9 |
| hooks/useTrainerWorkoutSession.ts | 9 | app/api/programs/assign/route.ts | 9 |
| hooks/useTrainerPlans.ts | 9 | actions/prescription/approve-program.ts | 7 |

`@ts-ignore`: web 47 (concentrado em `actions/prescription/*` — generate-program 12, get-prescription-data 5, approve-program 4 — e `actions/organizations/add-coach.ts` 4); mobile 1 + 5 `@ts-expect-error`.

### 5.2 🔴 Causa-raiz: `shared/types/database.ts` foi gerado do projeto Supabase ERRADO + remendado à mão

Evidências:
- O arquivo **contém** tabelas que **não existem em nenhuma migration do repo**: `ambassadors`, `ambassador_events`, `ambassador_payouts`, `commissions`, `referrals`, `feedback`, `android_tester_queue`, `wearable_connections` (grep em `supabase/migrations/`: zero hits de `CREATE TABLE`).
- E **não contém** tabelas/colunas que existem e estão em produção: `perfect_weeks` (migration 156), `students.access_blocked_at` (140 — o gate de inadimplência!), `trainer_payment_accounts`, `pix_keys`, `payouts`, `trainer_financial_settings`, `trainer_api_keys`, `mcp_tool_usage_logs`, `mcp_oauth_*`, `trainer_leads`, `oauth_tokens`.
- Isso bate com a nota conhecida de que o MCP/`$SUPABASE_PROJECT_REF` local aponta pro projeto errado (real = `lylksbtgrihzepbteest`). O script raiz `package.json → gen:types` agrava: `supabase gen types … > shared/types/database.ts` **trunca o arquivo se o comando falhar** (gotcha já documentado).
- Commits recentes (`79b778c` 08/06 installments, `7f60388` 25/05 image_path) foram **edições manuais** por cima do arquivo errado.

Consequências mensuráveis:
- **196 ocorrências de `.from('tabela' as any)`** — **todas no mobile** (o web tem 0 porque seus clients nem são tipados, ver abaixo) — inclusive para tabelas que ATÉ EXISTEM nos tipos (`trainers`, `students`, `subscriptions` em `mobile/contexts/RoleModeContext.tsx:114,150`, `mobile/app/inbox/[id].tsx:63,107,126`…): o time desistiu da tipagem.
- 59 `.from()` em tabelas totalmente ausentes dos tipos.
- 🔴 **Os clients Supabase do web nem usam o generic**: `web/src/lib/supabase/server.ts:7` e `client.ts:4` chamam `createServerClient(...)`/`createBrowserClient(...)` **sem `<Database>`** — no web, TODA query do banco é não-tipada por construção, independente do database.ts.

Correção sugerida: (1) regenerar `database.ts` contra `lylksbtgrihzepbteest` com script seguro (gerar em temp, validar `wc -l`/parse TS, só então mover); (2) tipar os 3 clients web com `<Database>`; (3) campanha de remoção dos `as any` guiada por typecheck.

---

## 6. Cobertura de testes real

### 6.1 Shared — números verdadeiros (coverage re-rodado com include amplo, relatório em /tmp)

A config `shared/vitest.config.ts:18-20` só mede `lib/assessment-protocols` (thresholds 95%) — o "99,1%" é de 3 arquivos. Medindo `lib/ + utils/ + constants/ + tokens/`:

| Diretório/arquivo | % Stmts | Obs |
|---|---|---|
| **All files** | **70,92** | branch 69,5 / funcs 71,5 |
| lib/assessment-protocols | 97,4 | excelente |
| lib/prescription | 94,7 | set-scheme 92,9; builder-mapper branch 65 |
| constants | 100 | |
| tokens v2/legacy | ~96/100 | snapshot test |
| **utils/schedule-projection.ts** | **0** (linhas 79-532) | 533 linhas, motor de projeção de agenda usado por 21 arquivos — maior risco do shared |
| lib/asaas/fees.ts | 0 no shared | ✅ mitigado: testado via `web/src/lib/asaas/__tests__/fees.test.ts` |
| lib/http/parseFilename.ts | 0 | 15 linhas |
| utils/appointments-projection.ts | 92,4 | |

### 6.2 Web e mobile (estimativa por contagem — coverage não roda nesses workspaces)

| Workspace | Arquivos de teste | Arquivos fonte | Razão | Resultado da suíte |
|---|---|---|---|---|
| web | 98 | 728 | 13% | 978 pass / 4 fail / 1 skip |
| mobile | 32 | 490 | 6,5% | 292/292 pass |
| shared | 17 | 49 | 35% | 285/286 (1 fail §4) |
| supabase | **1** (`tests/student_block_rls_test.sql`) | 176 migrations + 19 functions | ~0% | nunca automatizado |

### 6.3 🔴 Fluxos críticos SEM teste

| Fluxo | Estado | Evidência |
|---|---|---|
| **Player de treino** (`mobile/hooks/useWorkoutSession.ts`) | **SEM teste** | 1.383 linhas, 31 `as any`, offline-first, persistência incremental — o arquivo mais crítico do produto; só helpers periféricos testados (`hydrateWorkoutSets`, `calculateWeeklyProgress`) |
| **Auth mobile** (`mobile/contexts/AuthContext.tsx`, `RoleModeContext.tsx`) | **SEM teste** | inclui o retry de keychain do cold start (regressão recente do overhaul Watch) |
| **Auth web** (login/signup pages+actions) | parcial | libs testadas (hibp, turnstile, get-trainer); as actions/páginas em si, não |
| **Webhook Asaas** (`web/src/app/api/webhooks/asaas/route.ts`) | parcial | `lib/asaas/webhook.ts` (parse/verify) testado; a **rota** (dedupe, transições de contrato, side-effects) não |
| **Webhooks Stripe + Stripe Connect** (`api/webhooks/stripe*/route.ts`) | **ZERO teste** | assinatura SaaS = gate de RLS 177 |
| **Inadimplência** (`block_overdue_students()`, cron `check-manual-overdue`) | **ZERO teste** | só o RLS do aluno bloqueado tem o sql manual de tests/ |
| **RLS em geral** | ~0 | 1 arquivo sql manual p/ ~60 tabelas com policies |
| Prescrição/atribuição | ✅ razoável | generate-program e2e, rules-engine, `api/programs/assign` route.test, activate-assigned-program, assign-from-snapshot |

---

## 7. TODOs, lint e débitos anotados

Contagens (fonte, 3 workspaces + supabase): **TODO 15** (web 10, mobile 5), FIXME/HACK/XXX **0**, `@ts-ignore` 48, `@ts-expect-error` 8, `eslint-disable` 41.

### 7.1 🔴 3 erros `react-hooks/rules-of-hooks` = crashes latentes (lint web)

- `web/src/app/financial/wallet/wallet-client.tsx:927` — `useState` **depois de early-return** ("precisa cadastrar chave PIX"): quando o usuário cadastra a chave e o modal re-renderiza, a contagem de hooks muda → React lança "Rendered more hooks than during the previous render" e **derruba a tela de saque**.
- `web/src/components/prescription/form-submissions-card.tsx:68,71` — mesmos `useState` após `if (submissions.length === 0) return null`: primeira submission chegando com o card montado → crash do painel de prescrição.
- Correção: mover os `useState` para antes dos returns (3 linhas cada).

### 7.2 TODOs mais relevantes

- `web/src/app/android/actions.ts:17` — fila de testers Android **sem rate-limit/Turnstile** (TODO explícito de segurança). 🟠
- `web/src/actions/prescription/generate-program.ts:1096` — `stalled_exercise_ids: []` hardcoded ("TODO: implement stall detection"): a IA prescreve sem detectar exercícios estagnados, silenciosamente. 🟠
- `web/src/lib/dashboard/get-dashboard-data.ts:678-680` — MRR/aderência/alunos "último período" = `null` (cards de tendência sem dado real). 🟡
- `mobile/components/trainer/student/AssignProgramWizard.tsx:1` — validação de frequency não replicada no wizard mobile (paridade web↔mobile). 🟡
- `web/src/components/programs/program-builder-client.tsx:936,1022` — modelo de rest único vs `rest_isolation_seconds` das preferências (TODO v2 ×2). 🟡
- Restante do lint web: 496 `no-explicit-any`, 133 `no-unused-vars`, 46 `ban-ts-comment`, 31 `no-img-element`, 27 `set-state-in-effect`, 15 `purity` (4 só em `avaliacoes-client.tsx`).

---

## 8. Código morto, órfãos e raiz bagunçada

### 8.1 🟠 Migrations untracked

`supabase/migrations/135_exercise_library_videos_bucket.sql` e `136_muscle_groups_for_athletic_library.sql` estão **fora do git** (`git status ??`). Provavelmente já aplicadas em prod → um clone novo / branch de preview não reproduz o schema; risco de perda. Correção: commitar.

### 8.2 Raiz do repo (mover/remover — sem tocar nesta análise)

| Item | Estado | Destino sugerido |
|---|---|---|
| `RELATORIO-ANALISE-MOBILE.md`, `RELATORIO-ANALISE-WEB.md` | untracked | `docs/` (são insumo do comparativo) |
| `chatgpt-app-submission.json` | untracked | `web/specs/mcp-server/` ou `_planning/` |
| `marketing/Conteúdos` | untracked | fora do repo (conteúdo IG) ou `_planning/` |
| `docs/aprovacao-videos-conflitos.md`, `docs/grupos-musculares-exercicios-novos.md` | untracked | commitar ou arquivar em `_planning/` |
| `aab-builder-eval-review.html`, `aab-builder.skill`, `design-convergencia.html` | **rastreados na raiz** | `_planning/`/`docs/` — não são código do produto |
| `app.json`, `eas.json`, `financeiro-*.html`, `Carteira_*.docx`, `exercicios-*.xlsx` | ignorados (`.gitignore:32-33`, `.git/info/exclude`) | ok, mas `app.json`/`eas.json` duplicados da pasta `mobile/` na raiz confundem (raiz tem até `dependencies.expo-file-system` no package.json do monorepo — smell) |
| `web/specs/active/chat-first-workspace/`, `web/specs/mcp-server/DIRECTORY-SUBMISSION.md` | untracked | commitar (specs vivas) |

### 8.3 Resíduos do Kinevo Estúdios (abandonado mai/2026) 🟡

- `web/src/actions/organizations/add-coach.ts` (4 `@ts-ignore`) e `update-org-visibility.ts`; `web/src/lib/studio/get-organization.ts` (3 `@ts-ignore`); `web/src/components/settings/equipe-section.tsx` — **build-crítico** (importado por `app/settings/page.tsx`), conforme já mapeado: remover exige tirar a seção Equipe do settings junto.
- `exercises.studio_id` + índice (migration 007) segue no schema; inofensivo, mas órfão.

### 8.4 Outros órfãos/observações

- `mobile/app/(dev)/components-showcase.tsx` e `student-showcase.tsx` — rotas de showcase **dentro de `app/`** vão pro bundle de produção do expo-router. Mover para fora ou gate por `__DEV__`.
- `shared/tokens/index.ts` e barrels `legacy/index.ts`/`v2/index.ts` com 0% de uso direto (consumo é por subpath) — inócuo.
- `shared/constants/notification-messages.ts` e `utils/format-br-date.ts`: usados só pelo web (server-side) — ok, mas questiona se precisavam estar no shared.
- web `training-room/*` (15 componentes): **não é órfão** — rota `app/training-room/page.tsx` existe (apesar do plano Zustand incompleto em docs/architecture).

---

## 9. Higiene do monorepo

| Item | Estado | Severidade |
|---|---|---|
| CI | **inexistente** (sem `.github/workflows`, sem husky) — por isso testes red por 6 semanas e typecheck web quebrado (11 erros TS em 2 arquivos de teste) passam despercebidos | 🔴 |
| `@supabase/supabase-js` | web `^2.94.0` vs mobile `^2.49.2` — ~45 minors de gap; comportamentos de auth/realtime podem divergir entre plataformas | 🟠 |
| `typescript` | web `^5` (flutuante!) vs mobile `~5.9.2` — web sem pin = builds não reprodutíveis | 🟠 |
| `tailwindcss` 4 (web) vs 3.4 (mobile/nativewind) | esperado (nativewind), ok | ✅ |
| Scripts mobile | **sem `lint` e sem `typecheck`** no `mobile/package.json` — os 332 `: any` nunca passam por gate nenhum | 🟠 |
| `gen:types` (raiz) | `supabase gen types … > shared/types/database.ts` — trunca em falha (gotcha confirmado estruturalmente) e depende de `$SUPABASE_PROJECT_REF` apontar pro projeto certo | 🔴 (com §5.2) |
| `web/.env.example` | **desatualizado**: faltam 9 chaves presentes no `.env.local` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `ADMIN_COACH_ID`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` | 🟠 |
| `mobile/.env.example` | não existe (3 chaves EXPO_PUBLIC_* sem template) | 🟡 |
| Deps na raiz | `expo-file-system` em `dependencies` do package.json raiz + override `react-native-svg` — funcionam, mas pertencem ao workspace mobile | 🟡 |
| npm audit | web 11 vulns (2 high), mobile 27 (4 high, 1 critical), shared 0 — detalhe em /tmp/kinevo-analise/audit-*.txt | 🟠 |

---

## 10. Verificado e OK

- ✅ `lib/asaas/fees.ts`: web re-exporta o shared (3 linhas) — zero duplicação de taxas; testado via web.
- ✅ `effectiveSetsForVolume` (volume semanal): única fonte, consumida por web (4) e mobile (2), incl. `volume-helpers` do builder mobile — convenção rounds documentada e testada.
- ✅ `getMethodChipLabel`/`METHOD_KEY_LABELS`: web, mobile builder, player e Watch usam o shared.
- ✅ `set-meta-label`, `set-scheme`, `set-scheme-presets`, `builder-mapper`, `snapshot-from-draft`: compartilhados de verdade e com testes (94,7% no diretório).
- ✅ `assessment-protocols`: 97,4% coverage, usado igualmente pelos dois lados.
- ✅ `schedule-projection` é consumido por ambos (não há motor de agenda duplicado) — o problema é só a ausência de teste.
- ✅ Fórmula de "semana começa na segunda" é a MESMA nas 4 cópias (sem divergência de regra, só risco de TZ no cron).
- ✅ shared sem nenhum `any`/`@ts-ignore`/TODO; npm audit do shared limpo.
- ✅ `mobile/lib/supabase.ts` usa `Database` generic (a tipagem mobile existe; o problema é o database.ts errado).
- ✅ Labels de status financeiro consistentes em texto entre web e mobile (hoje).

---

## Anexo — comandos-chave reproduzíveis

```
# coverage real do shared (relatório em /tmp, não toca o repo)
cd shared && npx vitest run --coverage --coverage.reportOnFailure \
  --coverage.include='lib/**/*.ts' --coverage.include='utils/**/*.ts' \
  --coverage.include='constants/**/*.ts' --coverage.include='tokens/**/*.ts' \
  --coverage.exclude='**/__tests__/**' --coverage.reportsDirectory=/tmp/...

# tabelas fantasma vs ausentes no database.ts
grep -oE '^      [a-z_]+: \{' shared/types/database.ts   # 62 tabelas
grep -rl 'CREATE TABLE.*ambassadors' supabase/migrations/ # vazio

# duplicação de moeda
grep -rn -E '(function|const) (formatCurrency|formatBRL)' web/src mobile --exclude-dir=node_modules
```
