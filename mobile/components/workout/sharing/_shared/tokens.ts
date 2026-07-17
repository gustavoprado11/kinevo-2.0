// Tokens próprios dos cards de compartilhamento (light / Stripe-ish).
// NÃO usar os tokens v2 do app — esta família tem paleta própria
// (Kinevo violet + off-whites quentes), divergente do tema dark/light do app.
// Ref: share-cards.jsx (mock aprovado).

export const SHARE_TOKENS = {
  // Surfaces
  canvas: '#FBFAF7', // off-white morno padrão
  canvasT3: '#FCFBF8',
  canvasT2: '#FBF6EB', // cream wash
  creamBand: '#F1E7CF', // faixa T1
  warmRadial: '#F4E1B2', // wash T2 superior
  tintT3: '#EEEAFC', // radial violet sutil top T3

  // Hairlines
  hairline: '#E8E2D8',
  hairlineSoft: '#F2F2F4',

  // Text
  textPrimary: '#0A0A0A',
  textSecondary: '#86868B',
  textTertiary: '#A1A1A6',
  textCream: '#5C5247', // sobre cream band

  // Brand
  brand: '#7C3AED',
  brandText: '#5B21B6',
  brandSoft: '#EFE9FE',
  brandStripe: ['#3730A3', '#7C3AED', '#A855F7'] as const,

  // Status (light variants)
  goldText: '#8B5A0F',
  goldBorder: '#D9B871',
  goldBg: '#FFF3D9',
  successText: '#166534',
  successBorder: '#B7DCC0',
  successBg: '#E7F4EB',

  // Apple-style activity ring
  ringRed: '#FF3B30',
  ringViolet: '#7C3AED',
  ringGreen: '#16A34A',
  ringRedSoft: '#FFE5E2',
  ringVioletSoft: '#E8DFFE',
  ringGreenSoft: '#D6F0DC',
} as const;

// Marca do estúdio — quando o coach tem cor custom, só a família violeta
// (brand/ring violeta) é rederivada da marca; os neutros quentes e as cores
// Apple-Fitness (vermelho/verde) ficam intactos. Consumidores chamam
// `useShareTokens()` em vez de `SHARE_TOKENS` para pintar na marca. Brand
// default Kinevo → devolve o objeto estático (zero impacto).
import { useBrand } from '../../../../stores/brandStore';
import { deriveBrandScale } from '../../../../lib/brandColor';

export function useShareTokens() {
    const brand = useBrand();
    if (!brand.isCustom) return SHARE_TOKENS;
    const s = deriveBrandScale(brand.color);
    return {
        ...SHARE_TOKENS,
        brand: brand.color,
        brandText: s[800],
        brandSoft: s[50],
        brandStripe: [s[800], brand.color, s[400]] as const,
        ringViolet: brand.color,
        ringVioletSoft: s[100],
    };
}

// Plus Jakarta Sans — famílias por peso (carregadas no app via expo-font).
// RN não herda fontFamily para <Text> filhos: setar em cada Text.
export const FONT = {
  regular: 'MonaSans_400Regular',
  medium: 'MonaSans_500Medium',
  semibold: 'MonaSans_600SemiBold',
  bold: 'MonaSans_700Bold',
  extrabold: 'MonaSans_800ExtraBold',
} as const;

export const CARD_W = 320;
export const CARD_H = 568;
