import { describe, it, expect } from 'vitest'
import { runTriage } from '../triage'
import type { AnswersMap } from '../answers'

// Helper: anamnese "saudável" com PAR-Q completo em "não".
function healthyAnswers(overrides: AnswersMap = {}): AnswersMap {
    const base: AnswersMap = {
        parq_heart_condition: { type: 'single_choice', value: 'no' },
        parq_chest_pain_exercise: { type: 'single_choice', value: 'no' },
        parq_chest_pain_recent: { type: 'single_choice', value: 'no' },
        parq_dizziness: { type: 'single_choice', value: 'no' },
        parq_bone_joint: { type: 'single_choice', value: 'no' },
        parq_medication: { type: 'single_choice', value: 'no' },
        parq_other_reason: { type: 'single_choice', value: 'no' },
        recent_surgery: { type: 'single_choice', value: 'no' },
        has_medical_restriction: { type: 'single_choice', value: 'no' },
        has_chronic_pain: { type: 'single_choice', value: 'no' },
        currently_training: { type: 'single_choice', value: 'yes' },
        birth_date: { type: 'short_text', value: '10/05/1995' },
    }
    return { ...base, ...overrides }
}

const TODAY = new Date('2026-07-02T12:00:00Z')

describe('runTriage — níveis', () => {
    it('anamnese limpa → verde, sem flags', () => {
        const result = runTriage(healthyAnswers(), TODAY)
        expect(result.level).toBe('green')
        expect(result.flags).toHaveLength(0)
    })

    it.each([
        'parq_heart_condition',
        'parq_chest_pain_exercise',
        'parq_chest_pain_recent',
        'parq_dizziness',
    ])('PAR-Q cardiovascular "sim" (%s) → vermelho', (questionId) => {
        const result = runTriage(
            healthyAnswers({ [questionId]: { type: 'single_choice', value: 'yes' } }),
            TODAY,
        )
        expect(result.level).toBe('red')
        expect(result.flags.some(f => f.key === questionId && f.severity === 'red')).toBe(true)
    })

    it('cirurgia recente → vermelho', () => {
        const result = runTriage(
            healthyAnswers({ recent_surgery: { type: 'single_choice', value: 'yes' } }),
            TODAY,
        )
        expect(result.level).toBe('red')
    })

    it.each([
        'parq_bone_joint',
        'parq_medication',
        'parq_other_reason',
    ])('PAR-Q 5-7 "sim" (%s) → amarelo (não bloqueia)', (questionId) => {
        const result = runTriage(
            healthyAnswers({ [questionId]: { type: 'single_choice', value: 'yes' } }),
            TODAY,
        )
        expect(result.level).toBe('yellow')
    })

    it('vermelho domina amarelo', () => {
        const result = runTriage(
            healthyAnswers({
                parq_heart_condition: { type: 'single_choice', value: 'yes' },
                parq_bone_joint: { type: 'single_choice', value: 'yes' },
            }),
            TODAY,
        )
        expect(result.level).toBe('red')
        expect(result.flags.length).toBeGreaterThanOrEqual(2)
    })
})

describe('runTriage — flags específicas', () => {
    it('PAR-Q incompleto nunca passa verde', () => {
        const partial = healthyAnswers()
        delete partial.parq_dizziness
        const result = runTriage(partial, TODAY)
        expect(result.level).toBe('yellow')
        const flag = result.flags.find(f => f.key === 'parq_incomplete')
        expect(flag?.detail).toContain('parq_dizziness')
    })

    it('restrição médica carrega a descrição como detail', () => {
        const result = runTriage(
            healthyAnswers({
                has_medical_restriction: { type: 'single_choice', value: 'yes' },
                medical_restriction_description: { type: 'long_text', value: 'Hérnia de disco L4-L5' },
            }),
            TODAY,
        )
        expect(result.level).toBe('yellow')
        const flag = result.flags.find(f => f.key === 'has_medical_restriction')
        expect(flag?.detail).toBe('Hérnia de disco L4-L5')
    })

    it('dor crônica agrega regiões marcadas', () => {
        const result = runTriage(
            healthyAnswers({
                has_chronic_pain: { type: 'single_choice', value: 'yes' },
                has_lower_back_pain: { type: 'single_choice', value: 'yes' },
                has_cervical_pain: { type: 'single_choice', value: 'yes' },
            }),
            TODAY,
        )
        const flag = result.flags.find(f => f.key === 'has_chronic_pain')
        expect(flag?.detail).toContain('lombar')
        expect(flag?.detail).toContain('cervical')
    })

    it('inatividade longa só flagra quando NÃO está treinando', () => {
        const inactive = runTriage(
            healthyAnswers({
                currently_training: { type: 'single_choice', value: 'no' },
                inactivity_duration: { type: 'single_choice', value: 'over_1y' },
            }),
            TODAY,
        )
        expect(inactive.flags.some(f => f.key === 'long_inactivity')).toBe(true)

        const active = runTriage(
            healthyAnswers({
                currently_training: { type: 'single_choice', value: 'yes' },
                inactivity_duration: { type: 'single_choice', value: 'over_1y' },
            }),
            TODAY,
        )
        expect(active.flags.some(f => f.key === 'long_inactivity')).toBe(false)
    })

    it('idade ≥ 60 flagra amarelo (formato DD/MM/AAAA)', () => {
        const result = runTriage(
            healthyAnswers({ birth_date: { type: 'short_text', value: '15/03/1960' } }),
            TODAY,
        )
        const flag = result.flags.find(f => f.key === 'age_60_plus')
        expect(flag).toBeDefined()
        expect(result.level).toBe('yellow')
    })

    it('data de nascimento não parseável não flagra nem quebra', () => {
        const result = runTriage(
            healthyAnswers({ birth_date: { type: 'short_text', value: 'não sei' } }),
            TODAY,
        )
        expect(result.flags.some(f => f.key === 'age_60_plus')).toBe(false)
        expect(result.level).toBe('green')
    })

    it('answers vazio → amarelo por PAR-Q incompleto (conservador)', () => {
        const result = runTriage({}, TODAY)
        expect(result.level).toBe('yellow')
        expect(result.flags.some(f => f.key === 'parq_incomplete')).toBe(true)
    })
})
