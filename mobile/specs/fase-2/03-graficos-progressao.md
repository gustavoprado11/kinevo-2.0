# Especificação Técnica: Gráficos de Progressão - Mobile

## Objetivo
Adicionar gráficos visuais de progressão à página de detalhes do aluno, exibindo volume de treinamento, frequência e tendências de tonelagem. Os treinadores precisam avaliar rapidamente se um aluno está progredindo.

## Contexto Atual
- **Mobile App**: `mobile/app/student/[id].tsx` possui 3 abas: Overview, Programs, Forms
- **Componente Existente**: `SessionHeatmap` mostra frequência de treinos como um heatmap de calendário
- **Hooks Disponíveis**:
  - `useStudentDetail`: retorna `recentSessions` (duration_seconds, rpe, feedback), `sessionsThisWeek`, `expectedPerWeek`, `totalSessions`
  - `useStudentHeatmap`: retorna dados dia-a-dia com tipo `HeatmapDay`
- **Design Tokens Kinevo**: 
  - `brand.primary = #7c3aed` (roxo)
  - `success = #16a34a` (verde)
  - `warning = #ca8a04` (amarelo)
  - `error = #dc2626` (vermelho)
- **Web Reference**: `load-progression-chart.tsx` implementa linha SVG com gradiente e badges de tendência
- **Animações**: `react-native-reanimated` disponível para efeitos de entrada

## Arquivos a Criar

### 1. `mobile/components/trainer/student/ProgressCharts.tsx`
Componente container que agrupa múltiplos cards de gráficos. Responsável por layout, espaçamento e coordenação de estado.

**Responsabilidades**:
- Renderizar container grid/flex com múltiplos cards
- Gerenciar estado de carregamento compartilhado
- Coordenar refresh de dados (pull-to-refresh)
- Aplicar animações de entrada aos cards

**Props**:
```typescript
interface ProgressChartsProps {
  studentId: string;
  refetchTrigger?: number; // Timestamp de último refresh
  isLoading?: boolean;
}
```

**Exportação**:
```typescript
export const ProgressCharts: React.FC<ProgressChartsProps>
```

**Comportamento**:
- Renderizar em coluna única (mobile)
- Espaçamento de 16px entre cards
- Cards com `borderRadius: 12px`, `backgroundColor: theme.colors.surface`
- Sombra leve: `shadowColor: '#000'`, `shadowOpacity: 0.05`, `shadowRadius: 4`
- Animação de fade-in + slide-up ao montar (500ms, usando Reanimated)
- Cada card renderiza um componente específico (TonnageChart, FrequencyChart, ProgressSummary)

### 2. `mobile/components/trainer/student/TonnageChart.tsx`
Gráfico de linha SVG mostrando tonelagem semanal ao longo de 8-12 semanas.

**Responsabilidades**:
- Renderizar gráfico de linha com preenchimento degradado
- Plotar dados de tonelagem ao longo do tempo
- Exibir badges de tendência (↑ ↓ —)
- Animar desenho da linha ao montar

**Props**:
```typescript
interface TonnageChartProps {
  data: ChartDataPoint[];
  trend: 'up' | 'down' | 'stable';
  trendValue: number; // Percentual de mudança, ex: 12.5
  isLoading: boolean;
}

interface ChartDataPoint {
  week: number; // 1-12
  date: string; // ISO date da segunda-feira da semana
  tonnage: number; // kg total
  sessions: number; // quantidade de sessões
}
```

**Exportação**:
```typescript
export const TonnageChart: React.FC<TonnageChartProps>
```

**Especificações SVG**:
- Dimensões: Width: 100%, Height: 240px (definir viewBox proporcional)
- Padding/Margins: top 16px, right 16px, bottom 24px, left 40px
- Eixo Y: 0 até max(tonnage) + 20%
- Eixo X: semana 1-12 (ou quantidade de semanas disponíveis)
- Linha: stroke width 2.5px, cor `brand.primary (#7c3aed)`
- Gradiente de preenchimento: `brand.primary` com opacity 0.15 em cima, transparente embaixo
- Pontos interativos: círculos de 6px nas intersecções (toque mostra tooltip)

**Animação**:
- Stroke-dasharray animation: linha "desenhada" em 800ms ao montar
- Pontos aparecem com scale (0.5 → 1) em cascata

**Badge de Tendência**:
- Posicionado no canto superior direito do card
- Ícone + texto: "↑ +12.5%" (verde/success) | "↓ -8.2%" (vermelho/error) | "— Estável" (cinza)
- Font size 12px, font weight 600

**Tooltip ao Tocar**:
- Mostrar semana, data, tonelagem (kg), quantidade de sessões
- Posicionar acima do ponto tocado
- Desaparecer após 3 segundos ou novo toque

### 3. `mobile/components/trainer/student/FrequencyChart.tsx`
Gráfico de barras mostrando sessões por semana vs. meta esperada.

**Responsabilidades**:
- Renderizar barras para cada semana
- Plotar meta esperada como linha horizontal
- Usar cores diferentes para atingida/não-atingida
- Animar barras ao montar

**Props**:
```typescript
interface FrequencyChartProps {
  data: FrequencyDataPoint[];
  expectedPerWeek: number; // Meta de sessões/semana
  isLoading: boolean;
}

interface FrequencyDataPoint {
  week: number;
  date: string; // ISO date
  completedSessions: number;
  percentOfGoal: number; // 0-100%
}
```

**Exportação**:
```typescript
export const FrequencyChart: React.FC<FrequencyChartProps>
```

**Especificações SVG**:
- Dimensões: Width: 100%, Height: 240px
- Padding/Margins: top 16px, right 16px, bottom 24px, left 40px
- Barras: width = (containerWidth - margins) / numberOfWeeks - 4px
- Espaçamento entre barras: 4px
- Cor da barra (atingiu meta): `success (#16a34a)`
- Cor da barra (não atingiu): `warning (#ca8a04)` ou `error` se 0 sessões
- Linha meta esperada: stroke width 1.5px, estilo dashed, cor cinza-400

**Animação**:
- Barras crescem do bottom em 600ms (easing: easeOut)
- Cascata: primeira barra começa em 0ms, cada subsequente +50ms

**Labels**:
- Embaixo de cada barra: número de semana pequeno (font size 10px)
- Acima da barra (se houver espaço): número de sessões completadas

### 4. `mobile/components/trainer/student/ProgressSummary.tsx`
Cards compactos exibindo estatísticas resumidas: tendência de tonelagem, adesão %, streak.

**Responsabilidades**:
- Renderizar 3 cards horizontais/grid com estatísticas
- Mostrar métrica, valor, ícone
- Aplicar cores contextuais (verde para bem, vermelho para mal)

**Props**:
```typescript
interface ProgressSummaryProps {
  tonneageTrend: {
    value: number; // Percentual
    direction: 'up' | 'down' | 'stable';
  };
  adherencePercent: number; // 0-100
  currentStreak: number; // Semanas consecutivas
  isLoading: boolean;
}
```

**Exportação**:
```typescript
export const ProgressSummary: React.FC<ProgressSummaryProps>
```

**Layout**:
- Grid de 3 colunas (se espaço permitir) ou 1 coluna em mobile pequeno
- Cada card: padding 12px, borderRadius 8px, backgroundColor cor leve (variant primary/success/warning)
- Card 1 (Tonelagem):
  - Ícone: "📈" ou ícone SVG de tendência
  - Valor: "+12.5%" (verde) ou "-8.2%" (vermelho)
  - Label: "Tendência"
- Card 2 (Adesão):
  - Ícone: "✓" ou checkmark
  - Valor: "85%" 
  - Label: "Adesão"
  - Barra de progresso visual embaixo do valor
- Card 3 (Streak):
  - Ícone: "🔥" ou flame
  - Valor: "4" (semanas)
  - Label: "Semanas Seguidas"

**Animações**:
- Cada card fadeIn + slideUp em cascata (100ms stagger)
- Números "contadores": animam de 0 até valor final em 1200ms (easeOut)

### 5. `mobile/hooks/useStudentProgress.ts`
Hook customizado que busca/computa histórico de tonelagem, estatísticas de frequência e tendências.

**Responsabilidades**:
- Buscar dados de histórico de sessões do servidor
- Computar tonelagem semanal a partir de sessions
- Calcular tendência (comparar últimas 4 semanas com 4 anteriores)
- Calcular adesão e streak

**Assinatura**:
```typescript
export const useStudentProgress = (studentId: string) => {
  // Retorna:
  return {
    tonnageHistory: ChartDataPoint[];
    frequencyHistory: FrequencyDataPoint[];
    tonneageTrend: { value: number; direction: 'up' | 'down' | 'stable' };
    adherencePercent: number;
    currentStreak: number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
  };
};
```

**Lógica de Computação**:

1. **Tonelagem Semanal**:
   - Agrupar sessões por semana ISO (segunda-feira é primeiro dia)
   - Para cada sessão, calcular tonelagem: `sum(exercise.weight * exercise.reps * exercise.sets)`
   - Se dados de weight não estiverem disponíveis, usar RPE como proxy: `duration_seconds * (rpe / 10) * 0.5` kg
   - Retornar últimas 12 semanas com dados

2. **Tendência de Tonelagem**:
   - Média das últimas 4 semanas vs. 4 semanas anteriores
   - Calcular percentual de mudança: `((recent - previous) / previous) * 100`
   - Direction: up (> 5%), down (< -5%), stable (entre -5% e 5%)

3. **Frequência**:
   - Contar sessões completadas por semana
   - Comparar contra `expectedPerWeek` (de `useStudentDetail`)
   - `percentOfGoal = (completedSessions / expectedPerWeek) * 100`

4. **Adesão %**:
   - Total de sessões esperadas: `expectedPerWeek * numberOfWeeks`
   - Total de sessões completadas: count de recentSessions
   - `adherencePercent = (completed / expected) * 100`, capped at 100%

5. **Streak**:
   - Contar semanas consecutivas com pelo menos 1 sessão
   - Começar do final (semana mais recente) e ir para trás
   - Se última semana não tem sessão, streak = 0

**RPC Call**:
```typescript
// No servidor (FastAPI/Node):
// GET /api/students/{studentId}/progress-history
// Query params: ?weeks=12 (default)
// Response:
interface ProgressHistoryResponse {
  sessions: {
    id: string;
    workout_name: string;
    date: string; // ISO date
    duration_seconds: number;
    rpe: number;
    exercises: {
      name: string;
      weight: number; // kg
      reps: number;
      sets: number;
    }[];
    completed_at: string; // ISO datetime
  }[];
  expectedPerWeek: number;
}
```

**Caching e Refresh**:
- Cachear resultado por 5 minutos
- `refetch()` força busca mesmo com cache válido
- Usar `useQuery` do TanStack Query (React Query) se disponível, senão implementar com `useState` + `useEffect`

## Arquivo a Modificar

### `mobile/app/student/[id].tsx`
Adicionar ProgressCharts ao Overview tab, abaixo do SessionHeatmap.

**Mudanças**:
```typescript
// No Overview tab, após o SessionHeatmap:
import { ProgressCharts } from '@/components/trainer/student/ProgressCharts';

// Inside the Overview section:
<SessionHeatmap studentId={studentId} />

{/* NEW: Gráficos de Progressão */}
<ProgressCharts 
  studentId={studentId}
  refetchTrigger={refreshTimestamp}
  isLoading={isLoadingCharts}
/>
```

**Estados a Gerenciar**:
- `refreshTimestamp`: atualizado ao fazer pull-to-refresh
- `isLoadingCharts`: booleano que indica se os gráficos estão carregando
- Compartilhar estado de refresh com ProgressCharts para sincronizar atualização

## Tipos TypeScript (Interfaces)

```typescript
// Dados do gráfico de tonelagem
interface ChartDataPoint {
  week: number; // 1-12
  date: string; // ISO string (segunda-feira da semana)
  tonnage: number; // kg total da semana
  sessions: number; // quantidade de sessões na semana
}

// Dados do gráfico de frequência
interface FrequencyDataPoint {
  week: number;
  date: string; // ISO string
  completedSessions: number;
  percentOfGoal: number; // 0-100%
}

// Tendência
interface TrendData {
  value: number; // Percentual (ex: 12.5 para +12.5%)
  direction: 'up' | 'down' | 'stable';
}

// Retorno completo do hook
interface StudentProgressData {
  tonnageHistory: ChartDataPoint[];
  frequencyHistory: FrequencyDataPoint[];
  tonneageTrend: TrendData;
  adherencePercent: number;
  currentStreak: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## Padrões de Design e Estilo

### Cores
- **Tonelagem Acima da Meta**: `brand.primary (#7c3aed)` para linha principal
- **Trend Positivo**: `success (#16a34a)` com ícone ↑
- **Trend Negativo**: `error (#dc2626)` com ícone ↓
- **Trend Estável**: `gray-400 (#9ca3af)` com ícone —
- **Adesão Boa (>80%)**: `success`
- **Adesão Baixa (<60%)**: `warning`
- **Background Cards**: `colors.surface` (branco ou light gray conforme tema)

### Tipografia
- **Títulos**: Font size 14px, weight 600, cor `text.primary`
- **Valores Principais**: Font size 18px, weight 700, cor `text.primary`
- **Labels**: Font size 12px, weight 400, cor `text.secondary`
- **Badges**: Font size 11px, weight 600

### Animações
- **Duração Padrão**: 500-800ms
- **Easing Padrão**: `Easing.out(Easing.cubic)` ou `ease-out`
- **Entrada de Cards**: Fade + Slide up simultâneos
- **Linha do Gráfico**: Stroke-dasharray animation
- **Barras**: Crescem de baixo para cima
- **Números**: Counter animation com tween

### Acessibilidade
- Labels descritivos em SVG: `<text>` com id e `aria-label`
- Contraste mínimo WCAG AA (4.5:1 para texto pequeno)
- Touch targets mínimo 44x44px para pontos clicáveis no gráfico
- Suportar VoiceOver: fornecer descrição dos dados principais

## Dependências

### Já Disponíveis
- `react-native-svg`: Renderizar gráficos SVG em mobile
- `react-native-reanimated`: Animações suaves
- Design tokens Kinevo: `@kinevo/theme` ou similar

### Possivelmente Necessárias (Verificar)
- `react-native-svg-charts`: Biblioteca auxiliar (opcional, pode ser feito custom)
- `date-fns`: Manipulação de datas (ISO, formatação)
- `TanStack Query` / `React Query`: Caching de dados (opcional, se não usar Redux)

## Critérios de Aceite

1. **Renderização de Gráfico de Tonelagem**
   - [ ] Gráfico de linha SVG renderiza corretamente com dados de 8-12 semanas
   - [ ] Badge de tendência mostra (+/–) com percentual correto
   - [ ] Linha é suave (Bezier curves) e tem gradiente de preenchimento

2. **Renderização de Gráfico de Frequência**
   - [ ] Barras aparecem com cores corretas (verde atingiu, amarelo/vermelho não atingiu)
   - [ ] Linha de meta esperada é visível e correta
   - [ ] Labels de semana visíveis no eixo X

3. **Renderização de Summary Stats**
   - [ ] 3 cards (ou 1 coluna) exibem: Tendência, Adesão, Streak
   - [ ] Valores são computados corretamente
   - [ ] Ícones e cores contextuais aparecem

4. **Dados Computados Corretamente**
   - [ ] Tonelagem semanal é soma correta (weight × reps × sets) ou RPE proxy
   - [ ] Tendência compara últimas 4 semanas com anteriores
   - [ ] Adesão % é (sessões completas / esperadas) × 100
   - [ ] Streak conta semanas consecutivas com ≥1 sessão

5. **Animações e UX**
   - [ ] Cards fazem fade-in + slide-up ao montar (sem jank)
   - [ ] Linha do gráfico é "desenhada" ao aparecer
   - [ ] Barras crescem de baixo para cima em cascata
   - [ ] Contadores de números animam de 0 até valor final

6. **Interatividade e Refresh**
   - [ ] Pull-to-refresh atualiza dados e re-anima os gráficos
   - [ ] Estados de carregamento (skeleton/spinner) aparecem corretamente
   - [ ] Tocar em pontos do gráfico mostra tooltip com semana, data, valores
   - [ ] Erros de rede exibem mensagem amigável e botão retry

7. **Responsividade Mobile**
   - [ ] Cards e gráficos ocupam 100% da largura com padding lateral correto (16px)
   - [ ] Texto não transborda em telas pequenas
   - [ ] Touch targets dos pontos do gráfico são ≥44×44px

8. **Integração com Contexto Existente**
   - [ ] ProgressCharts integra com Overview tab do student/[id].tsx
   - [ ] Compartilha estado de refresh com SessionHeatmap
   - [ ] useStudentProgress usa dados de useStudentDetail quando disponível
   - [ ] Design tokens Kinevo aplicados corretamente (cores, espaçamento, shadows)

## Notas Adicionais

### Performance
- Limitar renderização a 12 semanas para manter performance
- Memoizar componentes com `React.memo()` para evitar re-renders desnecessários
- Usar `useCallback` para funções passadas como props

### Tratamento de Erros
- Se dados de tonelagem não estiverem disponíveis, usar RPE como proxy
- Se menos de 2 semanas de dados: mostrar estado "Dados Insuficientes"
- Erro ao buscar: exibir card com mensagem e botão "Tentar Novamente"

### Extensibilidade Futura
- Estrutura permite adicionar novos gráficos facilmente (ex: Força, Velocidade)
- Hook `useStudentProgress` pode ser expandido com mais métricas
- Suportar filtros por tipo de exercício ou programa

### Checklist de Implementação
- [ ] Criar pasta `mobile/components/trainer/student/` se não existir
- [ ] Criar todos 5 arquivos (.tsx, .ts)
- [ ] Testar renderização em device/emulator
- [ ] Verificar animações sem jank (60fps)
- [ ] Integrar com API backend (RPC `/api/students/{id}/progress-history`)
- [ ] Adicionar testes unitários para lógica de computação (tendência, adesão)
- [ ] Adicionar testes de snapshot para componentes
- [ ] Documentar interface RPC no backend
- [ ] Verificar acessibilidade (VoiceOver, contrast)
