# Adaptação para Tablet/iPad — Overview & Plano de Execução

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto

O Kinevo já declara `supportsTablet: true` no app.json e roda nativamente no iPad, mas **não possui nenhuma adaptação de layout para telas maiores**. O app renderiza o layout de celular esticado em telas de 10-13", resultando em:

- Texto pequeno e difícil de ler a distância
- Padding de 20px parecendo minúsculo em tela de 12.9"
- Cards esticados horizontalmente sem max-width
- Espaço desperdiçado onde caberiam 2-3 colunas
- Modais de tela cheia desnecessários quando sobra espaço
- Orientação travada em portrait (trainers usam tablet na horizontal)

**Dados de mercado**: A maioria dos personal trainers usa tablet na academia para consultar fichas, acompanhar treinos ao vivo e montar programas. Trainerize, TrainHeroic e TrueCoach investem em layouts adaptativos como diferencial competitivo.

## Objetivo

Transformar o Kinevo em uma experiência nativa de tablet — layouts adaptativos que aproveitam a tela, suporte a landscape, e navegação otimizada — mantendo 100% de retrocompatibilidade com celular.

## Diagnóstico Atual

### O que já funciona
- `supportsTablet: true` no app.json (iOS)
- Safe area handling correto (notch, Dynamic Island)
- NativeWind (Tailwind) já integrado (mas subutilizado)
- Zustand stores independentes de UI
- Design tokens centralizados em `theme/`

### O que está faltando
1. **Zero hooks responsivos** — Nenhum uso de `useWindowDimensions` reativo
2. **Sem breakpoints** — Não existe sistema de breakpoint (phone/tablet)
3. **Layouts fixos** — Padding, font sizes e widths hardcoded
4. **Portrait-only** — Orientação travada no `app.json`
5. **Sem max-width** — Conteúdo estica até as bordas do iPad 13"
6. **Sem Platform.isPad** — Nenhuma ramificação tablet no código
7. **Sem split-view** — App não reage ao multitask do iPad
8. **Modais full-screen** — Todos os modais são full-screen, mesmo sobrando espaço
9. **Bottom tabs fixas** — Tab bar na parte inferior mesmo em landscape iPad

### Componentes que usam Dimensions (precisam migrar)
- `WeekCalendar.tsx` — `Dimensions.get("window").width` (estático, não reage)
- `UnifiedCalendar.tsx` — `Dimensions`
- `ShareWorkoutModal.tsx` — `Dimensions`
- `WorkoutCelebration.tsx` — `Dimensions`
- `WorkoutSuccessModal.tsx` — `Dimensions`
- `ExerciseVideoModal.tsx` — `Dimensions`

## Plano de Execução — 7 Specs

O trabalho está dividido em 7 specs incrementais, ordenadas por dependência e impacto:

### Spec 01 — Infraestrutura Responsiva (Foundation)
**Prioridade: CRÍTICA — Todas as outras specs dependem desta**

Criar o sistema de breakpoints, hook responsivo e tokens adaptativos que serão a base de tudo.

- Hook `useResponsive()` com breakpoints e helpers
- Responsive design tokens (spacing, typography, layout)
- Utility `ResponsiveContainer` com max-width
- Orientação landscape habilitada
- Migração de `Dimensions.get()` → `useWindowDimensions()`

### Spec 02 — Navegação Adaptativa
**Prioridade: ALTA**

Substituir bottom tabs por sidebar/navigation rail em tablets.

- Tab bar lateral (navigation rail) em tablet landscape
- Drawer navigation em tablet portrait
- Manter bottom tabs no celular
- Transição suave entre modos

### Spec 03 — Dashboard & Stats (Grid Layout)
**Prioridade: ALTA**

Dashboard em grid multi-coluna aproveitando o espaço do tablet.

- StatCards em grid 2x2 (tablet) vs stack (phone)
- Gráficos maiores com mais datapoints
- Quick actions em row horizontal
- Conteúdo com max-width central

### Spec 04 — Lista de Alunos (Master-Detail)
**Prioridade: ALTA**

Padrão master-detail: lista à esquerda, detalhe à direita.

- Split view: lista (1/3) + detalhe (2/3) em tablet
- Seleção com highlight na lista
- Transição animada ao selecionar aluno
- Fallback para navegação stack no celular

### Spec 05 — Detalhe do Aluno & Gráficos
**Prioridade: MÉDIA**

Tabs lado a lado e gráficos maiores na tela do aluno.

- Tabs de conteúdo em layout horizontal (Overview + Programs lado a lado)
- Gráficos de progressão maiores com mais semanas
- Heatmap expandido
- Cards de informação em grid

### Spec 06 — Program Builder (Workspace Layout)
**Prioridade: MÉDIA**

O builder é a tela mais beneficiada pelo espaço do tablet.

- Layout workspace: sidebar exercícios + editor central
- Exercise picker como painel lateral (não modal)
- Drag-and-drop mais confortável em tela grande
- Preview do programa em tempo real

### Spec 07 — Modais, Forms & Polish
**Prioridade: BAIXA**

Adaptações finais de modais, formulários e componentes menores.

- Modais como sheets laterais ou popover (não full-screen)
- Formulários com campos side-by-side
- Exercício detail como panel
- Notificações em layout adaptado
- Financial screens em grid

---

## Análise Competitiva

| App | Tablet Layout | Split View | Nav Rail | Landscape |
|-----|---------------|------------|----------|-----------|
| Trainerize | Adaptativo | Sim | Sim | v7.10+ |
| TrainHeroic | Responsivo | Sim | Parcial | Sim |
| TrueCoach | iPad nativo | Split OS | Não | Sim |
| My PT Hub | Básico | Não | Não | Parcial |
| Hevy | Básico | Não | Não | Não |
| **Kinevo (atual)** | **Nenhum** | **Não** | **Não** | **Não** |

**Oportunidade**: Kinevo pode igualar Trainerize/TrainHeroic com a implementação dessas 7 specs.

## Estimativa de Esforço

| Spec | Complexidade | Estimativa | Dependência |
|------|-------------|------------|-------------|
| 01 — Infraestrutura | Alta | 1-2 dias | Nenhuma |
| 02 — Navegação | Alta | 1-2 dias | Spec 01 |
| 03 — Dashboard | Média | 0.5-1 dia | Spec 01 |
| 04 — Master-Detail | Alta | 1-2 dias | Spec 01, 02 |
| 05 — Detalhe Aluno | Média | 0.5-1 dia | Spec 01 |
| 06 — Program Builder | Alta | 1-2 dias | Spec 01 |
| 07 — Polish | Baixa | 0.5-1 dia | Spec 01 |

**Total estimado: 5-10 dias de implementação**

## Princípios de Design

1. **Mobile-first, tablet-enhanced** — O celular continua sendo o default; tablet adiciona layouts extras
2. **Breakpoint único** — `width >= 768` = tablet (simplifica decisões)
3. **Conteúdo centralizado** — Max-width de 1200px em telas muito grandes (iPad 13")
4. **Modais → Panels** — Em tablet, preferir painéis laterais sobre modais full-screen
5. **Orientação flexível** — Suportar portrait + landscape no tablet
6. **Zero breaking changes** — Tudo retrocompatível; celular não muda nada
