/**
 * Fixtures da suíte de eval — modo POR RESOLUÇÃO (não semeia, resolve).
 *
 * Em vez de criar dados (frágil e arriscado), apontamos os evals para um TRAINER
 * DE STAGING dedicado (EVAL_TRAINER_ID) e mapeamos os apelidos dos casos
 * (`studentRef`) para alunos/leads que já existem nesse trainer, escolhidos pelo
 * ESTADO necessário (com programa ativo, com lead aberto, etc.). Os inputs dos
 * casos usam o token `{name}`, substituído pelo nome real resolvido — assim a
 * suíte funciona com qualquer base de staging, sem nomes hardcoded.
 *
 * ⚠️ Use um trainer DESCARTÁVEL/STAGING: rodar evals executa escritas reversíveis
 * reais (ex.: kinevo_update_student) e pode gerar rascunhos de programa nesse
 * trainer. Nunca aponte para um treinador de produção com alunos reais.
 *
 * Variáveis de ambiente (lidas de web/.env.local + process.env):
 *   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (encanamento)
 *   - EVAL_TRAINER_ID   = UUID do trainer de staging
 *   - OPENAI_API_KEY    (LLM real, via o motor)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedRef {
    id: string
    name: string
}

export interface EvalFixtures {
    admin: SupabaseClient
    trainerId: string
    trainerName: string | null
    /** apelido → aluno real (id + nome) */
    students: Record<string, ResolvedRef>
    /** apelido → lead real (id + nome) */
    leads: Record<string, ResolvedRef>
}

/** Carrega web/.env.local para process.env (mesmo padrão dos *.live.test.ts). */
function loadEnvLocal(): { url: string; key: string } {
    // Este arquivo vive em web/src/lib/assistant/evals → .env.local está 4 níveis acima.
    const raw = readFileSync(resolve(import.meta.dirname, '../../../../.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
        }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em web/.env.local')
    }
    return { url, key }
}

/**
 * Resolve o trainer de staging + os alunos/leads usados pelos casos.
 * Lança com mensagem clara se faltar configuração — o runner converte em skip.
 */
export async function setupEvalFixtures(): Promise<EvalFixtures> {
    const { url, key } = loadEnvLocal()
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = key

    const trainerId = process.env.EVAL_TRAINER_ID
    if (!trainerId) {
        throw new Error(
            'Defina EVAL_TRAINER_ID (um trainer de STAGING dedicado) para rodar os evals comportamentais.',
        )
    }

    const admin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: trainer } = await admin
        .from('trainers')
        .select('id, name')
        .eq('id', trainerId)
        .maybeSingle()
    if (!trainer) throw new Error(`EVAL_TRAINER_ID "${trainerId}" não encontrado na base.`)

    // Alunos ativos (exclui o self-student do treinador).
    const { data: studentRows } = await admin
        .from('students')
        .select('id, name, created_at')
        .eq('coach_id', trainerId)
        .eq('status', 'active')
        .eq('is_trainer_profile', false)
        .order('created_at', { ascending: true })

    const list = (studentRows ?? []) as Array<{ id: string; name: string }>

    // Quais têm programa ativo (para casos de progresso/prescrição).
    const { data: programRows } = await admin
        .from('assigned_programs')
        .select('student_id')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
    const withProgram = new Set((programRows ?? []).map((p) => p.student_id))

    const studentWithProgram = list.find((s) => withProgram.has(s.id)) ?? list[0]
    const students: Record<string, ResolvedRef> = {}
    const ref = (s?: { id: string; name: string }): ResolvedRef | undefined =>
        s ? { id: s.id, name: s.name } : undefined

    // Mapeamento por estado (com fallback para o que existir):
    //   joao  = aluno COM programa ativo (progresso, edição de treino)
    //   maria = qualquer aluno ativo (edição reversível, pagamento)
    //   pedro = um segundo aluno (contrato/agenda)
    const r1 = ref(studentWithProgram)
    const r2 = ref(list[0])
    const r3 = ref(list[1] ?? list[0])
    if (r1) students.joao = r1
    if (r2) students.maria = r2
    if (r3) students.pedro = r3

    // Lead aberto (não convertido).
    const { data: leadRows } = await admin
        .from('trainer_leads')
        .select('id, name')
        .eq('trainer_id', trainerId)
        .in('status', ['new', 'read', 'contacted'])
        .limit(1)
    const leads: Record<string, ResolvedRef> = {}
    if (leadRows?.[0]) leads.ana_lead = { id: leadRows[0].id, name: leadRows[0].name }

    return { admin, trainerId, trainerName: trainer.name ?? null, students, leads }
}

/** Resolve um studentRef para um aluno real (não resolve leads). */
export function resolveStudent(fx: EvalFixtures, ref?: string): ResolvedRef | undefined {
    if (!ref) return undefined
    return fx.students[ref]
}

/** Resolve um ref para aluno OU lead (qualquer um). */
export function resolveAny(fx: EvalFixtures, ref?: string): ResolvedRef | undefined {
    if (!ref) return undefined
    return fx.students[ref] ?? fx.leads[ref]
}

/** Substitui o token {name} no input pelo nome real resolvido. */
export function applyNameTemplate(input: string, name?: string): string {
    if (!name) return input
    return input.replace(/\{name\}/g, name)
}
