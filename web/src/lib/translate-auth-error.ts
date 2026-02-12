/**
 * Translates common Supabase Auth error messages to Portuguese.
 */
const errorMap: Record<string, string> = {
    'User already registered': 'Este email já está cadastrado.',
    'Invalid login credentials': 'Email ou senha incorretos.',
    'Email not confirmed': 'Email ainda não confirmado. Verifique sua caixa de entrada.',
    'Email rate limit exceeded': 'Limite de envio de emails excedido. Tente novamente em alguns minutos.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Signup requires a valid password': 'É necessário informar uma senha válida.',
    'Unable to validate email address: invalid format': 'Formato de email inválido.',
    'User not found': 'Usuário não encontrado.',
    'New password should be different from the old password.': 'A nova senha deve ser diferente da senha atual.',
    'Auth session missing!': 'Sessão expirada. Faça login novamente.',
    'Token has expired or is invalid': 'O link expirou ou é inválido.',
    'For security purposes, you can only request this once every 60 seconds': 'Por segurança, aguarde 60 segundos antes de tentar novamente.',
}

export function translateAuthError(message: string): string {
    return errorMap[message] || message
}
