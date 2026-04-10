# Spec: Tokens de Design Centralizados

## Objetivo
Criar um sistema de tokens de design centralizado e migrar todas as cores, espaçamentos e tipografia hard-coded para referências ao tema. Isso elimina inconsistências visuais e prepara a infraestrutura para dark mode futuro.

## Contexto
O codebase mobile tem 50+ instâncias de cores hard-coded espalhadas:
- `#F2F2F7` (background) — 15+ ocorrências
- `#7c3aed` (primary/purple) — 20+ ocorrências
- `#1a1a2e`, `#0f172a` (text) — variações inconsistentes
- `#94a3b8`, `#64748b`, `#cbd5e1` (secondary text) — 3 tons diferentes usados indistintamente
- `#ffffff` (card background) — 10+ ocorrências

## Arquivos a criar

### `mobile/theme/colors.ts`
```tsx
export const colors = {
    // Backgrounds
    background: {
        primary: '#F2F2F7',    // Tela principal
        card: '#FFFFFF',        // Cards e surfaces
        elevated: '#FFFFFF',    // Modais e sheets
        inset: '#E5E7EB',      // Inputs, search bars
    },
    // Text
    text: {
        primary: '#0f172a',     // Títulos e texto principal
        secondary: '#64748b',   // Subtítulos
        tertiary: '#94a3b8',    // Labels, placeholders
        quaternary: '#cbd5e1',  // Texto desabilitado
        inverse: '#FFFFFF',     // Texto sobre fundos escuros
    },
    // Brand
    brand: {
        primary: '#7c3aed',     // Roxo Kinevo
        primaryLight: '#ede9fe', // Background de accent
        primaryDark: '#6d28d9',  // Hover/pressed state
    },
    // Semantic
    success: {
        default: '#16a34a',
        light: '#f0fdf4',
    },
    warning: {
        default: '#f59e0b',
        light: '#fffbeb',
    },
    error: {
        default: '#ef4444',
        light: '#fef2f2',
    },
    info: {
        default: '#3b82f6',
        light: '#eff6ff',
    },
    // Borders
    border: {
        primary: 'rgba(0,0,0,0.04)',
        secondary: 'rgba(0,0,0,0.08)',
        focused: '#7c3aed',
    },
    // Status badges
    status: {
        active: '#16a34a',
        activeBg: '#f0fdf4',
        inactive: '#94a3b8',
        inactiveBg: '#f1f5f9',
        pending: '#f59e0b',
        pendingBg: '#fffbeb',
        online: '#3b82f6',
        onlineBg: '#eff6ff',
        presencial: '#8b5cf6',
        presencialBg: '#f5f3ff',
    },
} as const

export type Colors = typeof colors
```

### `mobile/theme/spacing.ts`
```tsx
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
} as const
```

### `mobile/theme/typography.ts`
```tsx
export const typography = {
    // Sizes
    size: {
        xs: 11,
        sm: 12,
        md: 13,
        base: 14,
        lg: 16,
        xl: 18,
        '2xl': 20,
        '3xl': 24,
        '4xl': 32,
    },
    // Weights (React Native string format)
    weight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        extrabold: '800' as const,
    },
    // Line heights
    lineHeight: {
        tight: 1.2,
        normal: 1.4,
        relaxed: 1.6,
    },
} as const
```

### `mobile/theme/shadows.ts`
```tsx
import { Platform } from 'react-native'

export const shadows = {
    sm: Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
        android: { elevation: 1 },
    }),
    md: Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
    }),
    lg: Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
        android: { elevation: 4 },
    }),
} as const
```

### `mobile/theme/index.ts`
```tsx
export { colors } from './colors'
export { spacing } from './spacing'
export { typography } from './typography'
export { shadows } from './shadows'

// Convenience re-exports
export { colors as c, spacing as s, typography as t, shadows as sh } from './index'
```

## Arquivos a modificar (migração)
Fazer find-and-replace progressivo nos seguintes arquivos, substituindo cores literais por referências:

| Literal | Token | Arquivos afetados |
|---------|-------|-------------------|
| `"#F2F2F7"` | `colors.background.primary` | dashboard.tsx, students.tsx, forms.tsx, student/[id].tsx, _layout.tsx |
| `"#7c3aed"` | `colors.brand.primary` | _layout.tsx, StatCard.tsx, StudentCard.tsx, PressableScale.tsx, + hooks |
| `"#ffffff"` / `"#FFFFFF"` | `colors.background.card` | StatCard.tsx, StudentCard.tsx, EmptyState.tsx |
| `"#0f172a"` | `colors.text.primary` | StatCard.tsx, StudentCard.tsx, dashboard.tsx |
| `"#94a3b8"` | `colors.text.tertiary` | StatCard.tsx, EmptyState.tsx, StudentFilterChips.tsx |
| `"#64748b"` | `colors.text.secondary` | StatCard.tsx, EmptyState.tsx |
| `"#16a34a"` | `colors.success.default` | status badges em StudentCard.tsx |
| `"#ef4444"` | `colors.error.default` | badges e error states |

**IMPORTANTE:** Migrar os componentes de `components/trainer/` primeiro (StatCard, StudentCard, StudentFilterChips) porque são os mais reutilizados. Depois migrar as telas.

## Critérios de aceite
- [ ] Diretório `mobile/theme/` criado com 5 arquivos
- [ ] Zero cores hard-coded nos componentes em `components/trainer/`
- [ ] Zero cores hard-coded nas telas em `app/(trainer-tabs)/`
- [ ] App visualmente idêntico ao estado atual (nenhuma mudança visual)
- [ ] Import path funciona: `import { colors, spacing } from '@/theme'`
