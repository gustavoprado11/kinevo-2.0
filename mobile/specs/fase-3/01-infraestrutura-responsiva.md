# Spec 01 — Infraestrutura Responsiva

## Status
- [x] Rascunho
- [ ] Em implementação
- [ ] Concluída

## Contexto
O app não possui nenhum sistema de breakpoints, hooks responsivos ou tokens adaptativos. Todas as 6 specs seguintes dependem dessa infraestrutura. Sem ela, não há como detectar se o app roda em phone ou tablet, nem reagir a mudanças de orientação.

## Objetivo
Criar a camada foundational de responsividade: hook central, breakpoints, tokens adaptativos e container responsivo.

## Escopo

### Incluído
- Hook `useResponsive()` com detecção de device type e orientação
- Sistema de breakpoints (`phone` / `tablet`)
- Tokens adaptativos de spacing, typography e layout
- Componente `ResponsiveContainer` com max-width
- Habilitar orientação landscape no app.json
- Migrar 6 componentes de `Dimensions.get()` → `useWindowDimensions()`

### Excluído
- Mudanças de navegação (Spec 02)
- Layouts específicos de tela (Specs 03-07)

## Arquivos Afetados

### Novos
- `mobile/hooks/useResponsive.ts`
- `mobile/theme/breakpoints.ts`
- `mobile/theme/responsive.ts`
- `mobile/components/shared/ResponsiveContainer.tsx`

### Modificados
- `mobile/app.json` — orientation, iPad config
- `mobile/theme/index.ts` — exportar novos tokens
- `mobile/components/home/WeekCalendar.tsx` — migrar Dimensions
- `mobile/components/home/UnifiedCalendar.tsx` — migrar Dimensions
- `mobile/components/workout/ShareWorkoutModal.tsx` — migrar Dimensions
- `mobile/components/workout/WorkoutCelebration.tsx` — migrar Dimensions
- `mobile/components/workout/WorkoutSuccessModal.tsx` — migrar Dimensions
- `mobile/components/workout/ExerciseVideoModal.tsx` — migrar Dimensions

## Comportamento Esperado

### Hook `useResponsive()`

```typescript
import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export interface ResponsiveInfo {
  // Device classification
  isTablet: boolean;       // width >= 768
  isPhone: boolean;        // width < 768

  // Orientation
  isLandscape: boolean;
  isPortrait: boolean;

  // Raw dimensions (reactive)
  width: number;
  height: number;

  // Layout helpers
  columns: 1 | 2 | 3;    // suggested column count
  contentMaxWidth: number; // max-width for centered content
  sidebarWidth: number;   // sidebar width when applicable (0 on phone)

  // Scaling
  fontScale: number;      // 1.0 phone, 1.15 tablet
  spacingScale: number;   // 1.0 phone, 1.25 tablet
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= 768;
    const isLandscape = width > height;

    return {
      isTablet,
      isPhone: !isTablet,
      isLandscape,
      isPortrait: !isLandscape,
      width,
      height,
      columns: isTablet ? (isLandscape ? 3 : 2) : 1,
      contentMaxWidth: isTablet ? 1200 : width,
      sidebarWidth: isTablet ? (isLandscape ? 320 : 280) : 0,
      fontScale: isTablet ? 1.15 : 1.0,
      spacingScale: isTablet ? 1.25 : 1.0,
    };
  }, [width, height]);
}
```

### Breakpoints

```typescript
// theme/breakpoints.ts
export const breakpoints = {
  phone: 0,
  tablet: 768,
  tabletLarge: 1024,
} as const;

export type DeviceType = 'phone' | 'tablet';

export function getDeviceType(width: number): DeviceType {
  return width >= breakpoints.tablet ? 'tablet' : 'phone';
}
```

### Tokens Responsivos

```typescript
// theme/responsive.ts
import { spacing } from './spacing';
import { typography } from './typography';

export function getResponsiveSpacing(scale: number) {
  return {
    xs: Math.round(spacing.xs * scale),
    sm: Math.round(spacing.sm * scale),
    md: Math.round(spacing.md * scale),
    lg: Math.round(spacing.lg * scale),
    xl: Math.round(spacing.xl * scale),
    '2xl': Math.round(spacing['2xl'] * scale),
    '3xl': Math.round(spacing['3xl'] * scale),
    '4xl': Math.round(spacing['4xl'] * scale),
    '5xl': Math.round(spacing['5xl'] * scale),
    // Extras para tablet
    screenPadding: scale >= 1.25 ? 32 : 20,
    cardPadding: scale >= 1.25 ? 20 : 14,
    sectionGap: scale >= 1.25 ? 24 : 16,
  };
}

export function getResponsiveTypography(scale: number) {
  return {
    size: {
      xs: Math.round(typography.size.xs * scale),
      sm: Math.round(typography.size.sm * scale),
      md: Math.round(typography.size.md * scale),
      base: Math.round(typography.size.base * scale),
      lg: Math.round(typography.size.lg * scale),
      xl: Math.round(typography.size.xl * scale),
      '2xl': Math.round(typography.size['2xl'] * scale),
      '3xl': Math.round(typography.size['3xl'] * scale),
      '4xl': Math.round(typography.size['4xl'] * scale),
    },
    weight: typography.weight,
    lineHeight: typography.lineHeight,
  };
}

export const layout = {
  phone: {
    contentMaxWidth: Infinity,  // full width
    screenPadding: 20,
    columns: 1,
    modalStyle: 'fullscreen' as const,
  },
  tablet: {
    contentMaxWidth: 1200,
    screenPadding: 32,
    columns: 2,
    modalStyle: 'sheet' as const,
  },
};
```

### ResponsiveContainer

```typescript
// components/shared/ResponsiveContainer.tsx
import { View, StyleSheet } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface Props {
  children: React.ReactNode;
  maxWidth?: number;
  padding?: boolean;
  style?: any;
}

export function ResponsiveContainer({
  children,
  maxWidth,
  padding = true,
  style,
}: Props) {
  const { contentMaxWidth, spacingScale } = useResponsive();
  const effectiveMax = maxWidth ?? contentMaxWidth;
  const px = padding ? Math.round(20 * spacingScale) : 0;

  return (
    <View style={[
      styles.container,
      { maxWidth: effectiveMax, paddingHorizontal: px },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
```

### app.json — Mudanças

```diff
{
  "expo": {
-   "orientation": "portrait",
+   "orientation": "default",
    "ios": {
      "supportsTablet": true,
+     "requiresFullScreen": false,
+     "infoPlist": {
+       "UISupportedInterfaceOrientations~ipad": [
+         "UIInterfaceOrientationPortrait",
+         "UIInterfaceOrientationPortraitUpsideDown",
+         "UIInterfaceOrientationLandscapeLeft",
+         "UIInterfaceOrientationLandscapeRight"
+       ]
+     }
    }
  }
}
```

**Nota**: No celular, manter portrait-only via lock programático no root layout (apenas iPad ganha landscape).

### Migração de Dimensions

**Antes (estático, não reage a mudanças):**
```typescript
const SCREEN_WIDTH = Dimensions.get("window").width;
```

**Depois (reativo):**
```typescript
const { width } = useResponsive();
// ou se o componente não precisa de outros dados:
const { width } = useWindowDimensions();
```

## Critérios de Aceite
- [ ] `useResponsive()` retorna dados corretos em phone e tablet
- [ ] `useResponsive()` reage a mudanças de orientação no iPad
- [ ] Breakpoint de 768px classifica corretamente iPhone vs iPad
- [ ] `ResponsiveContainer` centraliza conteúdo com max-width no tablet
- [ ] `ResponsiveContainer` usa full-width no phone
- [ ] Design tokens escalam corretamente (font 1.15x, spacing 1.25x no tablet)
- [ ] Orientação landscape funciona no iPad sem quebrar layout do phone
- [ ] 6 componentes migrados de `Dimensions.get()` sem regressão visual
- [ ] iPhone continua travado em portrait
- [ ] Sem novos erros de TypeScript
- [ ] Retrocompatível — zero mudanças visuais no celular

## Edge Cases
- iPad em Split View (largura reduzida) → deve se comportar como phone se width < 768
- iPad Mini (744px de largura em portrait) → fica como phone, landscape como tablet
- Orientação mudando com modal aberto → modal deve se adaptar ou manter posição
- Troca rápida portrait↔landscape → sem flicker ou estado inconsistente

## Testes Requeridos

### Lógica Pura (unitários — obrigatório)
- [ ] `getDeviceType(width)` — retorna 'phone' para < 768, 'tablet' para >= 768
- [ ] `getResponsiveSpacing(1.0)` — retorna valores originais
- [ ] `getResponsiveSpacing(1.25)` — retorna valores escalonados e arredondados
- [ ] `getResponsiveTypography(1.15)` — font sizes escalonados corretamente
- [ ] `layout.phone` vs `layout.tablet` — constantes corretas

### Hook (recomendado)
- [ ] `useResponsive()` — isTablet/isPhone correto para diferentes widths
- [ ] `useResponsive()` — columns retorna 1/2/3 baseado em width e orientação
- [ ] `useResponsive()` — contentMaxWidth 1200 no tablet, width no phone

## Notas de Implementação
(Preenchido pelo executor durante/após a implementação)
