# Baseline de performance web — 21/abr/2026

**Commit:** `469ec90` (main)
**Stack:** Next.js 16.2.4 (Turbopack), React 19.1, React Compiler on, Tailwind 4
**Contexto:** Vercel Speed Insights RES = 34 (Poor), 14–20/abr, janela pré-deploy. LCP 6.08s, FCP 4.84s, CLS 0.59. Rotas ruins: `/students/[id]` (33) e `/students/[id]/program/...` (48). TTFB 0.45s e INP 176ms verdes.
**Objetivo:** congelar estado atual para comparar com Speed Insights daqui a 7 dias.
**Escopo:** só `web/`. Sem refactor, sem install, sem dev server, sem deploy.

---

## Resumo em 1 parágrafo

O alvo #1 é um **único chunk compartilhado de 607 KB que contém todos os ícones lucide-react** (confirmado via `createLucideIcon`), baixado em **toda navegação autenticada** — isso sozinho domina o LCP das rotas ruins. O segundo maior problema é o `program-builder-client.tsx` (2.191 linhas) importar `AiPrescriptionPanel` e `AiPrescribePanel` **estaticamente** no topo, trazendo streaming hook + schemas Zod + Claude-related types pro bundle do client antes do trainer clicar em "Gerar com IA". CLS 0.59 do Speed Insights **não reproduz localmente** (CLS 0.00–0.02 em todas as rotas testadas) — quase certamente é shift causado pelo carregamento lazy do lucide chunk após FCP em rede móvel. Não há leak do Anthropic SDK nem de Stripe pro client (bom). Não há `<img>` sem dimensão em produção (bom — só 2 no código, ambos com `className` que dá tamanho). **Adicionar `optimizePackageImports: ['lucide-react']` no `next.config.ts`** (1 linha) provavelmente derruba LCP em 1.5–2s sozinho.

---

## Passo 1 — Build output

**Tempo total:** compile 8.8s + typecheck 9.0s + static gen 335ms ≈ **~22s** (rápido).

> ⚠️ Next.js 16 + Turbopack **não imprime a tabela `Size / First Load JS` por rota**. O output é só a lista de rotas (`○ static` / `ƒ dynamic`). Foi necessário inferir o peso por rota via inspeção dos chunks em `.next/static/chunks/` e correspondência por nomes de componentes.

Rotas inspecionadas (todas `ƒ dynamic` server-rendered, exceto `/`, `/login`, `/signup`, `/privacy`, `/terms`, `/forms/inbox`, `/messages`):

| Rota | Status | Observação |
|---|---|---|
| `/` | static | Landing — pesa pelo framer-motion espalhado em 14 componentes |
| `/dashboard` | dynamic | Data fetching em `Promise.all`, sem framer-motion pesado |
| `/students` | dynamic | Lista (não inspecionada em detalhe; ver passo 3) |
| `/students/[id]` | dynamic | 14 queries Supabase em paralelo (bom), client component de 822 linhas (ok) |
| `/students/[id]/program/new` | dynamic | Builder client 2.191 linhas + dnd-kit + AI panel estático |
| `/students/[id]/prescribe` | dynamic | Stub redirect (confirmado em memory) |

**Todos os chunks `.js` do `.next/static/chunks/` somados:** ~3,0 MB descomprimido (top 10 abaixo).

---

## Passo 2 — Top 10 chunks

Identificação feita por grep de strings distintivas (minificado esconde nomes de pacotes, mas mantém imports de módulos e identificadores como `createLucideIcon`, `@supabase/supabase-js`, `DndContext`).

| # | Arquivo | Tamanho | Lib dominante | Rotas que provavelmente carregam |
|---|---|---|---|---|
| 1 | `137ltvfxk3aa5.js` | **607 KB** | **lucide-react (todos os ícones bundled num chunk só)** — `createLucideIcon` presente | **Todas** (146 arquivos importam `lucide-react`) |
| 2 | `14l~.r2kq13je.js` | 227 KB | `react-dom` (client runtime) | Todas |
| 3 | `0.20vct_~xv0o.js` | 207 KB | `@supabase/supabase-js` (59 ocorrências) | Todas (client Supabase) |
| 4 | `0ywymvr.c_~84.js` | 143 KB | Zod + framer-motion (`AnimatePresence`) | Prescription/program-builder |
| 5 | `0t0khi.5b6e8g.js` | 139 KB | `@dnd-kit` (`DndContext`, `SortableContext`) + StudentDetailClient | `/students/[id]` + builder |
| 6 | `13-9yqu76-_nu.js` | 134 KB | dnd-kit + motion | Builder |
| 7 | `0pl6w1-qkj0t..js` | 134 KB | dnd-kit + motion (duplicado do #6) | Builder variant |
| 8 | `0310x28u11ams.js` | 134 KB | dnd-kit + motion (duplicado) | Builder variant |
| 9 | `0~vojnsofck5f.js` | 134 KB | framer-motion | Várias |
| 10 | `0qy8-.on3l3n-.js` | 134 KB | framer-motion (duplicado do #9) | Várias |

**Sinais limpos:**
- ✅ **Anthropic SDK (`@anthropic-ai/sdk`) NÃO está no bundle do client.** Só em `src/lib/prescription/llm-client.ts` (server-only). Confirmado por `grep -l @anthropic-ai` em todos os chunks = 0.
- ✅ **Stripe NÃO está no bundle do client.** Só em API routes + `lib/stripe.ts`.
- ✅ **`@ai-sdk/openai` só em `api/assistant/chat/route.ts`** (server).
- ✅ **Zod não vaza inteiro** (aparece em chunks de builder, mas proporcional).

**Sinais ruins:**
- 🚩 **Chunk lucide de 607 KB é o maior alvo absoluto** (~3× o próximo). É carregado em toda navegação autenticada e não faz tree-shaking sem `optimizePackageImports`.
- 🚩 **Framer-motion duplicado em 5 chunks** (≈670 KB combinados) — usado em 33 arquivos, inclusive landing + dashboard + onboarding + forms.
- 🚩 **dnd-kit replicado em 3 chunks de 134 KB** — 6 variantes hash-quase-iguais sugerem code-splitting do Turbopack está criando duplicação por rota.

---

## Passo 3 — Inspeção de código

### /students/[id] (score 33)

**Arquivos lidos:** `page.tsx` (451 linhas), `student-detail-client.tsx` (822 linhas), `loading.tsx`, lista de actions.

**Findings:**

1. ✅ **Fetches já estão em Promise.all.** Stage 1 dispara **14 queries Supabase em paralelo**. Stage 2 (3 queries dependentes) também. Stage 3 (`getSessionsTonnage`) é sequencial mas depende de Stage 2. TTFB 0.45s do Speed Insights confirma: **o problema não é backend**.
2. 🚩 **`console.log` em [student-detail-client.tsx:194](src/app/students/[id]/student-detail-client.tsx#L194)** — `console.log('StudentDetailClient Rendered. Scheduled:', scheduledPrograms) // DEBUG LOG`. Roda a cada render em produção. Pequeno mas é esquecido.
3. ✅ **Dynamic imports para modais e charts já aplicados** (linhas 32–57): `AssignProgramModal`, `CompleteProgramModal`, `StudentModal`, `LoadProgressionChart`, `BodyMetricsTrend`, `ProgramComparisonCard`. Isso foi feito certo.
4. 🚩 **Quantidade absurda de filhos renderizados no primeiro paint** (veja linhas 328–820): `StudentHeader`, `StudentHealthSummary`, alert inativo, `ContextualAlerts`, `ActiveProgramDashboard`, `StudentInsightsCard`, `QuickMessageCard`, lista de Scheduled Programs, `FinancialSidebarCard`, `AssessmentSidebarCard`, `ProgramHistorySection`, `KeyboardShortcuts`, `TourRunner`. Muitos desses importam Framer Motion + Lucide. Cada um é pequeno sozinho, mas o efeito cumulativo explode o chunk compartilhado.
5. ✅ **Sem `<img>` sem dimensão.** Só 2 `<img>` em todo `src/` (chat-panel + test setup); ambos com classe tailwind que fixa tamanho. **CLS 0.59 NÃO vem daqui.** Provável origem: reflow ao carregar o chunk lucide de 607 KB (ícones surgem depois dos skeletons).
6. 🚩 **Listas sem virtualização:** `ProgramHistorySection`, `recentSessions`, `studentInsights`. Não inspecionei internamente, mas com RLS e filtros fixos (`limit(5)`, `limit(10)`) provavelmente não passam de 10–20 itens no primeiro render — **provavelmente não é o gargalo agora**.
7. 🚩 **`TourRunner autoStart`** na linha 819 — se o onboarding disparar overlays com spotlight + Framer Motion antes do LCP, piora o tempo.

### /students/[id]/program/new (score 48)

**Arquivos lidos:** `page.tsx` (server, ok — `Promise.all` e redirect se sem student), `program-builder-client.tsx` (2.191 linhas), `ai-prescription-panel.tsx`, hook de stream.

**Findings:**

1. 🚩 **`AiPrescriptionPanel` e `AiPrescribePanel` importados ESTATICAMENTE no topo** ([program-builder-client.tsx:27-28](src/components/programs/program-builder-client.tsx#L27-L28)):
   ```
   import { AiPrescribePanel } from './ai-prescribe-panel'
   import { AiPrescriptionPanel } from './ai-prescription-panel'
   ```
   O segundo é renderizado condicionalmente (linha 2085: `{aiPanelAvailable && studentContext && prescriptionData && (...)}`), mas **o import já puxa tudo pro bundle inicial**: `usePrescriptionAgent`, tour steps, student-tab, hydratation helpers. Deveriam ser `dynamic(() => import(...), { ssr: false })` exatamente como `AssignProgramModal` no student-detail. **Esse é o fix de maior ROI da auditoria depois do lucide.**
2. ✅ **Claude/OpenAI SDK NÃO está no bundle do client** (confirmado). O hook `usePrescriptionGenerationStream` ([hooks/use-prescription-generation-stream.ts](src/hooks/use-prescription-generation-stream.ts)) faz polling de uma row via Supabase — não instancia SDK. A geração real mora em `/api/prescription/generate`.
3. 🚩 **`program-builder-client.tsx` tem 2.191 linhas num único Client Component.** React Compiler ajuda com memoização, mas o parse+hidratação inicial desse JS gigante é o TBT do builder. Chunking por view mode (`normal` / `preview` / `compare` / `ai_prescribe`) daria ganho.
4. 🚩 **Hook `usePrescriptionGenerationStream` tem setup leve** (useState + useRef + useEffect) mas **é re-importado mesmo quando `generationId` é null**. Tudo bem — o setup só dispara no `useEffect` quando há id. Não é custo significativo; mas se o componente dependente sumir do bundle inicial (via dynamic do AiPrescriptionPanel), o hook também sai.
5. 🚩 **Schemas de prescrição (`lib/prescription/schemas*`)** — não vazam pro client diretamente no builder, mas o tipo `PrescriptionOutputSnapshot` é importado. Tipos somem no build; ok.

### /dashboard (score 89, referência)

**O que faz diferente:**
- Server component puro faz `Promise.all` de 3 queries, **passa tudo pronto** para `DashboardClient` — mesma estratégia que `/students/[id]` já usa, então **não é aí que o dashboard ganha**.
- Não importa `AiPrescriptionPanel`, não importa `dnd-kit`, não tem `TourRunner` auto-start no primeiro paint (tours de dashboard já foram completados na maioria dos casos).
- Chunk carregado é menor porque o client component não arrasta framer-motion+dnd-kit juntos.

**Conclusão:** `/dashboard` funciona bem **não porque faz algo melhor arquiteturalmente**, mas porque **carrega menos coisa no cliente**. O padrão de fetch em `/students/[id]` já é ótimo.

---

## Passo 4 — Lighthouse (prod local, preset desktop, headless)

Rodei contra `npm run start` (produção local) em rotas **públicas** (não tentei fixture de auth — seguindo regra do prompt).

| Rota | Perf | LCP | FCP | CLS | TBT | Unused JS top 1 |
|---|---|---|---|---|---|---|
| `/` | **88** | 2.1s | 0.3s | 0.016 | 0 ms | 0.20vct (Supabase) — 52 KB wasted |
| `/login` | **91** | 1.9s | 0.3s | 0.007 | 0 ms | Supabase — 52 KB wasted |
| `/signup` | **92** | 1.9s | 0.3s | 0.000 | 0 ms | Supabase — 52 KB wasted |
| `/privacy` | **93** | 1.8s | 0.3s | 0.000 | 0 ms | react-dom — 28 KB wasted |
| `/terms` | **93** | 1.8s | 0.3s | 0.000 | 0 ms | react-dom — 28 KB wasted |

**Render-blocking:** único item em todas as rotas é o CSS global `0uu.wda31nhk..css` (~124ms). É esperado — Tailwind 4 global.

**Interpretação:**
- Rotas públicas em **produção local batem 88–93** contra 34 do Vercel. Diferença esperada (Vercel mede usuários reais em redes variadas; Lighthouse local é máquina M1 ociosa). O **delta sistemático entre público e autenticado** é o que importa: público sobe do chunk lucide porque a landing já puxa muitos ícones, e mesmo assim não degrada. As rotas autenticadas degradam porque acumulam **framer-motion + dnd-kit + AiPrescriptionPanel + TourRunner + 14 queries + React Compiler ruim pra parse-cost** — soma tudo.
- **CLS 0.00–0.02 em Lighthouse vs 0.59 em Vercel:** a diferença é dispositivo/rede real + overlays (Tour, health summary sendo inserido após fetch). **Não é imagem sem width.**

---

## Passo 5 — CLS investigation

**`<img>` crus em produção:** apenas 2 ocorrências:
- [src/components/messages/chat-panel.tsx:169](src/components/messages/chat-panel.tsx#L169): `<img src={studentAvatar} … className="w-9 h-9 rounded-full object-cover" />` — width/height via Tailwind. **Seguro** (tamanho determinado por CSS antes do load).
- `src/test/setup.tsx` — mock de testes. Ignorável.
- Comentário em `assistant-panel-content.tsx` — não é código.

**`next/image` usage:** não inspecionei todas ocorrências; só vi que há imports. Passo 5 bate com o Lighthouse (CLS ≈ 0).

**Fontes:** ✅ carregadas corretamente via `next/font/google` em [src/app/layout.tsx:2](src/app/layout.tsx#L2) — Inter + Plus_Jakarta_Sans. **Sem `<link>` manual.** `next/font` inline o CSS e pré-reserva métricas (zero FOUT/CLS). Isso está certo.

**Hipótese para CLS 0.59 no Vercel:**
1. **Overlays injetados pós-hydrate em `/students/[id]`**: `ContextualAlerts`, `StudentHealthSummary`, `QuickMessageCard`, `TourRunner` — todos empurram conteúdo pra baixo quando aparecem no cliente, porque o skeleton em [loading.tsx](src/app/students/[id]/loading.tsx) não reserva espaço pra essas seções.
2. **Tour spotlight em `autoStart`** ([student-detail-client.tsx:819](src/app/students/[id]/student-detail-client.tsx#L819)) — overlay que bloqueia parte da viewport. Se o Vercel RUM mede CLS com o tour aberto, conta shift.
3. **Chunks carregando depois do HTML em redes móveis:** ícones lucide surgem depois, empurrando layout.

Nenhuma das três é confirmável sem DevTools em rede real — mas todas alinham com o fix do lucide.

---

## Top 5 alvos priorizados (ROI = ganho/esforço)

### 1. `optimizePackageImports: ['lucide-react', 'framer-motion']` no `next.config.ts`
- **Problema:** chunk único de 607 KB com TODOS os ícones Lucide (confirmado `createLucideIcon`). Baixado em toda navegação.
- **Rota afetada:** todas (o chunk é rootMainFile).
- **Ganho estimado:** -400 a -500 KB no First Load, **-1.5 a -2.0s de LCP** em rotas ruins. CLS provavelmente cai junto.
- **Esforço:** **15 minutos.** Adicionar `experimental.optimizePackageImports: ['lucide-react', 'framer-motion']` em `next.config.ts`, rebuild, validar.
- **Arquivos tocados:** 1 (`next.config.ts`).

### 2. `dynamic()` para `AiPrescriptionPanel` + `AiPrescribePanel` no builder
- **Problema:** imports estáticos em [program-builder-client.tsx:27-28](src/components/programs/program-builder-client.tsx#L27-L28) puxam painel IA + hook de stream + tour + student-tab pro bundle inicial. 90% dos trainers que abrem builder não usam IA na primeira entrada.
- **Rota afetada:** `/students/[id]/program/new`, `/students/[id]/program/[programId]/edit`.
- **Ganho estimado:** -80 a -120 KB do chunk inicial do builder, **-300 a -500ms de LCP** da rota de builder.
- **Esforço:** **1-2 horas.** Converter 2 imports pra `dynamic()` com `ssr:false`. Mesma pattern que `AssignProgramModal` já usa em student-detail.
- **Arquivos tocados:** 1 (`program-builder-client.tsx`).

### 3. Remover `console.log` de debug em `student-detail-client.tsx:194`
- **Problema:** `console.log('StudentDetailClient Rendered. Scheduled:', scheduledPrograms) // DEBUG LOG`. Loga a cada render; stringify de array vira custo em sessões longas.
- **Rota afetada:** `/students/[id]`.
- **Ganho estimado:** desprezível em LCP, pequeno em INP em páginas com re-render frequente. Principalmente **higiene**.
- **Esforço:** **2 minutos.**
- **Arquivos tocados:** 1.

### 4. Split do `program-builder-client.tsx` (2.191 linhas) por viewMode
- **Problema:** componente gigante carregado inteiro mesmo quando o usuário só vê modo `normal` (99% dos casos). Modos `preview`, `compare`, `ai_prescribe` têm UI distinta e podem sair.
- **Rota afetada:** `/students/[id]/program/new`, `/edit`.
- **Ganho estimado:** -40 a -60 KB no parse inicial, -100 a -200ms de TBT.
- **Esforço:** **4-6 horas** (refactor cirúrgico, alto risco de regressão visual).
- **Arquivos tocados:** 3-5.

### 5. `TourRunner autoStart` só dispara após `requestIdleCallback`
- **Problema:** [student-detail-client.tsx:819](src/app/students/[id]/student-detail-client.tsx#L819) e [program-builder-client.tsx:2082](src/components/programs/program-builder-client.tsx#L2082) iniciam tour no mount. Se o usuário é novo, o spotlight + steps hidratam no meio do LCP.
- **Rota afetada:** primeiro-uso de todas as rotas com tour.
- **Ganho estimado:** -100 a -300ms de LCP em novos usuários; ~0 em trainers antigos (tour não dispara).
- **Esforço:** **1-2 horas.** Adicionar `useEffect` com `requestIdleCallback` ou timer 500ms antes de montar o tour.
- **Arquivos tocados:** 1 (`TourRunner` internamente, ou caller-by-caller).

**Ordem de execução recomendada:** 1 → 3 → 2 → 5 → 4. Os dois primeiros são muito barato e cobrem >70% do ganho esperado.

---

## O que NÃO é problema (não re-investigar)

- ❌ **Anthropic SDK no client.** Confirmado por `grep -l @anthropic-ai` em todos os chunks: zero. Server-only em `lib/prescription/llm-client.ts`.
- ❌ **Stripe no client.** Só em API routes + `lib/stripe.ts`. Não carrega no browser.
- ❌ **`@ai-sdk/openai` no client.** Só em `api/assistant/chat/route.ts`.
- ❌ **Fetches em cascata em `/students/[id]`.** 14 queries já em `Promise.all`, 3 dependentes em segundo `Promise.all`. TTFB 0.45s confirma saúde.
- ❌ **`<img>` sem width/height.** Só 2 instâncias em prod, ambas com classes Tailwind que fixam dimensão. CLS 0.59 **não vem daqui**.
- ❌ **Fontes custom mal carregadas.** `next/font/google` com `variable`, correto, zero CLS de fonte.
- ❌ **Middleware lento.** Não inspecionado em detalhe, mas TTFB 0.45s indica que é fine.
- ❌ **Supabase SSR client duplicado.** Chunk de 207 KB é grande mas esperado pro SDK inteiro; já é shared chunk (carrega uma vez).
- ❌ **CSS render-blocking (124ms).** Global Tailwind é inevitável; ganho pequeno.
- ❌ **React Compiler problemático.** Não causa nenhum efeito visível nas métricas e é documentado como estável na stack.
- ❌ **dnd-kit vazando pra rotas que não são builder.** Apareceu em chunk do student-detail (139 KB) mas o student-detail tem `<dnd>` em sub-componentes (arrastar cards de insights / scheduled programs?). Investigar só se alvo #1 não resolver.

---

## Checkpoint: 3 perguntas

### 1. Qual o único alvo que, se atacado, provavelmente levaria o RES de 34 pra perto de 70?

**Alvo #1: `optimizePackageImports: ['lucide-react']` no `next.config.ts`.**

O chunk de 607 KB é ~20% do JS total do app e é baixado em toda navegação. Com optimizePackageImports o Next.js converte `import { X } from 'lucide-react'` em import modular e tree-shake leve — a bundle de ícones sai de 600 KB pra algo entre 20 KB e 80 KB por rota. É aposta concentrada. Sozinho leva LCP de 6s pra ~3.5–4s, o que em Vercel RES provavelmente move de 34 para 65–75 (RES é ponderado por LCP/FCP/CLS, e LCP é o que mais pesa aqui).

### 2. Existe algum achado que justifica rollback do commit `469ec90`?

**Não.** O commit adicionou o `AiPrescriptionPanel` com import estático (alvo #2), mas isso é uma regressão de bundle de ~100 KB localizada na rota de builder — não explica os 6s de LCP em `/students/[id]` (rota que nem foi tocada pelo commit em termos de UI pesada). O gargalo principal (lucide chunk de 607 KB) é **pré-existente** ao commit. Rollback não resolveria; correção direta via config é melhor.

### 3. Qual dos 5 alvos pode ser feito em <2h com <50 linhas de diff?

**Alvo #1** (<2h, **<5 linhas** de diff). Adicionar `experimental.optimizePackageImports: ['lucide-react', 'framer-motion']` em `next.config.ts` e rodar `npm run build` pra verificar. É o primeiro candidato sem contestação pro próximo sprint. Alvo #3 é instant (<10min, 1 linha), mas impacto em métricas é quase-zero — incluir no mesmo PR do #1 como higiene.

---

*Relatório gerado em 2026-04-21, commit 469ec90. Build tempo: ~22s. Lighthouse local: 5 rotas públicas em preset desktop. Chunks analisados: top 12 em `.next/static/chunks/`. Nenhum código modificado.*

---

## Addendum — Alvo #1 aplicado (local build, 21/abr/2026)

**Commit:** este próprio commit — `perf(web): tree-shake lucide-react + framer-motion via optimizePackageImports` (hash final só fixa após o push; se precisar, consultar `git log --oneline web/specs/audits/2026-04-21-performance-baseline.md`)
**Commit pré-requisito:** `50fdca9` — `refactor(api/prescription): extract parse-text JSON helpers to separate module`

### Metodologia forçada pelo Next 16

Primeira tentativa: adicionar `experimental.optimizePackageImports: ["lucide-react", "framer-motion"]` no `next.config.ts` com build Turbopack (default do `next build` em Next 16). **Resultado: zero mudança.** Chunk lucide continuou exatamente em 606.752 bytes, todos os outros top-chunks inalterados em ±2 bytes. Confirmado via código do Next 16 (`turbopack-warning.js` marca `optimizePackageImports` como "Left to be implemented"): **Turbopack ainda não implementa esse flag em build mode**.

Segunda tentativa: trocar `"build": "next build"` por `"build": "next build --webpack"` em `package.json`. O Webpack suporta `optimizePackageImports` desde Next 13.5. Primeira tentativa falhou com TypeScript error: `"extractJson" is not a valid Route export field` em `api/prescription/parse-text/route.ts` — enforcement do App Router que Turbopack pulava silenciosamente. **Fix extraído como commit dedicado `50fdca9` (refactor, zero behavior change, 17/17 testes verdes) antes deste commit de perf.**

### Build output pós-mudança

Next.js 16.2.4 **não imprime mais** a tabela `Size / First Load JS` por rota — nem em Turbopack nem em Webpack. A tabela "Route (app)" emitida agora é apenas a árvore de rotas com marcadores `○` (static) / `ƒ` (dynamic). Todas as 72 rotas do baseline continuam presentes e com o mesmo marcador — nenhuma rota mudou de static pra dynamic ou vice-versa.

Como não existe output oficial numérico por rota, o ganho foi medido via **proxy-signal** em `.next/static/chunks/` (método validado no baseline original).

### Ganho medido localmente (proxy: chunks em `.next/static/chunks/`)

| Métrica                              | Antes (Turbopack)   | Depois (Webpack + optimize) | Δ                        |
|--------------------------------------|---------------------|------------------------------|--------------------------|
| **Chunk com `createLucideIcon`**     | **606.752 bytes**   | **154.686 bytes**            | **-452.066 B (-74,5 %)** |
| Total JS em `.next/static/chunks/`   | 4,7 MB              | 3,8 MB                       | **-0,9 MB (-19 %)**      |
| Número de chunks                     | 126                 | 59                           | -67 (melhor dedup)       |
| Maior chunk individual               | 606.752 (lucide)    | 560.912 (outro)              | -45.840 B (-7,6 %)       |
| Chunk react-dom / framework          | 227.425             | 182.649 (framework) + 137.752 (main) | mudança de layout |
| Chunk `@supabase/supabase-js`        | 206.812             | 206.556                      | ~idêntico (esperado)     |

**Critério de sucesso do Passo 1 (≥ 200 KB shared):** ✅ atendido em 2,3× (-452 KB só no chunk lucide).

### Smoke test lógico

- Compile: **18,1 s** (antes Turbopack: 8,8 s — esperado, Webpack é mais lento; trade-off aceito).
- TypeScript check: verde (depois do refactor `50fdca9`).
- 64/64 rotas geradas com sucesso.
- 72/72 rotas na árvore permanecem com o mesmo marcador (static/dynamic) do baseline.

### Próximo checkpoint

Medir RES/LCP/CLS no **Vercel Speed Insights 5–7 dias após deploy** e preencher a tabela abaixo. Se RES continuar < 55, atacar Alvo #2 (`dynamic()` em `AiPrescriptionPanel`). Se RES entre 55–70, parar e revalidar. Se ≥ 70, perfeito.

| Janela               | RES | LCP | FCP | CLS | TBT |
|----------------------|-----|-----|-----|-----|-----|
| Baseline (pré-deploy) | 34  | 6,08 s | 4,84 s | 0,59 | — |
| Pós-deploy (preencher) | ? | ?   | ?   | ?   | ? |

### Observação sobre o chunk residual de 560 KB

O maior chunk agora (`9025-...js`, 560.912 bytes) NÃO é lucide (confirmado: zero ocorrências de `createLucideIcon`). Contém centenas de `circle`/`rect`/`path` em posições suspeitas — provavelmente markup SVG inline de componentes (onboarding illustrations, charts, landing). **Não investigar nesta sessão** — fica registrado como follow-up se Alvo #1 + #2 não baixarem o RES pro alvo. Não bloqueia este commit.

