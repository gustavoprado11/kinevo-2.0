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
  ringExercise: '#6D28D9',
  ringExerciseTrack: '#E8DFFE',
  ringStand: '#16A34A',
  ringStandTrack: '#D6F0DC',

  statDots: ['#FF3B30', '#6D28D9', '#16A34A', '#86868B'] as const,

  // Brand
  brand: '#6D28D9',
  brandStripe: ['#3730A3', '#6D28D9', '#A855F7'] as const,
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

// Marca do estúdio — quando o coach tem cor custom, só a família violeta
// (brand + ring "exercise" + dot violeta) é rederivada da marca; neutros e as
// cores Apple-Fitness (move=vermelho / stand=verde) ficam intactos.
// Consumidores chamam `useCelebTokens()` em vez de `CELEB_TOKENS`.
import { useBrand } from '../../../../stores/brandStore';
import { deriveBrandScale } from '../../../../lib/brandColor';

export function useCelebTokens() {
    const brand = useBrand();
    if (!brand.isCustom) return CELEB_TOKENS;
    const s = deriveBrandScale(brand.color);
    return {
        ...CELEB_TOKENS,
        ringExercise: brand.color,
        ringExerciseTrack: s[100],
        statDots: [CELEB_TOKENS.ringMove, brand.color, CELEB_TOKENS.ringStand, CELEB_TOKENS.textSecondary] as const,
        brand: brand.color,
        brandStripe: [s[800], brand.color, s[400]] as const,
        brandSoft: s[50],
        brandSoftBorder: s[300],
        brandSoftText: s[800],
    };
}

// Plus Jakarta Sans — famílias por peso (carregadas no app via expo-font).
export const CFONT = {
  regular: 'MonaSans_400Regular',
  medium: 'MonaSans_500Medium',
  semibold: 'MonaSans_600SemiBold',
  bold: 'MonaSans_700Bold',
  extrabold: 'MonaSans_800ExtraBold',
} as const;
