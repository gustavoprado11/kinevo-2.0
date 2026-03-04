import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateProgram } from '@/actions/prescription/generate-program'

/**
 * POST /api/prescription/generate
 *
 * Generates an AI prescription program for a student.
 * Used by the mobile app which authenticates via Supabase JWT.
 *
 * The generateProgram() server action uses `createClient()` from
 * '@/lib/supabase/server' which reads cookies. Since API routes
 * from mobile don't have cookies, we need to validate the JWT
 * separately and then call the server action which will handle
 * its own auth via the cookie-based session.
 *
 * Approach: Validate the JWT to confirm the caller is a trainer,
 * then use supabaseAdmin to impersonate the call. However, since
 * generateProgram() uses createClient() internally (cookie-based),
 * we validate auth here and then re-call the same logic directly.
 */
export async function POST(request: NextRequest) {
    try {
        // Extract Bearer token
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
        }
        const token = authHeader.slice(7)

        // Create Supabase client with the mobile user's token
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        )

        // Validate user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse body
        const body = await request.json()
        const { studentId } = body

        if (!studentId) {
            return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
        }

        // Validate trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, ai_prescriptions_enabled')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return NextResponse.json({ error: 'Trainer not found' }, { status: 403 })
        }

        if (!(trainer as any).ai_prescriptions_enabled) {
            return NextResponse.json({ error: 'AI prescriptions not enabled' }, { status: 403 })
        }

        // Validate student ownership
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        }

        // Call the generation logic directly (inlined from generate-program.ts)
        // We import the shared libraries and replicate the flow here since
        // the server action uses cookie-based auth internally.
        const { validateInput, validateOutput, fixViolations, resolveAiMode } = await import('@/lib/prescription/rules-engine')
        const { buildHeuristicProgram } = await import('@/lib/prescription/program-builder')
        const { buildPromptPair, parseAiResponse } = await import('@/lib/prescription/prompt-builder')
        const { ENGINE_VERSION } = await import('@/lib/prescription/constants')

        const startTime = Date.now()

        // Fetch prescription profile
        const { data: profile, error: profileError } = await supabase
            .from('student_prescription_profiles')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle()

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Perfil de prescrição não encontrado. Preencha a anamnese primeiro.' },
                { status: 400 }
            )
        }

        // Fetch exercises
        const { data: exercisesRaw } = await supabase
            .from('exercises')
            .select(`
                id, name, equipment, difficulty_level, is_primary_movement, session_position,
                exercise_muscle_groups ( muscle_groups ( id, name ) )
            `)
            .eq('is_archived', false)
            .order('name', { ascending: true })

        const COMPOUND_PATTERNS = [
            'supino', 'press', 'remada', 'puxada', 'barra fixa', 'pulldown',
            'agachamento', 'leg press', 'terra', 'passada', 'lunge', 'avanço',
            'stiff', 'desenvolvimento', 'press militar', 'hip thrust', 'búlgaro',
            'levantamento', 'flexão',
        ]

        const exercises = (exercisesRaw || []).map((e: any) => {
            const muscleGroupNames: string[] = (e.exercise_muscle_groups || [])
                .map((emg: any) => emg.muscle_groups?.name)
                .filter(Boolean)
            return {
                id: e.id,
                name: e.name,
                muscle_group_names: muscleGroupNames,
                equipment: e.equipment || null,
                is_compound: muscleGroupNames.length >= 2 || COMPOUND_PATTERNS.some(p => e.name.toLowerCase().includes(p)),
                difficulty_level: e.difficulty_level || 'intermediate',
                is_primary_movement: e.is_primary_movement || false,
                session_position: e.session_position || 'middle',
            }
        })

        // Performance context
        const fourWeeksAgo = new Date()
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
        const { data: sessions } = await supabase
            .from('workout_sessions')
            .select('id, status, completed_at, duration_seconds, rpe, assigned_program_id')
            .eq('student_id', studentId)
            .gte('started_at', fourWeeksAgo.toISOString())
            .order('started_at', { ascending: false })

        let performanceContext = null
        if (sessions && sessions.length > 0) {
            const completed = sessions.filter((s: any) => s.status === 'completed')
            const oldest = sessions[sessions.length - 1] as any
            const oldestDate = new Date(oldest.completed_at || oldest.started_at || fourWeeksAgo)
            const weeksOfHistory = Math.max(1, Math.ceil((Date.now() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
            const adherenceRate = sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : null

            const twoWeeksAgo = new Date()
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
            const recentRpe = completed.filter((s: any) => s.rpe != null && new Date(s.completed_at) >= twoWeeksAgo)
            const avgRpe = recentRpe.length > 0
                ? Math.round(recentRpe.reduce((sum: number, s: any) => sum + s.rpe, 0) / recentRpe.length * 10) / 10
                : null

            performanceContext = {
                weeks_of_history: weeksOfHistory,
                recent_adherence_rate: adherenceRate,
                recent_avg_rpe: avgRpe,
                stalled_exercise_ids: [],
                previous_program: null,
            }
        }

        const typedProfile = profile as any
        const aiMode = resolveAiMode(typedProfile, performanceContext)

        // Validate input
        const inputValidation = validateInput(typedProfile, exercises)
        if (!inputValidation.valid) {
            return NextResponse.json(
                { error: `Dados insuficientes: ${inputValidation.errors.join('; ')}` },
                { status: 400 }
            )
        }

        const inputSnapshot = {
            profile: {
                student_id: typedProfile.student_id,
                training_level: typedProfile.training_level,
                goal: typedProfile.goal,
                available_days: typedProfile.available_days,
                session_duration_minutes: typedProfile.session_duration_minutes,
                available_equipment: typedProfile.available_equipment,
                favorite_exercise_ids: typedProfile.favorite_exercise_ids || [],
                disliked_exercise_ids: typedProfile.disliked_exercise_ids || [],
                medical_restrictions: typedProfile.medical_restrictions || [],
                ai_mode: typedProfile.ai_mode,
                adherence_rate: typedProfile.adherence_rate,
            },
            available_exercises: exercises,
            performance_context: performanceContext,
            engine_version: ENGINE_VERSION,
        }

        // Try AI generation
        const exerciseMap = new Map(exercises.map((e: any) => [e.id, e]))
        let outputSnapshot: any
        let source: string
        let llmStatus: string
        let model = process.env.OPENAI_PRESCRIPTION_MODEL?.trim() || 'gpt-4o-mini'
        let allViolations: any[] = []

        const llmEnabled = (() => {
            const raw = process.env.PRESCRIPTION_AI_LLM_ENABLED
            if (!raw) return true
            return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
        })()

        const apiKey = process.env.OPENAI_API_KEY
        let aiOutput: any = null

        if (llmEnabled && apiKey) {
            const { system: sysPrompt, user: userPrompt } = buildPromptPair(typedProfile, exercises, performanceContext)
            const timeoutMs = Math.max(5000, Math.min(Number(process.env.OPENAI_PRESCRIPTION_TIMEOUT_MS || 25000), 60000))

            const controller = new AbortController()
            const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model,
                        temperature: 0.3,
                        response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: sysPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                    }),
                })
                clearTimeout(timeoutHandle)

                if (response.ok) {
                    const payload = await response.json()
                    const content = payload?.choices?.[0]?.message?.content
                    if (content && typeof content === 'string') {
                        aiOutput = parseAiResponse(content)
                        llmStatus = aiOutput ? 'llm_used' : 'invalid_response'
                    } else {
                        llmStatus = 'invalid_response'
                    }
                } else {
                    llmStatus = 'http_error'
                }
            } catch (err: any) {
                clearTimeout(timeoutHandle)
                llmStatus = err?.name === 'AbortError' ? 'timeout' : 'network_error'
            }
        } else {
            llmStatus = !llmEnabled ? 'llm_disabled' : 'missing_api_key'
        }

        if (aiOutput) {
            const validation = validateOutput(aiOutput, typedProfile, exerciseMap)
            if (validation.hasErrors) {
                const fixResult = fixViolations(aiOutput, validation.violations, exerciseMap)
                if (fixResult.remainingViolations.some((v: any) => v.severity === 'error')) {
                    llmStatus = 'validation_failed'
                    outputSnapshot = buildHeuristicProgram(typedProfile, exercises)
                    source = 'heuristic'
                    allViolations = validation.violations
                } else {
                    outputSnapshot = fixResult.fixed
                    source = 'llm'
                    allViolations = [...fixResult.appliedFixes, ...fixResult.remainingViolations]
                }
            } else {
                outputSnapshot = aiOutput
                source = 'llm'
                allViolations = validation.violations
            }
        } else {
            outputSnapshot = buildHeuristicProgram(typedProfile, exercises)
            source = 'heuristic'
            const hVal = validateOutput(outputSnapshot, typedProfile, exerciseMap)
            allViolations = hVal.violations
        }

        const generationTimeMs = Date.now() - startTime

        // Save generation audit trail
        const { data: generation, error: genError } = await supabase
            .from('prescription_generations')
            .insert({
                trainer_id: trainer.id,
                student_id: studentId,
                assigned_program_id: null,
                ai_mode_used: aiMode,
                ai_model: source === 'llm' ? model : 'heuristic',
                ai_source: source,
                input_snapshot: inputSnapshot,
                output_snapshot: outputSnapshot,
                rules_violations: allViolations,
                status: 'pending_review',
                generation_time_ms: generationTimeMs,
                confidence_score: outputSnapshot?.reasoning?.confidence_score || null,
            })
            .select('id')
            .single()

        if (genError || !generation) {
            console.error('[API] Failed to save generation:', genError)
            return NextResponse.json({ error: 'Erro ao salvar geração' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            generationId: (generation as any).id,
            aiMode,
            source,
            llmStatus,
            outputSnapshot,
            violations: allViolations.length > 0 ? allViolations : undefined,
        })

    } catch (error: any) {
        console.error('[API] Prescription generation error:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to generate program' },
            { status: 500 }
        )
    }
}
