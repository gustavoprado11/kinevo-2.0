import { supabaseAdmin } from '@/lib/supabase-admin'
import { enrichStudentContext, type EnrichedStudentContext } from '@/lib/prescription/context-enricher'

// ── Types ──

interface StudentSnapshot {
    name: string
    profile: {
        training_level: string
        goal: string
        session_duration_minutes: number
        medical_restrictions: any[]
    } | null
    enriched: EnrichedStudentContext
    activeProgram: {
        name: string
        duration_weeks: number | null
        started_at: string | null
        workouts: Array<{ name: string; exercises: string[] }>
    } | null
    recentCheckins: Array<{ created_at: string; answers_preview: string }>
    activeInsights: Array<{ category: string; title: string; body: string }>
}

interface GeneralSnapshot {
    students: Array<{
        id: string
        name: string
        days_since_last_session: number | null
        active_program: string | null
    }>
    insights: Array<{ category: string; title: string; body: string; student_name: string | null }>
}

// ── Student context ──

async function buildStudentSnapshot(trainerId: string, studentId: string): Promise<StudentSnapshot> {
    const [enriched, profileResult, programResult, checkinsResult, insightsResult] = await Promise.all([
        enrichStudentContext(supabaseAdmin as any, studentId),

        supabaseAdmin
            .from('student_prescription_profiles')
            .select('training_level, goal, session_duration_minutes, medical_restrictions')
            .eq('student_id', studentId)
            .single(),

        supabaseAdmin
            .from('assigned_programs')
            .select(`
                name, duration_weeks, started_at,
                assigned_workouts(name, assigned_workout_items(exercise_name))
            `)
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .single(),

        supabaseAdmin
            .from('form_submissions')
            .select('created_at, answers_json')
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .eq('trigger_context', 'post_workout')
            .eq('status', 'submitted')
            .order('created_at', { ascending: false })
            .limit(3),

        supabaseAdmin
            .from('assistant_insights')
            .select('category, title, body')
            .eq('trainer_id', trainerId)
            .eq('student_id', studentId)
            .in('status', ['new', 'read'])
            .order('created_at', { ascending: false })
            .limit(5),
    ])

    const program = programResult.data
    const activeProgram = program ? {
        name: program.name,
        duration_weeks: program.duration_weeks,
        started_at: program.started_at,
        workouts: ((program as any).assigned_workouts || []).map((w: any) => ({
            name: w.name,
            exercises: (w.assigned_workout_items || []).map((i: any) => i.exercise_name).filter(Boolean),
        })),
    } : null

    return {
        name: enriched.student_name,
        profile: profileResult.data || null,
        enriched,
        activeProgram,
        recentCheckins: (checkinsResult.data || []).map(c => ({
            created_at: c.created_at,
            answers_preview: JSON.stringify(c.answers_json || {}).slice(0, 300),
        })),
        activeInsights: (insightsResult.data || []) as any[],
    }
}

// ── General context ──

async function buildGeneralSnapshot(trainerId: string): Promise<GeneralSnapshot> {
    const [studentsResult, sessionsResult, insightsResult] = await Promise.all([
        supabaseAdmin
            .from('students')
            .select('id, name')
            .eq('coach_id', trainerId)
            .eq('status', 'active')
            .eq('is_trainer_profile', false),

        supabaseAdmin
            .from('workout_sessions')
            .select('student_id, completed_at')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false }),

        supabaseAdmin
            .from('assistant_insights')
            .select('category, title, body, student_id')
            .eq('trainer_id', trainerId)
            .in('status', ['new', 'read'])
            .order('created_at', { ascending: false })
            .limit(10),
    ])

    const students = studentsResult.data || []
    const sessions = sessionsResult.data || []
    const insights = insightsResult.data || []

    // Last session per student
    const lastSession = new Map<string, string>()
    for (const s of sessions) {
        if (!lastSession.has(s.student_id)) lastSession.set(s.student_id, s.completed_at)
    }

    // Active program per student
    const { data: programs } = await supabaseAdmin
        .from('assigned_programs')
        .select('student_id, name')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')

    const programMap = new Map((programs || []).map(p => [p.student_id, p.name]))

    // Student name map for insights
    const studentNameMap = new Map(students.map(s => [s.id, s.name]))

    const now = Date.now()

    return {
        students: students.map(s => {
            const last = lastSession.get(s.id)
            return {
                id: s.id,
                name: s.name,
                days_since_last_session: last ? Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24)) : null,
                active_program: programMap.get(s.id) || null,
            }
        }),
        insights: insights.map(i => ({
            category: i.category,
            title: i.title,
            body: i.body,
            student_name: i.student_id ? (studentNameMap.get(i.student_id) || null) : null,
        })),
    }
}

// ── System prompt builder ──

export async function buildChatContext(trainerId: string, trainerName: string, studentId?: string): Promise<string> {
    const base = `Você é o Assistente Kinevo, um assistente inteligente para personal trainers.

Seu papel é ajudar o trainer a entender o progresso dos seus alunos, identificar problemas, e sugerir ações baseadas em dados reais de treino.

Regras:
- Responda sempre em português brasileiro
- Seja direto e objetivo — trainers são profissionais ocupados
- Baseie suas respostas nos dados fornecidos, não invente informações
- Quando sugerir ajustes de carga ou programa, explique o raciocínio
- Use terminologia de musculação/fitness (séries, reps, carga, volume, periodização, etc.)
- Não faça diagnósticos médicos — quando houver menção a dor/lesão, sugira que o trainer encaminhe o aluno a um profissional de saúde
- Formate respostas com markdown quando útil (listas, negrito para ênfase)
- Seja conciso — respostas longas demais cansam
- Quando o trainer perguntar sobre um aluno específico, SEMPRE use a tool analyzeStudentProgress com o ID do aluno (listado no contexto) antes de responder. Nunca diga que não há dados sem consultar a tool primeiro.`

    if (studentId) {
        const snapshot = await buildStudentSnapshot(trainerId, studentId)

        const profileStr = snapshot.profile
            ? `Nível: ${snapshot.profile.training_level} | Objetivo: ${snapshot.profile.goal} | Duração sessão: ${snapshot.profile.session_duration_minutes}min${snapshot.profile.medical_restrictions?.length ? `\nRestrições médicas: ${JSON.stringify(snapshot.profile.medical_restrictions)}` : ''}`
            : 'Perfil de prescrição não preenchido'

        const programStr = snapshot.activeProgram
            ? `Programa ativo: "${snapshot.activeProgram.name}" (${snapshot.activeProgram.duration_weeks || '?'} semanas)\nTreinos:\n${snapshot.activeProgram.workouts.map(w => `  - ${w.name}: ${w.exercises.join(', ')}`).join('\n')}`
            : 'Sem programa ativo'

        const progressionStr = snapshot.enriched.load_progression.length > 0
            ? `Progressão de carga (últimas 8 semanas):\n${snapshot.enriched.load_progression.map(e => `  - ${e.exercise_name}: ${e.last_weight}kg (${e.trend}, ${e.weeks_at_current} semanas)`).join('\n')}`
            : 'Sem dados de progressão'

        const patternsStr = `Padrões de treino: ${snapshot.enriched.session_patterns.completed_sessions_4w} sessões em 4 semanas${snapshot.enriched.session_patterns.avg_session_duration_minutes ? `, duração média ${snapshot.enriched.session_patterns.avg_session_duration_minutes}min` : ''}`

        const checkinsStr = snapshot.recentCheckins.length > 0
            ? `Últimos check-ins pós-treino:\n${snapshot.recentCheckins.map(c => `  - ${new Date(c.created_at).toLocaleDateString('pt-BR')}: ${c.answers_preview}`).join('\n')}`
            : ''

        const insightsStr = snapshot.activeInsights.length > 0
            ? `Insights ativos:\n${snapshot.activeInsights.map(i => `  - [${i.category}] ${i.title}: ${i.body}`).join('\n')}`
            : ''

        return `${base}

Contexto do trainer: ${trainerName}

═══ Aluno: ${snapshot.name} ═══

${profileStr}

${programStr}

${progressionStr}

${patternsStr}

${checkinsStr}

${insightsStr}`.trim()
    }

    // General mode
    const snapshot = await buildGeneralSnapshot(trainerId)

    const studentsStr = snapshot.students.map(s => {
        const lastStr = s.days_since_last_session !== null ? `último treino há ${s.days_since_last_session}d` : 'nunca treinou'
        return `  - ${s.name} (id: ${s.id}): ${lastStr}${s.active_program ? ` | Programa: "${s.active_program}"` : ''}`
    }).join('\n')

    const insightsStr = snapshot.insights.length > 0
        ? `\nInsights ativos:\n${snapshot.insights.map(i => `  - [${i.category}] ${i.student_name ? `${i.student_name}: ` : ''}${i.title}`).join('\n')}`
        : ''

    return `${base}

Contexto do trainer: ${trainerName} — ${snapshot.students.length} alunos ativos

Alunos:
${studentsStr}
${insightsStr}`.trim()
}
