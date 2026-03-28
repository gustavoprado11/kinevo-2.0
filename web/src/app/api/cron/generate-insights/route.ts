import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enrichInsightsWithLLM } from '@/lib/assistant/insight-enricher'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * CRON: Generate proactive assistant insights for all trainers.
 * Runs daily at 09:00 UTC — idempotent via ON CONFLICT (trainer_id, insight_key) DO NOTHING.
 *
 * Phase 1: deterministic rules (no LLM).
 * Phase 2 will add LLM-enriched body text via llm-client.ts (GPT-4.1-mini).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Clean expired insights
        await supabaseAdmin
            .from('assistant_insights')
            .delete()
            .not('expires_at', 'is', null)
            .lt('expires_at', new Date().toISOString())

        // Fetch all trainers with active students
        const { data: trainers, error: trainerError } = await supabaseAdmin
            .from('trainers')
            .select('id')

        if (trainerError || !trainers) {
            console.error('[cron:generate-insights] Failed to fetch trainers:', trainerError)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        let totalInsights = 0
        let totalEnriched = 0
        let totalConsolidated = 0
        let totalPushed = 0
        const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

        for (const trainer of trainers) {
            const trainerId = trainer.id
            const insights: InsightRow[] = []

            // Run all detections in parallel for this trainer
            const [gapResults, stagnationResults, programResults, painResults, progressionResults, formResults] = await Promise.all([
                detectTrainingGaps(trainerId, today),
                detectLoadStagnation(trainerId, today),
                detectExpiringPrograms(trainerId, today),
                detectPainReports(trainerId, today),
                detectReadyToProgress(trainerId, today),
                detectFormInsights(trainerId, today),
            ])

            insights.push(...gapResults, ...stagnationResults, ...programResults, ...painResults, ...progressionResults, ...formResults)

            if (insights.length > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('assistant_insights')
                    .upsert(insights, { onConflict: 'trainer_id,insight_key', ignoreDuplicates: true })

                if (insertError) {
                    console.error(`[cron:generate-insights] Insert error for trainer ${trainerId}:`, insertError)
                } else {
                    totalInsights += insights.length

                    // Phase 2B: Enrich with LLM (best-effort)
                    try {
                        const enrichResult = await enrichInsightsWithLLM(trainerId, insights.map(i => ({
                            insight_key: i.insight_key,
                            student_id: i.student_id,
                            category: i.category,
                            title: i.title,
                            body: i.body,
                            action_metadata: i.action_metadata as Record<string, unknown>,
                        })))
                        totalEnriched += enrichResult.enriched
                        totalConsolidated += enrichResult.consolidated
                    } catch (enrichError) {
                        console.error(`[cron:generate-insights] LLM enrichment failed for trainer ${trainerId}, keeping rule-based insights:`, enrichError)
                    }

                    // Phase 3: Push notifications for critical insights (best-effort)
                    try {
                        totalPushed += await sendInsightPushNotifications(trainerId, insights)
                    } catch (pushError) {
                        console.error(`[cron:generate-insights] Push failed for trainer ${trainerId}:`, pushError)
                    }
                }
            }
        }

        console.log(`[cron:generate-insights] Generated ${totalInsights} insights, enriched ${totalEnriched}, consolidated ${totalConsolidated}, pushed ${totalPushed} for ${trainers.length} trainers`)
        return NextResponse.json({ trainers: trainers.length, insights: totalInsights, enriched: totalEnriched, consolidated: totalConsolidated, pushed: totalPushed })
    } catch (err) {
        console.error('[cron:generate-insights] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// ── Push notifications for critical insights ──

async function sendInsightPushNotifications(trainerId: string, insights: InsightRow[]): Promise<number> {
    // Only push for high/critical priority
    const critical = insights.filter(i => i.priority === 'high' || i.priority === 'critical')
    if (critical.length === 0) return 0

    // Rate limit: max 3 assistant pushes per day per trainer
    const todayStr = new Date().toISOString().split('T')[0]
    const { count } = await supabaseAdmin
        .from('trainer_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('trainer_id', trainerId)
        .eq('type', 'assistant_insight')
        .gte('created_at', todayStr)

    const alreadySent = count || 0
    if (alreadySent >= 3) return 0

    const remaining = 3 - alreadySent
    const toNotify = critical.slice(0, remaining)
    let pushed = 0

    for (const insight of toNotify) {
        const notifId = await insertTrainerNotification({
            trainerId,
            type: 'assistant_insight',
            title: insight.title,
            message: insight.body,
            metadata: {
                category: insight.category,
                student_id: insight.student_id,
                action_type: insight.action_type,
                insight_key: insight.insight_key,
            },
        })

        if (notifId) {
            sendTrainerPush({
                trainerId,
                type: 'assistant_insight',
                title: insight.title,
                body: insight.body,
                data: { screen: 'dashboard' },
                notificationId: notifId,
            })
            pushed++
        }
    }

    return pushed
}

// ── Types ──

interface InsightRow {
    trainer_id: string
    student_id: string | null
    category: 'alert' | 'progression' | 'suggestion' | 'summary'
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    body: string
    action_type: string
    action_metadata: Record<string, unknown>
    status: 'new'
    insight_key: string
    source: 'rules'
    expires_at: string
}

function expiresIn(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Detection 1: Training gaps ──

async function detectTrainingGaps(trainerId: string, today: string): Promise<InsightRow[]> {
    const { data, error } = await supabaseAdmin.rpc('detect_training_gaps', { p_trainer_id: trainerId })
    if (error || !data) return []

    return (data as any[]).map(row => {
        const daysSince = row.days_since_last
        const isNever = row.last_completed_at === null
        const priority = daysSince >= 10 ? 'high' as const : 'medium' as const

        return {
            trainer_id: trainerId,
            student_id: row.student_id,
            category: 'alert' as const,
            priority,
            title: isNever
                ? `${row.student_name} ainda não realizou nenhum treino`
                : `${row.student_name} está sem treinar há ${daysSince} dias`,
            body: isNever
                ? 'O aluno possui programa ativo mas ainda não completou nenhuma sessão. Considere entrar em contato para iniciar os treinos.'
                : `Último treino foi em ${formatDate(row.last_completed_at)}. Considere entrar em contato para manter o engajamento.`,
            action_type: 'contact_student',
            action_metadata: { student_id: row.student_id, days_since_last: daysSince },
            status: 'new' as const,
            insight_key: `gap_alert:${row.student_id}:${today}`,
            source: 'rules' as const,
            expires_at: expiresIn(7),
        }
    })
}

// ── Detection 2: Load stagnation ──
// Only flags exercises where the student is NOT at the top of the prescribed
// rep range (those are handled by Detection 5 as "ready to progress").

async function detectLoadStagnation(trainerId: string, today: string): Promise<InsightRow[]> {
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
        .from('set_logs')
        .select(`
            exercise_id,
            assigned_workout_item_id,
            weight,
            reps_completed,
            workout_sessions!inner(student_id, trainer_id, status, completed_at)
        `)
        .eq('workout_sessions.trainer_id', trainerId)
        .eq('workout_sessions.status', 'completed')
        .gte('workout_sessions.completed_at', fourWeeksAgo)
        .gt('weight', 0)
        .eq('is_completed', true)

    if (error || !data) return []

    // Collect all assigned_workout_item_ids to fetch prescribed reps
    const itemIds = [...new Set((data as any[]).map(r => r.assigned_workout_item_id).filter(Boolean))]
    const itemRepsMap = new Map<string, number>() // item_id → max prescribed reps

    if (itemIds.length > 0) {
        const { data: items } = await supabaseAdmin
            .from('assigned_workout_items')
            .select('id, reps')
            .in('id', itemIds)

        for (const item of items || []) {
            if (!item.reps) continue
            const parts = item.reps.split('-')
            const maxReps = parseInt(parts[parts.length - 1])
            if (!isNaN(maxReps)) itemRepsMap.set(item.id, maxReps)
        }
    }

    // Group by student+exercise, track weekly max weights AND recent reps
    interface StagnationEntry {
        studentId: string
        exerciseId: string
        weeklyMaxes: Map<string, number>
        recentReps: Array<{ repsCompleted: number; maxPrescribed: number }>
    }
    const map = new Map<string, StagnationEntry>()

    for (const row of data as any[]) {
        const key = `${row.workout_sessions.student_id}:${row.exercise_id}`
        if (!map.has(key)) {
            map.set(key, {
                studentId: row.workout_sessions.student_id,
                exerciseId: row.exercise_id,
                weeklyMaxes: new Map(),
                recentReps: [],
            })
        }
        const weekStart = getWeekStart(new Date(row.workout_sessions.completed_at))
        const entry = map.get(key)!
        const current = entry.weeklyMaxes.get(weekStart) || 0
        if (row.weight > current) {
            entry.weeklyMaxes.set(weekStart, row.weight)
        }

        // Track reps vs prescribed max for recent sets
        const maxPrescribed = itemRepsMap.get(row.assigned_workout_item_id)
        if (maxPrescribed && row.reps_completed != null) {
            entry.recentReps.push({ repsCompleted: row.reps_completed, maxPrescribed })
        }
    }

    const insights: InsightRow[] = []

    for (const [, entry] of map) {
        if (entry.weeklyMaxes.size < 3) continue

        const maxWeights = [...entry.weeklyMaxes.values()]
        const topWeight = Math.max(...maxWeights)
        const weeksAtTop = maxWeights.filter(w => w === topWeight).length

        if (weeksAtTop < 3) continue

        // Check if student is at the top of the rep range — if so, skip
        // (Detection 5 handles this as "ready to progress")
        if (entry.recentReps.length > 0) {
            const lastSets = entry.recentReps.slice(-6) // last ~2 sessions worth of sets
            const atTopCount = lastSets.filter(s => s.repsCompleted >= s.maxPrescribed).length
            const atTopRatio = atTopCount / lastSets.length

            // If >= 70% of recent sets are at the top of the range, skip
            if (atTopRatio >= 0.7) continue
        }

        const [exerciseResult, studentResult] = await Promise.all([
            supabaseAdmin.from('exercises').select('name').eq('id', entry.exerciseId).single(),
            supabaseAdmin.from('students').select('name').eq('id', entry.studentId).single(),
        ])

        const exerciseName = exerciseResult.data?.name || 'Exercício'
        const studentName = studentResult.data?.name || 'Aluno'

        insights.push({
            trainer_id: trainerId,
            student_id: entry.studentId,
            category: 'progression',
            priority: 'medium',
            title: `${studentName} — ${exerciseName} estagnado há ${weeksAtTop} semanas`,
            body: `Carga máxima de ${topWeight}kg sem alteração há ${weeksAtTop} semanas. Considere variar o estímulo ou ajustar a progressão.`,
            action_type: 'adjust_load',
            action_metadata: {
                student_id: entry.studentId,
                exercise_id: entry.exerciseId,
                exercise_name: exerciseName,
                current_weight: topWeight,
            },
            status: 'new',
            insight_key: `stagnation:${entry.studentId}:${entry.exerciseId}:${today}`,
            source: 'rules',
            expires_at: expiresIn(14),
        })
    }

    return insights
}

function getWeekStart(date: Date): string {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    return d.toISOString().slice(0, 10)
}

// ── Detection 3: Expiring/expired programs ──

async function detectExpiringPrograms(trainerId: string, today: string): Promise<InsightRow[]> {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
        .from('assigned_programs')
        .select('id, student_id, name, expires_at, students!inner(name)')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .lte('expires_at', threeDaysFromNow)

    if (error || !data) return []

    const now = new Date()

    return (data as any[]).map(row => {
        const expiresAt = new Date(row.expires_at)
        const isExpired = expiresAt <= now
        const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const studentName = row.students?.name || 'Aluno'

        return {
            trainer_id: trainerId,
            student_id: row.student_id,
            category: 'suggestion' as const,
            priority: isExpired ? 'high' as const : 'medium' as const,
            title: isExpired
                ? `Programa de ${studentName} encerrou`
                : `Programa de ${studentName} encerra em ${daysUntil} dia${daysUntil !== 1 ? 's' : ''}`,
            body: `O programa "${row.name}" está ${isExpired ? 'encerrado' : 'prestes a encerrar'}. Considere criar o próximo programa para manter a continuidade.`,
            action_type: 'generate_program',
            action_metadata: {
                student_id: row.student_id,
                assigned_program_id: row.id,
                program_name: row.name,
            },
            status: 'new' as const,
            insight_key: `program_expiring:${row.id}:${today}`,
            source: 'rules' as const,
            expires_at: expiresIn(14),
        }
    })
}

// ── Detection 4: Pain/discomfort reported ──

async function detectPainReports(trainerId: string, today: string): Promise<InsightRow[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
        .from('form_submissions')
        .select('id, student_id, answers_json, created_at, students!inner(name)')
        .eq('trainer_id', trainerId)
        .eq('trigger_context', 'post_workout')
        .gte('created_at', twentyFourHoursAgo)

    if (error || !data) return []

    const painKeywords = ['dor', 'pain', 'desconforto', 'lesão', 'lesao', 'machuc', 'incômodo', 'incomodo']

    return (data as any[])
        .filter(row => {
            const answersStr = JSON.stringify(row.answers_json || {}).toLowerCase()
            return painKeywords.some(keyword => answersStr.includes(keyword))
        })
        .map(row => {
            const studentName = row.students?.name || 'Aluno'
            const answersPreview = JSON.stringify(row.answers_json || {}).slice(0, 200)

            return {
                trainer_id: trainerId,
                student_id: row.student_id,
                category: 'alert' as const,
                priority: 'high' as const,
                title: `${studentName} reportou desconforto no check-in pós-treino`,
                body: `No check-in de ${formatDate(row.created_at)}, foram identificadas menções a dor ou desconforto. Revise o programa e entre em contato.`,
                action_type: 'review_program',
                action_metadata: {
                    student_id: row.student_id,
                    submission_id: row.id,
                    answers_preview: answersPreview,
                },
                status: 'new' as const,
                insight_key: `pain_report:${row.id}`,
                source: 'rules' as const,
                expires_at: expiresIn(3),
            }
        })
}

// ── Detection 5: Ready to progress ──

async function detectReadyToProgress(trainerId: string, today: string): Promise<InsightRow[]> {
    // Fetch recent completed sessions with set data
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()

    const { data: sessions, error: sessionsError } = await supabaseAdmin
        .from('workout_sessions')
        .select(`
            id, student_id, completed_at,
            students!inner(name)
        `)
        .eq('trainer_id', trainerId)
        .eq('status', 'completed')
        .gte('completed_at', eightWeeksAgo)
        .order('completed_at', { ascending: true })

    if (sessionsError || !sessions || sessions.length === 0) return []

    const sessionIds = sessions.map(s => s.id)

    // Fetch set logs for these sessions
    const { data: setLogs, error: setLogsError } = await supabaseAdmin
        .from('set_logs')
        .select('workout_session_id, assigned_workout_item_id, exercise_id, reps_completed, weight, is_completed')
        .in('workout_session_id', sessionIds)
        .eq('is_completed', true)

    if (setLogsError || !setLogs) return []

    // Fetch prescribed reps from assigned_workout_items
    const itemIds = [...new Set(setLogs.map(s => s.assigned_workout_item_id))]
    if (itemIds.length === 0) return []

    const { data: items, error: itemsError } = await supabaseAdmin
        .from('assigned_workout_items')
        .select('id, reps, exercise_id')
        .in('id', itemIds)

    if (itemsError || !items) return []

    // Parse max reps from text field (e.g., "8-12" → 12, "10" → 10)
    const itemRepsMap = new Map<string, number>()
    for (const item of items) {
        if (!item.reps) continue
        const parts = item.reps.split('-')
        const maxReps = parseInt(parts[parts.length - 1])
        if (!isNaN(maxReps)) itemRepsMap.set(item.id, maxReps)
    }

    // Build session-indexed set data per student+exercise
    const sessionMap = new Map(sessions.map(s => [s.id, s]))

    // Key: studentId:exerciseId, Value: array of { sessionId, allSetsAtTop: boolean, weight }
    const progressMap = new Map<string, Array<{ sessionId: string; allSetsAtTop: boolean; weight: number; completedAt: string }>>()

    // Group set_logs by session+exercise
    const sessionExerciseSets = new Map<string, typeof setLogs>()
    for (const log of setLogs) {
        const key = `${log.workout_session_id}:${log.exercise_id}`
        if (!sessionExerciseSets.has(key)) sessionExerciseSets.set(key, [])
        sessionExerciseSets.get(key)!.push(log)
    }

    for (const [key, sets] of sessionExerciseSets) {
        const [sessionId, exerciseId] = key.split(':')
        const session = sessionMap.get(sessionId)
        if (!session || !exerciseId) continue

        const studentId = session.student_id
        const progressKey = `${studentId}:${exerciseId}`

        // Check if all sets hit the top of prescribed range
        const maxReps = itemRepsMap.get(sets[0].assigned_workout_item_id)
        if (!maxReps || sets.length === 0) continue

        const allAtTop = sets.every(s => s.reps_completed !== null && s.reps_completed >= maxReps)
        const maxWeight = Math.max(...sets.map(s => s.weight || 0))

        if (!progressMap.has(progressKey)) progressMap.set(progressKey, [])
        progressMap.get(progressKey)!.push({
            sessionId,
            allSetsAtTop: allAtTop,
            weight: maxWeight,
            completedAt: session.completed_at,
        })
    }

    const insights: InsightRow[] = []

    for (const [key, entries] of progressMap) {
        const [studentId, exerciseId] = key.split(':')

        // Sort by date and check last 3+ consecutive sessions all at top
        entries.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())

        let consecutiveAtTop = 0
        let lastWeight = 0
        for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i].allSetsAtTop) {
                consecutiveAtTop++
                lastWeight = entries[i].weight
            } else {
                break
            }
        }

        if (consecutiveAtTop >= 3 && lastWeight > 0) {
            const session = sessions.find(s => s.student_id === studentId)
            const studentName = (session as any)?.students?.name || 'Aluno'

            // Fetch exercise name
            const { data: exercise } = await supabaseAdmin
                .from('exercises')
                .select('name')
                .eq('id', exerciseId)
                .single()

            const exerciseName = exercise?.name || 'Exercício'

            // Find prescribed reps text
            const item = items.find(i => i.exercise_id === exerciseId)
            const repsText = item?.reps || '?'

            insights.push({
                trainer_id: trainerId,
                student_id: studentId,
                category: 'progression',
                priority: 'medium',
                title: `${studentName} — pronto para progredir em ${exerciseName}`,
                body: `${consecutiveAtTop} sessões consecutivas completando todas as séries no topo do range prescrito (${repsText} reps) com ${lastWeight}kg. Considere aumentar a carga.`,
                action_type: 'adjust_load',
                action_metadata: {
                    student_id: studentId,
                    exercise_id: exerciseId,
                    exercise_name: exerciseName,
                    current_weight: lastWeight,
                    sessions_at_top: consecutiveAtTop,
                },
                status: 'new',
                insight_key: `ready_to_progress:${studentId}:${exerciseId}:${today}`,
                source: 'rules',
                expires_at: expiresIn(14),
            })
        }
    }

    return insights
}

// ── Detection 6: Form-based insights (anamnese & check-in health alerts) ──

/**
 * Scans recent anamnese and check-in submissions for health-relevant flags:
 * - Anamnese: chronic conditions, injuries, medications, restrictions, surgeries
 * - Check-ins: significant changes in sleep, stress, fatigue, well-being
 *
 * Creates per-student summary insights so the trainer has quick context.
 * Uses submission ID in the insight_key for idempotency.
 */
async function detectFormInsights(trainerId: string, today: string): Promise<InsightRow[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch recent submissions with their template category
    const { data, error } = await supabaseAdmin
        .from('form_submissions')
        .select(`
            id, student_id, answers_json, created_at, trigger_context,
            form_templates!inner(category, title),
            students!inner(name)
        `)
        .eq('trainer_id', trainerId)
        .eq('status', 'submitted')
        .gte('created_at', sevenDaysAgo)

    if (error || !data) return []

    const insights: InsightRow[] = []

    // Already-processed submissions (check existing insight_keys to avoid re-processing)
    const existingKeys = new Set<string>()
    const { data: existing } = await supabaseAdmin
        .from('assistant_insights')
        .select('insight_key')
        .eq('trainer_id', trainerId)
        .like('insight_key', 'form_insight:%')

    for (const row of existing || []) {
        existingKeys.add(row.insight_key)
    }

    for (const row of data as any[]) {
        const category = row.form_templates?.category as string
        const studentName = row.students?.name || 'Aluno'
        const answers = row.answers_json || {}
        const answersStr = JSON.stringify(answers).toLowerCase()
        const insightKey = `form_insight:${row.id}`

        // Skip already-processed
        if (existingKeys.has(insightKey)) continue

        // ── Anamnese submissions: extract health flags ──
        if (category === 'anamnese') {
            const flags: string[] = []

            const healthKeywords: Record<string, string> = {
                'diabetes': 'diabetes',
                'hipertens': 'hipertensão',
                'cardíac': 'condição cardíaca',
                'cardiac': 'condição cardíaca',
                'asma': 'asma',
                'cirurgia': 'cirurgia recente',
                'surgery': 'cirurgia recente',
                'prótese': 'prótese',
                'protese': 'prótese',
                'hérnia': 'hérnia',
                'hernia': 'hérnia',
                'gravid': 'gravidez',
                'gestant': 'gestação',
                'tabagis': 'tabagismo',
                'medica': 'uso de medicamentos',
                'remédio': 'uso de medicamentos',
                'remedio': 'uso de medicamentos',
                'restrição': 'restrição médica',
                'restricao': 'restrição médica',
                'lesão': 'lesão prévia',
                'lesao': 'lesão prévia',
                'fratura': 'fratura prévia',
                'coluna': 'problema na coluna',
                'joelho': 'problema no joelho',
                'ombro': 'problema no ombro',
            }

            for (const [keyword, label] of Object.entries(healthKeywords)) {
                if (answersStr.includes(keyword)) {
                    flags.push(label)
                }
            }

            const uniqueFlags = [...new Set(flags)]

            if (uniqueFlags.length > 0) {
                const priority = uniqueFlags.length >= 3 ? 'high' as const : 'medium' as const
                const flagList = uniqueFlags.slice(0, 5).join(', ')

                insights.push({
                    trainer_id: trainerId,
                    student_id: row.student_id,
                    category: 'alert',
                    priority,
                    title: `Anamnese de ${studentName}: ${uniqueFlags.length} ponto${uniqueFlags.length > 1 ? 's' : ''} de atenção`,
                    body: `Na anamnese preenchida em ${formatDate(row.created_at)}, foram identificados: ${flagList}. Revise para adaptar o programa se necessário.`,
                    action_type: 'review_anamnese',
                    action_metadata: {
                        student_id: row.student_id,
                        submission_id: row.id,
                        flags: uniqueFlags,
                    },
                    status: 'new',
                    insight_key: insightKey,
                    source: 'rules',
                    expires_at: expiresIn(30),
                })
            }
        }

        // ── Check-in submissions: detect well-being drops ──
        if (category === 'checkin' && row.trigger_context !== 'post_workout') {
            const lowScoreFlags: string[] = []

            for (const [key, value] of Object.entries(answers)) {
                const keyLower = key.toLowerCase()
                const numValue = typeof value === 'number' ? value : parseInt(String(value))

                if (isNaN(numValue)) continue

                // Detect low scores on well-being indicators (universally low on any scale)
                const isLowScore = numValue <= 2

                if (isLowScore) {
                    if (keyLower.includes('sono') || keyLower.includes('sleep')) lowScoreFlags.push('sono ruim')
                    else if (keyLower.includes('stress') || keyLower.includes('estresse')) lowScoreFlags.push('estresse alto')
                    else if (keyLower.includes('fadiga') || keyLower.includes('cansa') || keyLower.includes('fatigue') || keyLower.includes('energy') || keyLower.includes('energia')) lowScoreFlags.push('fadiga elevada')
                    else if (keyLower.includes('humor') || keyLower.includes('mood') || keyLower.includes('bem-estar') || keyLower.includes('disposição') || keyLower.includes('disposicao')) lowScoreFlags.push('bem-estar baixo')
                    else if (keyLower.includes('motivação') || keyLower.includes('motivacao') || keyLower.includes('motivation')) lowScoreFlags.push('motivação baixa')
                }

                // Detect HIGH scores for negative indicators (stress, pain on inverted scales)
                const isHighNegative = numValue >= 4
                if (isHighNegative) {
                    if (keyLower.includes('stress') || keyLower.includes('estresse')) lowScoreFlags.push('estresse alto')
                    if (keyLower.includes('dor') || keyLower.includes('pain')) lowScoreFlags.push('dor reportada')
                }
            }

            // Also check text answers for concerning keywords
            const concernKeywords = ['cansad', 'exaust', 'insônia', 'insonia', 'ansied', 'depres', 'desanim']
            for (const keyword of concernKeywords) {
                if (answersStr.includes(keyword)) {
                    lowScoreFlags.push('relato de mal-estar')
                    break
                }
            }

            const uniqueFlags = [...new Set(lowScoreFlags)]

            if (uniqueFlags.length >= 2) {
                insights.push({
                    trainer_id: trainerId,
                    student_id: row.student_id,
                    category: 'alert',
                    priority: 'medium',
                    title: `Check-in de ${studentName}: sinais de atenção`,
                    body: `No check-in de ${formatDate(row.created_at)} foram identificados: ${uniqueFlags.join(', ')}. Considere ajustar a intensidade do treino ou conversar com o aluno.`,
                    action_type: 'review_checkin',
                    action_metadata: {
                        student_id: row.student_id,
                        submission_id: row.id,
                        flags: uniqueFlags,
                    },
                    status: 'new',
                    insight_key: insightKey,
                    source: 'rules',
                    expires_at: expiresIn(7),
                })
            }
        }
    }

    return insights
}
