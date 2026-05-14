# Prompt mestre — Auditoria de performance do web (baseline pré-impacto do deploy `469ec90`)

> Copie tudo abaixo desta linha e cole em uma sessão nova do Claude Code, a partir da raiz do monorepo `kinevo`. Esta é uma tarefa de **pesquisa e diagnóstico** — **não faça refatoração agora**. O objetivo é produzir um relatório de baseline que vai ser comparado daqui a 7 dias com os dados do Vercel pós-deploy.

---

Você vai rodar uma **auditoria de performance do app web** (`web/`) do monorepo `kinevo`. Contexto: o Vercel Speed Insights mostra Real Experience Score = 34 (Poor), com LCP 6.08s, FCP 4.84s, CLS 0.59. As duas rotas que puxam o score pra baixo são `/students/[id]` (score 33) e `/students/[id]/program/...` (score 48). TTFB 0.45s e INP 176ms estão verdes — ou seja, o backend e a interatividade pós-carregamento estão bem; o problema está em **tudo que roda entre o HTML chegar e a página ficar usável**.

Acabamos de mergear o commit `469ec90` que mexeu pesado no fluxo de prescrição e no detalhe do aluno (ver `git show 469ec90 --stat`). As métricas atuais do Vercel são **pré-deploy** — não refletem o código de agora. Por isso este trabalho é **baseline**: medir o estado atual no commit `469ec90` para poder comparar daqui a 7 dias com os novos dados do Vercel Speed Insights.

## Regras duras (leia antes de começar)

- **Não refatore nada.** Nenhum código é editado nesta sessão. Se encontrar algo "rápido de corrigir", anote no relatório e pare. Refatoração é sessão separada, depois que eu priorizar os achados.
- **Não rode dev server (`npm run dev`).** Lighthouse contra dev mode dá números 5-10x piores que produção e polui o relatório. Sempre `npm run build && npm run start` e medir contra `localhost:3000` em modo produção.
- **Não faça deploy nem push.** Trabalho 100% local.
- **Não toque em `mobile/`, `shared/` ou `supabase/`.** Escopo é exclusivamente `web/`.
- **Não instale libs novas sem pedir.** Se precisar de `@next/bundle-analyzer`, `lighthouse`, `source-map-explorer`, pergunta antes — não adiciona nada ao `package.json` que vai virar commit.
- **Tempo total máximo: 60 minutos.** Se estourar, entrega o que tiver.

## Stack (pra calibrar expectativas)

- Next.js 16.2, React 19.1 com React Compiler ligado (`reactCompiler: true` em `next.config.ts`).
- Tailwind 4, Turbopack em dev.
- Supabase SSR (`@supabase/ssr`) + cookies auth.
- Anthropic SDK (`@anthropic-ai/sdk`) e AI SDK (`@ai-sdk/openai`, `@ai-sdk/react`) usados no fluxo de prescrição — suspeitos de bundle pesado.
- Framer Motion, dnd-kit, Stripe. Todos potencialmente pesados se não forem lazy-loaded.

## Os 5 passos da auditoria

Execute na ordem. Cada passo tem um output específico que vai entrar no relatório.

### Passo 1 — Build de produção + medição do tamanho total do bundle

```
cd web
npm run build
```

Anote:
1. O tempo total de build.
2. A tabela "Route (app)" que o Next imprime no final — colunas `Size` e `First Load JS` pra cada rota. Copie como tabela markdown no relatório.
3. Em particular: `First Load JS` de `/students/[id]`, `/students/[id]/program/new`, `/students/[id]/prescribe`, `/dashboard`, `/students`, e `/` (home).
4. Identifique as 3 rotas com maior `First Load JS`. Qualquer coisa acima de 250KB é suspeita; acima de 400KB é provavelmente a causa direta do LCP ruim.

Se algum chunk `shared` (acima de 200KB) aparecer no output, anote o tamanho — esse chunk é baixado em toda navegação, então é o maior alvo.

### Passo 2 — Análise do bundle (o que está pesando)

Sem instalar libs novas, use só o que o Next já emite:

```
ls -lh .next/static/chunks/ | head -30
```

Liste os 10 maiores arquivos `.js` em `.next/static/chunks/` ordenados por tamanho. Pra cada um dos top 5, abra o arquivo (sem formatar — só `head -c 2000` ou procure os `import` no começo) e tente identificar qual pacote domina aquele chunk. Sinais típicos:

- Chunks gigantes com `"@anthropic-ai/sdk"` em `web/src/lib/prescription/claude-agent.ts` ou `llm-client.ts` → SDK inteiro sendo importado no bundle do client. Se estão em rota que é Server Component, não deveria — investigue.
- Chunks com `framer-motion` → Framer pesa 100-150KB; se tá sendo carregado em rota que não anima nada, é alvo de `dynamic import`.
- Chunks com `@dnd-kit/*` → só deveria carregar em rotas de program-builder.
- Chunks com `stripe` → só deveria carregar em rotas de billing/checkout.
- Chunks com `recharts`, `d3`, `three` → verifique se alguma rota não-visualization tá puxando.

Entregue uma tabela: `chunk file | tamanho | lib dominante | rotas que provavelmente carregam`.

### Passo 3 — Inspeção das rotas lentas (leitura de código)

Leia os seguintes arquivos e anote as observações pedidas:

**A) `/students/[id]` — score 33**

Arquivos:
- `web/src/app/students/[id]/page.tsx`
- `web/src/app/students/[id]/student-detail-client.tsx`
- `web/src/app/students/[id]/loading.tsx`
- `web/src/app/students/[id]/actions/*` (todos)

Procure por:
1. **Fetches em cascata**: `await supabase.from(...).select(...)` em série, um depois do outro. Idealmente devem ser `Promise.all`.
2. **Client Components que deveriam ser Server Components**: componentes com `"use client"` que só renderizam dados estáticos e não têm estado/interação.
3. **Imports pesados no topo do client component**: `import { Stripe }`, `import * as framer from "framer-motion"` sem `dynamic()`.
4. **`<Image>` ou `<img>` sem `width`/`height`** — principal suspeito do CLS 0.59.
5. **Listas grandes sem virtualização** (tabela de treinos completados, log de sessões, etc.) — se renderiza 200+ items no primeiro paint, é problema.

**B) `/students/[id]/program/new` — score 48**

Arquivos:
- `web/src/app/students/[id]/program/new/page.tsx`
- `web/src/components/programs/program-builder-client.tsx`
- `web/src/components/programs/ai-prescription-panel.tsx` (novo do deploy `469ec90`)
- `web/src/components/programs/ai-prescription-panel/*` (se for folder)
- `web/src/hooks/use-prescription-generation-stream.ts`

Procure por:
1. **Painel IA carregando no primeiro paint mesmo quando o trainer não vai usar** — deveria ser `dynamic(() => import(...), { ssr: false })` disparado só quando clica em "Gerar com IA".
2. **Claude/OpenAI SDK importado no bundle client** — esses SDKs são gigantes e só deveriam viver em API routes (server). Se `@anthropic-ai/sdk` aparece importado em qualquer arquivo sob `web/src/components/` ou `web/src/hooks/`, é bug de bundle.
3. **Streaming hook inicializando na montagem** — se o `useEffect` do `use-prescription-generation-stream` faz setup pesado (WebSocket, EventSource, Claude SDK init) antes do usuário pedir, é desperdício.
4. **Schemas Zod gigantes importados** — `web/src/lib/prescription/schemas.ts` e `schemas-strict.ts` podem ser 50-100KB. Se forem usados só em API route, não devem vazar pro client.

**C) `/dashboard` — score 89 (quase verde, referência do que funciona)**

Arquivos:
- `web/src/app/dashboard/page.tsx`
- `web/src/app/dashboard/*-client.tsx` (se existir)

Não procure problemas aqui — use como contraste. Anote 1-2 coisas que `/dashboard` faz diferente de `/students/[id]` (ex: usa mais Server Components, não importa Framer Motion, fetch único em vez de cascata). Isso vira recomendação pras outras rotas.

### Passo 4 — Lighthouse em produção local

```
npm run build
npm run start
```

Em outro terminal:

```
npx --yes lighthouse http://localhost:3000/ \
  --only-categories=performance \
  --preset=desktop \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=/tmp/lh-home.json \
  --quiet
```

Rode o mesmo comando pra 3 URLs (adapte o ID de um aluno real — o dev vai te dar, ou use uma rota que não exige auth se houver):

- `http://localhost:3000/` (home)
- `http://localhost:3000/dashboard`
- `http://localhost:3000/students` (lista)

Se alguma rota exige auth e você não tem sessão, **pule e anote** — não tente criar fixture de auth. Lighthouse em rotas públicas já é suficiente pra baseline.

Pra cada JSON gerado, extraia:
- `audits["largest-contentful-paint"].displayValue`
- `audits["first-contentful-paint"].displayValue`
- `audits["cumulative-layout-shift"].displayValue`
- `audits["total-blocking-time"].displayValue`
- Top 3 itens em `audits["unused-javascript"].details.items` (arquivo + wastedBytes)
- Top 3 em `audits["render-blocking-resources"].details.items`

Use `jq` se tiver:
```
jq '.audits["largest-contentful-paint"].displayValue' /tmp/lh-home.json
```

Salve os JSONs completos em `/tmp/` — não commite.

### Passo 5 — CLS investigation (0.59 é absurdo — meta é < 0.1)

CLS 0.59 quase sempre vem de **imagens sem dimensão reservada** ou **fonte que troca de tamanho durante o load**.

Rode:

```
grep -rn "<img" web/src --include="*.tsx" --include="*.jsx" | grep -v "node_modules" | head -30
```

Pra cada resultado, verifique se tem `width` e `height` explícitos. Se não tiver, é candidato.

Também procure uso de `next/image` sem `width/height/fill`:

```
grep -rn "next/image" web/src --include="*.tsx"
```

Verifique também o layout raiz (`web/src/app/layout.tsx`) e se tem fontes custom carregadas via `next/font` (correto) ou via `<link href="...">` manual (errado — causa FOUT/CLS).

## Entregável final

Salve como `web/specs/audits/2026-04-21-performance-baseline.md`. Estrutura:

```
# Baseline de performance web — 21/abr/2026

Commit: 469ec90
Contexto: Vercel RES = 34 (Apr 14–20, pré-deploy). Objetivo: medir estado pós-deploy localmente para comparar com Vercel daqui a 7 dias.

## Resumo em 1 parágrafo
(3-5 linhas: qual é o maior alvo, quanto de bundle é possível cortar, qual rota ataca primeiro.)

## Passo 1 — Build output
(tabela First Load JS por rota)

## Passo 2 — Top 10 chunks
(tabela chunk | tamanho | lib dominante | rotas)

## Passo 3 — Inspeção de código
### /students/[id]
(findings numerados)
### /students/[id]/program/new
(findings numerados)
### /dashboard (referência)
(o que funciona)

## Passo 4 — Lighthouse
(tabela: rota | LCP | FCP | CLS | TBT | unused JS top 3)

## Passo 5 — CLS
(lista de <img> sem dimensão, fontes não-otimizadas)

## Top 5 alvos priorizados
Cada item: (1) problema, (2) rota afetada, (3) ganho estimado em ms/KB, (4) esforço em horas, (5) arquivos tocados.
Ordene por ROI (ganho/esforço) — maior ganho com menor esforço primeiro.

## O que NÃO é problema
(coisas que você investigou e descartou — poupa o próximo a não re-investigar)
```

## Checkpoint antes de fechar

Antes de entregar o relatório, responda essas 3 perguntas no final do documento:

1. Qual o **único** alvo que, se atacado, provavelmente levaria o RES de 34 pra perto de 70? (Aposta concentrada, não lista.)
2. Existe algum achado que justifica **rollback** do commit `469ec90`? (Resposta esperada: não, mas confirme.)
3. Dos 5 alvos priorizados, qual pode ser feito em **menos de 2 horas** com **menos de 50 linhas de diff**? Esse é o primeiro candidato pro próximo sprint.

Se não conseguir responder essas 3 com confiança, o relatório ainda não está pronto — volte aos dados.

Boa auditoria.
