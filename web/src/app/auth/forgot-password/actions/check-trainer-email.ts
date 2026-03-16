'use server'

/**
 * Security: Always returns { exists: true } to prevent email enumeration.
 * Supabase's resetPasswordForEmail() silently ignores non-existent emails,
 * so the caller will show "email sent" regardless — standard security practice.
 */
export async function checkTrainerEmail(_email: string) {
    return { exists: true }
}
