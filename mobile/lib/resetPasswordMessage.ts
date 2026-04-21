export interface BuildWhatsAppMessageInput {
    studentName: string;
    email: string;
    password: string;
}

export function buildWhatsAppMessage({
    studentName,
    email,
    password,
}: BuildWhatsAppMessageInput): string {
    const firstName = studentName.trim().split(/\s+/)[0] ?? studentName.trim();
    return `Olá ${firstName}!\n\nSua senha de acesso ao aplicativo Kinevo foi redefinida.\n\nSua nova senha é: *${password}*\n\nBaixe o app e faça o login com seu e-mail (${email}).`;
}

export function sanitizePhoneForWhatsApp(
    phone: string | null | undefined
): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return null;
    if (digits.startsWith("55")) return digits;
    return `55${digits}`;
}

export function buildWhatsAppUrl(
    phone: string | null,
    message: string
): string | null {
    if (!phone) return null;
    return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
}
