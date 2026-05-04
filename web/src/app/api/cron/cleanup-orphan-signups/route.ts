import { NextResponse } from 'next/server'
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
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cutoffIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Pull candidate auth users: created >2h ago.
    // Service-role admin client is required because auth.users isn't
    // exposed via PostgREST to anon / authenticated.
    const { data: candidates, error: listError } = await supabaseAdmin
        .schema('auth')
        .from('users')
        .select('id, email, created_at')
        .lt('created_at', cutoffIso)
        .limit(500)

    if (listError) {
        console.error('[cron:cleanup-orphan-signups] list error:', listError)
        return NextResponse.json({ error: 'list_failed' }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
        return NextResponse.json({ deleted: 0, reason: 'no_candidates' })
    }

    const candidateIds = candidates.map(c => c.id)

    // For each candidate, check if it has a trainer or a subscription.
    // Two roundtrips (cheap), then set-difference locally.
    const [trainersRes, subsRes] = await Promise.all([
        supabaseAdmin
            .from('trainers')
            .select('auth_user_id')
            .in('auth_user_id', candidateIds),
        supabaseAdmin
            .from('subscriptions')
            .select('trainer_id, trainers!inner(auth_user_id)')
            .in('trainers.auth_user_id', candidateIds as string[]),
    ])

    const linkedToTrainer = new Set(
        (trainersRes.data || []).map(r => r.auth_user_id).filter(Boolean)
    )
    const linkedToSubscription = new Set(
        ((subsRes.data || []) as any[])
            .map(r => r.trainers?.auth_user_id)
            .filter(Boolean)
    )

    // Orphans = candidates with no trainer AND no subscription link.
    const orphans = candidates.filter(c =>
        !linkedToTrainer.has(c.id) && !linkedToSubscription.has(c.id)
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
