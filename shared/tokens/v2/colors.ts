// Kinevo Premium DS v2 — paleta forward-looking.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.1.

const purple = {
  50: "#F5F3FF",
  100: "#EDE9FE",
  200: "#DDD6FE",
  300: "#C4B5FD",
  400: "#A78BFA",
  500: "#8B5CF6",
  600: "#7C3AED",
  700: "#6D28D9",
  800: "#5B21B6",
  900: "#4C1D95",
  950: "#2E1065",
} as const;

const neutral = {
  0: "#FFFFFF",
  50: "#FAFAFA",
  100: "#F4F4F5",
  200: "#E4E4E7",
  300: "#D4D4D8",
  400: "#A1A1AA",
  500: "#71717A",
  600: "#52525B",
  700: "#3F3F46",
  800: "#27272A",
  900: "#18181B",
  950: "#09090B",
} as const;

const semantic = {
  success: { bg: "#D1FAE5", fg: "#047857", default: "#10B981" },
  warning: { bg: "#FEF3C7", fg: "#B45309", default: "#F59E0B" },
  danger: { bg: "#FEE2E2", fg: "#B91C1C", default: "#EF4444" },
  info: { bg: "#DBEAFE", fg: "#1D4ED8", default: "#3B82F6" },
} as const;

const surface = {
  canvas: "#F4F5F8",
  card: "#FFFFFF",
  card2: "#FAFAFA",
  tintPurple: "rgba(124,58,237,0.04)",
  glass: "rgba(255,255,255,0.78)",
} as const;

const surfaceDark = {
  canvas: "#09090B",
  card: "#18181B",
  card2: "#27272A",
  tintPurple: "rgba(124,58,237,0.10)",
  glass: "rgba(24,24,27,0.78)",
} as const;

const text = {
  primary: "#09090B",
  secondary: "#3F3F46",
  tertiary: "#71717A",
  quaternary: "#A1A1AA",
} as const;

const textDark = {
  primary: "#FAFAFA",
  secondary: "#A1A1AA",
  tertiary: "#71717A",
  quaternary: "#52525B",
} as const;

const border = {
  default: "#E4E4E7",
  subtle: "rgba(0,0,0,0.04)",
} as const;

const borderDark = {
  default: "rgba(255,255,255,0.08)",
  subtle: "rgba(255,255,255,0.04)",
} as const;

export const colors = {
  purple,
  neutral,
  semantic,
  surface,
  text,
  border,
  // Aliases para tokens semânticos referenciados no master doc §4.1
  brand: {
    primary: purple[600],
    primaryLight: purple[100],
    primaryDark: purple[700],
  },
} as const;

// Dark mode counterpart. Brand/semantic/neutral palettes ficam iguais
// (cores brand independem de modo). Apenas surface/text/border invertem.
export const colorsDark = {
  purple,
  neutral,
  semantic,
  surface: surfaceDark,
  text: textDark,
  border: borderDark,
  brand: {
    primary: purple[600],
    primaryLight: purple[100],
    primaryDark: purple[700],
  },
} as const;

export type Color = typeof colors;
export type ColorScheme = "light" | "dark";
