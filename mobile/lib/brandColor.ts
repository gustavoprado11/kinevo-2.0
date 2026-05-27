// Marca do estúdio (white-label leve) — utilidades de cor + resolução.
// O personal define cor/logo no web; o app do aluno aplica como camada de
// identidade sobre o Kinevo. Mantém os neutros/semânticas; só a cor primária
// e o logo mudam (ver decisão "Focado": header, herói e botão Iniciar).

export const DEFAULT_BRAND = '#7C3AED'; // roxo Kinevo (v2 purple[600])

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex(hex?: string | null): hex is string {
    return typeof hex === 'string' && HEX.test(hex);
}

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/** Interpola entre hex e um alvo (t=0 → hex, t=1 → alvo). */
export function mix(hex: string, target: string, t: number): string {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function darken(hex: string, t = 0.32): string {
    return mix(hex, '#000000', t);
}

export function lighten(hex: string, t: number): string {
    return mix(hex, '#FFFFFF', t);
}

/**
 * Deriva uma escala de 11 tons (50…950) a partir de uma cor base, mantendo
 * as proporções da paleta v2 (purple). Tons claros são mix com branco;
 * tons escuros são mix com preto.
 *
 * Usado pra reescalar `colors.purple[N]` quando há marca custom — todos os
 * componentes que consomem `colors.purple[N]` ganham a marca automaticamente
 * (zero churn) e preservam as relações visuais (claro fica claro, escuro
 * fica escuro).
 */
export function deriveBrandScale(color: string): Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string> {
    return {
        50: lighten(color, 0.94),
        100: lighten(color, 0.87),
        200: lighten(color, 0.74),
        300: lighten(color, 0.58),
        400: lighten(color, 0.36),
        500: lighten(color, 0.16),
        600: color,
        700: darken(color, 0.14),
        800: darken(color, 0.30),
        900: darken(color, 0.46),
        950: darken(color, 0.66),
    };
}

export function toRgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

/** Luminância relativa (WCAG) — usada para decidir contraste. */
export function luminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface Brand {
    color: string;       // cor primária resolvida
    dark: string;        // derivada escura (botões/sobre branco)
    deep: string;        // derivada profunda (fim do gradiente do herói)
    tint30: string;      // rgba 0.30 (badges/ícones sobre escuro)
    logoUrl: string | null;
    name: string | null; // nome de marca; null = sem linha de estúdio
    showPoweredBy: boolean;
    enabled: boolean;
    isCustom: boolean;   // true se difere do roxo Kinevo
}

function buildBrand(color: string, extras: Partial<Brand> = {}): Brand {
    return {
        color,
        dark: darken(color, 0.32),
        deep: darken(color, 0.62),
        tint30: toRgba(color, 0.3),
        logoUrl: null,
        name: null,
        showPoweredBy: true,
        enabled: true,
        isCustom: color.toUpperCase() !== DEFAULT_BRAND,
        ...extras,
    };
}

/** Marca padrão Kinevo (fallback). */
export const KINEVO_BRAND: Brand = buildBrand(DEFAULT_BRAND);

/** Shape do coach vindo do join de students→trainers (campos de marca). */
export interface CoachBrandFields {
    brand_color?: string | null;
    brand_logo_url?: string | null;
    brand_name?: string | null;
    brand_show_powered_by?: boolean | null;
    branding_enabled?: boolean | null;
}

/** Resolve a marca a partir do coach. Branding desligado → Kinevo puro. */
export function resolveBrand(coach?: CoachBrandFields | null): Brand {
    const enabled = coach?.branding_enabled !== false;
    if (!coach || !enabled) {
        return { ...KINEVO_BRAND, enabled, showPoweredBy: coach?.brand_show_powered_by !== false };
    }
    const color = isValidHex(coach.brand_color) ? coach.brand_color : DEFAULT_BRAND;
    return buildBrand(color, {
        logoUrl: coach.brand_logo_url ?? null,
        name: coach.brand_name ?? null,
        showPoweredBy: coach.brand_show_powered_by !== false,
        enabled: true,
    });
}
