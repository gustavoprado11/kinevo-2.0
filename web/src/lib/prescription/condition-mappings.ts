// ============================================================================
// Kinevo Prescription Engine — Condition Mappings
// ============================================================================
// Maps common clinical conditions to programmatic restrictions.
// When a trainer types a restriction description, matchCondition() identifies
// the condition and suggests muscle groups/patterns to restrict.
// buildConditionInstructions() formats specific AI instructions per condition.

import type { MedicalRestriction } from '@kinevo/shared/types/prescription'

// ============================================================================
// Types
// ============================================================================

export interface ConditionMapping {
    /** Unique condition ID */
    id: string
    /** Regex matchers for automatic matching (case-insensitive) */
    matchers: RegExp[]
    /** Standardized condition label */
    label: string
    /** Muscle groups that should be trained with caution */
    cautious_muscle_groups: string[]
    /** Contraindicated movement patterns */
    contraindicated_patterns: string[]
    /** Specific prescription rules for this condition */
    prescription_rules: string[]
    /** Instruction text injected into the AI prompt */
    ai_instruction: string
}

export interface ConditionMatchResult {
    condition: ConditionMapping
    confidence: 'high' | 'medium'
}

// ============================================================================
// Condition Dictionary (10 common conditions)
// ============================================================================

export const CONDITION_MAPPINGS: ConditionMapping[] = [

    // ── JOELHO ──

    {
        id: 'patellofemoral_pain',
        matchers: [
            /femoropatelar/i, /patelar/i, /condromal[aá]cia/i,
            /patellofemoral/i, /pf[\s-]?pain/i,
            /dor\s*(?:no|nos|de)?\s*joelho/i,
            /anterior\s*(?:do|de)?\s*joelho/i,
        ],
        label: 'Dor Femoropatelar / Condromalácia',
        cautious_muscle_groups: ['Quadríceps'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Limitar flexão de joelho a 0-80° em exercícios de cadeia fechada',
            'Preferir leg press com amplitude controlada sobre agachamento livre',
            'Isometria de quadríceps (20-40°) como alternativa à extensora dinâmica',
            'Incluir fortalecimento de glúteo médio (abdução, clamshell, side plank)',
            'Step-up apenas com degrau baixo (10-15cm)',
            'Evitar exercícios com impacto (jump, corrida)',
            'Cardio preferencial: bike com banco alto ou elíptico',
        ],
        ai_instruction: 'CONDIÇÃO: Dor femoropatelar. Limitar flexão de joelho a 80°. Priorizar glúteo médio. Isometria de quad em ângulos indolores. Evitar impacto. Regra de dor: ≤3/10 durante execução, sem piora em 24h.',
    },

    {
        id: 'acl_post_op',
        matchers: [
            /lca/i, /ligamento\s*cruzado\s*anterior/i, /acl/i,
            /p[oó]s[\s-]*(?:op|cir[uú]rg)/i,
        ],
        label: 'Pós-operatório LCA',
        cautious_muscle_groups: ['Quadríceps', 'Posterior de Coxa'],
        contraindicated_patterns: ['lunge'],
        prescription_rules: [
            'Seguir protocolo do fisioterapeuta — confirmar fase de reabilitação',
            'Evitar exercícios em cadeia aberta com carga nos primeiros 4 meses',
            'Cadeia fechada preferencial (leg press, agachamento parcial)',
            'Progredir amplitude gradualmente',
            'Sem exercícios de pivô ou mudança brusca de direção',
        ],
        ai_instruction: 'CONDIÇÃO: Pós-op LCA. Confirmar fase de reab com treinador. Cadeia fechada preferencial. Sem pivô. Progressão gradual de amplitude.',
    },

    {
        id: 'meniscus',
        matchers: [
            /menisco/i, /meniscal/i, /meniscus/i,
        ],
        label: 'Lesão de Menisco',
        cautious_muscle_groups: ['Quadríceps'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar flexão profunda de joelho (>90°) sob carga',
            'Evitar rotação de joelho sob carga',
            'Preferir cadeia fechada com amplitude controlada',
            'Fortalecer quadríceps e posterior de coxa para estabilidade',
        ],
        ai_instruction: 'CONDIÇÃO: Lesão de menisco. Evitar flexão >90° e rotação sob carga. Cadeia fechada com amplitude controlada.',
    },

    // ── COLUNA ──

    {
        id: 'lumbar_disc',
        matchers: [
            /h[eé]rnia/i, /disco/i, /lombar/i, /l[45]/i, /l5[\s-]*s1/i,
            /protrus[aã]o/i, /abaulamento/i, /ciatalgia/i, /ci[aá]tica/i,
            /lumbar/i, /herniat/i,
        ],
        label: 'Hérnia / Protrusão Discal Lombar',
        cautious_muscle_groups: [],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar flexão lombar sob carga (stiff com barra pesada, bom dia)',
            'Evitar compressão axial excessiva (agachamento com barra alta + carga pesada)',
            'Preferir exercícios com suporte lombar (leg press, máquinas)',
            'Fortalecer core com exercícios isométricos (prancha, pallof press)',
            'Evitar rotação lombar sob carga',
            'Hip hinge com carga leve é ok se técnica perfeita',
        ],
        ai_instruction: 'CONDIÇÃO: Hérnia/protrusão lombar. Evitar flexão lombar sob carga e compressão axial excessiva. Core isométrico. Máquinas com suporte lombar preferíveis.',
    },

    {
        id: 'cervical',
        matchers: [
            /cervical/i, /pesco[çc]o/i, /c[45]/i, /cervicalgia/i,
        ],
        label: 'Dor Cervical / Cervicalgia',
        cautious_muscle_groups: ['Trapézio'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar carga direta sobre o trapézio superior (encolhimentos pesados)',
            'Evitar posições que comprimam a cervical (agachamento com barra alta)',
            'Preferir agachamento com barra baixa ou front squat ou leg press',
            'Desenvolvimento sentado com apoio preferível a em pé',
        ],
        ai_instruction: 'CONDIÇÃO: Dor cervical. Evitar compressão cervical direta. Preferir leg press sobre agachamento com barra. Desenvolvimento sentado com apoio.',
    },

    // ── OMBRO ──

    {
        id: 'shoulder_impingement',
        matchers: [
            /impacto\s*(?:de|no|do)?\s*ombro/i, /impingement/i,
            /s[ií]ndrome\s*(?:do)?\s*impacto/i,
            /bursite\s*(?:de|no|do)?\s*ombro/i,
            /tendinite\s*(?:de|no|do)?\s*(?:ombro|supraespinh)/i,
            /manguito\s*rotador/i, /rotator\s*cuff/i,
            /supraespinh/i, /supraspinat/i,
        ],
        label: 'Impacto / Tendinite de Ombro',
        cautious_muscle_groups: ['Ombros'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar elevação acima de 90° com carga em fase aguda',
            'Evitar desenvolvimento atrás da nuca',
            'Supino com amplitude controlada (não descer abaixo da linha do peito)',
            'Incluir rotação externa (face pull, rotação externa com elástico)',
            'Fortalecer estabilizadores escapulares',
            'Progredir para amplitude completa conforme dor permitir',
        ],
        ai_instruction: 'CONDIÇÃO: Impacto/tendinite de ombro. Evitar elevação >90° com carga se doloroso. Incluir rotação externa. Supino com amplitude controlada. Fortalecer estabilizadores.',
    },

    {
        id: 'shoulder_instability',
        matchers: [
            /luxa[çc][aã]o/i, /subluxa[çc][aã]o/i,
            /instabilidade\s*(?:de|no|do)?\s*ombro/i,
            /labrum/i, /labral/i, /bankart/i, /slap/i,
        ],
        label: 'Instabilidade / Luxação de Ombro',
        cautious_muscle_groups: ['Ombros', 'Peito'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar posição de abdução + rotação externa máxima sob carga',
            'Supino com pegada não muito aberta',
            'Evitar supino declinado (posição provocativa)',
            'Fortalecer manguito rotador e estabilizadores',
            'Progredir amplitude gradualmente',
        ],
        ai_instruction: 'CONDIÇÃO: Instabilidade de ombro. Evitar abdução + rotação externa máxima. Supino pegada moderada. Fortalecer rotadores.',
    },

    // ── QUADRIL ──

    {
        id: 'hip_pain',
        matchers: [
            /dor\s*(?:no|do|de)?\s*quadril/i,
            /bursite\s*(?:de|no|do)?\s*quadril/i, /trocanteriana/i,
            /artrose\s*(?:de|no|do)?\s*quadril/i,
            /labrum\s*(?:de|no|do)?\s*quadril/i,
            /impacto\s*femoroacetabular/i, /fai/i,
        ],
        label: 'Dor / Patologia de Quadril',
        cautious_muscle_groups: ['Glúteo', 'Adutores'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar flexão de quadril profunda (>90°) se dolorosa',
            'Evitar adução forçada sob carga',
            'Fortalecer glúteo médio e rotadores externos',
            'Preferir amplitudes indolores e progredir gradualmente',
        ],
        ai_instruction: 'CONDIÇÃO: Dor de quadril. Evitar flexão >90° e adução forçada se dolorosas. Fortalecer glúteo médio.',
    },

    // ── OUTROS ──

    {
        id: 'hypertension',
        matchers: [
            /hipertens[aã]o/i, /press[aã]o\s*alta/i, /hypertension/i,
        ],
        label: 'Hipertensão Arterial',
        cautious_muscle_groups: [],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar isometria prolongada (>10s) com carga alta',
            'Evitar manobra de Valsalva — respirar durante todas as repetições',
            'Preferir séries com mais repetições e menos carga',
            'Monitorar sintomas: tontura, dor de cabeça, falta de ar',
        ],
        ai_instruction: 'CONDIÇÃO: Hipertensão. Evitar isometria prolongada e Valsalva. Preferir cargas moderadas com mais reps.',
    },

    {
        id: 'pregnancy',
        matchers: [
            /gr[aá]vida/i, /gestante/i, /gesta[çc][aã]o/i,
            /pregnan/i, /prenatal/i,
        ],
        label: 'Gestante',
        cautious_muscle_groups: ['Abdominais'],
        contraindicated_patterns: [],
        prescription_rules: [
            'Evitar exercícios em decúbito dorsal após 1º trimestre',
            'Evitar sobrecarga abdominal direta (crunch, sit-up)',
            'Fortalecer assoalho pélvico e musculatura posterior',
            'Evitar exercícios com risco de queda ou impacto',
            'Manter intensidade moderada — falar durante o exercício',
        ],
        ai_instruction: 'CONDIÇÃO: Gestante. Evitar decúbito dorsal após 1º tri. Sem crunch/sit-up. Fortalecer posterior e assoalho pélvico. Intensidade moderada.',
    },
]

// ============================================================================
// Matching
// ============================================================================

/**
 * Matches a restriction description against known clinical conditions.
 * Returns the first match found (cascade order).
 */
export function matchCondition(description: string): ConditionMatchResult | null {
    for (const condition of CONDITION_MAPPINGS) {
        for (const matcher of condition.matchers) {
            if (matcher.test(description)) {
                return {
                    condition,
                    confidence: 'high',
                }
            }
        }
    }
    return null
}

// ============================================================================
// AI Instruction Builder
// ============================================================================

/**
 * Builds condition-specific instruction text for the AI prompt.
 * For matched conditions: injects ai_instruction + prescription_rules.
 * For unmatched: passes description as-is with severity.
 */
export function buildConditionInstructions(
    restrictions: MedicalRestriction[],
): string {
    if (!restrictions || restrictions.length === 0) return ''

    const instructions: string[] = []

    for (const restriction of restrictions) {
        const match = matchCondition(restriction.description)
        if (match) {
            instructions.push(match.condition.ai_instruction)
            if (match.condition.prescription_rules.length > 0) {
                instructions.push('Regras específicas:')
                for (const rule of match.condition.prescription_rules) {
                    instructions.push(`  - ${rule}`)
                }
            }
            instructions.push('')
        } else {
            // No match — pass description as-is
            instructions.push(
                `CONDIÇÃO: ${restriction.description} (severity: ${restriction.severity}). Consultar treinador para restrições específicas.`,
            )
            instructions.push('')
        }
    }

    if (instructions.length === 0) return ''

    return `\n### Instruções específicas por condição clínica:\n${instructions.join('\n')}`
}
