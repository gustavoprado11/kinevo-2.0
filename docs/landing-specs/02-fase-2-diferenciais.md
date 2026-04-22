# Fase 2 — Apple Watch + Stripe + Sala de Treino

> **Duração estimada:** 6–10 dias úteis
> **Arquivos tocados:** 5 novos componentes + `page.tsx` + ajustes em `landing-pillars.tsx` e `landing-student-app.tsx`
> **Risco:** médio (3 seções novas, mas todas isoladas e sem dependências de back-end)
> **Dependências:** Fase 1 mergeada (não obrigatório, mas recomendado pra evitar conflito de copy)

## 1. Objetivo

A Fase 1 mostra **o que o Kinevo faz**. A Fase 2 mostra **por que o Kinevo é diferente**. Três coisas que nenhum concorrente direto entrega no Brasil:

1. **Apple Watch nativo** com HealthKit + WatchConnectivity — diferencial técnico real (já implementado em SwiftUI, ver `mobile/APPLE_WATCH.md`)
2. **Stripe com 0% taxa Kinevo** — a taxa do Stripe (3,99% + R$ 0,50 por transação nacional) é menor do que os 5–20% que outras plataformas cobram
3. **Sala de Treino em tempo real** — modo de acompanhamento múltiplo na academia, sem equivalente direto em Trainerize/TrueCoach

Cada um vira **uma seção dedicada**, não bullet enterrado em pillars.

## 2. Escopo

### Entra
- Componente novo: `landing-apple-watch.tsx`
- Componente novo: `landing-stripe.tsx`
- Componente novo: `landing-sala-de-treino.tsx`
- Ajuste em `landing-pillars.tsx`: pilar "Financeiro" vira **link/scroll** para nova seção Stripe
- Ajuste em `landing-student-app.tsx`: remover "Apple Watch" das pills (vai virar seção própria), substituir por outra feature
- Ajuste em `page.tsx`: inserir 3 seções nas posições corretas do flow

### Não entra
- Vídeo gravado de Watch (manter mockup SVG/CSS)
- Integração de tracking real do Stripe (apenas visual)
- Live data da Sala de Treino (mockup com `setInterval` para simular updates)
- Animações 3D / WebGL — manter Framer + SVG

## 3. Posicionamento na landing

```
0. Navbar
1. Hero
2. Social Proof
3. Problem
4. Assistente IA
5. How It Works
6. Pillars  ←  pilar "Financeiro" deep-links pra #stripe
7. ★ Sala de Treino     ← NOVA
8. ★ Stripe & Pagamentos ← NOVA
9. Student App
10. ★ Apple Watch       ← NOVA
11. Testimonials
12. Pricing
13. FAQ
14. CTA Footer
```

**Justificativa do ordering:**
- **Sala de Treino** logo após Pillars: a feature complementa "Acompanhamento" e dá contexto antes de Pagamentos.
- **Stripe** logo depois: encerra o lado "B" (ferramenta do treinador).
- **Student App + Apple Watch** ficam juntos: ambos são lado "B do aluno", e o Watch é uma extensão natural do app mobile.

## 4. Mudanças por arquivo

### 4.1 `web/src/components/landing/landing-apple-watch.tsx` — NOVO

**Estrutura visual** (dark, segue padrão do `landing-ai-assistant`):

```
┌─────────────────────────────────────────────────────┐
│ [Eyebrow: APPLE WATCH NATIVO]                       │
│                                                     │
│ H2: O treino na cara do                             │
│     pulso do seu aluno.                             │
│ Sub: Watch app nativo com HealthKit, controle de    │
│      séries e timer. Sem precisar de iPhone na mão. │
│                                                     │
│   ┌─────────────────┐    ┌──────────────────────┐  │
│   │  [Watch mockup] │    │ • Frequência cardíaca│  │
│   │  com tela do    │    │   em tempo real      │  │
│   │  treino + HR    │    │ • Marcar sets sem    │  │
│   │  pulsando       │    │   tirar do bolso     │  │
│   │                 │    │ • Timer de descanso  │  │
│   │                 │    │   com háptico        │  │
│   └─────────────────┘    │ • Sync via Watch     │  │
│                          │   Connectivity        │  │
│                          └──────────────────────┘  │
│                                                     │
│ Selo: "Não é uma extensão do iPhone — é um app     │
│        Watch nativo de verdade."                    │
└─────────────────────────────────────────────────────┘
```

**Implementação:**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Heart, CheckCircle, Timer, Zap } from 'lucide-react'

const features = [
  { icon: Heart, label: 'Frequência cardíaca em tempo real', detail: 'HealthKit + HKWorkoutSession' },
  { icon: CheckCircle, label: 'Marcar sets sem tirar do bolso', detail: 'Tap no pulso, sync automático' },
  { icon: Timer, label: 'Timer de descanso com háptico', detail: 'Sente quando o tempo acaba' },
  { icon: Zap, label: 'Sync via WatchConnectivity', detail: 'Bidirecional, em background' },
]

export function LandingAppleWatch() {
  return (
    <section id="apple-watch" className="relative bg-[#0A0A0B] py-24 md:py-32 overflow-hidden">
      {/* mesh gradient discreta */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(255,59,48,0.05),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#FF3B30]/70">
            Apple Watch nativo
          </span>
          <h2 className="font-jakarta text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mt-4 leading-[1.05]">
            O treino na{' '}
            <span className="bg-gradient-to-r from-[#FF3B30] to-[#FF9500] bg-clip-text text-transparent">
              cara do pulso
            </span>{' '}
            do seu aluno.
          </h2>
          <p className="font-jakarta text-base md:text-lg text-white/35 mt-5 max-w-xl mx-auto">
            Watch app nativo com HealthKit, controle de séries e timer.
            Sem precisar de iPhone na mão.
          </p>
        </motion.div>

        {/* 2 colunas: mockup + features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-5xl mx-auto">
          {/* Watch mockup — SVG/HTML, sem imagem PNG */}
          <WatchMockup />

          {/* Features */}
          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-start gap-4 bg-white/[0.02] border border-white/[0.05] rounded-xl p-5"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FF3B30]/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-[#FF3B30]/80" />
                </div>
                <div>
                  <p className="font-jakarta text-sm md:text-base font-semibold text-white/85">
                    {f.label}
                  </p>
                  <p className="font-jakarta text-xs text-white/30 mt-0.5">
                    {f.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Selo final */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="font-jakarta text-sm text-white/30 text-center mt-14 max-w-md mx-auto italic"
        >
          Não é uma extensão do iPhone — é um app Watch nativo de verdade.
        </motion.p>
      </div>
    </section>
  )
}
```

**`WatchMockup` (subcomponente):**

Subcomponente que desenha um Apple Watch em SVG com tela renderizada em HTML/CSS por cima. A tela mostra:

```
┌─────────────────────┐
│ ❤️ 142 bpm    14:23 │
│                     │
│ Supino reto         │
│ ━━━━━━━━━━━━━━━━━━ │
│ 3/4  •  72.5kg      │
│                     │
│ ┌───────────────┐   │
│ │  ✓ Marcar set │   │
│ └───────────────┘   │
│                     │
│ ⏱ Descanso 1:30     │
└─────────────────────┘
```

- Frequência cardíaca pulsa: `motion.span` com `scale: [1, 1.1, 1]`, infinite, 1.2s
- Set counter avança a cada 4s (3/4 → 4/4 → "✓ Concluído!" → reset)
- Timer descontando real (1:30 → 1:29 → ...)

> Usar `aspect-square` + `border-radius: 38%` (Apple Watch S9 ratio) + `bg-[#0F0F10]` para a moldura preta. Tela interna em `bg-black`. Tudo dimensionado em `vmin` para responsividade.

### 4.2 `web/src/components/landing/landing-stripe.tsx` — NOVO

**Estrutura:**

```
┌─────────────────────────────────────────────────────┐
│ [Eyebrow: PAGAMENTOS]                               │
│                                                     │
│ H2: 0% taxa Kinevo.                                 │
│     Você fica com seu dinheiro.                     │
│ Sub: Cobramos só o plano. As taxas são as do        │
│      próprio Stripe — as mesmas que qualquer        │
│      gateway profissional cobra.                    │
│                                                     │
│ ┌──────────────────────────────────────────────┐   │
│ │ COMPARATIVO LADO A LADO                       │   │
│ │                                                │   │
│ │  ┌─Outras plataformas─┐  ┌─Kinevo─────────┐  │   │
│ │  │ Mensalidade  R$ 99 │  │ Mensalidade R$39│  │   │
│ │  │ + Taxa     10-20%  │  │ + Taxa Kinevo 0%│  │   │
│ │  │ + Stripe   3,99%+50¢│ │ + Stripe 3,99%+50¢│ │   │
│ │  │                    │  │                  │  │   │
│ │  │ R$ 5.250 cobrados  │  │ R$ 5.250 cobrados│  │   │
│ │  │ → Você recebe       │  │ → Você recebe    │  │   │
│ │  │   R$ 4.235          │  │   R$ 5.025       │  │   │
│ │  └────────────────────┘  └──────────────────┘  │   │
│ │                                                │   │
│ │   Diferença: +R$ 790 por mês no seu bolso     │   │
│ └──────────────────────────────────────────────┘   │
│                                                     │
│ [3 selos]                                           │
│ • Stripe oficial    • PIX, cartão, boleto          │
│ • Recorrência ✓     • Bloqueio inadimplência       │
└─────────────────────────────────────────────────────┘
```

**Pontos críticos:**

- **Não chamar de "calculadora"** (já existe a calculadora simples no Pricing). Aqui é um **comparativo lado-a-lado fixo** com cenário "15 alunos × R$ 350" — número plausível de personal médio.
- **Mostrar a quebra completa**: receita bruta → menos taxa Kinevo → menos taxa Stripe → líquido. Em vermelho a perda do concorrente, em verde a economia.
- **Citar Stripe pelo nome** dá credibilidade. Evitar "gateway internacional" (vago).

**Cálculo de exemplo (hardcoded — nada dinâmico aqui):**

| Item | Outras plataformas | Kinevo |
|---|---|---|
| 15 alunos × R$ 350 (bruto) | R$ 5.250 | R$ 5.250 |
| Taxa da plataforma (10%) | -R$ 525 | -R$ 0 |
| Taxa Stripe (3,99% + R$ 0,50 × 15) | -R$ 209,50 + R$ 7,50 | -R$ 209,50 + R$ 7,50 |
| **Líquido** | **R$ 4.508** | **R$ 5.033** |
| Diferença mensal | — | **+R$ 525** |
| Diferença anual | — | **+R$ 6.300** |

> Os 10% são uma média conservadora — algumas plataformas cobram 7%, outras 20%. Manter "10–20%" no badge de cima da coluna esquerda, mas calcular com 10% para não parecer exagero.

**Implementação resumida:**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Check, X, Lock, CreditCard, Repeat, ShieldCheck } from 'lucide-react'

const STRIPE_RATE = 0.0399
const STRIPE_FIXED = 0.50
const COMPETITOR_RATE = 0.10
const STUDENTS = 15
const PRICE = 350

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const gross = STUDENTS * PRICE                              // 5250
const stripeFee = gross * STRIPE_RATE + STRIPE_FIXED * STUDENTS  // 209.50 + 7.50
const competitorFee = gross * COMPETITOR_RATE                // 525
const netCompetitor = gross - competitorFee - stripeFee     // 4508
const netKinevo = gross - stripeFee                          // 5033
const monthlyDiff = netKinevo - netCompetitor                // 525
const yearlyDiff = monthlyDiff * 12                          // 6300

export function LandingStripe() {
  return (
    <section id="stripe" className="bg-white py-24 md:py-32">
      {/* ... header com eyebrow PAGAMENTOS, H2 e subhead ... */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
        {/* Card vermelho: outras plataformas */}
        <ComparisonCard
          variant="bad"
          title="Outras plataformas"
          rows={[
            { label: '15 alunos × R$ 350', value: formatBRL(gross) },
            { label: 'Taxa da plataforma (10%)', value: `-${formatBRL(competitorFee)}`, negative: true },
            { label: 'Taxa Stripe (3,99% + R$ 0,50)', value: `-${formatBRL(stripeFee)}` },
          ]}
          totalLabel="Você recebe"
          totalValue={formatBRL(netCompetitor)}
        />

        {/* Card verde: Kinevo */}
        <ComparisonCard
          variant="good"
          title="Kinevo"
          rows={[
            { label: '15 alunos × R$ 350', value: formatBRL(gross) },
            { label: 'Taxa Kinevo', value: '0%', highlight: true },
            { label: 'Taxa Stripe (3,99% + R$ 0,50)', value: `-${formatBRL(stripeFee)}` },
          ]}
          totalLabel="Você recebe"
          totalValue={formatBRL(netKinevo)}
        />
      </div>

      {/* Diferença em destaque */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mt-8 max-w-md mx-auto text-center bg-[#34C759]/8 border border-[#34C759]/20 rounded-2xl py-6 px-8"
      >
        <p className="font-jakarta text-xs uppercase tracking-widest text-[#34C759]/70 font-semibold">
          Diferença a seu favor
        </p>
        <p className="font-jakarta text-3xl md:text-4xl font-extrabold text-[#34C759] mt-2">
          +{formatBRL(monthlyDiff)}/mês
        </p>
        <p className="font-jakarta text-sm text-[#6E6E73] mt-1">
          {formatBRL(yearlyDiff)} a mais no seu bolso por ano
        </p>
      </motion.div>

      {/* Trust strip */}
      <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3">
        {[
          { icon: ShieldCheck, label: 'Processamento Stripe oficial' },
          { icon: CreditCard, label: 'PIX, cartão e boleto' },
          { icon: Repeat, label: 'Recorrência automática' },
          { icon: Lock, label: 'Bloqueio por inadimplência' },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-2">
            <t.icon className="w-4 h-4 text-[#86868B]" />
            <span className="font-jakarta text-xs text-[#6E6E73]">{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

**`ComparisonCard`** é um subcomponente local: card branco em variante `bad` (header vermelho-suave) ou `good` (header verde-suave), lista de rows, total em bold no rodapé.

### 4.3 `web/src/components/landing/landing-sala-de-treino.tsx` — NOVO

**Estrutura:**

```
┌─────────────────────────────────────────────────────┐
│ [Eyebrow: SALA DE TREINO]                           │
│                                                     │
│ H2: Acompanhe 5 alunos de uma vez,                  │
│     na academia ou online.                          │
│ Sub: Modo presencial em tempo real. Você vê o que   │
│      cada aluno está fazendo agora — sem precisar   │
│      olhar 5 celulares.                             │
│                                                     │
│ ┌─Mockup de Sala de Treino────────────────────────┐│
│ │ ┌──Aluno 1───┐ ┌──Aluno 2───┐ ┌──Aluno 3───┐    ││
│ │ │ 📍 Maria    │ │ 📍 João     │ │ 📍 Ana     │   ││
│ │ │ Supino 4/4  │ │ Agacha 2/3  │ │ ⏸ Descanso │  ││
│ │ │ ❤ 138 bpm   │ │ ❤ 152 bpm   │ │ 0:48        │ ││
│ │ │ 12kg x 10   │ │ 60kg x 8    │ │             │ ││
│ │ └─────────────┘ └─────────────┘ └─────────────┘  ││
│ │                                                   ││
│ │ ┌──Aluno 4───┐ ┌──Aluno 5───┐                    ││
│ │ │ 📍 Pedro    │ │ ⚠️ Lucas    │                    ││
│ │ │ Rosca 3/4   │ │ Reportou dor│                    ││
│ │ │ ❤ 128 bpm   │ │ ombro D     │                    ││
│ │ └─────────────┘ └─────────────┘                    ││
│ └───────────────────────────────────────────────────┘│
│                                                     │
│ [3 use cases em cards]                              │
│ Online: dashboard de aderência                      │
│ Presencial: 5 alunos, 1 tela                        │
│ Híbrido: alterna em 1 clique                        │
└─────────────────────────────────────────────────────┘
```

**Pontos críticos:**

- Cards animam: HR muda a cada 2s, set counter incrementa, alguém termina exercício e vira para o próximo.
- Card do "Lucas" (alerta) **fica com borda amber** e o texto pulsa — esse é o ponto de venda: "você vê quem precisa de você".

**Implementação resumida:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Heart, AlertTriangle, Pause } from 'lucide-react'

type StudentLive = {
  name: string
  status: 'training' | 'resting' | 'alert'
  exercise?: string
  set?: string
  weight?: string
  hr?: number
  alert?: string
  restTimer?: string
}

function useLiveStudents() {
  const [students, setStudents] = useState<StudentLive[]>([
    { name: 'Maria', status: 'training', exercise: 'Supino', set: '3/4', weight: '12kg × 10', hr: 138 },
    { name: 'João', status: 'training', exercise: 'Agachamento', set: '2/3', weight: '60kg × 8', hr: 152 },
    { name: 'Ana', status: 'resting', restTimer: '0:48' },
    { name: 'Pedro', status: 'training', exercise: 'Rosca', set: '3/4', weight: '8kg × 12', hr: 128 },
    { name: 'Lucas', status: 'alert', alert: 'Reportou dor — ombro D' },
  ])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setStudents((prev) => prev.map((s) =>
        s.status === 'training'
          ? { ...s, hr: Math.max(110, Math.min(165, s.hr! + (Math.random() < 0.5 ? -2 : 2))) }
          : s.status === 'resting'
          ? { ...s, restTimer: tickDown(s.restTimer!) }
          : s
      ))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return students
}

function tickDown(t: string): string {
  const [m, s] = t.split(':').map(Number)
  const total = Math.max(0, m * 60 + s - 2)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function LandingSalaDeTreino() {
  const students = useLiveStudents()

  return (
    <section id="sala-de-treino" className="bg-[#F5F5F7] py-24 md:py-32">
      {/* header */}

      {/* mockup */}
      <div className="mt-12 max-w-5xl mx-auto rounded-2xl bg-white border border-[#E8E8ED] shadow-xl shadow-black/5 p-6">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E8E8ED]">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[#34C759] opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-[#34C759]" />
            </span>
            <span className="font-jakarta text-xs font-semibold text-[#1D1D1F]">5 alunos treinando agora</span>
          </div>
          <span className="font-jakarta text-xs text-[#86868B]">Sábado, 14:23</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {students.map((s) => <StudentCard key={s.name} student={s} />)}
        </div>
      </div>

      {/* 3 use cases */}
      {/* ... */}
    </section>
  )
}
```

**`StudentCard`** desenha um card com:
- header: 📍 nome + indicador de modo (treinando/descanso/alerta)
- body conforme o status
- borda colorida: `border-[#34C759]/20` (treinando), `border-[#007AFF]/20` (descanso), `border-[#FF9500]/40` + `animate-pulse` (alerta)

### 4.4 `web/src/components/landing/landing-pillars.tsx` — ajuste

**Mudança única**: o pilar `financeiro` ganha um **botão "Ver detalhes"** que rola pra `#stripe`. Adicionar logo abaixo da lista de bullets quando `activePillar.id === 'financeiro'`:

```tsx
{activePillar.id === 'financeiro' && (
  <a
    href="#stripe"
    className="inline-flex items-center gap-1.5 mt-6 font-jakarta text-sm font-semibold text-[#34C759] hover:underline"
  >
    Ver detalhes da economia →
  </a>
)}
```

### 4.5 `web/src/components/landing/landing-student-app.tsx` — ajuste

**Mudança única**: remover `Apple Watch` da lista `features` (ele agora é seção própria), substituir por outra feature relevante:

```tsx
// Antes:
{ icon: Watch, label: 'Apple Watch' },

// Depois:
{ icon: Bell, label: 'Push notifications' },
// (importar Bell de lucide-react)
```

### 4.6 `web/src/app/page.tsx` — inserir 3 seções

```tsx
// Adicionar imports dinâmicos (mesmo padrão das demais)
const LandingSalaDeTreino = dynamic(
  () => import('@/components/landing/landing-sala-de-treino').then(m => m.LandingSalaDeTreino),
  { loading: () => <div className="h-96" />, ssr: false }
)
const LandingStripe = dynamic(
  () => import('@/components/landing/landing-stripe').then(m => m.LandingStripe),
  { loading: () => <div className="h-96" />, ssr: false }
)
const LandingAppleWatch = dynamic(
  () => import('@/components/landing/landing-apple-watch').then(m => m.LandingAppleWatch),
  { loading: () => <div className="h-96" />, ssr: false }
)

// Inserir no <main> nas posições corretas:
<main>
  <LandingHero />
  <LandingSocialProof />
  <LandingProblem />
  <div id="assistente-ia">
    <LandingAiAssistant />
  </div>
  <div id="como-funciona">
    <LandingHowItWorks />
    <LandingPillars />
  </div>
  <LandingSalaDeTreino />        {/* ← novo */}
  <LandingStripe />               {/* ← novo */}
  <div id="app-aluno">
    <LandingStudentApp />
  </div>
  <LandingAppleWatch />          {/* ← novo */}
  <LandingTestimonials />
  <div id="precos">
    <LandingPricing />
  </div>
  <div id="faq">
    <LandingFaq />
  </div>
</main>
```

> O `id="apple-watch"` e `id="stripe"` ficam dentro dos próprios componentes (já no spec acima), evitando uma `<div>` extra.

### 4.7 `navbar.tsx` — adicionar 1 link

```tsx
const navLinks = [
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'App do Aluno', href: '#app-aluno' },
  { label: 'Apple Watch', href: '#apple-watch' },   // ← novo
  { label: 'Assistente IA', href: '#assistente-ia' },
  { label: 'Preços', href: '#precos' },
  { label: 'FAQ', href: '#faq' },
]
```

> Em mobile, `Apple Watch` cabe no menu; em desktop com 6 itens, validar se ainda cabe na navbar `max-w-7xl` — se ficar apertado, remover `Assistente IA` da navbar (ele tem destaque visual próprio).

## 5. Copy final (pronto para colar)

### Apple Watch
```
[Eyebrow]   APPLE WATCH NATIVO
[H2]        O treino na cara do pulso do seu aluno.
[Subhead]   Watch app nativo com HealthKit, controle de séries e timer.
            Sem precisar de iPhone na mão.
[Feature 1] Frequência cardíaca em tempo real
            └─ HealthKit + HKWorkoutSession
[Feature 2] Marcar sets sem tirar do bolso
            └─ Tap no pulso, sync automático
[Feature 3] Timer de descanso com háptico
            └─ Sente quando o tempo acaba
[Feature 4] Sync via WatchConnectivity
            └─ Bidirecional, em background
[Selo]      Não é uma extensão do iPhone — é um app Watch nativo de verdade.
```

### Stripe
```
[Eyebrow]   PAGAMENTOS
[H2]        0% taxa Kinevo. Você fica com seu dinheiro.
[Subhead]   Cobramos só o plano. As taxas são as do próprio Stripe —
            as mesmas que qualquer gateway profissional cobra.

[Card vermelho — Outras plataformas]
  15 alunos × R$ 350         R$ 5.250
  Taxa da plataforma (10%)   -R$ 525
  Taxa Stripe (3,99% + R$ 0,50)   -R$ 217
  ──────────────────────────────────────
  Você recebe                R$ 4.508

[Card verde — Kinevo]
  15 alunos × R$ 350         R$ 5.250
  Taxa Kinevo                0%
  Taxa Stripe (3,99% + R$ 0,50)   -R$ 217
  ──────────────────────────────────────
  Você recebe                R$ 5.033

[Destaque]  Diferença a seu favor: +R$ 525/mês
            R$ 6.300 a mais no seu bolso por ano

[Trust strip]
  • Processamento Stripe oficial
  • PIX, cartão e boleto
  • Recorrência automática
  • Bloqueio por inadimplência
```

### Sala de Treino
```
[Eyebrow]   SALA DE TREINO
[H2]        Acompanhe 5 alunos de uma vez, na academia ou online.
[Subhead]   Modo presencial em tempo real. Você vê o que cada aluno
            está fazendo agora — sem precisar olhar 5 celulares.

[Use case 1] Online
             Dashboard de aderência por aluno, com streaks e alertas.
[Use case 2] Presencial
             5 alunos, 1 tela. HR, série atual e tempo de descanso.
[Use case 3] Híbrido
             Alterna em 1 clique. O mesmo aluno na academia ou em casa.
```

## 6. Motion specs

### Apple Watch
- HR pulse: `scale: [1, 1.1, 1]`, 1.2s, infinite, `easeInOut` (sincronizado com bpm visível, ~120 bpm)
- Set counter: `setInterval` 4s — `3/4 → 4/4 → ✓ Concluído → reset` em 12s total
- Timer descontando: `setInterval` 1s — `1:30 → 1:29 → ...` reset aos 0:00

### Stripe
- Cards entram com stagger `[0, 0.15]` em `whileInView`
- Card "Diferença a seu favor": `initial={{ opacity: 0, scale: 0.95 }}`, `whileInView={{ opacity: 1, scale: 1 }}`, `delay: 0.4`
- Hover nos cards: `translateY(-4px)` (já no `lift-on-scroll` do globals.css)

### Sala de Treino
- HR muda a cada 2s (random walk de ±2 bpm, clamp 110-165)
- Rest timer desconta 2s a cada 2s
- Card de alerta: `animate-pulse` na borda + texto bold

> Todos respeitam `prefers-reduced-motion: reduce` — quando ativo, valores ficam estáticos.

## 7. Acceptance criteria

### Geral
- [ ] 3 novas seções renderizando sem erro
- [ ] Navbar atualizada com link `Apple Watch` (ou removido `Assistente IA` se não couber)
- [ ] Pilar Financeiro tem CTA "Ver detalhes" linkando pra `#stripe`
- [ ] `Apple Watch` removido das pills do `landing-student-app`
- [ ] Lighthouse mobile ≥ 80 mantido
- [ ] `pnpm build` passa sem warnings

### Apple Watch
- [ ] Mockup SVG/HTML do Watch renderiza em proporção correta
- [ ] HR pulsa em loop estável
- [ ] Set counter cicla
- [ ] Timer desconta
- [ ] Selo "não é extensão" presente no rodapé
- [ ] Cor de destaque é `#FF3B30` (vermelho Apple — não roxo)

### Stripe
- [ ] **Cálculos batem com a fórmula** (validar manualmente):
  - Bruto: 15 × 350 = R$ 5.250 ✓
  - Stripe: 5250 × 0,0399 + 0,50 × 15 = 209,475 + 7,50 ≈ R$ 217 ✓
  - Outros: 5250 × 0,10 = R$ 525 ✓
  - Líquido outros: 5250 - 525 - 217 = R$ 4.508 ✓
  - Líquido Kinevo: 5250 - 217 = R$ 5.033 ✓
  - Diferença: R$ 525/mês, R$ 6.300/ano ✓
- [ ] Taxa Stripe formatada como "3,99% + R$ 0,50"
- [ ] Trust strip com 4 selos
- [ ] Cards lado-a-lado em desktop, empilhados em mobile

### Sala de Treino
- [ ] 5 cards de aluno em grid 2 cols (mobile) / 3 cols (desktop)
- [ ] Pelo menos 1 card em estado `alert` com borda amber + pulse
- [ ] Pelo menos 1 card em estado `resting` com timer descontando
- [ ] HR atualiza a cada 2s sem reflow do card
- [ ] Header "5 alunos treinando agora" com dot verde pulsando

## 8. Tarefas em ordem de execução

1. **Stripe section — versão estática** (sem animação): copy + comparison cards + trust strip. *~3h*
2. **Stripe — validar cálculos** com calculadora à parte. *~30min*
3. **Stripe — animações de entrada** (stagger + diferença). *~1h*
4. **Sala de Treino — versão estática** com 5 cards mockados. *~2h*
5. **Sala de Treino — `useLiveStudents` hook** com setInterval. *~1.5h*
6. **Sala de Treino — variantes de card por status**. *~2h*
7. **Apple Watch — `WatchMockup` SVG/HTML**. *~3h*
8. **Apple Watch — animações** (HR pulse, set counter, timer). *~2h*
9. **Apple Watch — features list + selo**. *~1h*
10. **`page.tsx` — inserir 3 seções no flow**. *~30min*
11. **Pillars — botão "Ver detalhes" pro Stripe**. *~30min*
12. **Student App — remover Watch das pills**. *~15min*
13. **Navbar — adicionar Apple Watch**. *~30min*
14. **QA**: smooth scroll entre seções, anchors, mobile real, `prefers-reduced-motion`. *~3h*

**Total estimado: 20–24h** (3 dias úteis com refino).

## 9. Riscos & mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cálculos do Stripe ficarem desatualizados | Média | Alto | Hardcode de constantes no topo do arquivo (`STRIPE_RATE`, `STRIPE_FIXED`). Comentar com link pra https://stripe.com/br/pricing. Adicionar TODO de revalidar a cada 6 meses. |
| Personal achar agressivo o "10% concorrente" | Média | Médio | Manter "10–20%" no badge da coluna esquerda (não esconder o range). Se reclamarem, baixar para 7%. |
| Mockup do Watch ficar genérico | Alta | Médio | Investir tempo no SVG: respeitar curvature (38% border-radius), digital crown à direita, tela em `bg-black`, fonte SF Pro mock. Validar com Gustavo. |
| Sala de Treino com 5 cards ficar pesado em mobile | Média | Médio | Em telas < 640px, mostrar só 3 cards (Maria, Ana, Lucas — os 3 estados representativos). Fade-out nos outros 2. |
| Auto-update da Sala drenar bateria | Baixa | Baixo | Pausar quando seção sai do viewport via `IntersectionObserver`. |
| Anchors `#stripe` e `#apple-watch` quebrarem com scroll-padding | Baixa | Baixo | Adicionar `scroll-margin-top: 80px` (= altura da navbar) no `<section>` de cada um. |
| Navbar com 6 links ficar apertada em desktop ≤ 1024px | Média | Baixo | Esconder `Assistente IA` em telas < 1280px (`lg:flex hidden xl:inline-block`). |

## 10. Definição de "pronto"

1. Todos os acceptance criteria marcados ✅
2. Stripe — cálculos validados em calculadora externa
3. Apple Watch — mockup aprovado por Gustavo (screenshot anexado no PR)
4. Sala de Treino — testada em iPhone real (Safari mobile)
5. Lighthouse mobile rodado em vercel preview: Performance ≥ 80
6. Sem novos erros no console em produção

---

← Anterior: [Fase 1 — Hero + Assistente IA](./01-fase-1-hero-e-ia.md)
→ Próxima: [Fase 3 — Pricing, FAQ, polish](./03-fase-3-pricing-faq-polish.md)
