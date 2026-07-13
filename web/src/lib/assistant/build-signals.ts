/**
 * Detecção de turno de BUILD (criação/renovação de programa) — módulo LEVE,
 * importável em teste sem os efeitos colaterais do command-engine.
 *
 * O que o sinal controla é PESADO: modelo (Gemini vs mini), teto de passos
 * (16 vs 8), orçamento de saída (12000 vs 1500), thinking e a cadeia de retry.
 * Falso negativo é caro — visto em prod 13/jul: "Me ajude a planejar o próximo
 * programa" não casava com a regex de verbos, o turno da aprovação rodou como
 * turno comum e o JSON do create TRUNCOU em 1500 tokens de saída ("Não consegui
 * concluir"). Falso positivo custa só um turno de consulta um pouco mais caro.
 * Por isso os padrões abaixo são deliberadamente generosos — e a escalada por
 * truncamento no motor é a rede de segurança para o que ainda escapar.
 */

/** Mensagem de histórico mínima (texto puro ou nativa com parts). */
export interface HistoryLike {
    role: string
    content: string | Array<{ type: string; text?: string }>
}

/** Texto legível de uma mensagem do histórico (nativa pode ter content em array). */
export function historyText(m: HistoryLike): string {
    if (typeof m.content === 'string') return m.content
    return m.content
        .map((p) => (p.type === 'text' ? (p.text ?? '') : ''))
        .filter(Boolean)
        .join(' ')
}

// Verbo de construção/planejamento perto de um substantivo de programa.
const BUILD_VERB_RE =
    /\b(cri|mont|gera|elabor|prescrev|planej|renov|prepar|desenh|estrutur|faz|fa[çc]a|nov[oa])\w*\b[\s\S]{0,40}\b(programa|treino|prescri|ficha|periodiz|split|divis[ãa]o|ciclo|mesociclo)\b/i

// Frase nominal de renovação: "próximo programa", "novo ciclo", "ficha nova"…
// (Sem "treino" aqui de propósito: "qual o próximo treino dele?" é consulta de
// agenda, não build.)
const BUILD_NOUN_RE =
    /\b(pr[óo]xim[oa]|nov[oa]|outr[oa])\s+(programa|ciclo|mesociclo|ficha|periodiza[çc][ãa]o)\b|\b(programa|ciclo|ficha)\s+(nov[oa]|seguinte)\b/i

const PROGRAM_TOPIC_RE = /\b(programa|treino|prescri\w*|split|divis[ãa]o|ficha|ciclo)\b/i

/** A resposta de aprovação de proposta gerada pelo app começa com "Aprovado". */
const PROPOSAL_APPROVAL_RE = /^\s*aprovado\b/i

function textSignalsBuild(text: string): boolean {
    return BUILD_VERB_RE.test(text) || BUILD_NOUN_RE.test(text)
}

/**
 * Turno de build: o input (ou o histórico recente) pede criação/renovação de
 * programa — inclusive a APROVAÇÃO de uma proposta numa conversa de programa
 * (o turno que materializa o create, o mais crítico de todos).
 */
export function isBuildTurn(input: string, history: HistoryLike[]): boolean {
    if (textSignalsBuild(input)) return true
    const recent = history.slice(-5).map(historyText).join('  ')
    if (textSignalsBuild(recent)) return true
    if (PROPOSAL_APPROVAL_RE.test(input) && (PROGRAM_TOPIC_RE.test(input) || PROGRAM_TOPIC_RE.test(recent))) {
        return true
    }
    return false
}
