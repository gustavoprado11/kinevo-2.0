# Kinevo Premium DS v2 — `mobile/components/v2/`

Biblioteca de componentes premium V2 do Kinevo. Coexistem com os componentes existentes em `mobile/components/`.
**Aplicação às telas é Fase 2.** Esta pasta é a fonte verdade visual a partir da Fase 1.

Specs e contexto:

- Master doc: [`Kinevo_Mobile_Trainer_Redesign_v2.md`](../../../Kinevo_Mobile_Trainer_Redesign_v2.md) — seção 4 (tokens) e seção 5 (component patterns).
- Fase 0 (tokens compartilhados): [`SPEC_FASE_0.md`](../../../SPEC_FASE_0.md).
- Fase 1 (esta entrega): [`SPEC_FASE_1.md`](../../../SPEC_FASE_1.md).

## Filosofia

- Nenhum hex hardcoded. Tudo via `import { v2 } from '@kinevo/shared/tokens'`.
- Componentes apresentacionais (zero acoplamento com Expo Router, contexts ou data fetching).
- Touch target ≥44pt em qualquer interativo (HIG).
- `accessibilityLabel`/`accessibilityRole` obrigatórios em qualquer Pressable.
- Animações via `react-native-reanimated` (não `Animated` core).
- Haptics via `expo-haptics` em interações primárias (button press, tab switch, segmented switch).

## Componentes

| Componente | Arquivo | Resumo |
|---|---|---|
| `KCard` | [`KCard.tsx`](./KCard.tsx) | Shell padrão. 3 variants: default, elevated, tinted. Pressable opcional. |
| `KStatus` | [`KStatus.tsx`](./KStatus.tsx) | Indicador semântico unificado. Layouts dot/pill, 5 types. |
| `Avatar` | [`Avatar.tsx`](./Avatar.tsx) | Gradient determinístico por nome + initials, com optional foto e status overlay. |
| `KButton` | [`KButton.tsx`](./KButton.tsx) | 4 variants (primary/ghost/outline/destructive), 3 sizes, motion + haptics. |
| `KSegmented` | [`KSegmented.tsx`](./KSegmented.tsx) | Segmented control com active pill animado (spring). |
| `KSearchBox` | [`KSearchBox.tsx`](./KSearchBox.tsx) | Input de busca com ícone + slot ⌘K / clear. |
| `KPICard` | [`KPICard.tsx`](./KPICard.tsx) | KPI composite com sparkline SVG (`react-native-svg`) + delta indicator. |
| `BottomNav` | [`BottomNav.tsx`](./BottomNav.tsx) | Liquid Glass tab bar floating com active pill animado. |
| `KSkeleton` | [`KSkeleton.tsx`](./KSkeleton.tsx) | Placeholder shimmer animado pra loading states. Variants `rect`/`circle`/`pill` + composições `KSkeletonRow`/`KSkeletonKPICard`. |

## Tokens

```ts
import { v2 } from '@kinevo/shared/tokens';
const { colors, typography, spacing, radius, shadows, motion } = v2;

colors.purple[600];           // '#7C3AED'
colors.semantic.success;      // { bg, fg, default }
typography.title2;            // { size, lineHeight, weight, letterSpacing }
spacing[4];                   // 16
radius.md;                    // 12
shadows.xs.ios;               // { shadowColor, shadowOffset, shadowOpacity, shadowRadius }
motion.easings.spring;        // [0.32, 0.72, 0, 1]
```

## Showcase

A rota dev `mobile/app/(dev)/components-showcase.tsx` renderiza todos os componentes em estados representativos. Acesso:

1. Em **dev** mode (Expo Go ou dev build), abrir Mais (Trainer Mode).
2. Long-press (800ms) no texto de versão no rodapé ("Kinevo v1.x.x — Modo Treinador").
3. Showcase abre. Toggle Light/Dark no topo pra inspecionar contraste.

Em **production** (`__DEV__ === false`), o long-press é no-op e a rota `(dev)/components-showcase` retorna `null`.

## Convenções de motion

- **Spring**: `{ damping: 22-24, stiffness: 280, mass: 0.8 }` — usado em pill switches (KSegmented, BottomNav active state).
- **Timing**: 90ms press-in, 140ms press-out, 240ms transição padrão (ver `motion.durations.default`).
- **Easing**: `motion.easings.spring` (cubic-bezier `[0.32, 0.72, 0, 1]`) — Apple-style.
- **Tap feedback**: scale 0.97 (KButton) ou 0.99 (KCard) ou 0.94 (BottomNav tab).

## Convenções de haptics

- `Haptics.ImpactFeedbackStyle.Light` em press de KButton e BottomNav.
- `Haptics.selectionAsync()` em switch de KSegmented.
- KCard pressable usa o haptic default do `PressableScale`.
- Interações destrutivas (futuro): `Haptics.notificationAsync(Warning)`.

## Como adicionar um componente novo

1. Criar arquivo `KSomething.tsx` em `mobile/components/v2/`.
2. Importar tokens via `import { v2 } from '@kinevo/shared/tokens'`. **Nunca** importar `legacy`.
3. Exportar tipos públicos (`KSomethingProps`, variants, sizes).
4. Adicionar ao barrel `index.ts`.
5. Adicionar ao showcase com 3-5 variantes representativas.
6. Atualizar a tabela de "Componentes" deste README.

## Próximo (Fase 2)

Aplicar componentes v2 às 5 telas (Home, Alunos, Mensagens, Forms, Mais). **Spec separada virá em outro doc.**
