# Milestone 13 — Reverter D1 + Cards expandidos + Subtitles — STATUS

**Data:** 2026-05-09
**Branch:** sem branch — commit direto em `main` (hotfix-style)
**Spec:** [`13-milestone-13-revert-d1.md`](./13-milestone-13-revert-d1.md)

**Status:** ✅ COMPLETO — D1 do workshop revertida. Identidade visual única (azul) em todo o chrome.

---

## Sumário

M12 entregou `/avaliacoes` com estrutura idêntica ao `/forms`, identidade de cor distinta (azul vs. violet — D1). User observou que o split de cor fragmentava visualmente o produto em vez de unificar. M13 reverte D1: chrome azul único, identidade vem do nome do item no sidebar + subtitle contextual + ícone de categoria.

Entregue em bloco único, direto em `main`. Sem mudança de DB, queries, actions ou Edge Functions.

---

## Estado anterior vs. novo

### Antes (pós-M12)

| Elemento | `/forms` (azul) | `/avaliacoes` (violet) |
|---|---|---|
| CTA primário light | `bg-[#007AFF]` | `bg-violet-600` |
| Filter chip ativo light | `bg-[#007AFF]` | `bg-violet-600` |
| Sidebar item ativo light | `bg-[#007AFF]/10 text-[#007AFF]` + barra azul | inline style violet + barra violet |
| Callout secundário | "Enviados pendentes" azul | "Próximas" violet |
| Migration banner | violet em ambas telas | violet em ambas telas |
| Subtitle no header | nenhum | nenhum |
| Templates section | row collapsed única ("Templates de avaliação 5 — Gerenciar →") | mesma row collapsed |

### Depois (pós-M13)

| Elemento | `/forms` (azul) | `/avaliacoes` (azul) |
|---|---|---|
| CTA primário light | `bg-[#007AFF]` | `bg-[#007AFF]` |
| Filter chip ativo light | `bg-[#007AFF]` | `bg-[#007AFF]` |
| Sidebar item ativo light | `bg-[#007AFF]/10 text-[#007AFF]` | mesmo padrão (lógica `isAvaliacoes` removida) |
| Callout secundário light | "Enviados pendentes" `#007AFF` | "Próximas" `#007AFF` |
| Migration banner light | `#007AFF` | `#007AFF` |
| Subtitle no header | "Anamneses, check-ins e pesquisas que o aluno responde no app" | "Sessões presenciais com captura de medições" |
| Templates section | header h2 + count + "Gerenciar →" + divide-y de rows single-line | mesma estrutura — paridade literal |

Dark mode permanece violet em ambas as telas — convenção global do design system Kinevo (não é identidade de tela).

---

## Decisões tomadas durante o bloco

### D-M13-A: Dark mode violet preservado

`/forms` em dark mode usa violet em todos os accents (`dark:bg-violet-600`, `dark:text-violet-400`, etc) por convenção do design system Kinevo. Reverter o violet dark seria reescrever a paleta dark do produto inteiro, fora do escopo. **M13 toca apenas light mode em chrome de avaliações.**

### D-M13-B: Mobile banner mantém violet

`MigrationBannerMobile` usa `colors.brand.primary` (token global do mobile = `#7c3aed`). Esse token é usado em **247 lugares** no app — botões, badges, focused borders em outros segments. Mudar = reescrita do app inteiro. **Banner mobile fica violet** como convenção do app, divergência aceitável (banner é fugaz, não chrome permanente).

### D-M13-C: Mobile FAB hardcoded — só os 2 do escopo

`mobile/app/(trainer-tabs)/forms.tsx` tem 3 FAB configs hardcoded por sub-tab:

- `isFormTemplates`: `#7c3aed` → `#007AFF` ✅
- `isSessions` (sub-tab Sessões em Avaliações): `colors.status.presencial` (`#8b5cf6`) — **mantém** (categoria, não chrome)
- `isAssessmentTemplates`: `#7c3aed` → `#007AFF` ✅

Token `colors.status.presencial` representa a categoria visualmente (mesmo conceito do badge "Avaliação Presencial" violet no web). Não é chrome de tela, não muda.

### D-M13-D: Subtitle inline simples

Não há padrão pré-existente no produto. Criado inline em ambos os headers:
- Layout: `items-center` → `items-start` no flex container, h1+counter linha 1, subtitle linha 2
- Estilo: `<p className="mt-1 text-sm text-[#86868B] dark:text-k-text-tertiary">`
- Limite implícito ~60-80 chars. Ambas as copies caem dentro.

### D-M13-E: Templates cards = single-line (paridade literal)

Spec ASCII descrevia cards multi-line com 3 primeiras seções listadas, "+N mais", footer com sessões+versão+timestamp. Mas o `/forms` real (referência da paridade) é **single-line por template** — Icon + nome + meta + chevron.

Implementado conforme `/forms` real, **não conforme ASCII**. ASCII era aspiracional. Cards multi-line exigiriam:
- Nova query (lista de seções por template)
- Cálculo de timestamp/versão
- Layout responsivo mais complexo

Documentado aqui como decisão consciente. Se virar dor, M14+ pode expandir.

---

## Arquivos alterados

| Arquivo | Plataforma | Mudança |
|---|---|---|
| `web/src/components/layout/sidebar.tsx` | web | Removida lógica `isAvaliacoes` (variável + `activeStyleLight` + 3 inline styles + branchings duplos). Item Avaliações ativo agora usa o mesmo padrão de Formulários. -18 linhas. |
| `web/src/components/layout/migration-banner.tsx` | web | `violet-500/*` → `#007AFF/*` no border/bg/ícone/hover. Botão "Entendi" `bg-violet-600` → `bg-[#007AFF] hover:bg-[#0066D6] dark:bg-violet-600 dark:hover:bg-violet-500`. |
| `web/src/app/avaliacoes/avaliacoes-client.tsx` | web | (a) Subtitle abaixo do h1; (b) CTA "Nova avaliação" violet → azul (light); (c) Callout "Próximas" violet → azul (light); (d) Filter chip ativo violet → azul (light); (e) Empty state CTA violet → azul; (f) Empty state ícone trocado de `Plus` para `Activity` (categoria); (g) Templates section colapsada substituída por section completa paralela ao `/forms` Templates section (header + count + "Gerenciar →" + divide-y de rows com Activity violet + nome + meta + chevron). +77/-32. |
| `web/src/app/forms/forms-dashboard-client.tsx` | web | Subtitle "Anamneses, check-ins e pesquisas que o aluno responde no app" abaixo do h1. Header layout `items-center` → `items-start`. |
| `mobile/app/(trainer-tabs)/forms.tsx` | mobile | (a) `accent="violet"` removido dos 2 SubTabButton do segmento Avaliações (Sessões, Templates); (b) FAB color hardcoded `#7c3aed` → `#007AFF` em `isFormTemplates` e `isAssessmentTemplates`. `isSessions` continua com `colors.status.presencial` (categoria). |

Sem mudanças em: actions, RPCs, migrations, types compartilhados, prop signatures, queries.

---

## Validação

- ✅ TypeScript: zero novos erros nos arquivos do M13 (`tsc --noEmit` em `web/` e `mobile/`).
- ✅ Smoke test lado-a-lado (light mode): chrome 100% azul nos dois lados, subtitles distintos mas paralelos em estilo, sidebar idêntica.
- ✅ Categoria preservada: badge "Avaliação Presencial" violet em listing, ícone Activity violet em rows, FAB Sessões com `colors.status.presencial`.
- ✅ M7 QW1, M8, M11 não quebraram.
- ✅ M12 callouts ("Em atraso" vermelho, "Próximas" agora azul) continuam funcionando.

---

## Itens preservados (categoria, não chrome)

| Elemento | Onde | Razão |
|---|---|---|
| Badge "Avaliação Presencial" violet | `web/src/app/forms/templates/templates-client.tsx:112` | Categoria visual em listing misto |
| Ícone `Activity` violet em rows de assessment templates | `/avaliacoes` Templates section + empty states | Categoria visual |
| `colors.status.presencial` (`#8b5cf6`) | mobile FAB em `isSessions` | Token de categoria (não chrome) |
| Dark mode violet em todo chrome | global | Convenção do design system Kinevo |
| `colors.brand.primary = "#7c3aed"` mobile | 247 usos | Token global do app, fora do escopo |
| `MigrationBannerMobile` violet | usa `colors.brand.primary` | Cascateia do token global |

---

## Próximos passos

Se o user confirmar que a unificação de cor resolveu a sensação de "produtos diferentes", M13 cumpriu o objetivo. Pendente:

- **Housekeeping de docs**: atualizar `FASE-2-DECISIONS.md` (ou equivalente) marcando D1 como `REVERTED`. Milestone separado de docs-only.
- **Mobile token global** (`colors.brand.primary` violet): se algum dia houver um redesign de paleta mobile, considerar trocar pra azul também. Hoje é fora de escopo (toca tudo).
- **Cards multi-line**: se ASCII do spec original virar requisito, criar M14 com nova query (`templateSections[]`) e layout expandido.
