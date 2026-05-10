// Kinevo Premium DS v2 — shadow scale.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.5.
//
// Cross-platform: cada token expõe `web` (string CSS) e `ios`/`android` (RN).
// Sem import de 'react-native' — shared roda em web e mobile.

type NativeIOSShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
};

type NativeAndroidShadow = { elevation: number };

type ShadowToken = {
  ios: NativeIOSShadow;
  android: NativeAndroidShadow;
  web: string;
};

const SHADOW_COLOR = "#09090B"; // neutral-950 da paleta v2

export const shadows: Record<
  'xs' | 'sm' | 'md' | 'lg' | 'glowPurple' | 'glass',
  ShadowToken
> = {
  xs: {
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    web: "0 1px 2px rgba(9,9,11,0.04)",
  },
  sm: {
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    web: "0 1px 3px rgba(9,9,11,0.06), 0 1px 2px rgba(9,9,11,0.04)",
  },
  md: {
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    web: "0 4px 12px rgba(9,9,11,0.06), 0 2px 4px rgba(9,9,11,0.04)",
  },
  lg: {
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 32,
    },
    android: { elevation: 8 },
    web: "0 12px 32px rgba(9,9,11,0.08), 0 4px 12px rgba(9,9,11,0.04)",
  },
  glowPurple: {
    ios: {
      shadowColor: "#7C3AED",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 28,
    },
    android: { elevation: 12 },
    web: "0 8px 28px rgba(124,58,237,0.32), 0 2px 8px rgba(124,58,237,0.16)",
  },
  glass: {
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
    web: "inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 24px rgba(0,0,0,0.06)",
  },
} as const;

export type Shadows = typeof shadows;
