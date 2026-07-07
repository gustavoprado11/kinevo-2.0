import { describe, it, expect } from 'vitest'
import { deriveProfileFromAnamnese } from '../profile-mapper'
import type { AnswersMap } from '../answers'

describe('deriveProfileFromAnamnese', () => {
    it('mapeia o caminho feliz completo', () => {
        const answers: AnswersMap = {
            training_level: { type: 'single_choice', value: 'intermediate' },
            primary_goal: { type: 'single_choice', value: 'hypertrophy' },
            available_days: { type: 'multi_choice', values: ['monday', 'wednesday', 'friday'] },
        }
        const profile = deriveProfileFromAnamnese(answers)
        expect(profile.training_level).toBe('intermediate')
        expect(profile.goal).toBe('hypertrophy')
        expect(profile.available_days).toEqual([1, 3, 5])
        expect(profile.session_duration_minutes).toBe(60)
        expect(profile.medical_restrictions).toEqual([])
    })

    it('mapeia os objetivos do template 065 para o enum do perfil', () => {
        const goalOf = (value: string) =>
            deriveProfileFromAnamnese({ primary_goal: { type: 'single_choice', value } }).goal
        expect(goalOf('weight_loss')).toBe('weight_loss')
        expect(goalOf('sports_performance')).toBe('performance')
        expect(goalOf('quality_of_life')).toBe('health')
        expect(goalOf('valor_desconhecido')).toBe('health') // fallback neutro
    })

    it('7 dias marcados → derruba domingo (validateInput exige máx. 6)', () => {
        const profile = deriveProfileFromAnamnese({
            available_days: {
                type: 'multi_choice',
                values: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            },
        })
        expect(profile.available_days).toEqual([1, 2, 3, 4, 5, 6])
    })

    it('sem dias respondidos → default seg/qua/sex (defensivo)', () => {
        const profile = deriveProfileFromAnamnese({})
        expect(profile.available_days).toEqual([1, 3, 5])
        expect(profile.training_level).toBe('beginner')
    })

    it('deriva restrições médicas com severidade', () => {
        const profile = deriveProfileFromAnamnese({
            has_medical_restriction: { type: 'single_choice', value: 'yes' },
            medical_restriction_description: { type: 'long_text', value: 'Hipertensão controlada' },
            has_chronic_pain: { type: 'single_choice', value: 'yes' },
            has_lower_back_pain: { type: 'single_choice', value: 'yes' },
            recent_surgery: { type: 'single_choice', value: 'yes' },
        })
        expect(profile.medical_restrictions).toHaveLength(3)
        expect(profile.medical_restrictions[0].description).toBe('Hipertensão controlada')
        expect(profile.medical_restrictions[0].severity).toBe('moderate')
        expect(profile.medical_restrictions[1].description).toContain('lombar')
        expect(profile.medical_restrictions[2].severity).toBe('severe')
    })

    it('valores de dia desconhecidos são ignorados sem quebrar', () => {
        const profile = deriveProfileFromAnamnese({
            available_days: { type: 'multi_choice', values: ['monday', 'feriados', 'friday'] },
        })
        expect(profile.available_days).toEqual([1, 5])
    })
})
