/**
 * Traduz mensagens de erro do Supabase Auth (em inglês) para PT-BR amigável.
 * Evita expor "Invalid login credentials" etc. cru ao usuário.
 */
export function translateAuthError(message?: string | null): string {
    if (!message) return "Algo deu errado. Tente novamente.";
    const m = message.toLowerCase();

    if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (m.includes("user already registered")) return "Este e-mail já está cadastrado.";
    if (m.includes("email address") && m.includes("invalid")) return "E-mail inválido.";
    if (m.includes("invalid email")) return "E-mail inválido.";
    if (m.includes("password should be at least")) return "A senha é muito curta (mínimo 6 caracteres).";
    if (m.includes("rate limit") || m.includes("too many requests")) return "Muitas tentativas. Aguarde um instante e tente novamente.";
    if (m.includes("expired")) return "O código expirou. Solicite um novo.";
    if (m.includes("otp") || (m.includes("token") && m.includes("invalid"))) return "Código inválido. Verifique e tente de novo.";
    if (m.includes("network") || m.includes("fetch") || m.includes("connection")) return "Sem conexão. Verifique sua internet.";

    return "Algo deu errado. Tente novamente.";
}
