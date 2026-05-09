# Milestone 15 — Re-unificar Formulários e Avaliações no sidebar

**Pré-requisitos:** Fase 2 + M11 + M12 + M13 + M14 em prod.

**Goal:** reverter estruturalmente a decisão D1 do workshop (já parcialmente revertida em M13 via cor única). Em vez de 2 items distintos no sidebar (Formulários + Avaliações), volta pra 1 item ("Formulários e Avaliações") com segmented control no topo da página alternando entre os 2 fluxos.

**Plataforma:** web (mobile já tem padrão similar via M11).

**Dura:** ~3-5 dias.

**Branch:** sem branch — direto em main, hotfix-style.

---

## 1. Estado atual vs. desejado

### Hoje (pós-M13)
- Sidebar: 2 items distintos — "Formulários" + "Avaliações"
- Rotas: `/forms` (forms-only) + `/avaliacoes` (assessments-only)
- Cores unificadas em azul (M13)
- Conteúdo já paralelo (M12+M14)

### Pós-M15
- Sidebar: 1 item — "Formulários e Avaliações" com `href: '/forms'`
- Rotas: **mantidas** `/forms` e `/avaliacoes` (deep-links de HealthMetricsCard, builder, redirects continuam válidos)
- Em ambas as rotas: segmented control no topo `[Formulários] [Avaliações]` (estilo iOS)
- Click no segmento navega entre as 2 rotas (não state interno) — preserva URLs limpas e shareability
- Active sidebar item: 1 só, ativo quando em `/forms*` OU `/avaliacoes*`
- Banner in-app: "Reorganizamos: Formulários e Avaliações voltaram a viver juntos"

---

## 2. Decisões registradas

### 2.1 Nome do sidebar item: "Formulários e Avaliações"
Escolhido em workshop. Composto, sem ambiguidade. Cabe no sidebar web (não testar em mobile — mobile tem padrão próprio).

### 2.2 URLs preservadas
`/forms` e `/avaliacoes` continuam existindo. Segmented control altera URL via `router.push`. Permite:
- Deep links externos continuam funcionando
- HealthMetricsCard continua linkando direto pra `/avaliacoes?createAssessment=1`
- Bookmarks salvos pelos trainers continuam válidos

### 2.3 Segmented control no topo
- Position: logo abaixo do header (h1 + subtitle), antes do CTA proativo (M14.1)
- Visual: pill segmented iOS-style (similar ao mobile M11)
- Active: highlight azul preenchido + texto branco
- Inactive: background neutro + texto secundário
- Click: `router.push('/forms')` ou `router.push('/avaliacoes')`
- Deve aparecer em ambas as rotas

### 2.4 Mobile sem mudança
Mobile já tem segmented control [Formulários][Avaliações] dentro do tab "Formulários" via M11. Não muda. M15 é web only.

### 2.5 Banner novo
Reusa pattern do M8 (`MigrationBanner` web). Tip ID novo: `m15_unification_banner` em `tips_dismissed`. Persistência via `revalidatePath` na action.

---

## 3. Acceptance criteria

- ✅ Sidebar tem 1 item "Formulários e Avaliações" no lugar dos 2 antigos
- ✅ Click no item navega pra `/forms` (default)
- ✅ Active state do sidebar ativa quando user em `/forms*` OU `/avaliacoes*`
- ✅ Header de `/forms` tem segmented `[Formulários (ativo)] [Avaliações]`
- ✅ Header de `/avaliacoes` tem segmented `[Formulários] [Avaliações (ativo)]`
- ✅ Click no segmento alterna URL via `router.push`
- ✅ Banner de migração aparece 1x pós-deploy, "Entendi" persiste
- ✅ Deep links continuam funcionando (HealthMetricsCard `+`, redirects, bookmarks)
- ✅ TS clean

---

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Trainer perde muscle memory dos 2 items | Banner de migração + active state continua claro |
| Segmented control conflita visualmente com filter chips internos | Position acima do CTA proativo, hierarquia clara |
| Active state do sidebar com 2 rotas precisa lógica `pathname.startsWith('/forms') OR ...` | Pattern simples, baixo risco |
| Mobile e web divergem (mobile tab é "Formulários" sozinho) | Aceito como trade-off, mobile tem espaço limitado |

---

## 5. Plano de implementação

### Bloco único, ~3-5 dias

1. **Sidebar (`sidebar.tsx`)**:
   - Remove os 2 items "Formulários" e "Avaliações"
   - Adiciona 1 item "Formulários e Avaliações" com `href: '/forms'`
   - Active state: `pathname.startsWith('/forms') || pathname.startsWith('/avaliacoes')`

2. **Segmented control component**:
   - Criar `web/src/components/forms/forms-avaliacoes-segmented.tsx` (ou inline em ambos os arquivos se for pequeno)
   - Props: `active: 'formularios' | 'avaliacoes'`
   - Click muda rota via `useRouter().push`

3. **`forms-dashboard-client.tsx`**:
   - Renderiza segmented com `active="formularios"` abaixo do header

4. **`avaliacoes-client.tsx`**:
   - Renderiza segmented com `active="avaliacoes"` abaixo do header

5. **Banner novo**:
   - `MigrationBanner` ganha conditional logic: se `tips_dismissed` não tem `m15_unification_banner`, renderiza novo texto
   - OU criar componente separado `M15UnificationBanner`

6. **Status doc**: `MILESTONE-15-STATUS.md`

7. **Commit direto em main**

---

## 6. Validação

1. Sidebar: 1 item "Formulários e Avaliações"
2. Click → vai pra `/forms` com segmento "Formulários" ativo
3. Click no segmento "Avaliações" → URL muda pra `/avaliacoes`, segmento "Avaliações" ativo, sidebar item continua highlighted
4. Banner aparece na primeira visita pós-deploy, dismiss persiste
5. HealthMetricsCard `+` em `/students/[id]` ainda navega pra `/avaliacoes?createAssessment=1...`
6. Bookmark de `/avaliacoes` continua funcionando

---

## 7. Fora de escopo

- ❌ Mobile rename (M11 mantém pattern)
- ❌ Migração de URLs (deep-links preservados)
- ❌ Tour reescrito (banner cobre)
- ❌ Templates page (`/forms/templates` vs `/avaliacoes/templates` continuam separadas)
