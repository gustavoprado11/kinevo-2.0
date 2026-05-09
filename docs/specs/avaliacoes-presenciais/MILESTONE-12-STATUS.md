# Milestone 12 — Visual Coherence (web Avaliações ↔ Formulários) — STATUS

**Data:** 2026-05-09
**Branch:** sem branch — commit direto em `main` (hotfix-style)
**Spec:** [`12-milestone-12-visual-coherence.md`](./12-milestone-12-visual-coherence.md)

**Status:** ✅ COMPLETO — alinhamento visual entre `/avaliacoes` e `/forms` com identidade de cor (D1) preservada.

---

## Sumário

User flagou que apesar da decisão D1 do workshop (azul para Formulários, violet para Avaliações) ter sido aplicada, as duas telas ainda pareciam "produtos diferentes". A divergência ia além de cor: shape do CTA primário, estado dos filter chips, hierarquia de seções, estrutura dos cards e tokens de cor light mode.

M12 espelha estrutura visual de `/forms` em `/avaliacoes` — tudo que não é cor passa a ser literal. Identidade D1 mantida.

Entregue num único bloco em `main`. Sem mudança de DB. Sem novas server actions. Sem novas Edge Functions. Web only.

---

## Antes vs. depois

### Antes (pré-M12)

| Elemento | `/forms` (azul) | `/avaliacoes` (violet) |
|---|---|---|
| CTA primário | rounded-full azul | rounded-full violet (tom 500/600) |
| Filter chip ativo | preenchido azul + branco (light) | outlined violet em ambos modos |
| Filter chips position | dentro do header de "Todas as Respostas" | linha solta acima da lista |
| Wrapper de section | `bg-white border-[#D2D2D7]` (light) | `bg-surface-card` (só dark tokens) |
| Card item | inline 8x8 avatar com light tokens | 9x9 avatar só com dark tokens — genérico em light |
| Callout urgente | "Aguardando Feedback" laranja pulsante quando count > 0 | nenhum |
| Callout secundário | "Enviados pendentes" violet quando count > 0 | nenhum |

### Depois (pós-M12)

| Elemento | `/forms` (azul) | `/avaliacoes` (violet) |
|---|---|---|
| CTA primário | rounded-full azul | rounded-full violet-600/500 |
| Filter chip ativo | preenchido azul + branco (light) / outlined dark | preenchido violet + branco (light) / outlined dark |
| Filter chips position | dentro do header de "Todas as Respostas" | dentro do header de "Todas as avaliações" |
| Wrapper de section | `bg-white border-[#D2D2D7]` | idem |
| Card item | inline 8x8 avatar com light tokens | 8x8 avatar com light tokens (`SessionListItem` reescrito) |
| Callout urgente | "Aguardando Feedback" laranja pulsante | "Em atraso" vermelho pulsante quando overdue > 0 |
| Callout secundário | "Enviados pendentes" violet | "Próximas" violet quando scheduled em [now, now+7d] (cap estrito) |

Sidebar intocado — `/forms` e `/avaliacoes` já tinham padrões paralelos (background `/10` + bullet vertical colorida). Spec sugeria "background violet cheio" mas o padrão real do `/forms` é `/10`, então paridade ganhou da letra do spec.

---

## Decisões tomadas durante o bloco

### D-M12-1: Sidebar não muda

Spec pedia "background violet cheio" no item Avaliações ativo. Mas o `/forms` real usa `bg-[#007AFF]/10` (não cheio) + barra esquerda colorida. Para preservar paridade, mantivemos o padrão `/forms` em ambos. Spec foi escrito antes de revisar o código real.

### D-M12-2: Filter chip "Próximas" amplo, callout "Próximas" estrito (≤7d)

O filter chip "Próximas" mantém comportamento amplo (todas scheduled futuras + in_progress) — é navegação. O **callout** "Próximas" usa cap estrito `[now, now+7d]` — é sinal de urgência. Dois conceitos, dois recortes.

### D-M12-3: Sem extração de componentes shared

`/forms` usa classes Tailwind hardcoded inline em todo o dashboard. Extrair `<PrimaryCTA>`, `<FilterChip>`, `<CalloutSection>` exigiria refactor cross-file. Spec 3.2 já permitia "se não for reusável, espelha visualmente sem extrair". M12 espelhou literal — extração canonical fica para M13+ se virar prioridade.

### D-M12-4: CTA tom violet-600/500

Original era `bg-violet-500 hover:bg-violet-600`. Atualizado para `bg-violet-600 hover:bg-violet-500` — espelha o `dark:bg-violet-600 dark:hover:bg-violet-500` que `/forms` já usa. Coerência interna na paleta dark.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `web/src/app/avaliacoes/avaliacoes-client.tsx` | Reescrita do layout: header counter inline, CTA tom, callouts "Em atraso" e "Próximas (≤7d)", filter chips dentro do header da section "Todas as avaliações", wrappers `bg-white` light, footer "Templates" no mesmo padrão. Removida função `FilterChip` local (não usada mais). |
| `web/src/components/assessments/session-list-item.tsx` | Avatar 8x8 (era 9x9), light tokens (`#D2D2D7`, `#F5F5F7`, `#1D1D1F`, `#86868B`), hover `bg-[#F5F5F7]` light, chevron com transition igual ao card de submission. |
| `docs/specs/avaliacoes-presenciais/12-milestone-12-visual-coherence.md` | Spec do milestone (criada no início do bloco). |
| `docs/specs/avaliacoes-presenciais/MILESTONE-12-STATUS.md` | Este doc. |

Sem mudanças em sidebar, status badge, page server, actions, RPC, migrations.

---

## Validação

- ✅ TypeScript: zero novos erros nos arquivos do M12 (`tsc --noEmit` em web/). Erros pre-existentes em `src/components/students/__tests__/program-calendar.test.tsx` e `student-insights-card.test.tsx` — não relacionados.
- ✅ Smoke test lado-a-lado (light mode): header counter, CTA shape, sidebar active, filter chips dentro de section header, wrapper white, cards — todos paralelos.
- ✅ Identidade D1 preservada: forms azul, avaliações violet.

### Comportamento dos callouts

- `overdueSessions.length > 0` → renderiza callout vermelho com bullet `animate-pulse` e contador `bg-red-500/10 text-red-500 border-red-500/20`
- `upcomingNext7d.length > 0` → renderiza callout violet com ícone `Send` e contador `bg-violet-500/10 text-violet-600 border-violet-500/20`
- Ambos ocultos quando count = 0 (paralelo ao `/forms` quando não há "Aguardando Feedback")

---

## Fora de escopo (confirmado)

- ❌ Mudança de cor primária — D1 preservado
- ❌ Mobile — IA própria via segmented control (M11)
- ❌ Refactor canonical do design system — M13+ se virar dor
- ❌ Mudança em `/forms` — já é o template OK

---

## Próximos passos

Se a coerência visual ficar boa em produção e o user parar de sentir as telas como "produtos diferentes", M12 cumpriu o objetivo. Se outras telas (Programas, Alunos, Financeiro) tiverem divergência similar, considerar M13+ com extração de shareds (`<PrimaryCTA>`, `<FilterChip>`, `<CalloutSection>`).
