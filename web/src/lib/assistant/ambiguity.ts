/**
 * Desambiguação determinística de homônimos (Onda 1 — 2026-07-01).
 *
 * Problema: "manda uma cobrança pro João" com 2+ alunos chamados João. O modelo
 * pega um UUID do contexto — às vezes o errado — e o prompt sozinho não segura
 * (só send_message tinha guarda, via arg-validation). Aqui a guarda vira
 * DETERMINÍSTICA e vale para QUALQUER write com student_id:
 *
 *   - `ambiguousStudentTarget`: o pedido cita o aluno SÓ pelo primeiro nome e a
 *     carteira tem 2+ alunos com esse primeiro nome → devolve os candidatos.
 *   - `withAmbiguityGuard`: embrulha as WRITE tools da ponte; alvo ambíguo → a
 *     tool NÃO executa e devolve um corretivo mandando o modelo perguntar
 *     (perguntar_treinador com os nomes completos).
 *
 * Para CONFIRM_TOOLS (sem execute na ponte) a checagem roda no command-engine ao
 * montar o card — ambíguo → vira pergunta estruturada em vez de card.
 *
 * Best-effort por design: referência que NÃO cita o primeiro nome (aluno em foco,
 * "esse aluno", resolvido em turno anterior) passa direto — a guarda só age
 * quando o próprio texto do pedido é ambíguo.
 */
import type { ToolSet } from 'ai'
import { WRITE_TOOLS } from '@/lib/assistant/tool-policy'

export interface StudentRef {
    id: string
    name: string
}

/** lowercase + remove acentos (combining marks U+0300–U+036F após NFD). */
export function normalizeName(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .split('')
        .filter((c) => {
            const code = c.charCodeAt(0)
            return code < 0x300 || code > 0x36f
        })
        .join('')
}

export function firstNameOf(name: string): string {
    return normalizeName(name).trim().split(/\s+/)[0] ?? ''
}

/** `needle` aparece como palavra/frase inteira dentro de `haystackNorm`? */
function mentions(haystackNorm: string, needleNorm: string): boolean {
    if (!needleNorm) return false
    const esc = needleNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, 'u').test(haystackNorm)
}

/**
 * Detecta alvo ambíguo. Retorna os candidatos (alvo primeiro) quando o pedido
 * cita o aluno só pelo primeiro nome e há homônimos; null quando não há
 * ambiguidade (sem homônimo, nome completo citado, aluno em foco, ou o pedido
 * nem cita o nome).
 */
export function ambiguousStudentTarget(
    input: string,
    targetStudentId: string,
    roster: StudentRef[],
    focusedStudentId?: string,
): StudentRef[] | null {
    // Aluno em foco explícito (escopo da conversa) = escolha do treinador.
    if (focusedStudentId && focusedStudentId === targetStudentId) return null
    const target = roster.find((s) => s.id === targetStudentId)
    if (!target) return null
    const first = firstNameOf(target.name)
    if (first.length < 3) return null
    const dups = roster.filter((s) => s.id !== target.id && firstNameOf(s.name) === first)
    if (dups.length === 0) return null

    const inputNorm = normalizeName(input)
    // O pedido não cita esse primeiro nome → a referência veio de outra via
    // (contexto/turno anterior); não bloqueia.
    if (!mentions(inputNorm, first)) return null
    // Nome mais completo do ALVO citado (1º + 2º nome) → escolha explícita, passa.
    const targetTokens = normalizeName(target.name).split(/\s+/).filter(Boolean)
    if (targetTokens.length > 1 && mentions(inputNorm, targetTokens.slice(0, 2).join(' '))) {
        return null
    }
    // Só o primeiro nome (ou o nome completo de OUTRO homônimo — alvo errado):
    // ambíguo. Quem decide é o treinador.
    return [target, ...dups]
}

/**
 * Embrulha as WRITE tools (com execute) com a guarda de homônimos. CONFIRM_TOOLS
 * chegam sem execute (HITL) e passam intactas — a checagem delas roda no card.
 */
export function withAmbiguityGuard(
    tools: ToolSet,
    opts: {
        input: string
        focusedStudentId?: string
        getRoster: () => Promise<StudentRef[]>
    },
): ToolSet {
    const guarded: ToolSet = {}
    for (const [name, t] of Object.entries(tools)) {
        const orig = t.execute
        if (!WRITE_TOOLS.has(name) || typeof orig !== 'function') {
            guarded[name] = t
            continue
        }
        guarded[name] = {
            ...t,
            execute: (async (args, options) => {
                const sid = (args as { student_id?: unknown } | null)?.student_id
                if (typeof sid === 'string' && sid.length > 0) {
                    try {
                        const roster = await opts.getRoster()
                        const cands = ambiguousStudentTarget(opts.input, sid, roster, opts.focusedStudentId)
                        if (cands) {
                            return {
                                blocked: 'ambiguous_student',
                                message:
                                    `NÃO EXECUTEI: há mais de um aluno com esse primeiro nome (${cands.map((c) => c.name).join('; ')}). ` +
                                    `Chame perguntar_treinador com a pergunta "Qual aluno?" e os NOMES COMPLETOS acima como opções. ` +
                                    `Nunca escolha sozinho entre homônimos.`,
                            }
                        }
                    } catch {
                        // Guarda é best-effort: falha ao carregar a carteira nunca trava ação legítima.
                    }
                }
                return orig(args, options)
            }) as typeof t.execute,
        }
    }
    return guarded
}
