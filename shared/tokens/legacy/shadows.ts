// LEGACY — preserva sombras atuais. Migrar pra v2 em Fases 1+.
// Valores copiados de mobile/theme/shadows.ts.
//
// Cross-platform: exporta dois formatos por token (`native` para RN, `web` para CSS).
// Sem import de 'react-native' aqui — shared roda em web e mobile.

type NativeIOSShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
};

type NativeAndroidShadow = {
  elevation: number;
};

type ShadowToken = {
  ios: NativeIOSShadow;
  android: NativeAndroidShadow;
  web: string;
};

export const shadows: Record<'sm' | 'md' | 'lg', ShadowToken> = {
  sm: {
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    web: "0 1px 4px rgba(0,0,0,0.03)",
  },
  md: {
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    web: "0 2px 8px rgba(0,0,0,0.04)",
  },
  lg: {
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    web: "0 4px 12px rgba(0,0,0,0.06)",
  },
} as const;

export type Shadows = typeof shadows;
