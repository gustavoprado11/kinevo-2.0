import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * CRON: Delete auth.users that are clearly bot signups slipping past the
 * front-line defenses (rate limit + honeypot + domain trigger + HIBP +
 * future CAPTCHA).
 *
 * Selection criteria — must match ALL:
 *   1. Created more than 2 hours ago (gives a real user enough time to
 *      complete the funnel: signup → confirm email → checkout → first
 *      sign-in).
 *   2. Has NO matching trainer record. Real signups always create a
 *      trainer row in the same server action; missing trainer = the user
 *      stopped between auth.signUp and the trainer insert (or never tried
 *      to). The bot waves of 2026-05-02/03 produced exactly this shape:
 *      auth.users rows with no trainer downstream.
 *   3. Has NO matching subscription. Belt-and-suspenders — even if a
 *      trainer record somehow exists, never touch a paying customer.
 *
 * The cron runs hourly. Each run logs the count + emails of accounts it
 * removed so we can audit for false positives in production logs.
 *
 * Auth contract: same Bearer CRON_SECRET pattern as every other cron in
 * this codebase. No body, no params, idempotent.
 */
export async function GET(request: Request) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cutoffMs = Date.now() - 2 * 60 * 60 * 1000
    const cutoffIso = new Date(cutoffMs).toISOString()

    // Pull candidate auth users: created >2h ago.
    // PostgREST NÃO expõe o schema `auth` (nem com service role — PGRST106),
    // então a listagem vem da Admin API do GoTrue. listUsers pagina newest-
    // first, o que prioriza exatamente as levas recentes de bots.
    const candidates: { id: string; email: string | null; created_at: string }[] = []
    const PER_PAGE = 200
    for (let page = 1; page <= 10 && candidates.length < 500; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: PER_PAGE,
        })
        if (error) {
            console.error('[cron:cleanup-orphan-signups] list error:', error)
            return NextResponse.json({ error: 'list_failed' }, { status: 500 })
        }
        for (const u of data.users) {
            if (u.created_at && new Date(u.created_at).getTime() < cutoffMs) {
                candidates.push({ id: u.id, email: u.email ?? null, created_at: u.created_at })
            }
        }
        if (data.users.length < PER_PAGE) break
    }

    if (!candidates || candidates.length === 0) {
        return NextResponse.json({ deleted: 0, reason: 'no_candidates' })
    }

    const candidateIds = candidates.map(c => c.id)

    // For each candidate, check if it has a trainer, a STUDENT or a
    // subscription. Alunos autenticam via auth.users sem linha em trainers —
    // sem o check de students, o cron deletaria toda conta de aluno.
    // Três roundtrips (cheap), then set-difference locally.
    const [trainersRes, studentsRes, subsRes] = await Promise.all([
        supabaseAdmin
            .from('trainers')
            .select('auth_user_id')
            .in('auth_user_id', candidateIds),
        supabaseAdmin
            .from('students')
            .select('auth_user_id')
            .in('auth_user_id', candidateIds),
        supabaseAdmin
            .from('subscriptions')
            .select('trainer_id, trainers!inner(auth_user_id)')
            .in('trainers.auth_user_id', candidateIds as string[]),
    ])

    // Falha em QUALQUER lookup aborta a run: um erro aqui faria contas
    // legítimas parecerem órfãs (fail-closed obrigatório antes de deletar).
    if (trainersRes.error || studentsRes.error || subsRes.error) {
        console.error('[cron:cleanup-orphan-signups] linkage lookup failed:', {
            trainers: trainersRes.error?.message,
            students: studentsRes.error?.message,
            subscriptions: subsRes.error?.message,
        })
        return NextResponse.json({ error: 'linkage_lookup_failed' }, { status: 500 })
    }

    const linkedToTrainer = new Set(
        (trainersRes.data || []).map(r => r.auth_user_id).filter(Boolean)
    )
    const linkedToStudent = new Set(
        (studentsRes.data || []).map(r => r.auth_user_id).filter(Boolean)
    )
    const linkedToSubscription = new Set(
        ((subsRes.data || []) as any[])
            .map(r => r.trainers?.auth_user_id)
            .filter(Boolean)
    )

    // Orphans = candidates with no trainer, no student AND no subscription link.
    const orphans = candidates.filter(c =>
        !linkedToTrainer.has(c.id) &&
        !linkedToStudent.has(c.id) &&
        !linkedToSubscription.has(c.id)
    )

    if (orphans.length === 0) {
        return NextResponse.json({
            deleted: 0,
            scanned: candidates.length,
            reason: 'no_orphans',
        })
    }

    // Delete each orphan via the admin auth API. Cascades to identities,
    // sessions, refresh_tokens automatically (Supabase Auth FK setup).
    const results: { id: string; email: string | null; ok: boolean; error?: string }[] = []
    for (const orphan of orphans) {
        const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id)
        results.push({
            id: orphan.id,
            email: orphan.email ?? null,
            ok: !delError,
            error: delError?.message,
        })
    }

    const deleted = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok)

    if (failed.length > 0) {
        console.warn('[cron:cleanup-orphan-signups] some deletes failed:', failed)
    }

    console.log(`[cron:cleanup-orphan-signups] deleted=${deleted} scanned=${candidates.length} cutoff=${cutoffIso}`)

    return NextResponse.json({
        deleted,
        scanned: candidates.length,
        failures: failed.length,
        cutoff: cutoffIso,
        // Emails included so log inspection can spot patterns and tune
        // the front-line defenses (e.g. add a domain to the blocklist).
        sample_emails: results.filter(r => r.ok).slice(0, 20).map(r => r.email),
    })
}
