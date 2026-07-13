// Gate de qualidade da prescrição (P3): as regras do playbook viram código.
// O que bloqueia (errors) e o que só avisa (warnings) está travado aqui —
// mudar a política de qualidade deve quebrar um teste, nunca passar em silêncio.

import { describe, it, expect } from 'vitest'
import {
    validateBuildArgs,
    buildQualityCorrective,
    annotateResultWithWarnings,
    type BuildProgramArgs,
    type CatalogEntry,
} from './build-validator'
import type { PrescriptionStyle } from '@kinevo/shared/types/prescription'

// Catálogo de teste: compostos (P) e acessórios (A) por grupo.
const CATALOG = new Map<string, CatalogEntry>([
    ['sq', { name: 'Agachamento', group: 'Quadríceps', isPrimary: true }],
    ['hip', { name: 'Hip Thrust', group: 'Glúteo', isPrimary: true }],
    ['terra', { name: 'Levantamento Terra', group: 'Posterior de Coxa', isPrimary: true }],
    ['sup', { name: 'Supino', group: 'Peito', isPrimary: true }],
    ['rem', { name: 'Remada', group: 'Costas', isPrimary: true }],
    ['abd', { name: 'Abdução de Quadril', group: 'Glúteo', isPrimary: false }],
    ['lat', { name: 'Elevação Lateral', group: 'Ombros', isPrimary: false }],
    ['rosca', { name: 'Rosca Direta', group: 'Bíceps', isPrimary: false }],
    ['triceps', { name: 'Tríceps Polia', group: 'Tríceps', isPrimary: false }],
])

function session(
    name: string,
    exercises: Array<[string, number] | { superset: Array<[string, number]> }>,
    days: number[] = [1],
): NonNullable<BuildProgramArgs['sessions']>[number] {
    return {
        name,
        scheduled_days: days,
        items: exercises.map((e) =>
            Array.isArray(e)
                ? { exercise_id: e[0], sets: e[1], reps: '8-12' }
                : { superset: e.superset.map(([id, sets]) => ({ exercise_id: id, sets, reps: '10' })) },
        ),
    }
}

const OK_PROGRAM: BuildProgramArgs = {
    name: 'Teste',
    sessions: [
        session('A', [['sq', 4], ['hip', 3], ['abd', 3], ['lat', 3]], [1]),
        session('B', [['sup', 4], ['rem', 4], ['rosca', 3], ['triceps', 3]], [3]),
    ],
}

describe('validateBuildArgs — caminho feliz', () => {
    it('programa são passa sem erros', () => {
        const v = validateBuildArgs(OK_PROGRAM, CATALOG)
        expect(v.errors).toEqual([])
    })
})

describe('errors (bloqueiam)', () => {
    it('E1: sem sessões / sessão vazia', () => {
        expect(validateBuildArgs({ sessions: [] }, CATALOG).errors).toHaveLength(1)
        const v = validateBuildArgs({ sessions: [{ name: 'Vazia', items: [] }] }, CATALOG)
        expect(v.errors[0]).toContain('Vazia')
    })

    it('E2: exercise_id fora do catálogo', () => {
        const v = validateBuildArgs(
            { sessions: [session('A', [['fantasma', 3], ['sq', 4], ['hip', 3], ['abd', 3]]) ] },
            CATALOG,
        )
        expect(v.errors.some((e) => e.includes('fantasma'))).toBe(true)
    })

    it('E3: exercício repetido DENTRO da sessão (inclusive via superset)', () => {
        const v = validateBuildArgs(
            { sessions: [session('A', [['sq', 4], { superset: [['sq', 3], ['abd', 3]] }, ['hip', 3]])] },
            CATALOG,
        )
        expect(v.errors.some((e) => e.includes('repete') && e.includes('Agachamento'))).toBe(true)
    })

    it('E4: volume semanal por grupo acima de 20 — soma sessões e multiplica pelos dias', () => {
        // Glúteo: (hip 4 + abd 4) × 2 dias + hip 6 ×1 = 22 → estoura.
        const v = validateBuildArgs(
            {
                sessions: [
                    session('A', [['hip', 4], ['abd', 4], ['sq', 3], ['lat', 3]], [1, 4]),
                    session('B', [['hip', 6], ['rem', 4], ['sup', 3], ['rosca', 3]], [2]),
                ],
            },
            CATALOG,
        )
        const volErr = v.errors.find((e) => e.includes('Glúteo'))
        expect(volErr).toBeTruthy()
        expect(volErr).toContain('Glúteo = 22')
    })

    it('E4: aquecimento/ativação não contam volume', () => {
        const sessions = [
            {
                name: 'A',
                scheduled_days: [1],
                items: [
                    { exercise_id: 'hip', sets: 18, reps: '8' },
                    { exercise_id: 'abd', sets: 6, reps: '15', exercise_function: 'activation' },
                    { exercise_id: 'sq', sets: 3, reps: '8' },
                    { exercise_id: 'lat', sets: 3, reps: '12' },
                ],
            },
        ]
        // Glúteo trabalhando = 18 (a ativação de 6 não conta) → dentro do teto.
        expect(validateBuildArgs({ sessions }, CATALOG).errors).toEqual([])
    })

    it('E4: set_scheme × rounds conta como séries', () => {
        const sessions = [
            {
                name: 'A',
                scheduled_days: [1],
                items: [
                    // 3 séries no scheme × 4 rounds = 12; + hip 9 = 21 no Glúteo → estoura.
                    { exercise_id: 'abd', set_scheme: [{}, {}, {}], rounds: 4, reps: '10' },
                    { exercise_id: 'hip', sets: 9, reps: '8' },
                    { exercise_id: 'sq', sets: 3, reps: '8' },
                    { exercise_id: 'lat', sets: 3, reps: '12' },
                ],
            },
        ]
        const v = validateBuildArgs({ sessions }, CATALOG)
        expect(v.errors.some((e) => e.includes('Glúteo = 21'))).toBe(true)
    })

    it('E5: sessão (4+ exercícios) sem NENHUM composto principal', () => {
        const v = validateBuildArgs(
            { sessions: [session('Isoladores', [['abd', 3], ['lat', 3], ['rosca', 3], ['triceps', 3]])] },
            CATALOG,
        )
        expect(v.errors.some((e) => e.includes('composto principal'))).toBe(true)
    })

    it('E6: mais de 9 exercícios na sessão', () => {
        const many = session('Gigante', [
            ['sq', 2], ['hip', 2], ['terra', 2], ['sup', 2], ['rem', 2],
            ['abd', 2], ['lat', 2], ['rosca', 2], ['triceps', 2], ['sq', 2],
        ])
        const v = validateBuildArgs({ sessions: [many] }, CATALOG)
        expect(v.errors.some((e) => e.includes('Gigante') && e.includes('10 exercícios'))).toBe(true)
    })
})

describe('warnings (não bloqueiam)', () => {
    it('W1: exercício em 3+ sessões vira aviso (2 sessões é legítimo)', () => {
        const p: BuildProgramArgs = {
            sessions: [
                session('A', [['hip', 3], ['sq', 3], ['abd', 3], ['lat', 3]], [1]),
                session('B', [['hip', 3], ['rem', 3], ['rosca', 3], ['triceps', 3]], [3]),
                session('C', [['hip', 3], ['sup', 3], ['terra', 3], ['lat', 3]], [5]),
            ],
        }
        const v = validateBuildArgs(p, CATALOG)
        expect(v.errors).toEqual([])
        expect(v.warnings.some((w) => w.includes('Hip Thrust') && w.includes('3 sessões'))).toBe(true)

        const twoOnly = validateBuildArgs({ sessions: p.sessions!.slice(0, 2) }, CATALOG)
        expect(twoOnly.warnings.some((w) => w.includes('Hip Thrust'))).toBe(false)
    })

    it('W2: acessório sem exercise_function (default main) vira aviso', () => {
        const v = validateBuildArgs(OK_PROGRAM, CATALOG)
        expect(v.warnings.some((w) => w.includes('accessory'))).toBe(true)
    })

    it('W3: sessão sem scheduled_days', () => {
        const v = validateBuildArgs(
            { sessions: [{ name: 'A', items: [{ exercise_id: 'sq', sets: 4, reps: '8' }] }] },
            CATALOG,
        )
        expect(v.warnings.some((w) => w.includes('scheduled_days'))).toBe(true)
    })

    it('W6: sessão que abre com acessório vira aviso, não erro', () => {
        const v = validateBuildArgs(
            { sessions: [session('A', [['abd', 3], ['hip', 4], ['sq', 3], ['lat', 3]])] },
            CATALOG,
        )
        expect(v.errors).toEqual([])
        expect(v.warnings.some((w) => w.includes('começa por um acessório'))).toBe(true)
    })

    it('W4: faixa de exercícios/sessão segue o estilo do treinador quando existe', () => {
        const style = { exercises_per_session: { min: 6, max: 8 } } as PrescriptionStyle
        const v = validateBuildArgs(OK_PROGRAM, CATALOG, style) // sessões têm 4
        expect(v.warnings.some((w) => w.includes('6–8'))).toBe(true)
    })

    it('W7: renovação que repete a maioria dos exercícios do programa ativo vira aviso', () => {
        // OK_PROGRAM usa sq,hip,abd,lat,sup,rem,rosca,triceps (8 distintos).
        // 6/8 vindos do programa anterior = 75% de sobreposição → aviso.
        const prev = new Set(['sq', 'hip', 'abd', 'lat', 'sup', 'rem'])
        const v = validateBuildArgs(OK_PROGRAM, CATALOG, null, prev)
        expect(v.errors).toEqual([])
        expect(v.warnings.some((w) => w.includes('6 de 8') && w.includes('VARIAÇÃO'))).toBe(true)

        // Sobreposição baixa (só os compostos-chave) NÃO gera aviso.
        const fewPrev = new Set(['sq', 'hip'])
        const v2 = validateBuildArgs(OK_PROGRAM, CATALOG, null, fewPrev)
        expect(v2.warnings.some((w) => w.includes('VARIAÇÃO'))).toBe(false)
    })
})

describe('corretivo e anotação', () => {
    it('buildQualityCorrective carrega blocked + erros', () => {
        const c = buildQualityCorrective({ errors: ['x'], warnings: ['y'] })
        expect(c.blocked).toBe(true)
        expect(c.quality_errors).toEqual(['x'])
        expect(c.quality_warnings).toEqual(['y'])
        expect(String(c.message)).toContain('NÃO foi criado')
    })

    it('annotateResultWithWarnings injeta no payload MCP e é defensivo', () => {
        const env = { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }
        const out = annotateResultWithWarnings(env, ['w1']) as typeof env
        expect(JSON.parse(out.content[0].text).quality_warnings).toEqual(['w1'])
        // erro MCP e formatos estranhos passam intocados
        const err = { isError: true, content: [{ text: '{}' }] }
        expect(annotateResultWithWarnings(err, ['w'])).toBe(err)
        expect(annotateResultWithWarnings('str', ['w'])).toBe('str')
        expect(annotateResultWithWarnings(env, [])).toBe(env)
    })
})
