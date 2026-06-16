/**
 * Transcrição de voz do Assistente (Fase C — superfície de voz).
 *
 * Áudio → texto via API de transcrição da OpenAI (a mesma chave já usada pelo
 * motor; sem dependência nova — só `fetch` + FormData, disponíveis no runtime
 * Node das rotas). O texto resultante alimenta `runAssistantTurn` com
 * `surface:'voice'`, cujo system-prompt já pede resposta curta e falável.
 *
 * Mantemos a transcrição separada do turno para ser testável e reutilizável
 * (ex.: mobile pode mandar áudio; web pode mandar texto de STT on-device).
 */

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const TRANSCRIBE_MODEL = 'whisper-1'

export interface TranscribeOptions {
    /** Idioma do áudio (ISO-639-1). Default 'pt'. */
    language?: string
    /** Nome do arquivo enviado (ajuda o provedor a inferir o formato). */
    filename?: string
}

/**
 * Transcreve um áudio para texto. Lança em falta de chave ou erro do provedor —
 * o caller (rota) converte em resposta amigável.
 */
export async function transcribeAudio(
    audio: Blob,
    opts: TranscribeOptions = {},
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY ausente — transcrição indisponível.')

    const form = new FormData()
    form.append('file', audio, opts.filename ?? 'audio.webm')
    form.append('model', TRANSCRIBE_MODEL)
    form.append('language', opts.language ?? 'pt')

    const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Falha na transcrição (${res.status}): ${detail.slice(0, 200)}`)
    }

    const data = (await res.json()) as { text?: string }
    return (data.text ?? '').trim()
}
