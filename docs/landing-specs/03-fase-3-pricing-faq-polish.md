# Fase 3 — Pricing, FAQ, polish técnico

> **Duração estimada:** 4–6 dias úteis
> **Arquivos tocados:** `landing-pricing.tsx`, `landing-faq.tsx`, `globals.css`, `next.config.ts`, `layout.tsx`, métricas de SEO/social
> **Risco:** baixo (mexe em coisas isoladas + tooling)
> **Dependências:** Fase 2 mergeada (Pricing referencia o card de Stripe; FAQ ganha perguntas sobre Apple Watch e Sala de Treino)

## 1. Objetivo

Fechar o ciclo da landing com:

1. **Pricing repensado** — a calculadora atual usa "10% de taxa" como input fixo. Substituir por uma narrativa mais honesta: cenário pré-definido + link pra seção Stripe completa.
2. **FAQ expandido** — adicionar 4 perguntas que os personals fazem (Apple Watch, Sala de Treino, sincronização do app, dados após cancelamento).
3. **Polish técnico cross-cutting** — performance budget, acessibilidade WCAG AA, SEO completo (Open Graph + Twitter cards + sitemap + robots), dark mode opcional, scroll-margin anchors.

## 2. Escopo

### Entra
- Pricing: simplificar calculadora (slider continua, mas resultado linka pra `#stripe`)
- Pricing: comparison table — substituir "Outros" genérico por nomes reais ou manter genérico mas adicionar disclaimer
- FAQ: 4 perguntas novas + acordeão com keyboard navigation
- Performance: lazy loading inteligente de imagens, font-display swap, preconnect, code-split de Framer no que dá
- A11y: focus rings consistentes, contraste WCAG AA em todos os textos, `aria-expanded` no FAQ, `aria-current` no navbar
- SEO: meta tags completas, OG image dedicada, Twitter card, sitemap.xml, robots.txt, structured data (`Organization`, `Product`, `FAQPage`)
- Dark mode: ativar suporte respeitando `prefers-color-scheme` (CSS já está pronto, faltam ajustes)
- Scroll-margin pra todos os anchors
- Smooth scroll com `scroll-behavior: smooth` (com `prefers-reduced-motion` exceção)

### Não entra
- Internacionalização (i18n)
- A/B testing infrastructure
- Analytics adicional além do já existente (Vercel Analytics provavelmente já está)
- Service worker / PWA

## 3. Mudanças por arquivo

### 3.1 `web/src/components/landing/landing-pricing.tsx` — refino

**Estado atual:** card de plano R$ 39,90 + calculadora com slider + comparison table.

**Mudanças:**

#### a) Calculadora — simplificar e linkar pra Stripe

A calculadora atual mostra "Com 10% de taxa: -R$ X/mês" e "Com Kinevo: R$ 0/mês em taxas". Isso conflita com o card de Stripe da Fase 2 (que faz a comparação completa, com Stripe incluído). Aqui simplificar para:

```tsx
// Substituir o conteúdo do card-direito da calculadora por:
<div className="bg-white rounded-xl p-5 border border-[#E8E8ED]">
  <p className="font-jakarta text-xs text-[#86868B] uppercase tracking-wider font-semibold">
    Quanto você economiza por mês
  </p>
  <p className="font-jakarta text-3xl font-extrabold text-[#34C759] mt-2">
    +R$ {monthlyEconomy.toLocaleString('pt-BR')}
  </p>
  <p className="font-jakarta text-sm text-[#86868B] mt-1">
    vs. plataformas com 10% de taxa
  </p>

  <a
    href="#stripe"
    className="inline-flex items-center gap-1.5 mt-3 font-jakarta text-sm font-semibold text-[#7C3AED] hover:underline"
  >
    Ver cálculo completo (incluindo Stripe) →
  </a>
</div>
```

Onde `monthlyEconomy = students * avgPrice * 0.10` (mesmo cálculo conceitual, mas só mostra o lado positivo).

#### b) Comparison table — substituir/qualificar "Outros"

Hoje a tabela usa `outros: 'R$ 49-199'` etc. Manter genérico mas adicionar disclaimer:

```tsx
{/* No header da tabela, adicionar abaixo do <h3> */}
<p className="font-jakarta text-xs text-[#86868B] mt-2">
  Comparação com plataformas de personal training disponíveis no Brasil
  (Trainerize, TrueCoach, MyPTHub, Tecnofit) em planos profissionais equivalentes.
  Valores e taxas verificados em abril/2026.
</p>
```

> Falar nomes dá credibilidade. Verificar com Gustavo se está confortável citá-los.

Adicionar 2 linhas novas na tabela:

```tsx
const comparison = [
  { feature: 'Preço mensal', kinevo: 'R$ 39,90', others: 'R$ 49-199' },
  { feature: 'Taxa sobre pagamentos', kinevo: '0%', others: '5-20%' },
  { feature: 'Alunos ilimitados', kinevo: true, others: false },
  { feature: 'App nativo iOS/Android', kinevo: true, others: 'Parcial' },
  { feature: 'Apple Watch nativo', kinevo: true, others: false },          // ← era "Apple Watch"
  { feature: 'Assistente IA', kinevo: true, others: false },
  { feature: 'Sala de Treino (tempo real)', kinevo: true, others: false },
  { feature: 'Modo offline', kinevo: true, others: false },
  { feature: 'Em português brasileiro', kinevo: true, others: 'Parcial' }, // ← novo
  { feature: 'Suporte humano em PT-BR', kinevo: true, others: false },     // ← novo
]
```

### 3.2 `web/src/components/landing/landing-faq.tsx` — adicionar 4 perguntas

Adicionar na constante `faqs` (na ordem):

```tsx
const faqs = [
  // ... existentes ...

  // NOVA — depois de "Funciona para treino presencial e online?"
  {
    question: 'Como funciona a Sala de Treino?',
    answer: 'É um modo presencial. Você abre a Sala de Treino no Kinevo e seleciona os alunos que estão com você na academia. Vê o que cada um está fazendo em tempo real — série atual, frequência cardíaca, tempo de descanso. Quando alguém precisa de você, fica em destaque. Não substitui sua atenção, só evita você ter que olhar 5 celulares.',
  },

  // NOVA — depois de "O app funciona no iPhone e Android?"
  {
    question: 'Como funciona o app no Apple Watch?',
    answer: 'É um app Watch nativo (não uma extensão). O aluno marca série, vê frequência cardíaca em tempo real e timer de descanso direto no relógio — sem tirar o celular do bolso. Sincroniza com o iPhone via WatchConnectivity em background. Funciona com qualquer Apple Watch (Series 4 ou superior, watchOS 9+).',
  },

  // NOVA — antes de "O Kinevo usa inteligência artificial?"
  {
    question: 'Os dados sincronizam entre dispositivos?',
    answer: 'Sim, em tempo real. O aluno pode começar o treino no iPhone, marcar séries no Apple Watch e ver o histórico no iPad. Você vê tudo no painel web ou no seu celular. Tudo via Supabase Realtime.',
  },

  // NOVA — última pergunta
  {
    question: 'O que acontece com meus dados se eu cancelar?',
    answer: 'Você consegue exportar tudo (alunos, programas, históricos, financeiro) em CSV antes de cancelar. Após o cancelamento, mantemos seus dados por 90 dias caso você queira voltar — depois disso, exclusão permanente conforme LGPD.',
  },
]
```

#### Acessibilidade do FAQ

```tsx
<button
  onClick={() => setOpenIndex(isOpen ? null : i)}
  aria-expanded={isOpen}                               // ← novo
  aria-controls={`faq-panel-${i}`}                     // ← novo
  id={`faq-button-${i}`}                               // ← novo
  className="w-full flex items-center justify-between py-5 px-6 text-left hover:bg-[#F5F5F7]/50 transition-colors focus-visible:bg-[#F5F5F7]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40"
>
  {/* ... */}
</button>

<motion.div
  id={`faq-panel-${i}`}                                // ← novo
  role="region"                                        // ← novo
  aria-labelledby={`faq-button-${i}`}                  // ← novo
  // ...
>
```

### 3.3 `web/src/app/globals.css` — polish

**Adicionar no final:**

```css
/* ═══════════════════════════════════════════════════════════════════
   Scroll behavior — smooth com fallback pra reduced-motion
   ═══════════════════════════════════════════════════════════════════ */

html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Scroll margin — anchors não ficam atrás da navbar (h-16)
   ═══════════════════════════════════════════════════════════════════ */

section[id], div[id] { scroll-margin-top: 80px; }

/* ═══════════════════════════════════════════════════════════════════
   Focus rings — consistente em todo lugar
   ═══════════════════════════════════════════════════════════════════ */

:focus-visible {
  outline: 2px solid #7C3AED;
  outline-offset: 2px;
  border-radius: 4px;
}
button:focus-visible, a:focus-visible {
  outline: 2px solid #7C3AED;
  outline-offset: 3px;
}

/* ═══════════════════════════════════════════════════════════════════
   Font loading — display swap
   ═══════════════════════════════════════════════════════════════════ */

/* Next.js font config já cuida — confirmar em layout.tsx que
   `display: 'swap'` está ativo no Plus Jakarta Sans */
```

### 3.4 `web/src/app/layout.tsx` — SEO completo

**Adicionar metadata completa:**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://kinevo.com.br'),
  title: {
    default: 'Kinevo — Sistema completo para personal trainers',
    template: '%s · Kinevo',
  },
  description: 'Prescreva programas em minutos, acompanhe quem treinou de verdade e receba sem taxa Kinevo. App iOS/Android, Apple Watch nativo e assistente IA.',
  keywords: ['personal trainer', 'app personal trainer', 'gestão personal', 'prescrição treino', 'apple watch personal', 'assistente IA personal'],
  authors: [{ name: 'Kinevo' }],
  creator: 'Kinevo',
  publisher: 'Kinevo',
  alternates: {
    canonical: 'https://kinevo.com.br',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://kinevo.com.br',
    siteName: 'Kinevo',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo. App nativo iOS/Android + Apple Watch.',
    images: [
      {
        url: '/og-image.png',  // criar 1200×630
        width: 1200,
        height: 630,
        alt: 'Kinevo — Sistema completo para personal trainers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kinevo — Sistema completo para personal trainers',
    description: 'Prescreva, acompanhe e receba sem taxa Kinevo.',
    images: ['/og-image.png'],
    creator: '@kinevo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',  // criar 180×180
  },
  manifest: '/manifest.webmanifest', // opcional
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0B' },
  ],
  width: 'device-width',
  initialScale: 1,
}
```

**Adicionar dentro do `<body>` do layout, antes do `{children}`:**

```tsx
{/* JSON-LD: Organization */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Kinevo',
      url: 'https://kinevo.com.br',
      logo: 'https://kinevo.com.br/logo-icon.png',
      sameAs: ['https://www.instagram.com/kinevo.app'],
      description: 'Sistema completo para personal trainers',
    }),
  }}
/>

{/* JSON-LD: SoftwareApplication */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Kinevo',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'iOS, Android, Web',
      offers: {
        '@type': 'Offer',
        price: '39.90',
        priceCurrency: 'BRL',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '50',
      },
    }),
  }}
/>
```

> O `aggregateRating` exige reviews reais. Se não houver, **omitir esse bloco** (Google penaliza dados estruturados falsos).

### 3.5 `web/src/app/sitemap.ts` — NOVO

```tsx
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://kinevo.com.br'
  const now = new Date()

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
```

### 3.6 `web/src/app/robots.ts` — NOVO

```tsx
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/app/', '/api/', '/dashboard/'] },
    ],
    sitemap: 'https://kinevo.com.br/sitemap.xml',
    host: 'https://kinevo.com.br',
  }
}
```

### 3.7 `web/src/app/(landing)/faq-jsonld.tsx` — NOVO (componente leve)

Server component que renderiza JSON-LD pro FAQ — Google adora isso, vira rich snippet.

```tsx
const faqs = [
  { q: 'Preciso pagar para testar?', a: 'Não. Você tem 7 dias grátis com acesso completo...' },
  // ... espelhar a constante de landing-faq.tsx
]

export function FaqJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }),
      }}
    />
  )
}
```

> **Manter as duas listas em sync** é o tradeoff. Alternativa: extrair `faqs` pra um arquivo `faqs-data.ts` e importar nos dois lugares. Recomendo a extração.

Importar e usar no `page.tsx` ou `layout.tsx`.

### 3.8 `web/next.config.ts` — performance

Verificar/adicionar:

```ts
const nextConfig: NextConfig = {
  // ... existente ...
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  poweredByHeader: false,
}
```

> `optimizePackageImports` é a otimização chave — Next 16 faz tree-shake mais agressivo de `lucide-react` (que importa centenas de ícones).

### 3.9 OG image — `/web/public/og-image.png`

Criar imagem 1200×630px com:
- Fundo: dark `#0A0A0B` com mesh gradient sutil
- Logo Kinevo + wordmark à esquerda
- Headline grande: "Sistema completo para personal trainers"
- Sub: "Prescreva. Acompanhe. Receba sem taxas."
- Mockup pequeno do dashboard à direita

> Fora do escopo de código — pode ser feito em Figma, Canva ou via outro task.

### 3.10 Dark mode — ativação opcional

CSS já tem `.dark { ... }` em `globals.css`. Falta:

1. **Detectar `prefers-color-scheme`** automaticamente:

   ```tsx
   // Em layout.tsx, adicionar script inline ANTES do <body>:
   <script dangerouslySetInnerHTML={{ __html: `
     (function() {
       try {
         var saved = localStorage.getItem('theme');
         var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
         var theme = saved || (prefers ? 'dark' : 'light');
         document.documentElement.classList.toggle('dark', theme === 'dark');
       } catch (e) {}
     })();
   `}} />
   ```

2. **Verificar componentes da landing** com hex hardcoded: a maioria usa Apple HIG light em hex direto. Para essa fase, **não migrar tudo pra dark** — só garantir que **não quebra** se `dark` estiver ativo, e usar `dark:` prefix nos pontos críticos:

   ```tsx
   // exemplo — Hero
   <div className="absolute inset-0 bg-[#FAFAFA] dark:bg-[#0A0A0B]" />
   ```

> Migração full pra dark mode é trabalho de outra spec. Aqui só ativar a infra e garantir não-regressão.

## 4. Copy final (FAQ — perguntas novas)

```
Q: Como funciona a Sala de Treino?
A: É um modo presencial. Você abre a Sala de Treino no Kinevo e seleciona
   os alunos que estão com você na academia. Vê o que cada um está fazendo
   em tempo real — série atual, frequência cardíaca, tempo de descanso.
   Quando alguém precisa de você, fica em destaque. Não substitui sua
   atenção, só evita você ter que olhar 5 celulares.

Q: Como funciona o app no Apple Watch?
A: É um app Watch nativo (não uma extensão). O aluno marca série, vê
   frequência cardíaca em tempo real e timer de descanso direto no relógio
   — sem tirar o celular do bolso. Sincroniza com o iPhone via
   WatchConnectivity em background. Funciona com qualquer Apple Watch
   (Series 4 ou superior, watchOS 9+).

Q: Os dados sincronizam entre dispositivos?
A: Sim, em tempo real. O aluno pode começar o treino no iPhone, marcar
   séries no Apple Watch e ver o histórico no iPad. Você vê tudo no painel
   web ou no seu celular. Tudo via Supabase Realtime.

Q: O que acontece com meus dados se eu cancelar?
A: Você consegue exportar tudo (alunos, programas, históricos, financeiro)
   em CSV antes de cancelar. Após o cancelamento, mantemos seus dados por
   90 dias caso você queira voltar — depois disso, exclusão permanente
   conforme LGPD.
```

## 5. Acceptance criteria

### Pricing
- [ ] Calculadora simplificada — só mostra "+R$ X economizados"
- [ ] Link "Ver cálculo completo" rola pra `#stripe`
- [ ] Comparison table tem 10 linhas (era 8) — incluindo "Em PT-BR" e "Suporte humano"
- [ ] Disclaimer abaixo do título da tabela referenciando concorrentes (se aprovado)

### FAQ
- [ ] 4 perguntas novas inseridas nas posições corretas
- [ ] `aria-expanded`, `aria-controls`, `aria-labelledby` nos accordions
- [ ] Focus ring `#7C3AED` visível em tab nav
- [ ] FAQ JSON-LD presente no head (validar via [Rich Results Test](https://search.google.com/test/rich-results))

### SEO
- [ ] `metadata` completa em `layout.tsx`
- [ ] OG image 1200×630 em `/public/og-image.png` (validar com [opengraph.xyz](https://www.opengraph.xyz))
- [ ] `sitemap.xml` acessível em `/sitemap.xml`
- [ ] `robots.txt` acessível em `/robots.txt`
- [ ] JSON-LD `Organization` + `SoftwareApplication` validados
- [ ] Lighthouse SEO = 100

### Performance
- [ ] Lighthouse Performance mobile ≥ 90
- [ ] CLS < 0.05
- [ ] LCP < 2.5s
- [ ] Total Blocking Time < 200ms
- [ ] `optimizePackageImports` ativo
- [ ] Imagens em WebP/AVIF

### A11y
- [ ] Lighthouse Accessibility = 100
- [ ] Contraste WCAG AA em **todos** os textos (validar com axe DevTools)
- [ ] Navegação por teclado funcional do início ao fim
- [ ] Focus rings visíveis em todos os elementos interativos
- [ ] `aria-current="page"` na navbar quando rola pra seção
- [ ] `prefers-reduced-motion: reduce` desliga TODAS as animações de loop

### Dark mode (opcional)
- [ ] `<html class="dark">` toggleável via `localStorage`
- [ ] Sem regressão visual no modo light
- [ ] Sem crash em modo dark (mesmo que ainda não esteja perfeito)

## 6. Tarefas em ordem de execução

1. **Pricing — simplificar calculadora** + link pra `#stripe`. *~1.5h*
2. **Pricing — comparison table** com 2 linhas novas + disclaimer. *~1h*
3. **FAQ — 4 perguntas novas**. *~30min*
4. **FAQ — extrair `faqs-data.ts`** compartilhado entre componente e JSON-LD. *~30min*
5. **FAQ — a11y**: aria-expanded/controls/labelledby + focus ring. *~1h*
6. **SEO — metadata em layout.tsx**. *~1h*
7. **SEO — OG image** (descobrir se vai criar agora ou em paralelo). *~2h se for criar inline*
8. **SEO — sitemap.ts + robots.ts**. *~30min*
9. **SEO — JSON-LD Organization + SoftwareApplication + FAQPage**. *~1h*
10. **Performance — `next.config.ts` ajustes**. *~30min*
11. **Performance — `optimizePackageImports`** validar bundle size com `@next/bundle-analyzer`. *~1h*
12. **A11y audit** com axe DevTools, fix do que aparecer. *~3h*
13. **CSS — scroll-margin, focus rings, prefers-reduced-motion global**. *~1h*
14. **Dark mode — script de detecção** + smoke test. *~2h*
15. **QA final**: Lighthouse mobile/desktop, Safari iPhone real, validar OG no Slack/WhatsApp. *~2h*

**Total estimado: 18–22h** (2.5 dias úteis com refino).

## 7. Riscos & mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Citar concorrentes (Trainerize, etc.) gerar fricção legal | Baixa | Médio | Verificar com Gustavo. Se houver dúvida, manter "Outras plataformas" genérico no header da tabela. |
| `aggregateRating` falso no JSON-LD trazer penalidade Google | Alta | Alto | **Não incluir** se não houver reviews reais coletados em algum sistema (G2, Trustpilot, App Store). |
| Dark mode quebrar componentes que usam hex hardcoded | Alta | Médio | Smoke test página por página. Se algo quebrar visualmente, toggle ficar opt-in (só ativa via switcher manual, não auto-detect). |
| OG image ficar genérica e prejudicar CTR de compartilhamento | Média | Médio | Investir 2-3h em design caprichado. Validar em Slack e WhatsApp antes de deploy. |
| `optimizePackageImports` quebrar build em produção | Baixa | Alto | Testar `pnpm build && pnpm start` localmente antes de mergear. Manter rollback fácil. |
| `scroll-margin-top: 80px` desktop ≠ mobile (navbar pode ter altura diferente) | Baixa | Baixo | Validar — se a navbar continua `h-16` em mobile, manter. |
| `prefers-reduced-motion` global desligar transições importantes (hover de botão) | Baixa | Baixo | Refinar regra: `animation` vs `transition` — desligar só animações de loop, manter transitions de hover. |

## 8. Checklist de pré-launch (independente da fase)

Antes de marcar a Fase 3 como pronta, validar:

- [ ] **Lighthouse mobile** (Performance ≥ 90, A11y = 100, BP = 100, SEO = 100)
- [ ] **Lighthouse desktop** (Performance ≥ 95, A11y = 100, BP = 100, SEO = 100)
- [ ] **WebPageTest** Filmstrip — visual progress > 80% antes de 2.5s
- [ ] **axe DevTools** — 0 critical/serious issues
- [ ] **Validador de Rich Snippets** — Organization + Software + FAQPage OK
- [ ] **OG validator** (opengraph.xyz) — preview correto Slack/WhatsApp/Twitter
- [ ] **Mobile real** — testar em iPhone (Safari), Android (Chrome) em 3G simulado
- [ ] **Keyboard nav** — Tab até o footer funciona, com focus visível em todos os passos
- [ ] **Screen reader** (VoiceOver no Mac, NVDA no Windows) — H1 lido corretamente, FAQ navegável
- [ ] **`prefers-reduced-motion: reduce`** ativo — sem animações de loop em nenhuma seção

## 9. Definição de "pronto"

1. Todos os acceptance criteria marcados ✅
2. Pre-launch checklist 100% verde
3. PR aprovado por Gustavo após review
4. Deploy em produção sem regressão (smoke test em prod)
5. Documento `Kinevo_Landing_Analise_e_Plano.docx` referenciado e roadmap fechado

## 10. Pós-Fase 3 — backlog para próximas iterações

Quando essa fase fechar, o backlog para "next" inclui:

- **Migração completa pra dark mode** (componente por componente)
- **3 nomes para o assistente IA** (Pulso/Alma/Cobra) — se a hipótese se mantiver
- **Vídeo curto de 30s** no hero (depois de validar que mockup HTML não converte mais)
- **Página de cases** com 3-5 personals reais (após onboarding crescer)
- **Calculator avançado** com input de plano médio variável (não só fixo 350)
- **i18n EN-US** (se internacionalizar a oferta)
- **A/B test** de headline ("receba sem taxas" vs "0% de taxa Kinevo" vs "ganhe mais com cada aluno")

---

← Anterior: [Fase 2 — Apple Watch + Stripe + Sala de Treino](./02-fase-2-diferenciais.md)
→ Documento mãe: [`Kinevo_Landing_Analise_e_Plano.docx`](../../Kinevo_Landing_Analise_e_Plano.docx)
