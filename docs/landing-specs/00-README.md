# Kinevo Landing — Specs de Implementação

> Plano executável para evoluir a landing atual rumo ao patamar de polish do
> [salte.app](https://salte.app), sem perder a identidade do Kinevo nem trocar
> o stack. Baseado no documento `Kinevo_Landing_Analise_e_Plano.docx`.

## Princípios

1. **Manter o stack atual.** Next.js 16 (App Router) + React 19 + Tailwind v4 + Framer Motion + Lucide. Nenhuma nova dependência sem justificativa explícita.
2. **Mostrar o produto trabalhando.** Toda promessa importante deve ter um mockup vivo (auto-play, tabs cycling, hover-driven). Texto serve só pra ancorar.
3. **Diferenciais como heróis.** IA com aprovação humana, **0% taxa Kinevo + Stripe (3,99% + R$ 0,50)**, App do aluno moderno, **Apple Watch nativo** e **Sala de Treino** ganham destaque dedicado.
4. **Performance é feature.** LCP < 2,5s, JS inicial sob controle, animações nunca bloqueiam scroll, acessibilidade WCAG AA.
5. **Assistente IA é entidade única** nesta versão (sem os 3 nomes propostos no doc — adiado).

## Estrutura final da landing (após as 3 fases)

| # | Seção | Estado | Fase |
|---|---|---|---|
| 0 | Navbar | mantém | — |
| 1 | Hero | **rework completo** | 1 |
| 2 | Social Proof (marquee) | mantém + leve ajuste | 1 |
| 3 | Problem | mantém | — |
| 4 | Assistente IA | **rework de copy + visual** | 1 |
| 5 | How It Works | mantém + ajuste de timeline | 2 |
| 6 | Pillars (Prescrição/Acompanhamento/Financeiro) | refino, virar âncora do Stripe | 2 |
| 7 | **Sala de Treino** (nova seção dedicada) | **criar** | 2 |
| 8 | **Stripe & Pagamentos** (nova seção dedicada) | **criar** | 2 |
| 9 | Student App | refino + reforçar Apple Watch | 2 |
| 10 | **Apple Watch** (nova seção dedicada) | **criar** | 2 |
| 11 | Testimonials | mantém | — |
| 12 | Pricing | **rework de calculadora + tabela** | 3 |
| 13 | FAQ | mantém + 4 perguntas novas | 3 |
| 14 | CTA Footer | mantém | — |

## Como ler cada spec

Cada spec segue o mesmo formato:

- **Objetivo** — o problema de negócio que a fase resolve
- **Escopo** — o que entra e o que fica de fora
- **Mudanças por arquivo** — paths reais, exports, deps adicionadas
- **Copy final** — texto pronto pra colar (sem placeholder)
- **Motion specs** — durações, easings, gatilhos
- **Acceptance criteria** — checklist objetivo de "pronto"
- **Riscos & mitigações** — o que pode quebrar e como evitar

## Convenções compartilhadas

### Cores (já no Tailwind via `globals.css`)

| Uso | Hex | Onde |
|---|---|---|
| Indigo Kinevo | `#7C3AED` / `#A855F7` | gradientes de marca, IA, prescrição |
| Azul Apple | `#007AFF` | acompanhamento, ações |
| Verde Apple | `#34C759` | financeiro, sucesso |
| Amber | `#FF9500` | alerta |
| Vermelho | `#FF3B30` | erro, destaque negativo |
| Tinta primária | `#1D1D1F` | texto, dark surface (`#0A0A0B`) |
| Texto secundário | `#6E6E73` / `#86868B` / `#AEAEB2` | hierarquia |
| Borda | `#E8E8ED` / `#D2D2D7` | hairlines |

### Tipografia

- Família única: `font-jakarta` (Plus Jakarta Sans, já configurada).
- Display: `text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]`
- Section title: `text-3xl md:text-5xl font-bold tracking-tight`
- Eyebrow: `text-xs font-semibold uppercase tracking-widest text-[#7C3AED]`
- Body: `text-sm md:text-base text-[#6E6E73] leading-relaxed`

### Motion vocabulary

| Token | Valor |
|---|---|
| `enter.fast` | `{ duration: 0.3, ease: 'easeOut' }` |
| `enter.std` | `{ duration: 0.5, ease: 'easeOut' }` |
| `enter.hero` | `{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }` |
| `tap` | `{ scale: 0.97 }` |
| `hover.subtle` | `{ scale: 1.04 }` |
| `spring.snappy` | `{ type: 'spring', stiffness: 400, damping: 30 }` |
| `viewport.std` | `{ once: true, margin: '-80px' }` |

> Não criar `framer-motion/variants` global — manter inline pra cada componente continuar legível em isolamento.

### Performance budget (orientativo)

- JS inicial (sem hero): ≤ 90 KB gzipped
- LCP em mobile mid-tier: ≤ 2.5s
- CLS: < 0.05
- Imagens hero: WebP/AVIF, `priority` só na 1ª (logo + hero mockup)

## Roadmap

| Fase | Conteúdo | Doc |
|---|---|---|
| 1 | Hero rework + Assistente IA rework | [`01-fase-1-hero-e-ia.md`](./01-fase-1-hero-e-ia.md) |
| 2 | Apple Watch + Stripe + Sala de Treino | [`02-fase-2-diferenciais.md`](./02-fase-2-diferenciais.md) |
| 3 | Pricing + FAQ + polish técnico | [`03-fase-3-pricing-faq-polish.md`](./03-fase-3-pricing-faq-polish.md) |

## Decisões adiadas (não fazer agora)

- **3 nomes para o assistente IA** (Pulso/Alma/Cobra) — exige refactor de copy em todo o produto, não só na landing. Reabrir após Fase 3.
- **Webcomponents shadow DOM** para o dashboard replica — overkill agora.
- **Internacionalização (i18n)** — landing é PT-BR only por enquanto.
- **A/B testing infra** — adiar até ter > 200 visitas/dia.
