# Spec 05 — Detalhe do Aluno & Gráficos

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
A tela de detalhe do aluno usa tabs verticais (Overview/Programs/Forms) com ScrollView. No tablet, há espaço para mostrar mais informações simultaneamente — tabs lado a lado, gráficos maiores, cards de info em grid.

**Dependência: Spec 01 (useResponsive)**

## Objetivo
Adaptar a tela de detalhe do aluno para aproveitar o espaço do tablet: layout em grid, gráficos expandidos e informações visíveis sem scroll excessivo.

## Escopo

### Incluído
- Header do aluno com info expandida no tablet
- Overview tab com cards em grid 2 colunas
- Gráficos de progressão maiores (mais semanas, labels legíveis)
- Heatmap expandido (mais semanas visíveis)
- ProgressSummaryCards em row horizontal no tablet
- Tabs de conteúdo com layout adaptativo

### Excluído
- Novos dados ou queries
- Mudanças no master-detail (Spec 04)
- Novas tabs

## Arquivos Afetados

### Modificados
- `mobile/app/student/[id].tsx` — layout responsivo do header e tabs
- `mobile/components/trainer/student/StudentOverviewTab.tsx` — grid layout
- `mobile/components/trainer/student/ProgressCharts.tsx` — tamanho adaptativo
- `mobile/components/trainer/student/TonnageChart.tsx` — width/height responsivos
- `mobile/components/trainer/student/FrequencyChart.tsx` — width/height responsivos
- `mobile/components/trainer/student/ProgressSummaryCards.tsx` — layout row no tablet

## Comportamento Esperado

### Phone
Sem mudanças — layout atual mantido.

### Tablet — Overview Tab

```
┌─────────────────────────────────────────────────┐
│  ┌────────┐  Ana Silva                          │
│  │ Avatar │  Plano: Premium · Online             │
│  │  64px  │  Desde: Jan/2025 · 3 treinos/semana │
│  └────────┘  [Atribuir Programa] [Enviar Msg]   │
├─────────────────────────────────────────────────┤
│  [Overview]  [Programs]  [Forms]                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │  Tonnage Chart   │ │  Frequency Chart │      │
│  │  (12 semanas)    │ │  (12 semanas)    │      │
│  │  Height: 280px   │ │  Height: 280px   │      │
│  └──────────────────┘ └──────────────────┘      │
│                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │Tonnage │ │ Aderên │ │ Streak │ │ Trend  │   │
│  │ Trend  │ │  cia   │ │ Atual  │ │ Semanal│   │
│  │  +12%  │ │  85%   │ │ 4 sem  │ │   ↑    │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │           Heatmap (16 semanas)           │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Gráficos Adaptativos
- **Phone**: width = screenWidth - 40, height = 200, mostra 8 semanas
- **Tablet**: width = (containerWidth / 2) - 24, height = 280, mostra 12 semanas
- Labels de eixo maiores no tablet (fontSize * fontScale)
- Tooltip/hover com mais informação no tablet

### ProgressSummaryCards
- **Phone**: 2x2 grid (atual)
- **Tablet**: 4x1 row horizontal

### Header do Aluno
- **Phone**: avatar 48px, nome + info empilhados
- **Tablet**: avatar 64px, nome + info lado a lado, botões de ação em row

## Critérios de Aceite
- [ ] Phone: layout idêntico ao atual
- [ ] Tablet: gráficos em 2 colunas lado a lado
- [ ] Tablet: gráficos mostram mais semanas (12 vs 8)
- [ ] Tablet: ProgressSummaryCards em row horizontal
- [ ] Tablet: avatar e header expandidos
- [ ] Heatmap expandido mostrando mais semanas no tablet
- [ ] Font sizes e spacing escalonados via fontScale/spacingScale
- [ ] Sem novos erros de TypeScript

## Edge Cases
- Aluno sem dados de progresso → gráficos vazios em ambos os modos
- Gráfico com muitos datapoints → scroll horizontal se necessário no tablet
- Rotação com gráficos carregados → re-render suave sem flicker

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getChartDimensions(isTablet, containerWidth)` — retorna width/height corretos
- [ ] `getWeeksToShow(isTablet)` — 8 phone, 12 tablet
- [ ] `getSummaryLayout(isTablet)` — 'grid' vs 'row'

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
