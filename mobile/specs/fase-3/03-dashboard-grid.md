# Spec 03 — Dashboard & Stats (Grid Layout)

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
O dashboard atual usa `ScrollView` com `paddingHorizontal: 20` e StatCards em stack vertical. No tablet, os cards ficam esticados de ponta a ponta, ocupando toda a largura sem necessidade. Gráficos ficam enormes e desproporcionais.

**Dependência: Spec 01 (useResponsive, ResponsiveContainer)**

## Objetivo
Dashboard adaptativo com grid multi-coluna no tablet, conteúdo centralizado com max-width, e gráficos dimensionados proporcionalmente.

## Escopo

### Incluído
- StatCards em grid 2x2 (tablet) vs stack vertical (phone)
- Seções em 2 colunas quando cabem (ex: gráfico + lista lado a lado)
- `ResponsiveContainer` para centralizar conteúdo
- Responsive padding e font sizes via tokens

### Excluído
- Mudanças de dados ou queries
- Novas métricas ou cards
- Navegação (Spec 02)

## Arquivos Afetados

### Novos
- `mobile/components/shared/ResponsiveGrid.tsx` — grid genérico baseado em columns

### Modificados
- `mobile/app/(trainer-tabs)/dashboard.tsx` — layout responsivo
- `mobile/components/trainer/dashboard/StatCard.tsx` — padding/font adaptativo
- `mobile/components/trainer/dashboard/` — demais cards com tokens responsivos

## Comportamento Esperado

### ResponsiveGrid

```typescript
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: { phone: number; tablet: number };
  gap?: number;
}

// Usage:
<ResponsiveGrid columns={{ phone: 1, tablet: 2 }} gap={16}>
  <StatCard title="Alunos" value={42} />
  <StatCard title="Receita" value="R$ 12.500" />
  <StatCard title="Treinos Hoje" value={8} />
  <StatCard title="Pendências" value={3} />
</ResponsiveGrid>
```

**Phone:** 1 coluna, cards empilhados (comportamento atual).
**Tablet:** 2 colunas, cards em grid 2x2.
**Tablet Landscape:** Opcionalmente 3 colunas se width > 1024.

### Dashboard Layout (Tablet)

```
┌─────────────────────────────────────────────┐
│           ← max-width: 1200px →             │
│                                             │
│  ┌──────────┐ ┌──────────┐                  │
│  │ Alunos   │ │ Receita  │   StatCards      │
│  │    42    │ │ R$12.500 │   em grid 2x2    │
│  └──────────┘ └──────────┘                  │
│  ┌──────────┐ ┌──────────┐                  │
│  │ Treinos  │ │ Pendênc. │                  │
│  │     8    │ │     3    │                  │
│  └──────────┘ └──────────┘                  │
│                                             │
│  ┌─────────────────┐ ┌─────────────────┐    │
│  │   Gráfico de    │ │   Atividade     │    │
│  │   Receita MRR   │ │   Recente       │    │
│  │                 │ │                 │    │
│  └─────────────────┘ └─────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │        Alunos Ativos (lista)        │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### StatCard Adaptações
- **Phone**: padding 16px, icon 36x36, title 12px, value 20px
- **Tablet**: padding 20px, icon 44x44, title 14px, value 24px
- Usar `fontScale` e `spacingScale` do `useResponsive()`

## Critérios de Aceite
- [ ] Phone: layout idêntico ao atual
- [ ] Tablet portrait: StatCards em grid 2x2
- [ ] Tablet landscape: StatCards em grid 2x2 ou 4x1
- [ ] Conteúdo centralizado com max-width no tablet
- [ ] Font sizes e spacing escalonados proporcionalmente
- [ ] ScrollView funcional em ambos os modos
- [ ] Sem novos erros de TypeScript

## Edge Cases
- Número ímpar de StatCards → último card ocupa largura full em tablet
- Dados carregando (skeleton) → skeletons também em grid
- Pull-to-refresh → funciona igual em ambos os modos

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `ResponsiveGrid` — calcula largura de cada child baseado em columns e gap
- [ ] Layout helpers — distribui items corretamente em 1, 2 e 3 colunas

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
