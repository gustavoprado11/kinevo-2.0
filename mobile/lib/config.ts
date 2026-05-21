/**
 * Configuração central de ambiente.
 *
 * URL base do backend web (Next.js / API). SEMPRE com www, sem barra final.
 * Fonte única — não hardcodar domínio em outros arquivos.
 */
export const WEB_URL = (
    process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com"
).replace(/\/+$/, "");
