# Loop de SEO/GEO — 2026-06-14

Base: `https://www.kinevoapp.com` (HTML SSR real, sem JS)

## Resumo

| Status | Nº |
|---|---|
| `gap_real` | 5 |
| `ja_ok` | 1 |
| `low_value` | 3 |
| `by_design`/`false_positive` | 0 |
| **Total** | **10** |

`gap_real` por impacto: **médio = 4** · **baixo = 1** · alto = 0.
Destes, **3 são fixWorthy** (todos médio). Os 2 não-fixWorthy são impacto baixo (`/terms`+`/privacy` sem metadata; `/android` og:url sem www).

**Diagnóstico geral:** o root está sólido para GEO — H1, definição via JSON-LD (`SoftwareApplication` + `FAQPage` com 13 Questions), tabela comparativa e answerability do hero já chegam no HTML estático. Os gaps reais são incrementais (prosa citável, métodos avançados, nomes de concorrentes, canonicals self-referentes), não estruturais.

## 🔎 Gaps reais (`gap_real`) — alto → baixo

| Impacto | Kind | Título | Evidência (HTML/asset + origem) |
|---|---|---|---|
| médio | geo-answerability | Falta parágrafo "o que é / pra quem" em prosa contínua citável | `"Kinevo é um sistema"` = 0× no corpo visível (só 1× dentro do JSON-LD `description`). Subtítulo do hero é prosa fragmentada com `<strong>`, não definição corrida. Demais `<p>` são feature/FAQ. Origem: `web/src/components/landing/landing-hero.tsx` (H1 L647-658, sub `<m.p>` L661-672) |
| médio | geo-answerability | Diferencial "métodos avançados de prescrição" ausente do SSR e do schema | grep no SSR por drop-set/pirâmide/cluster/5x5/backoff/superset/%1RM = **0 ocorrências**. `featureList` (8 itens) cita IA mas nenhum método. Recurso é real/shipping (MCP `kinevo_list_training_methods`). Origem: `web/src/app/layout.tsx` L101-110 (featureList) + `web/src/components/landing/landing-pillars.tsx` L565-568 |
| médio | geo-answerability | Nenhuma menção nominal a MFIT/Tecnofit/Trainerize | grep `mfit\|tecnofit\|trainerize` = **0** no SSR. Tabela "Kinevo vs. alternativas" usa subtítulo genérico e colunas "5-20%"/"R$49-199" sem nomes. FAQPage (13 Q) sem "alternativa a X?". Origem: `web/src/components/landing/landing-pricing.tsx` |
| médio | canonical | Canonical aponta pro root em TODAS as subpáginas (/android, /terms, /privacy, /signup) | `curl /android` (HTTP 200) → `<link rel="canonical" href="https://www.kinevoapp.com"/>`. Causa: `web/src/app/layout.tsx` L22-24 hardcoda canonical=root; subpáginas não sobrescrevem. Subrotas têm SSR próprio mas canonicalizam pro root. Bônus: og:url em /android **sem www** |
| baixo | og-twitter | /android: og:url sem www + twitter tags genéricas | `/tmp/kinevo_android.html`: `og:url="https://kinevoapp.com/android"` (viola regra CLAUDE.md: domínio canônico é www). `twitter:title/description` = texto genérico do root. Origem: `web/src/app/android/page.tsx` L11. Afeta só preview social, não indexação |

*(O item "/terms+/privacy sem metadata próprio" — `kind: meta`, `gap_real`, impacto baixo — está consolidado no fix de canonical abaixo, já que o mesmo prompt cobre essas rotas.)*

## 🛠️ Prompts de fix prontos (`fixWorthy=true`)

### 1. Parágrafo definitório citável no hero — médio
**Arquivo:** `web/src/components/landing/landing-hero.tsx` (após `</m.p>` da L672, antes dos CTAs na L674).
Adicionar um `<p>`/`<m.p>` em prosa contínua, sem `<strong>` nem chips, espelhando `SoftwareApplication.description` em 2-3 frases. Copy sugerida:
> "O Kinevo é um sistema completo para personal trainers que prescrevem treino com IA revisada e aprovada pelo profissional, acompanham cada sessão em tempo real e recebem dos alunos sem taxa de plataforma. É ideal tanto para o personal presencial — com a Sala de Treino para acompanhar vários alunos na academia — quanto para o online, com app nativo iOS/Android, Apple Watch e integração HealthKit."

Classes: `font-jakarta text-base text-[#6E6E73] mt-4 max-w-2xl mx-auto leading-relaxed`. **Outcome:** HTML SSR de `/` passa a conter prosa contínua que define o produto, alinhada ao JSON-LD, melhorando extração por IAs sem mudar layout.

### 2. Métodos avançados de prescrição citáveis — médio
**Dois pontos:**
1. `web/src/app/layout.tsx`, `featureList` (L101-110): adicionar item — `'Métodos avançados de prescrição: drop-set, pirâmide, cluster, 5x5, top+backoff, supersets e cargas por série (kg ou %1RM)'`.
2. `web/src/components/landing/landing-pillars.tsx` (seção do h2 "...prescrever treinos de forma eficiente." L565): incluir frase visível no SSR citando os métodos (drop-set, pirâmide, cluster, 5x5, top+backoff, supersets, %1RM), copy alinhada a "prescrição avançada". Manter Shield Strategy (hex hardcoded) e ícone Lucide se aplicável.

Sem mudança de middleware. Validar `tsc --noEmit` + `curl` confirmando termos no HTML não-renderizado. **Outcome:** "Kinevo suporta métodos avançados / é alternativa ao Trainerize?" passa a ter resposta citável no featureList e no SSR.

### 3. Concorrentes nomeados via FAQ SSR + JSON-LD — médio
**Arquivo:** componente que alimenta o `FAQPage` (provavelmente `web/src/components/landing/landing-faq.tsx`; verificar onde o array das 13 Question/Answer é definido) e/ou `web/src/components/landing/landing-pricing.tsx`.
Adicionar 1-3 FAQ em prosa SSR mencionando a categoria nominalmente, sem claims depreciativos. Ex.:
> P: "O Kinevo é uma alternativa ao MFIT, Tecnofit ou Trainerize?"
> R: "Sim. O Kinevo é uma plataforma brasileira de gestão e prescrição para personal trainers, usada por quem procura uma alternativa a apps como MFIT, Tecnofit e Trainerize, com app iOS/Android, Apple Watch nativo, assistente de IA e recebimento sem taxa Kinevo."

Garantir que a entrada também entre no array que gera o `FAQPage` JSON-LD do root. Opcional: citar a categoria no subtítulo da tabela em `landing-pricing.tsx` ("frente a apps como MFIT, Tecnofit e Trainerize"). Não tocar no middleware matcher. **Outcome:** queries "alternativa ao MFIT/Tecnofit/Trainerize" ganham âncora lexical no SSR.

### 4. Canonicals self-referentes por rota (+ og:url com www) — médio
**Arquivo:** root layout já correto (manter canonical=root). Por subpágina:
1. `web/src/app/android/page.tsx` (L4-13): adicionar `alternates: { canonical: 'https://www.kinevoapp.com/android' }` e corrigir `og.url` para incluir **www**.
2. `web/src/app/terms/page.tsx`: criar `export const metadata: Metadata = { title: 'Termos de Uso', description: '...', alternates: { canonical: 'https://www.kinevoapp.com/terms' } }` *(cobre também o gap de metadata genérico dessas páginas legais).*
3. `web/src/app/privacy/page.tsx`: idem com `'/privacy'` + title "Política de Privacidade".
4. `/signup`: opcional/menor prioridade (100% client-side, conversão).

Nota: `alternates.canonical` resolve contra `metadataBase` — pode usar path relativo, escolher padrão consistente. Validar `curl -sL <rota> | grep canonical` pós-deploy. Não tocar no middleware (é texto/metadata). **Outcome:** cada subpágina emite canonical apontando pra si mesma, preservando seu sinal de indexação.

## 🗑️ Descartados (sem fix)

| Título | Status | Motivo (vs. HTML real) |
|---|---|---|
| Root: answerability forte — query respondida no SSR sem JS | `ja_ok` | `/tmp/kinevo_root.html` (145KB): H1 presente, `FAQPage` com 13 Questions, `SoftwareApplication.featureList`, 93 hits de tabela comparativa e 84 da frase do hero — tudo antes de JS. É confirmação, não falta. **Nenhuma ação no root.** |
| HealthKit/integração de saúde não nomeada de forma extraível | `low_value` | Termos ausentes no SSR/`web/src` (grep vazio), mas integração real vive no **mobile** (`HealthKitManager.swift`, `useHealthKitSync.ts`). Landing é B2B com Watch-como-companheiro; nomear HealthKit prometeria vetor fora do foco web. Match de IA é nicho |
| /signup: zero conteúdo SSR — 100% client-side | `low_value` | `/signup` real: 0 h1/h2, ~18.5KB só de bundles. É rota de **conversão** (form), não descoberta; IA não extrai form. Canonical→root é até desejável (evita indexar como landing concorrente) |
| hreflang/alternate ausente em todas as rotas | `low_value` | `curl /` sem `<link rel="alternate" hreflang>`, mas sinal de idioma já existe via `<html lang="pt-BR">` + `og:locale=pt_BR`. Site genuinamente single-locale pt_BR; hreflang self-referente agrega ganho desprezível |
| /terms+/privacy: title/description genéricos, sem schema próprio | `gap_real` (não-fix isolado) | Confirmado: sem `export const metadata` nem JSON-LD nos dois → herdam title do root. Impacto baixo (páginas legais, priority 0.3, yearly). **Coberto pelo fix de canonical #4** acima |
| /android: og:url sem www + twitter genéricas | `gap_real` (impacto baixo) | Real (`og:url` sem www, twitter herdado do root) mas afeta só preview social, não indexação/ingestão por IAs. Correção do og:url **incluída no fix #4** por economia |
