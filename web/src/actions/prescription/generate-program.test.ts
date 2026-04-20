import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock is hoisted above top-level declarations; the factory must stand
// alone without closure references. The trap throws on invocation so any
// code path that reaches the cookie-based client is caught red-handed.
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => {
        throw new Error('cookie-based createClient must NOT be called when options.supabase is provided')
    }),
}))

import { createClient as cookieCreateClient } from '@/lib/supabase/server'
import { generateProgram, buildSmartV2InputSnapshot } from './generate-program'
import type { EnrichedStudentContextV2 } from '@/lib/prescription/context-enricher-v2'
import type { StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'

const cookieClientTrap = vi.mocked(cookieCreateClient)

// Minimal stub Supabase client: returns `null` for auth.getUser so the action
// short-circuits on line ~142 with "Não autorizado". We only need to prove that:
//   (a) createClient() from @/lib/supabase/server was NOT called;
//   (b) the injected client was consumed (auth.getUser reached).
function makeInjectedSupabase(): any {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
    }
}

describe('generateProgram — options.supabase injection', () => {
    let debugSpy: ReturnType<typeof vi.spyOn>
    type DebugCall = Parameters<Console['debug']>

    beforeEach(() => {
        cookieClientTrap.mockClear()
        debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    })

    afterEach(() => {
        debugSpy.mockRestore()
    })

    it('consumes injected supabase without calling the cookie-based factory', async () => {
        const injected = makeInjectedSupabase()
        const result = await generateProgram('stu-1', null, [], { supabase: injected })

        expect(cookieClientTrap).not.toHaveBeenCalled()
        expect(injected.auth.getUser).toHaveBeenCalledTimes(1)
        // Short-circuited at auth check (stub returned no user).
        expect(result.success).toBe(false)
        expect(result.error).toBe('Não autorizado')
    })

    it('emits the "using injected supabase client" debug log when injected', async () => {
        const injected = makeInjectedSupabase()
        await generateProgram('stu-1', null, [], { supabase: injected })

        const allArgs = (debugSpy.mock.calls as unknown as DebugCall[]).flat()
        const debugCalls = allArgs.map((s) => String(s))
        expect(debugCalls.some(s => s.includes('using injected supabase client'))).toBe(true)
    })

    it('falls back to cookie-based createClient when options.supabase is absent', async () => {
        // When no options.supabase is passed, the action must reach the cookie
        // factory — which is trapped here to prove the path is taken.
        await expect(generateProgram('stu-1', null, [])).rejects.toThrow(
            /cookie-based createClient must NOT be called/,
        )
        expect(cookieClientTrap).toHaveBeenCalledTimes(1)
    })
})

// ── Fase 2.5.2: persistence of EnrichedStudentContextV2 in input_snapshot ──

describe('buildSmartV2InputSnapshot', () => {
    const profile: StudentPrescriptionProfile = {
        id: 'p', student_id: 's', trainer_id: 't',
        training_level: 'intermediate', goal: 'hypertrophy',
        available_days: [1, 3, 5], session_duration_minutes: 60,
        available_equipment: ['academia_completa'],
        favorite_exercise_ids: [], disliked_exercise_ids: [],
        medical_restrictions: [], ai_mode: 'auto',
        cycle_observation: null, adherence_rate: null,
        avg_session_duration_minutes: null, last_calculated_at: null,
        created_at: '', updated_at: '',
    }

    const enriched: EnrichedStudentContextV2 = {
        student_name: 'Test Student',
        previous_programs: [],
        load_progression: [],
        session_patterns: {
            preferred_days: [],
            avg_session_duration_minutes: null,
            dropout_rate_by_workout: {},
            total_sessions_4w: 0,
            completed_sessions_4w: 0,
        },
        previous_exercise_ids: [],
        anamnese_summary: 'Nível intermediate, objetivo hypertrophy, 3 dias/semana (60 min).',
        performance_summary: {
            stagnated_exercises: [{ name: 'Supino Reto', group: 'Peito', weeks_stalled: 4 }],
            progressing_well: [{ name: 'Agachamento Livre' }],
            last_session_dates: ['2026-04-14'],
        },
        adherence: { rate_last_4_weeks: 75, bucket: 'boa' },
        trainer_observations: [{ note: 'Aluno relatou dor leve no ombro', created_at: '2026-04-15' }],
        active_injuries: [{ label: 'Tendinite ombro', started_at: null, notes: null }],
        equipment_preference: 'academia_completa',
        is_new_student: false,
    }

    it('persists enriched_context_v2 alongside the pre-existing keys', async () => {
        const snap = await buildSmartV2InputSnapshot({
            profile, exercises: [], performanceContext: null, enriched,
        })
        // All pre-existing top-level keys preserved.
        expect(snap).toHaveProperty('profile')
        expect(snap).toHaveProperty('available_exercises')
        expect(snap).toHaveProperty('performance_context')
        expect(snap).toHaveProperty('engine_version')
        expect(snap).toHaveProperty('smart_v2', true)
        expect(snap).toHaveProperty('prompt_version')
        // New: the full enriched context is now persisted.
        expect(snap).toHaveProperty('enriched_context_v2')
    })

    it('carries the 7 main fields of EnrichedStudentContextV2 in the snapshot', async () => {
        const snap = await buildSmartV2InputSnapshot({
            profile, exercises: [], performanceContext: null, enriched,
        })
        const persisted = snap.enriched_context_v2 as EnrichedStudentContextV2
        expect(persisted.anamnese_summary).toBe(enriched.anamnese_summary)
        expect(persisted.performance_summary).toEqual(enriched.performance_summary)
        expect(persisted.adherence).toEqual(enriched.adherence)
        expect(persisted.trainer_observations).toEqual(enriched.trainer_observations)
        expect(persisted.active_injuries).toEqual(enriched.active_injuries)
        expect(persisted.equipment_preference).toBe(enriched.equipment_preference)
        expect(persisted.is_new_student).toBe(enriched.is_new_student)
    })

    it('preserves enriched.stagnated_exercises entries (auditable performance signal)', async () => {
        const snap = await buildSmartV2InputSnapshot({
            profile, exercises: [], performanceContext: null, enriched,
        })
        const persisted = snap.enriched_context_v2 as EnrichedStudentContextV2
        expect(persisted.performance_summary.stagnated_exercises).toHaveLength(1)
        expect(persisted.performance_summary.stagnated_exercises[0].name).toBe('Supino Reto')
    })
})
