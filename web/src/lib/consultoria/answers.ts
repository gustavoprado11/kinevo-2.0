// Leitores do envelope de respostas de form_submissions.answers_json.
//
// Shape gravado pelo mobile (mobile/app/inbox/[id].tsx) e validado pela RPC
// submit_form_submission (migration 027):
//   { submitted_from, app_version, answers: { <question_id>: <AnswerValue> } }
// onde AnswerValue varia por tipo de pergunta:
//   short_text/long_text/single_choice → { type, value: string }
//   scale                              → { type, value: number }
//   multi_choice                       → { type, values: string[] }
//   photo                              → { type, files: [...] }

export interface AnswerValue {
    type?: string
    value?: string | number
    values?: string[]
}

export type AnswersMap = Record<string, AnswerValue>

/** Extrai o mapa de respostas do answers_json cru (tolerante a envelope ausente). */
export function extractAnswers(answersJson: unknown): AnswersMap {
    if (!answersJson || typeof answersJson !== 'object') return {}
    const root = answersJson as Record<string, unknown>
    const answers = root.answers
    if (!answers || typeof answers !== 'object') return {}
    return answers as AnswersMap
}

/** Valor string de uma resposta (single_choice/short_text). null se ausente. */
export function answerString(answers: AnswersMap, questionId: string): string | null {
    const raw = answers[questionId]?.value
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
    if (typeof raw === 'number') return String(raw)
    return null
}

/** Lista de valores de uma multi_choice. [] se ausente. */
export function answerValues(answers: AnswersMap, questionId: string): string[] {
    const raw = answers[questionId]?.values
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
}

/** true/false/null (não respondida) para perguntas Sim/Não (values 'yes'/'no'). */
export function answerYesNo(answers: AnswersMap, questionId: string): boolean | null {
    const v = answerString(answers, questionId)
    if (v === 'yes') return true
    if (v === 'no') return false
    return null
}

/**
 * Idade em anos a partir da resposta de data de nascimento (DD/MM/AAAA — placeholder
 * do template 065 — com tolerância a AAAA-MM-DD). null se não parseável.
 */
export function answerAgeYears(answers: AnswersMap, questionId: string, today: Date = new Date()): number | null {
    const v = answerString(answers, questionId)
    if (!v) return null

    let year: number | null = null
    let month = 1
    let day = 1

    const br = v.match(/^(\d{1,2})[/](\d{1,2})[/](\d{4})$/)
    const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (br) {
        day = Number(br[1]); month = Number(br[2]); year = Number(br[3])
    } else if (iso) {
        year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3])
    }
    if (year === null || year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null

    let age = today.getFullYear() - year
    const beforeBirthday =
        today.getMonth() + 1 < month ||
        (today.getMonth() + 1 === month && today.getDate() < day)
    if (beforeBirthday) age -= 1
    return age >= 0 && age <= 120 ? age : null
}
