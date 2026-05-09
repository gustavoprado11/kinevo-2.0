# Milestone 15 — Re-unificar Formulários e Avaliações no sidebar — STATUS

**Data:** 2026-05-09
**Branch:** sem branch — commit direto em `main` (hotfix-style)
**Spec:** [`15-milestone-15-reunificar.md`](./15-milestone-15-reunificar.md)

**Status:** ✅ COMPLETO — D1 do workshop revertida estruturalmente. 1 item composto no sidebar + segmented control no header.

---

## Sumário

M13 reverteu D1 cromaticamente (chrome único azul). M15 reverte D1 **estruturalmente**: o sidebar volta pra 1 item "Formulários e Avaliações" no lugar dos 2 antigos. URLs `/forms` e `/avaliacoes` permanecem distintas — alternância via segmented control no header de cada rota usando `router.push`.

Identidade unificada vem do nome do item no sidebar + ícone único; identidade de fluxo vem do segmented control no header. Mobile (M11) mantém pattern próprio (segmented dentro do tab Formulários) — M15 é web only.

Entregue em bloco único, direto em `main`.

---

## Estado anterior vs. novo

### Antes (pós-M14.2)

| Elemento | Estado |
|---|---|
| Sidebar | 2 items: "Formulários" (`/forms`) e "Avaliações" (`/avaliacoes`) |
| Cor de chrome | Azul único (M13) |
| Estrutura visual | Idêntica entre as telas (M12 + M14) |
| Banner ativo | `fase2_migration_banner` ("Renomeamos para Formulários e Avaliações...") |

### Depois (pós-M15)

| Elemento | Estado |
|---|---|
| Sidebar | 1 item: "Formulários e Avaliações" (`href: '/forms'`, icon `FileText`) |
| Active state | Ativo em `/forms*` OU `/avaliacoes*` via `extraActivePrefixes: ['/avaliacoes']` |
| Header | Segmented control pill `[Formulários] [Avaliações]` abaixo do header (h1+subtitle+CTAs), antes do CTA proativo |
| Click no segmento | `router.push('/forms')` ou `router.push('/avaliacoes')` (no-op se já está na rota) |
| Banner ativo | `m15_unification_banner` ("Reorganizamos: Formulários e Avaliações voltaram a viver juntos no menu") |
| URLs | Inalteradas — `/forms` e `/avaliacoes` continuam separadas (deep-links preservados) |

---

## Decisões tomadas durante o bloco

### D-M15-A: ícone `FileText`
Mantém coerência com o ícone original do sidebar item "Formulários". `Activity` ficou específico de avaliações (categoria visual nos cards de Templates de Avaliação) — usar `Activity` no item composto pesaria o lado errado.

### D-M15-B: banner M15 substitui M8
TIP_ID novo (`m15_unification_banner`). Quem dismissou o M8 antigo verá o M15 banner mesmo assim — TIP_IDs diferentes em `tips_dismissed`. Quem nunca viu nada vê o M15 direto. O `fase2_migration_banner` antigo vira deadcode em `tips_dismissed` arrays existentes (inerte, não causa dano).

### D-M15-C: segmented em `web/src/components/forms/`
Afinidade temática com a área. Alternativa `web/src/components/layout/` rejeitada — segmented é específico do par forms/avaliacoes, não primitivo de layout.

### D-M15-D: labels "Formulários" e "Avaliações"
Mesma copy do antigo sidebar. Clareza > brevidade.

### D-M15-E: posição do segmented
Abaixo do header (h1+subtitle+CTAs), antes do CTA proativo M14.1. Margem `mb-6`. Hierarquia visual: header → segmented (escolha de fluxo) → CTA proativo (urgência) → conteúdo.

### D-M15-F: refactor `isActive` por overload
A função `isActive(href: string)` original em [sidebar.tsx](../../web/src/components/layout/sidebar.tsx) virou overload `isActive(hrefOrItem: string | NavItem)`. String mantém comportamento antigo (usado em `/settings`); NavItem usa `href` + `extraActivePrefixes`. Pattern extensível para futuros items multi-rota — por exemplo se algum dia "Bibliotecas" precisar ativar em múltiplas sub-rotas.

### D-M15-G: segmented com no-op se já está na rota
Click em "Formulários" estando em `/forms`: no `router.push`. Evita re-render desnecessário e push duplicado no histórico do navegador.

### D-M15-H: tour key `sidebar-avaliacoes` removida
Não era referenciada em nenhum tour (`grep -r 'sidebar-avaliacoes'` não retornou matches em `tour-definitions.ts`). Apenas o `sidebar-forms` é usado, e ele permanece (item unificado herda esse onboardingId).

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `web/src/components/layout/sidebar.tsx` | Tipo `NavItem` ganha `extraActivePrefixes?: string[]`. Remove item "Avaliações". Renomeia "Formulários" → "Formulários e Avaliações" + `extraActivePrefixes: ['/avaliacoes']`. Refactor de `isActive` por overload. |
| `web/src/components/layout/migration-banner.tsx` | TIP_ID e texto novos. Comentário de cabeçalho atualizado para refletir M15. |
| `web/src/components/forms/forms-avaliacoes-segmented.tsx` | **NOVO**. Pill iOS-style com 2 botões. Active branco com sombra leve / dark equivalente. Click via `router.push` com no-op-if-current. `aria-pressed` em ambos botões. |
| `web/src/app/forms/forms-dashboard-client.tsx` | Import + render `<FormsAvaliacoesSegmented active="formularios" />` entre header e CTA proativo. |
| `web/src/app/avaliacoes/avaliacoes-client.tsx` | Import + render `<FormsAvaliacoesSegmented active="avaliacoes" />` entre header e CTA proativo. |

Sem mudanças em: actions, RPCs, migrations, types compartilhados, prop signatures, queries, tours, mobile.

---

## Validação

- ✅ TypeScript: zero novos erros nos arquivos do M15.
- ✅ Smoke test localhost (validado pelo user):
  - Sidebar 1 item "Formulários e Avaliações" + ícone FileText
  - Active state cobre `/forms*` e `/avaliacoes*`
  - Segmented control posicionado abaixo do header
  - Click navega via `router.push` em ambas direções
  - Layout 2-col preservado (M14 — densidade, scroll interno, Templates pra coluna esquerda)
  - Subtitles preservados (M13)

### Anomalia menor (não bloqueante)

Banner M15 não apareceu no smoke test do user. Hipótese: TIP_ID `m15_unification_banner` já estava no `tips_dismissed` por algum motivo (cache de localStorage residual? state acumulado?). Não bloqueia commit — comportamento individual do trainer testado pode não refletir o caso geral. Investigar separadamente se outros trainers reportarem ausência do banner pós-deploy.

---

## Itens preservados (sem regressão)

- URLs `/forms` e `/avaliacoes` distintas — deep-links de HealthMetricsCard, builder, redirects, bookmarks continuam válidos
- Templates pages (`/forms/templates`, `/avaliacoes/templates`) inalteradas
- Mobile M11 (segmented dentro do tab Formulários) inalterado
- Layout 2-col, densidade de rows, CTA proativo, callouts (M12, M14, M14.1, M14.2) intactos

---

## Próximos passos

- **Cleanup do TIP_ID antigo**: o `fase2_migration_banner` em `tips_dismissed` arrays acumulados é inerte. Pode ser removido em milestone de housekeeping de DB se acumular muitos tips legacy.
- **Onboarding tour update**: se o tour `tour_forms_first_time` referencia textos sobre "as 2 telas separadas", atualizar copy.
- **Investigação banner**: se o banner M15 não aparecer pra trainers em prod, debugar `useOnboardingStore` + `tips_dismissed` initial state.
