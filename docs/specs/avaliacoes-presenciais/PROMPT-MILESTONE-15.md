# PROMPT — Milestone 15: Re-unificar Formulários e Avaliações no sidebar

> Cole no Claude Code. Hotfix-style. Single block. Commit direto em main.

---

## Goal

Sidebar volta pra 1 item "Formulários e Avaliações". URLs `/forms` e `/avaliacoes` mantidas. Segmented control no header de cada rota alternando entre elas. Banner de migração novo.

## Antes de começar

1. Leia: `docs/specs/avaliacoes-presenciais/15-milestone-15-reunificar.md`
2. Examine:
   - `web/src/components/layout/sidebar.tsx`
   - `web/src/app/forms/forms-dashboard-client.tsx`
   - `web/src/app/avaliacoes/avaliacoes-client.tsx`
   - `web/src/components/layout/migration-banner.tsx`

## Workflow

- **Sem branch.** Direto em main (com stash WIP de `dashboard-aluno-followup` antes, restaura depois).
- **Single sub-bloco.**
- **Commit + push** após reportar e eu validar.

═══════════════════════════════════════════════════════════════════════
BLOCO A — DIAGNÓSTICO (~0.5 dia)
═══════════════════════════════════════════════════════════════════════

1. `git status --short`
2. Inspeção sidebar:
   - Linhas dos 2 items "Formulários" e "Avaliações" — escolher remoção ou consolidação
   - Pattern de active state — copiar pra novo item composto
3. Migration banner pattern:
   - Como o banner do M8/M13 detecta `tips_dismissed` 
   - Onde grava — provavelmente action `mark-tip-dismissed`
   - Se posso adicionar tip novo `m15_unification_banner` sem nova action

PARE e me reporte:
- Plano de remoção dos 2 items + criação do unificado no sidebar
- Estratégia do banner — mesmo componente reutilizado com tip novo OU componente separado
- Lista de arquivos que vão mudar

═══════════════════════════════════════════════════════════════════════
BLOCO B — IMPLEMENTAÇÃO (~2-3 dias)
═══════════════════════════════════════════════════════════════════════

Após meu OK do diagnóstico.

### Mudanças

1. **Sidebar**:
   - Remove items "Formulários" e "Avaliações" 
   - Adiciona 1 item: label "Formulários e Avaliações", `href: '/forms'`, ícone `FileText` (ou Activity — escolha o mais limpo)
   - Active state: `pathname.startsWith('/forms') || pathname.startsWith('/avaliacoes')`

2. **Segmented control**:
   - Criar `web/src/components/forms/forms-avaliacoes-segmented.tsx`
   - Props: `active: 'formularios' | 'avaliacoes'`
   - Render: pill iOS-style com 2 botões
   - Click formularios: `router.push('/forms')`
   - Click avaliacoes: `router.push('/avaliacoes')`
   - Active: `bg-[#007AFF] text-white` light / dark equivalent
   - Inactive: `text-k-text-secondary` neutro
   - Position: logo abaixo do header (h1 + subtitle), antes do CTA proativo

3. **`forms-dashboard-client.tsx`**:
   - Importa e renderiza `<FormsAvaliacoesSegmented active="formularios" />` abaixo do header

4. **`avaliacoes-client.tsx`**:
   - Importa e renderiza `<FormsAvaliacoesSegmented active="avaliacoes" />` abaixo do header

5. **Banner de migração novo**:
   - Tip ID: `m15_unification_banner`
   - Texto: "Reorganizamos: Formulários e Avaliações voltaram a viver juntos no menu"
   - Action persistência: reusa a action existente do M8 (`update-onboarding-state` com tips_dismissed)
   - Reaproveita componente `MigrationBanner` ou cria `M15UnificationBanner` separado — decisão sua. Recomendo extender o existente passando `tipId` e `text` como props.

### Critério de saída

Smoke test:
- Sidebar: 1 item "Formulários e Avaliações", click vai pra /forms
- /forms: segmented "Formulários" ativo
- /avaliacoes: segmented "Avaliações" ativo
- Click entre segmentos navega URL
- Banner aparece, "Entendi" persiste
- Deep link de /students/[id] HealthMetricsCard "+" ainda funciona

PARE e reporte com lista de arquivos modificados + screenshots locais.

═══════════════════════════════════════════════════════════════════════
BLOCO C — STATUS DOC + COMMIT
═══════════════════════════════════════════════════════════════════════

Após eu validar via Chrome MCP em localhost.

1. `MILESTONE-15-STATUS.md`
2. Commit direto em main:

```
fix(visual): M15 re-unifica Formulários e Avaliações no sidebar (1 item)

User decidiu reverter D1 estruturalmente: 2 items no sidebar fragmentavam
o produto. Volta pra 1 item composto 'Formulários e Avaliações'.

URLs /forms e /avaliacoes mantidas (deep-links preservados). Segmented
control no header de cada rota alterna entre os 2 fluxos via router.push.
Active state do sidebar funciona pra ambas as rotas.

Banner novo (tip 'm15_unification_banner') comunica a reorganização.

Mobile (M11) mantém pattern atual — segmented já existe dentro do tab.

Co-authored-by: Claude <claude@anthropic.com>
```

═══════════════════════════════════════════════════════════════════════
GATILHOS PARA PARAR
═══════════════════════════════════════════════════════════════════════

- Sidebar tem state machine complexa que dificulta consolidação
- MigrationBanner não aceita tipId+texto como props — precisa refactor maior
- Segmented control tem padrão pré-existente pra reusar (em vez de criar novo)

═══════════════════════════════════════════════════════════════════════
ORDEM
═══════════════════════════════════════════════════════════════════════

1. BLOCO A → reportar
2. BLOCO B → reportar (eu valido em localhost)
3. BLOCO C (commit + push após meu OK)

COMECE PELO BLOCO A.
