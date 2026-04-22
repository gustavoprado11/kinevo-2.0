# Fase 1 — Hero + Assistente IA

> **Duração estimada:** 5–8 dias úteis
> **Arquivos tocados:** 3 (`landing-hero.tsx`, `landing-ai-assistant.tsx`, `globals.css`)
> **Risco:** baixo–médio (sem mudanças de schema, sem deps novas)
> **Dependências:** nenhuma

## 1. Objetivo

Os primeiros 1.5 viewports da landing precisam fazer 3 coisas:

1. **Em < 5 segundos**, o personal entende o que o Kinevo é (sistema completo) e o diferencial financeiro (0% taxa).
2. **Ver o produto trabalhando** sem precisar clicar — o dashboard replica atual já faz isso, mas precisa amadurecer (estados de scroll, segunda cena, e a IA agindo de verdade).
3. **A seção de IA precisa parar de "explicar IA"** e começar a mostrar a IA fazendo coisas concretas (3 cenas: detectar gap, prescrever, conversar).

## 2. Escopo

### Entra
- Hero com **2 cenas auto-rotativas** no dashboard replica (overview → IA respondendo)
- Sub-headline reposicionada com **prova quantitativa** (ex: "0% taxa Kinevo, +18 personal trainers no Brasil")
- CTA principal com **microcopy de baixo atrito** ("7 dias grátis, sem cartão")
- Assistente IA com **demos 3D-feel** (sombra, glow, depth) e tabs com **auto-cycle a cada 6s**
- Princípio "Você aprova tudo" elevado de chip rodapé pra **selo dentro do card**
- Skeleton states durante o lazy load do hero (evita flash branco)

### Não entra
- Trocar copy do Kinevo no produto interno
- Nomear o assistente (Pulso/Alma/Cobra fica para depois)
- Vídeo gravado de tela (evitar peso de MP4 — manter mockup HTML/CSS)
- Lottie / animações de personagem (manter Framer Motion + SVG)

## 3. Mudanças por arquivo

### 3.1 `web/src/components/landing/landing-hero.tsx` — rework

**Estado atual:** `LandingHero` exporta uma seção que renderiza um `DashboardReplica` em `iframe-frame` simulado. A animação faz `glow → opens assistant` em 4s e para. Headline = "Prescreva, acompanhe e receba sem taxas."

**Novas adições:**

```tsx
// Topo do arquivo
type HeroScene = 'overview' | 'assistant-acting'

// Dentro de DashboardReplica:
const [scene, setScene] = useState<HeroScene>('overview')

useEffect(() => {
  // Cena 1 (overview) por 4.5s → glow do botão Assistente
  // Cena 2 (assistant-acting) → painel abre + IA "digita" insights
  // Loop a cada 9s, com prefers-reduced-motion respeitado
  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return // sem auto-loop
  }

  const cycle = () => {
    setScene('overview')
    const t1 = setTimeout(() => setScene('assistant-acting'), 4500)
    const t2 = setTimeout(cycle, 9000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }
  return cycle()
}, [])
```

**O `AssistantPanel` ganha um segundo estado**: além da bolha "Vi que Matheus Henrique...", entra uma **animação de typing** (3 dots) seguida de uma resposta com 2 chips de ação clicáveis (não-funcionais — apenas visual). Ver `Motion specs` abaixo.

**Substituições de copy (Hero):**

| Elemento | De | Para |
|---|---|---|
| Badge | "50+ personal trainers no Brasil" | "Em uso por personal trainers no Brasil" *(sem número falso)* — ou manter número real |
| H1 linha 1 | "Prescreva, acompanhe" | manter |
| H1 linha 2 | "e receba sem taxas." | manter |
| Subhead | "O sistema completo para personal trainers — do programa ao pagamento." | "**Prescreva** programas em minutos, **acompanhe** quem treinou de verdade e **receba** sem taxa Kinevo. Tudo em um sistema só." |
| CTA primário | "Comece grátis" | "Comece grátis" *(manter)* — adicionar microcopy abaixo dos botões |
| Microcopy nova (abaixo dos CTAs) | (não existe) | "**7 dias grátis** &bull; **sem cartão de crédito** &bull; setup em 2 min" |
| Trust line atual | "7 dias grátis &bull; Setup em 2 min &bull; Cancele quando quiser" | **remover** — virou microcopy acima |

> ⚠️ **Sobre "50+ personal trainers"**: confirmar com Gustavo se o número é real. Se for menor, trocar por "Em uso por personal trainers no Brasil" (sem mentir nem subestimar).

**Cor de fundo:** o hero hoje usa `#FAFAFA`. Manter, mas adicionar uma **mesh gradient** mais rica usando 2 blobs animados:

```tsx
{/* Substitui os 2 blobs estáticos atuais */}
<motion.div
  animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
  transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
  className="absolute top-1/4 -left-40 w-96 h-96 bg-[#7C3AED]/[0.06] rounded-full blur-3xl"
/>
<motion.div
  animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
  transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
  className="absolute bottom-1/3 -right-40 w-80 h-80 bg-[#A855F7]/[0.06] rounded-full blur-3xl"
/>
```

**Browser frame:** trocar a barra de URL falsa de `app.kinevo.com.br` por `app.kinevo.com.br/dashboard` para bater com a tela mostrada.

**LCP guard:** o hero é a primeira coisa visível. Hoje está dentro de `dynamic(..., { ssr: false })`. Mudar para **`ssr: true`** apenas no Hero (deixar o resto como está):

```tsx
// page.tsx
const LandingHero = dynamic(
  () => import('@/components/landing/landing-hero').then(mod => mod.LandingHero),
  { loading: () => <div className="min-h-screen bg-[#FAFAFA]" /> }
  // sem ssr: false — Hero precisa estar no HTML inicial pro LCP
)
```

> O `framer-motion` já é puxado pelo Hero, então o impacto de bundle é zero — só ganhamos LCP.

### 3.2 `web/src/components/landing/landing-ai-assistant.tsx` — rework de copy + visual

**Estado atual:** 3 tabs (Monitoramento, Prescrição, Copiloto), troca manual via clique, demos visuais isoladas. Princípios "Você aprova tudo / Aprende seu estilo / Dados reais / Proativo" estão como chips no rodapé com `text-white/15` (quase invisível).

**Mudanças:**

#### a) Auto-cycle de tabs (com pausa em hover)
```tsx
useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const id = setInterval(() => {
    setActiveTab((i) => (i + 1) % tabs.length)
  }, 6000)
  return () => clearInterval(id)
}, [])

// pausar no hover do bento
const [paused, setPaused] = useState(false)
// envolver bento em onMouseEnter/Leave
```

> Se `paused === true`, não trocar tabs. Reset do interval quando o usuário clica manualmente.

#### b) Princípios viram **selos visíveis** dentro do card de demo

Hoje os 4 princípios (`Você aprova tudo / Aprende seu estilo / Dados reais / Proativo`) estão no rodapé com opacidade 25%. Mover **2 princípios contextuais por tab** pra dentro do header da demo direita:

```tsx
const tabPrinciples: Record<string, { icon: LucideIcon; label: string }[]> = {
  monitor: [
    { icon: Activity, label: 'Dados reais' },
    { icon: BellRing, label: 'Proativo' },
  ],
  prescribe: [
    { icon: Shield, label: 'Você aprova tudo' },
    { icon: Brain, label: 'Aprende seu estilo' },
  ],
  chat: [
    { icon: Activity, label: 'Dados reais' },
    { icon: Shield, label: 'Você aprova tudo' },
  ],
}

// renderizar ao lado do "● MONITORAMENTO" no header da demo
```

Aumentar opacidade dos selos pra `text-white/50` no label e `text-white/40` no ícone.

#### c) Tagline H2 — alinhar voz à do hero

```tsx
// De:
"IA que trabalha com você."
// Subtitle: "Inteligência artificial integrada ao sistema para ajudar..."

// Para:
"Uma IA que entende cada aluno seu."
// Subtitle: "Detecta gaps, sugere progressões e gera programas com base nos dados reais que você já alimenta no Kinevo. Você sempre aprova."
```

#### d) Featurelist — substituições

```tsx
const features: Record<string, string[]> = {
  monitor: [
    'Detecta gaps de treino antes da desistência',
    'Alerta quando o aluno reporta dor no check-in',
    'Aponta cargas estagnadas e prontas pra progredir',
    'Avisa programas vencendo em 7 dias',
  ],
  prescribe: [
    'Periodização real em 4 fases (não template genérico)',
    'Respeita restrições médicas e equipamentos disponíveis',
    'Aprende seu estilo após ~10 prescrições editadas',
    'Você revisa e ajusta tudo antes de chegar ao aluno',
  ],
  chat: [
    'Contexto completo do aluno em cada conversa',
    'Análise de aderência, carga e RPE com gráficos',
    'Gera novo programa direto no chat',
    'Respostas baseadas nos dados reais — não em achismo',
  ],
}
```

#### e) Demo direita — refinos visuais

- **Adicionar `shadow-2xl shadow-[color]/20`** no card direito (depth)
- **Inner glow** mais forte no topo: aumentar opacity de `30` para `60` no gradient horizontal do topo
- **MonitorDemo:** adicionar pequena timestamp `há 2h` em cinza no topo de cada item
- **PrescribeDemo:** após o card "Padrão aprendido", adicionar um botão fantasma `Aprovar e enviar` pra reforçar que o personal aprova
- **ChatDemo:** o último item (loading dots) deve **resolver para uma resposta** após 2s, formando um loop completo de pergunta-resposta-pergunta. Usar `useEffect` com `setInterval`.

### 3.3 `web/src/app/globals.css` — mínimas adições

Adicionar utilitários já reutilizáveis pelo Hero e seções futuras:

```css
/* No final do arquivo */

@layer utilities {
  .hero-mesh {
    background:
      radial-gradient(ellipse 60% 40% at 30% 20%, rgba(124, 58, 237, 0.08), transparent),
      radial-gradient(ellipse 50% 40% at 70% 60%, rgba(168, 85, 247, 0.06), transparent),
      #FAFAFA;
  }

  .lift-on-scroll {
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lift-on-scroll:hover { transform: translateY(-4px); }
}

/* Skeleton para o loading do hero */
@keyframes hero-skeleton {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.hero-skeleton {
  animation: hero-skeleton 1.4s ease-in-out infinite;
}
```

## 4. Copy final (pronto para colar)

### Hero

```
[Badge]      Em uso por personal trainers no Brasil
[H1]         Prescreva, acompanhe
             e receba sem taxas.
[Subhead]    Prescreva programas em minutos, acompanhe quem treinou de
             verdade e receba sem taxa Kinevo. Tudo em um sistema só.
[CTA 1]      Comece grátis →
[CTA 2]      Como funciona ▶
[Microcopy]  7 dias grátis  •  sem cartão de crédito  •  setup em 2 min
```

### Assistente IA — header

```
[H2]         Uma IA que entende cada aluno seu.
[Subhead]    Detecta gaps, sugere progressões e gera programas com base
             nos dados reais que você já alimenta no Kinevo. Você sempre
             aprova.
```

### Assistente IA — taglines por tab

```
monitor:    Vê tudo que está acontecendo. Avisa antes que vire problema.
prescribe:  Gera o esqueleto do programa. Você dá o acabamento.
chat:       Pergunte qualquer coisa sobre qualquer aluno. Resposta com dados.
```

### Assistente IA — princípios (mantém os 4, mas reposicionados)

```
Shield      → Você aprova tudo
Brain       → Aprende seu estilo
Activity    → Dados reais
BellRing    → Proativo
```

## 5. Motion specs

### Hero — auto-cycle do dashboard

| Momento | Ação | Duração | Easing |
|---|---|---|---|
| 0.0s | Cena `overview` carrega | 700ms | `[0.16, 1, 0.3, 1]` |
| 4.5s | Glow no botão "Assistente" | 1500ms | `easeOut` |
| 5.0s | Painel abre da direita | 350ms | `spring(350, 30)` |
| 5.4s | Bolha 1 do AI aparece | 400ms | `easeOut` |
| 6.0s | Chips de ação aparecem | 250ms | `easeOut` |
| 7.5s | Typing indicator aparece | 200ms | `easeOut` |
| 8.5s | Resposta final do AI | 350ms | `easeOut` |
| 9.0s | Reset → loop de novo | — | — |

> Tudo com `useReducedMotion()` curto-circuitando para versão estática (apenas cena 1, sem cycle).

### Assistente IA — auto-cycle de tabs

- Interval: 6s
- Pausa em `onMouseEnter`, retoma em `onMouseLeave`
- Click manual reseta o interval
- `layoutId="ai-tab"` (já existe) garante a transição smooth do background da pill

## 6. Acceptance criteria

### Hero
- [ ] H1 + subhead + CTAs visíveis em < 1s no desktop (sem `ssr: false`)
- [ ] Dashboard replica carrega depois (`useState(showDashboard)` mantém-se)
- [ ] Auto-cycle entre overview ↔ assistant-acting funciona em loop estável (sem flicker)
- [ ] `prefers-reduced-motion: reduce` desliga o cycle e mantém só a cena `overview`
- [ ] LCP no Lighthouse mobile ≥ 80
- [ ] Microcopy nova substitui a trust line antiga
- [ ] Hover no dashboard pausa o cycle

### Assistente IA
- [ ] Tabs trocam sozinhas a cada 6s
- [ ] Hover no card direito pausa o cycle (testar com `mouseenter`/`mouseleave` em ambos os cards)
- [ ] Click manual reseta o timer
- [ ] Selos de princípio (Shield, Brain, Activity, BellRing) aparecem dentro do header da demo direita com `text-white/50`
- [ ] ChatDemo faz loop completo: pergunta → typing → resposta → pergunta
- [ ] Copy nova aplicada em H2, subhead, taglines e features
- [ ] Os 4 chips do rodapé continuam existindo (defesa em profundidade — não remover)

### Cross-cutting
- [ ] Lighthouse Performance mobile ≥ 85
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Sem regressão visual em mobile (≤ 380px)
- [ ] `pnpm build` passa sem warnings novos
- [ ] Sem novos `'use client'` introduzidos onde não é necessário

## 7. Tarefas em ordem de execução

1. **Hero — copy + microcopy**: trocar textos, badge, microcopy. *~1h*
2. **Hero — `ssr: true`**: ajustar `page.tsx` e validar build. *~30min*
3. **Hero — mesh gradient animada**: substituir blobs estáticos. *~1h*
4. **Hero — segunda cena (`assistant-acting`)**: criar `useEffect` de loop, novo estado `scene`, bolha de typing + resposta. *~3-4h*
5. **Hero — `prefers-reduced-motion`**: testar via DevTools. *~30min*
6. **AI — auto-cycle de tabs com pausa em hover**. *~1.5h*
7. **AI — copy nova**: H2, subhead, taglines, features. *~1h*
8. **AI — princípios contextuais por tab**: estrutura `tabPrinciples`, render no header da demo. *~1.5h*
9. **AI — refinos visuais**: shadow-2xl, glow top, timestamp no MonitorDemo, botão "Aprovar e enviar" no PrescribeDemo, loop do ChatDemo. *~3h*
10. **globals.css**: utilitários novos. *~30min*
11. **QA**: Lighthouse, mobile real (iPhone safari), `prefers-reduced-motion`, hover/touch parity. *~2h*

**Total estimado: 14–18h** (2 dias úteis com refino).

## 8. Riscos & mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| LCP piorar com `ssr: true` no Hero | Média | Alto | Medir antes/depois com Lighthouse. Se piorar, manter `ssr: false` mas adicionar fallback estático com mesma headline. |
| Auto-cycle do dashboard parecer agressivo | Média | Médio | 9s é longo — em testes, validar com 2-3 personals reais. Pausar em hover. |
| Tabs do AI cycling chamar atenção demais e atrapalhar leitura | Baixa | Médio | Pausar agressivamente em hover. Usar 6s. Considerar parar o cycle após 2 voltas completas. |
| ChatDemo loop infinito custar bateria mobile | Baixa | Baixo | Pausar quando seção sair do viewport via `IntersectionObserver`. |
| Copy mais longa quebrar layout em telas estreitas | Média | Baixo | Subhead nova tem ~30 palavras (vs 14). Testar em 375px. Fallback: `max-w-xl` no subhead. |
| Animação do dashboard puxar performance | Baixa | Médio | Profiling com Chrome DevTools. Se framerate < 50fps em mobile mid-tier, reduzir opacidade dos blobs animados ou trocar `motion.div` por CSS `@keyframes`. |

## 9. Definição de "pronto"

Esta fase está pronta quando:

1. Todos os acceptance criteria estão marcados ✅
2. PR aprovado por Gustavo após review visual em desktop e mobile
3. Lighthouse mobile rodado em produção (vercel preview): Performance ≥ 85, Accessibility ≥ 95, SEO = 100
4. Nenhum erro novo no console de produção
5. Documento `Kinevo_Landing_Analise_e_Plano.docx` referenciado no PR description

---

→ Próxima fase: [Fase 2 — Apple Watch + Stripe + Sala de Treino](./02-fase-2-diferenciais.md)
