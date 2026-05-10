// Kinevo Premium DS v2 — Plus Jakarta Sans scale.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.2.

export const FONT_FAMILY = "PlusJakartaSans";

// Nomes registrados pelo @expo-google-fonts/plus-jakarta-sans (mobile useFonts).
export const FONT_FAMILIES = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
} as const;

export type FontWeight = keyof typeof FONT_FAMILIES;

export function getFontFamily(weight: FontWeight): string {
  return FONT_FAMILIES[weight];
}

export const typography = {
  display: { size: 32, lineHeight: 38, weight: "800", letterSpacing: -0.04 },
  title1: { size: 24, lineHeight: 30, weight: "700", letterSpacing: -0.03 },
  title2: { size: 20, lineHeight: 26, weight: "700", letterSpacing: -0.02 },
  title3: { size: 17, lineHeight: 22, weight: "600", letterSpacing: -0.01 },
  body: { size: 15, lineHeight: 22, weight: "500", letterSpacing: -0.005 },
  bodySm: { size: 13, lineHeight: 18, weight: "500", letterSpacing: -0.005 },
  caption: { size: 12, lineHeight: 16, weight: "500", letterSpacing: 0 },
  micro: { size: 11, lineHeight: 14, weight: "700", letterSpacing: 0.1 },
} as const;

export type Typography = typeof typography;
