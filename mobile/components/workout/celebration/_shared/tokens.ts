// Tokens light da celebração (consistente com os share cards v2).
// NÃO usar tokens dark do app.
export const CELEB_TOKENS = {
  canvas: '#FBFAF7',
  tintFitnessTop: '#EDE5FA',
  tintEditorialTop: '#F4E6C8',
  tintReceiptTop: '#EDE5FA',

  textPrimary: '#0A0A0A',
  textSecondary: '#86868B',
  textTertiary: '#A1A1A6',

  // Ring colors (V1 — Apple Fitness)
  ringMove: '#FF3B30',
  ringMoveTrack: '#FFE5E2',
  ringExercise: '#7C3AED',
  ringExerciseTrack: '#E8DFFE',
  ringStand: '#16A34A',
  ringStandTrack: '#D6F0DC',

  statDots: ['#FF3B30', '#7C3AED', '#16A34A', '#86868B'] as const,

  // Brand
  brand: '#7C3AED',
  brandStripe: ['#3730A3', '#7C3AED', '#A855F7'] as const,
  brandSoft: '#F3EFFE',
  brandSoftBorder: '#C6B7F2',
  brandSoftText: '#5B21B6',

  // Status (light)
  goldText: '#8B5A0F',
  goldBorder: '#D9B871',
  goldBg: '#FFF7EC',
  goldBorderStrong: '#E5C994',
  successText: '#166534',
  successBorder: '#B7DCC0',
  successBg: '#E7F4EB',

  stampRed: '#C92A2A',

  hairline: '#E8E2D8',
  hairlineSoft: '#EDE5DA',
} as const;

// Plus Jakarta Sans — famílias por peso (carregadas no app via expo-font).
export const CFONT = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;
