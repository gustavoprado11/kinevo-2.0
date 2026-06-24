# Front C — Landing + Pricing (a promessa pública)

> Auditoria de prontidão para venda. READ-ONLY. Todas as referências são `arquivo:linha`.
> Data: 2026-06-23. Marcação **[confirmado por leitura]** vs **[hipótese]** em cada achado.

---

## TL;DR (veredito)

A landing **vende UM plano único de R$ 39,90/mês marcado "tudo incluso"**, mas o código tem **4 tiers** com cotas de crédito distintas, e o **Assistente com IA — a feature-herói de uma seção inteira da landing — é travado (403) para o tier que esse R$ 39,90 compra (essencial)**. Os tiers que de fato liberam o Assistente (Pro/Premium) **não são exibidos nem vendáveis** pela landing. Esse é o maior risco de falsa-promessa do produto inteiro: o cliente paga pelo plano anunciado e não recebe o que a landing mais destacou.

**GO/NO-GO: NO-GO** até resolver a incoerência central (essencial × Assistente) e decidir como a landing trata os 4 tiers.

---

## 1. Matriz de coerência — tier × {landing} vs {código}

Fonte código: `web/src/lib/ai-usage/quota.ts:23-28` (PLAN_AI_QUOTA), `web/src/lib/limits/student-cap.ts:17-22` (STUDENT_CAP), `web/src/lib/assistant/command-engine.ts:100` (PRO_TIERS), `web/src/lib/auth/get-ai-tier.ts:45-55` (price→tier).

| Tier | Preço na landing | Cota IA na landing | Limite alunos na landing | Assistente IA na landing | Preço (código) | Cota (código) | Alunos (código) | Assistente (código) |
|---|---|---|---|---|---|---|---|---|
| **free** | ❌ não mostrado (CTA "Comece grátis") | ❌ ausente | ❌ ausente (implica "ilimitado") | ⚠️ implícito (seção AI sem ressalva) | — | `null` → "1× cada ação" | **1 aluno** | **403 travado** |
| **essencial** | ✅ R$ 39,90 (`landing-pricing.tsx:82`) — exibido como o **único** plano | ❌ ausente | "Alunos ilimitados" (`:10,:23`) ✅ | "Assistente de prescrição IA" (`:13`) + "Assistente IA ✓" (`:26`) + seção inteira | R$ 39,90 (legacy `STRIPE_PRICE_ID`, `get-ai-tier.ts:51`) | **20/mês** | ∞ ✅ | **403 travado** ❌ |
| **pro_ia** | ❌ **não existe na landing** | ❌ | ❌ | ❌ | env `STRIPE_PRICE_PRO` (não exposto) | **300/mês** | ∞ | ✅ liberado |
| **premium_ia** | ❌ **não existe na landing** | ❌ | ❌ | ❌ | env `STRIPE_PRICE_PREMIUM` | **1000/mês** | ∞ | ✅ liberado |

**Leitura da matriz:**
- O único preço/quota que a landing expõe (R$ 39,90 = essencial) é coerente em valor com o código (`layout.tsx:114` JSON-LD `price: '39.90'` idem). ✅
- Mas o **conteúdo** desse plano está incoerente: o card diz "tudo incluso" e a landing vende o Assistente, enquanto o código trava o Assistente para esse tier. ❌
- Pro e Premium (os únicos que liberam o Assistente) são **invisíveis e não-vendáveis** pela landing. ❌
- Nenhuma cota de crédito (20/300/1000) ou o trial "1× cada ação" aparece em lugar nenhum da landing. ❌

---

## 2. Tabela de achados

| # | Sev. | Arquivo:linha | Evidência | Impacto | Fix (descrito) | Conf./Hip. |
|---|---|---|---|---|---|---|
| C1 | **CRÍTICO** | `landing-pricing.tsx:77,82,13,26` + `landing-ai-assistant.tsx:25-50` × `command-engine.ts:100,118-126` | Card "Plano único — tudo incluso" a R$ 39,90 (=essencial via `get-ai-tier.ts:51`). Landing vende "Assistente de prescrição IA", "Assistente IA ✓" e uma seção-herói com Copiloto/Monitoramento. Mas `PRO_TIERS = {pro_ia, premium_ia}` e `gateAssistant` retorna **403 "disponível nos planos Pro e Premium"** para essencial. | O cliente paga o plano anunciado e é **barrado** da feature mais destacada. Falsa-promessa + churn + risco de chargeback/PROCON. | (a) Travar copy: a feature-herói precisa existir no plano vendido **ou** (b) expor Pro/Premium na landing e deixar claro o que cada tier inclui. Ver C2. | **[confirmado]** |
| C2 | **CRÍTICO** | `landing-pricing.tsx` (todo) + `page.tsx:43-45` | Landing tem **1 só plano**. Não há tabela de tiers, nem seletor, nem menção a Pro/Premium. `app/api/stripe/checkout/route.ts:42-67` aceita `tier=pro_ia/premium_ia`, mas nada na landing dispara isso (CTA → `/signup`). | Os tiers que liberam o Assistente e dão 300/1000 créditos **não são comercializáveis** pela porta da frente. Perda de receita (upsell impossível) + impossível corrigir C1 sem eles. | Construir tabela de pricing com 3 colunas pagas (Essencial/Pro/Premium), mostrando por tier: preço, cota de créditos, "Assistente com IA" só em Pro+. CTA de cada card → checkout com `tier`. | **[confirmado]** |
| C3 | **ALTO** | landing inteira (sweep), `quota.ts:23-28` | **Zero** menção a crédito/token/cota/metering em qualquer arquivo de `components/landing/`. O sistema é metered (essencial=20/mês; free="1× cada ação"; estouro degrada pra GUI — `command-engine.ts:128-137`). | Cria expectativa de "IA ilimitada". Treinador descobre o teto de 20 usos/mês só depois de pagar → frustração. | Adicionar, no card de cada tier, "X créditos de IA/mês" + microcopy explicando o que é 1 crédito e o "degrade pra interface normal" ao esgotar. Explicar o trial "1× cada ação" do free. | **[confirmado]** |
| C4 | **MÉDIO** | `landing-pricing.tsx:10,23` + `landing-hero.tsx:694` + `student-cap.ts:17-22` | "Alunos ilimitados" é verdade só para pagos (∞). Mas o CTA dominante é "Comece grátis" / "Comece grátis agora" (`landing-pricing.tsx:122`, `hero:694`, `navbar:91`), que leva ao tier **free = 1 aluno** (o próprio treinador). Nada na landing revela o teto de 1 aluno do grátis. | Quem "começa grátis" esbarra no cap de 1 aluno na 1ª tentativa de adicionar o 2º. Decepção no onboarding. | Esclarecer: "Grátis: 1 aluno-teste. Planos pagos: alunos ilimitados." Amarrar "ilimitado" explicitamente a pago. | **[confirmado]** |
| C5 | **MÉDIO** | `faqs-data.ts:17` + `hero:713` + `cta-footer:86` × `checkout/route.ts:107` | Landing/FAQ dizem "7 dias grátis com acesso completo" e o spec pedia "sem cartão de crédito" (`01-fase-1...md:77,250`). Mas o trial de acesso-completo é o `trial_period_days: 7` do **checkout Stripe** (exige cartão); o `/signup` cria conta **free** (1 aluno, 1×-cada-ação), não um trial completo de 7 dias. | Ambiguidade sobre o que é "grátis": tier free permanente (limitado) vs trial pago de 7 dias (cartão). Pode gerar reclamação de "pediram meu cartão" ou "não tive acesso completo". | Definir e alinhar copy: ou o /signup inicia o trial completo de 7 dias, ou a landing separa "Grátis pra sempre (1 aluno)" de "Teste o plano pago 7 dias". | **[hipótese]** — mecânica exata do /signup→trial não 100% traçada |
| C6 | **MÉDIO** | `page.tsx:1-15` × componentes existentes não montados | `LandingStripe` (`landing-stripe.tsx`, id="stripe"), `LandingAppleWatch` (seção dedicada, `:281`) e `LandingStudentApp` **existem mas não são importados** em `page.tsx`. O spec Fase 2 marcou Stripe e Apple Watch como seções "**criar**" (`00-README.md:27,29`). | A prova honesta do "0% taxa Kinevo + 3,99%+R$0,50 Stripe" (diferencial #3 do spec, `00-README.md:11`) **não aparece** na página viva. Trabalho feito e não entregue. | Montar `LandingStripe` e (se desejado) `LandingAppleWatch` em `page.tsx`, ou remover os arquivos órfãos. Decisão de produto. | **[confirmado]** |
| C7 | **MÉDIO** | `landing-pricing.tsx:129-187` × `03-fase-3...md:43-69,486-487` | Fase 3 pedia: simplificar a calculadora e adicionar link "Ver cálculo completo (incluindo Stripe) → #stripe". O componente construído **ainda usa a calculadora antiga** ("vs. plataformas com 10% de taxa", `:183`) e **não tem** o link `#stripe`. Como `LandingStripe` nem está montado, o `#stripe` seria âncora-morta de qualquer forma. | Acceptance criteria da Fase 3 (pricing) não cumpridos; a narrativa de pagamento fica só no slogan "0% taxa", sem a math honesta que inclui a taxa do Stripe. | Implementar item 3.1 da Fase 3 OU montar a seção Stripe e linká-la. | **[confirmado]** |
| C8 | **BAIXO** | `landing-testimonials.tsx:17-40` + `landing-social-proof.tsx` + `landing-hero.tsx:642` | Depoimentos "Rafael Mendes/Camila Ferreira/Lucas Oliveira" com métricas (15min, 92%, 0%) e 5 estrelas (`StarRating`) parecem fabricados/não-verificáveis. Selo "Em uso por personal trainers no Brasil"; spec sugeria "+18 personal trainers" (`01-fase-1...md:20`). | Prova social não substanciada = risco de credibilidade e de publicidade enganosa (CDC) se forem fictícios. | Substituir por depoimentos reais com consentimento, ou remover métricas específicas até ter dados. | **[hipótese]** — autenticidade não verificável por código |
| C9 | **BAIXO (bom)** | `layout.tsx:114-120` | JSON-LD `SoftwareApplication` declara `Offer.price '39.90' BRL` (coerente com a landing) e **omite `aggregateRating` de propósito** ("until we have real reviews", `:120`) — seguiu a mitigação do spec (`03-fase-3...md:321,551`). Porém declara **uma só oferta** (39.90), reforçando a invisibilidade de Pro/Premium para crawlers/IA. | Positivo: sem penalidade de review falso. Negativo: IA generativa responde "Kinevo custa R$ 39,90" — e esse preço não inclui o Assistente. | Ao introduzir tiers (C2), atualizar o JSON-LD para múltiplas `Offer`s. | **[confirmado]** |
| C10 | **BAIXO (perf)** | `docs/perf-web-2026-06-23.md:9,19-20` | LCP 5,16s 🔴 medido, mas a causa apontada é a **rota do Builder** (`ExerciseLibraryPanel` sem virtualização), **não a landing**. A landing já usa `LazyMotion + domAnimation` (`:33,44`) e hero é SSR. CLS 0,1 🟢. | Landing não é o gargalo de LCP citado; não bloqueia conversão por perf. | Nenhum fix de landing exigido aqui; perf do Builder é outro front. | **[confirmado]** |

---

## 3. Respostas às 6 perguntas obrigatórias

### Q1 — Coerência numérica (preços, cotas, limites)
**Preço:** a landing mostra **R$ 39,90** (`landing-pricing.tsx:82`, `:21`) e o JSON-LD idem (`layout.tsx:114`). Isso bate com o price legado (`STRIPE_PRICE_ID`) que `get-ai-tier.ts:51` mapeia para **essencial**. Coerente **para o plano exibido**. ✅ A landing está em **1 preço (R$ 39,90)**, não nos 4 tiers. Não há vestígio do reposicionamento R$ 79,90 mencionado no doc de custo — a landing segue R$ 39,90. **[confirmado]**

**Cotas de crédito:** **divergência total por omissão** — nenhuma das cotas (20/300/1000) nem o trial "1× cada ação" aparece na landing (`quota.ts:23-28` × sweep vazio). Não há número errado, há **número ausente** num produto que é metered. **[confirmado]**

**Limite de alunos:** "Alunos ilimitados" (`landing-pricing.tsx:10,23`) é verdadeiro para pagos (`student-cap.ts:18-21` = ∞), mas **falso para o caminho "grátis"** (free = 1, `student-cap.ts:18`), que é o CTA dominante. Divergência contextual (C4). **[confirmado]**

**Falsas-promessas listadas:** C1 (essencial sem Assistente), C3 (cota oculta), C4 ("ilimitado" no grátis).

### Q2 — A landing mostra os 4 tiers? Algum tier promete "Assistente IA" sendo travado?
**Não.** A landing mostra **um único plano** ("Plano único — tudo incluso", `landing-pricing.tsx:77`). Não há tabela free + 3 pagos. Consequência: **Pro e Premium não são marketados nem vendáveis** pela landing (C2) — apesar de o backend suportá-los (`checkout/route.ts:42-67`). E **sim**: o card único (=essencial) reivindica "Assistente de prescrição IA" (`:13`) e a tabela marca "Assistente IA ✓" (`:26`), enquanto `gateAssistant` trava essencial com 403 (`command-engine.ts:118-126`). **A seção-herói inteira `landing-ai-assistant.tsx` (Monitoramento/Prescrição/Copiloto) vende, sem ressalva de tier, capacidades que são Pro+.** Nuance: a geração de rascunho de prescrição via caminho metered (`api/assistant/chat/route.ts`, `execute-tool/route.ts`) parece disponível ao essencial com a cota de 20; mas o **Copiloto conversacional** (`/assistente`, `assistente/page.tsx:28` redireciona não-Pro pra /settings) e o **Monitoramento proativo** (`api/cron/morning-briefing/route.ts:87`, Pro only) **não são**. **[confirmado]**

### Q3 — Clareza de token/crédito e degrade-to-GUI
**Nula.** Um treinador **não tem como** entender, pela landing, que existe crédito, quanto cada ação custa, que o essencial tem teto de 20/mês, nem que ao esgotar "você pode continuar pela interface normal" (degrade — `command-engine.ts:133-135`). O trial free "1× cada ação" (`quota.ts:1-6`) não é explicado. "Ilimitado alunos × 1 aluno" não é amarrado a pago×grátis. (C3, C4). **[confirmado]**

### Q4 — CTA & conversão
Todos os CTAs principais apontam para **`/signup`** (`hero:691`, `navbar:88,141`, `pricing:119`, `cta-footer:70`) — **rota válida, sem link morto**. As âncoras do nav/rodapé (`#como-funciona`, `#para-aluno`, `#assistente-ia`, `#precos`, `#faq`) **todas resolvem** para `id`s na página (`page.tsx:33,39,43,46`; `landing-para-aluno.tsx:206`). Sem dead-link. **Porém:** o CTA leva à criação de conta **free** (não a um checkout de tier), então o caminho de compra de Pro/Premium **não existe** na jornada (C2). Componentes do spec construídos e **não montados** (C6): `LandingStripe`, `LandingAppleWatch` (seção), `LandingStudentApp`. Item de pricing do spec não implementado (C7). **[confirmado]**

### Q5 — Gap de spec (o que foi planejado e não está pronto)
Do `docs/landing-specs/`:
- **Fase 2** marcou "Stripe & Pagamentos (criar)" e "Apple Watch (criar)" (`00-README.md:27,29`). Os componentes existem mas **não estão na página** (C6).
- **Fase 3 / pricing** (`03-fase-3...md:43-69,486-489`): calculadora simplificada + link "#stripe" + tabela de 10 linhas com disclaimer. A tabela de 10 linhas e o disclaimer **foram feitos** (`landing-pricing.tsx:20-31,203`); a **calculadora simplificada e o link #stripe não** (C7).
- **Nada nos specs** (escritos abr/2026) contempla os **4 tiers / cotas de crédito** — o sistema metered (Fase 0 IA) veio **depois** e a landing nunca foi atualizada para ele. **Esse é o gap estrutural**: a landing descreve um produto de plano único que o backend já não é.
- Pendências técnicas do spec (SEO/JSON-LD) majoritariamente entregues (`faq-jsonld.tsx`, `sitemap.ts`, `robots.ts`, `layout.tsx` metadata). **[confirmado]**

### Q6 — Perf/a11y que bloqueia conversão
O `docs/perf-web-2026-06-23.md` aponta LCP 5,16s (`:9`), mas atribui à **rota do Builder** (`:19-20`), **não à landing** — que já está mitigada com `LazyMotion`/`domAnimation` (`:33,44`) e hero SSR; CLS 0,1 (`:9`). FAQ tem a11y (`aria-expanded/controls/labelledby`, `landing-faq.tsx:48-49,69-70`). **Não há bloqueio de conversão por perf/a11y na landing.** (C10). **[confirmado]**

---

## 4. O que falta para a landing/pricing ficarem prontos para vender? (punch-list)

**Bloqueadores de venda (NO-GO até resolver):**
1. **Resolver a incoerência essencial × Assistente (C1).** Decisão de produto: ou o plano de R$ 39,90 passa a incluir o Assistente, ou a landing para de prometer o Assistente nesse plano.
2. **Expor os 4 tiers / tornar Pro e Premium vendáveis (C2).** Tabela de pricing com preço, cota de créditos e "Assistente com IA" só em Pro+. CTA de cada card → `/api/stripe/checkout` com `tier`.
3. **Revelar o metering de IA (C3).** Créditos/mês por tier + explicação de 1 crédito + degrade-to-GUI + trial "1× cada ação" do free.

**Alto valor (antes do go):**
4. Amarrar "alunos ilimitados" a pago e revelar o cap de 1 aluno do grátis (C4).
5. Desambiguar "7 dias grátis / sem cartão" vs tier free permanente (C5).
6. Montar (ou descartar) `LandingStripe` e `LandingAppleWatch`; entregar a calculadora/link da Fase 3 (C6, C7).

**Antes de tráfego pago / escala:**
7. Depoimentos e prova social reais ou removidos (C8).
8. Ao adicionar tiers, atualizar JSON-LD para múltiplas `Offer`s (C9).

**Resumo:** os números **exibidos** (R$ 39,90) são internamente coerentes, mas a landing descreve um **produto de plano único que o backend já não é** — e o pior caso (pagar essencial e não receber o Assistente que a landing mais vende) é uma falsa-promessa crítica. A correção é primariamente de **produto/conteúdo de pricing**, não de bug.
