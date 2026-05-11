// Kinevo Premium DS v2 — elevation system.
// 4 níveis (flat / raised / floating / hero) que adaptam light ↔ dark.
//
// Light: shadows rgba(black) com elevação real (HIG-style depth).
// Dark:  borders accent + glow sutil (shadows são quase invisíveis em fundo escuro,
//        então a elevação é comunicada por contorno + halo púrpura).
//
// Estrutura cross-platform por variante (light/dark):
//   { ios, android, web, border? }
// - ios:     Native shadow* props (RN)
// - android: { elevation: number }
// - web:     CSS box-shadow string
// - border:  { color, width } — usado principalmente no modo dark para reforço de contorno
//
// Sem import de 'react-native' — shared roda em web e mobile.

type NativeIOSShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
};

type NativeAndroidShadow = { elevation: number };

type ElevationBorder = {
  color: string;
  width: number;
};

type ElevationVariant = {
  ios: NativeIOSShadow;
  android: NativeAndroidShadow;
  web: string;
  border?: ElevationBorder;
};

type ElevationToken = {
  light: ElevationVariant;
  dark: ElevationVariant;
};

// Light — sombra preta neutral-950
const LIGHT_SHADOW = "#09090B";

// Dark — accent purple-600 da paleta v2
const DARK_ACCENT = "#7C3AED";
const DARK_BORDER_SUBTLE = "rgba(124,58,237,0.18)"; // contorno mais discreto
const DARK_BORDER_DEFAULT = "rgba(124,58,237,0.28)";
const DARK_BORDER_STRONG = "rgba(124,58,237,0.42)";
const DARK_BORDER_HERO = "rgba(139,92,246,0.55)"; // purple-500 mais vibrante

export const elevation: Record<
  'flat' | 'raised' | 'floating' | 'hero',
  ElevationToken
> = {
  // flat: sem elevação — superfície base, mesmo nível do canvas.
  flat: {
    light: {
      ios: {
        shadowColor: LIGHT_SHADOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: { elevation: 0 },
      web: "none",
    },
    dark: {
      ios: {
        shadowColor: LIGHT_SHADOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: { elevation: 0 },
      web: "none",
      border: { color: DARK_BORDER_SUBTLE, width: 1 },
    },
  },

  // raised: cards normais — leve elevação acima da superfície.
  raised: {
    light: {
      ios: {
        shadowColor: LIGHT_SHADOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: "0 2px 6px rgba(9,9,11,0.05), 0 1px 2px rgba(9,9,11,0.04)",
    },
    dark: {
      ios: {
        shadowColor: DARK_ACCENT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: "0 2px 8px rgba(124,58,237,0.12)",
      border: { color: DARK_BORDER_DEFAULT, width: 1 },
    },
  },

  // floating: bottom sheets, popovers, FABs — elevação clara, separação do fundo.
  floating: {
    light: {
      ios: {
        shadowColor: LIGHT_SHADOW,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      web: "0 8px 20px rgba(9,9,11,0.08), 0 2px 6px rgba(9,9,11,0.05)",
    },
    dark: {
      ios: {
        shadowColor: DARK_ACCENT,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: { elevation: 8 },
      web: "0 6px 18px rgba(124,58,237,0.22), 0 2px 8px rgba(124,58,237,0.14)",
      border: { color: DARK_BORDER_STRONG, width: 1 },
    },
  },

  // hero: CTAs principais, cards de destaque — elevação máxima, foco visual.
  hero: {
    light: {
      ios: {
        shadowColor: LIGHT_SHADOW,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 36,
      },
      android: { elevation: 14 },
      web: "0 16px 36px rgba(9,9,11,0.12), 0 4px 12px rgba(9,9,11,0.06)",
    },
    dark: {
      ios: {
        shadowColor: DARK_ACCENT,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.36,
        shadowRadius: 32,
      },
      android: { elevation: 14 },
      web: "0 10px 32px rgba(124,58,237,0.36), 0 4px 12px rgba(124,58,237,0.20)",
      border: { color: DARK_BORDER_HERO, width: 1 },
    },
  },
} as const;

export type Elevation = typeof elevation;
export type ElevationLevel = keyof typeof elevation;
export type ElevationMode = 'light' | 'dark';
