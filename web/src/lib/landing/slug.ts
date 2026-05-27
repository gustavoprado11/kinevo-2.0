/**
 * Slug da landing pública do trainer (`kinevoapp.com/com/<slug>`).
 *
 * Regras:
 *  - Lowercase a-z, dígitos, hífen interno.
 *  - Começa e termina com alfanumérico.
 *  - Min 3, max 40 chars.
 *  - Nada de palavras reservadas (rotas do app, marcas, palavras genéricas).
 *
 * A regex aqui replica EXATAMENTE o CHECK do banco
 * (`trainers_public_slug_format_chk` na migration 167) — manter ambos
 * sincronizados.
 */

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/**
 * Slugs reservados — rotas do app + nomes que poderiam virar phishing
 * ou colisão com domínio. Comparação é case-insensitive (input já
 * normalizado).
 */
export const RESERVED_SLUGS = new Set<string>([
    // Rotas/admin
    'admin', 'api', 'app', 'auth', 'blog', 'cdn', 'dashboard', 'docs',
    'email', 'estudio', 'financial', 'help', 'home', 'landing', 'leads',
    'login', 'logout', 'mail', 'oauth', 'pricing', 'privacy', 'public',
    'settings', 'signup', 'students', 'studio', 'support', 'terms', 'test',
    'webhooks', 'www',
    // Marca / phishing surface
    'kinevo', 'kinevoapp', 'oficial', 'official',
    // Genéricos
    'about', 'contato', 'contact', 'sobre', 'team',
]);

/** Sanitização básica: lowercase, sem acentos, hífen no lugar de espaço. */
export function slugify(input: string): string {
    return input
        .normalize('NFD')
        // remove acentos
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        // troca tudo que não é a-z 0-9 hífen por hífen
        .replace(/[^a-z0-9-]+/g, '-')
        // colapsa hífens repetidos
        .replace(/-+/g, '-')
        // remove hífens das pontas
        .replace(/^-+|-+$/g, '')
        // garante o máximo permitido
        .slice(0, SLUG_MAX_LENGTH)
        // remove hífen final caso o slice tenha cortado em hífen
        .replace(/-+$/g, '');
}

export function isReserved(slug: string): boolean {
    return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function isValidFormat(slug: string): boolean {
    if (typeof slug !== 'string') return false;
    if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) return false;
    return SLUG_REGEX.test(slug);
}

export type SlugValidation =
    | { valid: true }
    | { valid: false; reason: 'too_short' | 'too_long' | 'invalid_format' | 'reserved' };

/**
 * Valida formato + reservados (não checa disponibilidade no banco —
 * isso é responsabilidade da action `checkSlugAvailability`).
 */
export function validateSlug(slug: string): SlugValidation {
    if (!slug || slug.length < SLUG_MIN_LENGTH) return { valid: false, reason: 'too_short' };
    if (slug.length > SLUG_MAX_LENGTH) return { valid: false, reason: 'too_long' };
    if (!SLUG_REGEX.test(slug)) return { valid: false, reason: 'invalid_format' };
    if (isReserved(slug)) return { valid: false, reason: 'reserved' };
    return { valid: true };
}

/**
 * Sugere variações próximas quando o slug preferido está ocupado.
 * Usado pelo input em /settings → "Sua landing" quando bater colisão.
 *
 * Retorna ate `count` sugestões: base-2, base-3, base + cidade, etc.
 */
export function suggestVariations(base: string, city?: string, count = 3): string[] {
    const cleanBase = slugify(base);
    if (!cleanBase) return [];
    const out: string[] = [];
    if (city) {
        const citySlug = slugify(city);
        if (citySlug && cleanBase !== citySlug) {
            const combined = `${cleanBase}-${citySlug}`.slice(0, SLUG_MAX_LENGTH);
            if (isValidFormat(combined) && !isReserved(combined)) out.push(combined);
        }
    }
    for (let n = 2; n <= 9 && out.length < count; n++) {
        const variation = `${cleanBase}-${n}`.slice(0, SLUG_MAX_LENGTH);
        if (isValidFormat(variation) && !isReserved(variation)) out.push(variation);
    }
    return out.slice(0, count);
}
