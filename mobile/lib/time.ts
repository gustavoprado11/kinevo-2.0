// Tempo relativo em PT-BR, espelhando o helper do web (financial-client.tsx).
export function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "—";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `há ${diffMin}min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `há ${diffDays} dias`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
}
