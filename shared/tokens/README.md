# `@kinevo/shared/tokens`

Single source of truth para os design tokens compartilhados entre `web` e `mobile`.

Source of truth conceitual dos valores: [`Kinevo_Mobile_Trainer_Redesign_v2.md`](../../Kinevo_Mobile_Trainer_Redesign_v2.md), seção 4 (4.1 a 4.6).

## Estrutura

```
shared/tokens/
├── index.ts          ← reexporta legacy como default + v2 como namespace
├── legacy/           ← paleta atual (preserva visual existente)
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radius.ts
│   ├── shadows.ts    ← cross-platform (ios/android/web)
│   └── motion.ts
└── v2/               ← Kinevo Premium DS v2 (Fases 1+, ainda não consumido)
    ├── colors.ts
    ├── typography.ts
    ├── spacing.ts
    ├── radius.ts
    ├── shadows.ts
    └── motion.ts
```

- `legacy/` — valores em produção. Consumido por `mobile/theme/*` (reexport) e implícito no `web/src/app/globals.css` (Shield Strategy).
- `v2/` — paleta forward-looking. Hoje só alimenta `web/src/app/_tokens.generated.css` (vars `--k-*` que componentes V2 usarão).

## Uso

### Mobile / código compartilhado

```ts
import { colors, spacing, typography, shadows, radius, motion } from '@kinevo/shared/tokens';
// colors.brand.primary === '#7c3aed' (legacy)

// Opt-in pra paleta nova:
import { v2 } from '@kinevo/shared/tokens';
v2.colors.purple[600];   // '#7C3AED'
v2.getFontFamily(700);   // 'PlusJakartaSans_700Bold'
```

### Web (CSS via Tailwind v4)

Componentes V2 podem consumir as vars geradas em `_tokens.generated.css`:

```tsx
<div className="bg-[var(--k-purple-600)] rounded-[var(--k-radius-md)]" />
```

Componentes existentes mantêm seus hex hardcoded (Shield Strategy, ver `web/CLAUDE.md`).

## Adicionar token novo

1. Adicione em `v2/<arquivo>.ts` (paleta nova, recomendado) ou `legacy/<arquivo>.ts` (somente se for valor já em produção).
2. Reexporte do `index.ts` da subpasta correspondente.
3. Para o web: rode `npm run tokens:sync` na raiz (regenera `web/src/app/_tokens.generated.css`). O `prebuild` do web já roda isso em CI.
4. Atualize o snapshot: `npm test --workspace=shared` (revisar mudança no snapshot diff antes de commitar).

## Integração e workflow

- **Tipos**: tudo `as const` + tipos exportados (`Color`, `Typography`, etc.).
- **Cross-platform**: arquivos do shared não importam `react-native`. `Platform.select` é responsabilidade do consumidor (`mobile/theme/shadows.ts`).
- **Snapshot tests**: `shared/tokens/__tests__/snapshot.test.ts` falha se um valor mudar acidentalmente.
- **Sync web**: `web/scripts/sync-tokens.mjs` parseia `v2/*.ts` (Node puro, sem ts-node) e gera o CSS. Roda no `prebuild`.
