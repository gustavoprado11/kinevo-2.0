import { supabaseAdmin } from '@/lib/supabase-admin'
import { callLLM } from '@/lib/prescription/llm-client'

// ── Types ──

interface InsightFinding {
    insight_key: string
    student_id: string | null
    category: string
    title: string
    body: string
    action_metadata: Record<string, unknown>
}

interface EnrichedInsight {
    insight_key: string
    title: string
    body: string
    replaces?: string[]
}

interface StudentContext {
    name: string
    training_level?: string
    goal?: string
    program_name?: string
}

// ── System prompt ──

const ENRICHMENT_SYSTEM_PROMPT = `Você é o Assistente Kinevo, um assistente para personal trainers brasileiros.

Sua tarefa é reescrever insights de treino em linguagem natural, concisa e acionável.

Regras:
- Mantenha o tom profissional mas acessível
- Inclua sempre o dado concreto (carga, dias, exercício, etc.)
- Termine com uma sugestão de ação clara
- Title: máximo 60 caracteres
- Body: máximo 200 caracteres
- Se houver múltiplos insights de estagnação para o mesmo aluno, consolide em um único insight listando todos os exercícios com seus dados
- Responda APENAS com JSON válido, sem markdown, sem explicação

Formato de resposta:
[
  { "insight_key": "original_key_aqui", "title": "...", "body": "..." },
  { "insight_key": "stagnation_summary:student_id:date", "title": "...", "body": "...", "replaces": ["key1", "key2"] }
]`

// ── Main function ──

export async function enrichInsightsWithLLM(
    trainerId: string,
    insights: InsightFinding[],
): Promise<{ enriched: number; consolidated: number }> {
    // Group insights by student_id
    const byStudent = new Map<string, InsightFinding[]>()
    for (const insight of insights) {
        const key = insight.student_id || '__general__'
        if (!byStudent.has(key)) byStudent.set(key, [])
        byStudent.get(key)!.push(insight)
    }

    // Fetch student context for all students in one query
    const studentIds = [...byStudent.keys()].filter(k => k !== '__general__')
    const studentContextMap = new Map<string, StudentContext>()

    if (studentIds.length > 0) {
        const [studentsResult, profilesResult, programsResult] = await Promise.all([
            supabaseAdmin.from('students').select('id, name').in('id', studentIds),
            supabaseAdmin.from('student_prescription_profiles').select('student_id, training_level, goal').in('student_id', studentIds),
            supabaseAdmin.from('assigned_programs').select('student_id, name').eq('trainer_id', trainerId).eq('status', 'active').in('student_id', studentIds),
        ])

        const profileMap = new Map((profilesResult.data || []).map(p => [p.student_id, p]))
        const programMap = new Map((programsResult.data || []).map(p => [p.student_id, p]))

        for (const student of studentsResult.data || []) {
            const profile = profileMap.get(student.id)
            const program = programMap.get(student.id)
            studentContextMap.set(student.id, {
                name: student.name,
                training_level: profile?.training_level,
                goal: profile?.goal,
                program_name: program?.name,
            })
        }
    }

    // Process in batches of 3 students (keeps LLM payload manageable)
    const studentBatches: string[][] = []
    const allStudentKeys = [...byStudent.keys()]
    for (let i = 0; i < allStudentKeys.length; i += 3) {
        studentBatches.push(allStudentKeys.slice(i, i + 3))
    }

    let enrichedCount = 0
    let consolidatedCount = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const batch of studentBatches) {
        // Build one LLM call per batch with all students' insights
        const batchFindings: Array<{
            student_context: string
            findings: Array<{ insight_key: string; category: string; title: string; body: string }>
        }> = []

        for (const studentKey of batch) {
            const studentInsights = byStudent.get(studentKey)!
            const ctx = studentKey !== '__general__' ? studentContextMap.get(studentKey) : null

            const contextStr = ctx
                ? `Aluno: ${ctx.name}${ctx.training_level ? ` | Nível: ${ctx.training_level}` : ''}${ctx.goal ? ` | Objetivo: ${ctx.goal}` : ''}${ctx.program_name ? ` | Programa: "${ctx.program_name}"` : ''}`
                : 'Contexto geral do trainer'

            batchFindings.push({
                student_context: contextStr,
                findings: studentInsights.map(i => ({
                    insight_key: i.insight_key,
                    category: i.category,
                    title: i.title,
                    body: i.body,
                })),
            })
        }

        const totalFindings = batchFindings.reduce((sum, b) => sum + b.findings.length, 0)
        const maxTokens = Math.min(4000, 200 + totalFindings * 120) // ~120 tokens per enriched insight

        console.log(`[insight-enricher] Calling LLM for batch of ${batch.length} students, ${totalFindings} findings, maxTokens=${maxTokens}`)

        const result = await callLLM({
            model: 'gpt-4.1-mini',
            system: ENRICHMENT_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: JSON.stringify(batchFindings) }],
            max_tokens: maxTokens,
            temperature: 0.7,
            timeout_ms: 15000,
        })

        if (result.status !== 'success' || !result.data) {
            console.warn(`[insight-enricher] LLM call failed: ${result.status}`, { usage: result.usage, batchStudents: batch.length, findings: totalFindings })
            continue
        }

        // Parse response
        let enrichedInsights: EnrichedInsight[]
        try {
            const cleaned = result.data.trim().replace(/^```json?\n?|\n?```$/g, '')
            enrichedInsights = JSON.parse(cleaned)
            if (!Array.isArray(enrichedInsights)) throw new Error('Response is not an array')
        } catch (e) {
            console.warn('[insight-enricher] Failed to parse LLM response:', e)
            continue
        }

        if (result.usage) {
            console.log(`[insight-enricher] LLM cost: $${result.usage.cost_usd.toFixed(4)} (${result.usage.input_tokens}in/${result.usage.output_tokens}out)`)
        }

        // Apply enriched insights
        for (const enriched of enrichedInsights) {
            if (!enriched.insight_key || !enriched.title || !enriched.body) continue

            // Truncate to limits
            const title = enriched.title.slice(0, 60)
            const body = enriched.body.slice(0, 200)

            if (enriched.replaces && enriched.replaces.length > 0) {
                // Consolidated insight — find the student_id from one of the replaced keys
                const replacedInsight = insights.find(i => enriched.replaces!.includes(i.insight_key))
                if (!replacedInsight?.student_id) continue

                // Delete individual insights being replaced
                await supabaseAdmin
                    .from('assistant_insights')
                    .delete()
                    .eq('trainer_id', trainerId)
                    .in('insight_key', enriched.replaces)

                // Insert consolidated insight
                const consolidatedKey = `stagnation_summary:${replacedInsight.student_id}:${today}`
                await supabaseAdmin
                    .from('assistant_insights')
                    .upsert({
                        trainer_id: trainerId,
                        student_id: replacedInsight.student_id,
                        category: 'progression',
                        priority: 'medium',
                        title,
                        body,
                        action_type: 'adjust_load',
                        action_metadata: {
                            student_id: replacedInsight.student_id,
                            consolidated: true,
                            replaced_keys: enriched.replaces,
                        },
                        status: 'new',
                        insight_key: consolidatedKey,
                        source: 'llm',
                        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                    }, { onConflict: 'trainer_id,insight_key', ignoreDuplicates: false })

                consolidatedCount++
            } else {
                // Simple enrichment — update existing insight
                const { error } = await supabaseAdmin
                    .from('assistant_insights')
                    .update({ title, body, source: 'llm', updated_at: new Date().toISOString() })
                    .eq('trainer_id', trainerId)
                    .eq('insight_key', enriched.insight_key)

                if (!error) enrichedCount++
            }
        }
    }

    return { enriched: enrichedCount, consolidated: consolidatedCount }
}
