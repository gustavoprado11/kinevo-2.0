'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
import { checkPasswordPwned } from '@/lib/auth/hibp-check'
import { verifyTurnstileToken } from '@/lib/auth/turnstile'

export interface SignupTrainerInput {
    name: string
    email: string
    password: string
    /** Honeypot field — must be empty. Real users never fill it (display:none).
     *  Automated form-fillers DO fill every visible/labeled field by default. */
    honeypot?: string
    /** Cloudflare Turnstile token from the client widget. Verified server-side.
     *  When Turnstile is not configured (env var missing) this is ignored. */
    turnstileToken?: string
}

export interface SignupTrainerResult {
    success: boolean
    error?: string
}

/**
 * Server-side gate for /signup. All client-side validations also run here so
 * a bot calling supabase.auth.signUp directly from the browser console hits
 * the same fence. Composes:
 *   1. honeypot field check (silent)
 *   2. shape validation (name/email/password)
 *   3. per-IP rate limit (2/min, 10/day) via lib/rate-limit
 *   4. domain blocklist lookup (matches the BEFORE INSERT trigger from
 *      migration 118 but produces a clearer client-side error)
 *   5. supabase.auth.signUp via the server client so cookies plumb back to
 *      the browser and the existing post-signup checkout redirect keeps
 *      working unchanged.
 *   6. trainer record insertion (admin client — no RLS surprises, we
 *      control all inputs).
 *
 * Returns shape: { success: true } or { success: false, error: '...' }.
 * The error string is safe to surface verbatim to the user.
 */
export async function signupTrainer(input: SignupTrainerInput): Promise<SignupTrainerResult> {
    // ─── Honeypot ────────────────────────────────────────────────────────
    // Bots that auto-fill every form field will populate this; humans never
    // see it (display:none + aria-hidden + tabindex=-1). Reject with a
    // generic message so we don't telegraph the trap.
    if (input.honeypot && input.honeypot.trim().length > 0) {
        return { success: false, error: 'Erro ao processar cadastro. Tente novamente.' }
    }

    // ─── Shape validation ────────────────────────────────────────────────
    const name = (input.name || '').trim()
    const email = (input.email || '').trim().toLowerCase()
    const password = input.password || ''

    if (!name) return { success: false, error: 'Informe seu nome.' }
    if (name.length > 120) return { success: false, error: 'Nome muito longo.' }
    if (!email) return { success: false, error: 'Informe seu email.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'Email inválido.' }
    }
    if (password.length < 8) {
        return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' }
    }
    if (password.length > 256) {
        return { success: false, error: 'Senha muito longa.' }
    }

    // ─── Rate limit per IP ───────────────────────────────────────────────
    // Sliding window via lib/rate-limit (in-memory, per Vercel function
    // instance). Caps: 2 attempts/min (a human types once), 10/day (covers
    // the legit retry-after-typo + abandon-then-retry edge cases).
    // Distributed botnets across many IPs would defeat this — that's what
    // CAPTCHA (next layer) is for. This layer kills the single-IP burst
    // pattern we observed on 2026-05-02/03.
    const h = await headers()
    const ip =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        'unknown'

    const rateKey = `signup:${ip}`
    const rate = checkRateLimit(rateKey, { perMinute: 2, perDay: 10 })
    if (!rate.allowed) {
        return { success: false, error: rate.error || 'Muitas tentativas. Aguarde antes de tentar novamente.' }
    }

    // Record the attempt up-front so even a failure (e.g. duplicate email)
    // counts toward the limit. Stops enumeration-via-error.
    recordRequest(rateKey)

    // ─── Turnstile (Cloudflare CAPTCHA) ──────────────────────────────────
    // No-op when env vars are not configured (graceful degrade).
    const turnstile = await verifyTurnstileToken(input.turnstileToken, ip)
    if (!turnstile.ok) {
        return { success: false, error: turnstile.error || 'Falha na verificação anti-robô.' }
    }

    // ─── HIBP / common password check ────────────────────────────────────
    // Bundled top-50 common passwords (no network), then HIBP k-anonymity
    // API for the rest. Fail-open on network errors — see hibp-check.ts.
    const hibp = await checkPasswordPwned(password)
    if (!hibp.safe) {
        return { success: false, error: hibp.error || 'Senha não permitida.' }
    }

    // ─── Domain blocklist ────────────────────────────────────────────────
    // The BEFORE INSERT trigger on auth.users (migration 118) already
    // enforces this server-side, but we check here too so the user sees a
    // friendly message instead of the raw Postgres error code 23514.
    const domain = email.split('@')[1] || ''
    if (domain) {
        const { data: blocked } = await supabaseAdmin
            .from('blocked_email_domains')
            .select('domain')
            .eq('domain', domain)
            .maybeSingle()

        if (blocked) {
            return { success: false, error: 'Este domínio de email não é aceito. Use um email diferente.' }
        }
    }

    // ─── Auth user creation ──────────────────────────────────────────────
    // Use the SSR server client so the resulting session cookie is set on
    // the response and the browser is logged in for subsequent requests
    // (e.g. POST /api/stripe/checkout). signUp() also runs Supabase Auth's
    // own internal rate limit + the auth.users BEFORE INSERT trigger that
    // checks blocked_email_domains and the local-part regex.
    const supabase = await createClient()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
    })

    if (signUpError) {
        // Don't leak the raw error code to the client — the original page
        // had a translateAuthError helper, but here we keep it generic to
        // avoid telegraphing whether the email already exists.
        const lower = (signUpError.message || '').toLowerCase()
        if (lower.includes('already') || lower.includes('exists') || lower.includes('registered')) {
            return { success: false, error: 'Não foi possível criar a conta. Verifique seu email ou tente entrar.' }
        }
        if (lower.includes('weak') || lower.includes('password')) {
            return { success: false, error: 'Senha muito fraca. Use letras, números e pelo menos 8 caracteres.' }
        }
        // Trigger rejection from migration 118 (errcode 23514)
        if (lower.includes('not allowed') || lower.includes('domain') || lower.includes('pattern')) {
            return { success: false, error: 'Email não permitido para cadastro.' }
        }
        return { success: false, error: 'Erro ao criar conta. Tente novamente em instantes.' }
    }

    if (!signUpData.user) {
        return { success: false, error: 'Erro ao criar conta. Tente novamente.' }
    }

    // ─── Trainer record ──────────────────────────────────────────────────
    // Admin client because: (a) we just authenticated the user and have
    // their auth_user_id directly, (b) we want a single failure mode
    // (network/DB) instead of also having to debug RLS visibility for
    // brand-new sessions.
    const { error: trainerErr } = await supabaseAdmin.from('trainers').insert({
        auth_user_id: signUpData.user.id,
        name,
        email,
    })

    if (trainerErr) {
        // Auth user was created but trainer insert failed. The cleanup cron
        // (see api/cron/cleanup-orphan-signups) sweeps these eventually.
        // Return error so the client doesn't redirect to checkout with a
        // half-baked trainer.
        console.error('[signupTrainer] trainer insert failed:', trainerErr)
        return { success: false, error: 'Erro ao criar perfil. Tente novamente.' }
    }

    return { success: true }
}
