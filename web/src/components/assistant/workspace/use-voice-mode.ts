'use client'

/**
 * useVoiceMode — modo de voz HANDS-FREE do Assistente (Onda 6).
 *
 * Loop: OUVIR (Web Speech API, parciais ao vivo) → resultado final → ENVIAR o
 * turno (surface 'voice': resposta curta/falável) → FALAR a resposta
 * (SpeechSynthesis pt-BR) → voltar a OUVIR. Tudo on-device fora do turno em si
 * (sem custo de STT/TTS de API).
 *
 * FALA EM STREAMING (feedback 2/jul): a resposta chega token a token
 * (liveText); o hook fatia em FRASES completas e fala cada uma assim que
 * fecha — a primeira frase sai ANTES do turno terminar (mesmo chunking do
 * ChatGPT voice). text_reset (fallback de modelo) cancela a fala e recomeça.
 *
 * Regras:
 *  - Nunca ouve enquanto pensa/fala (evita retroalimentação de áudio).
 *  - Turno que pausa num card HITL → fala "preciso da sua confirmação na tela"
 *    e PAUSA o loop; `notifyConfirmationResolved()` retoma a escuta.
 *  - Barge-in: `interrupt()` corta a fala e volta a ouvir na hora.
 *  - Sem Web Speech API (ex.: Firefox) → state 'unsupported' (o toggle não liga).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantMessage } from '@/lib/assistant/conversations'

export type VoiceModeState =
    | 'off'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'paused_confirmation'
    | 'error'

interface SpeechRecognitionResultLike {
    readonly isFinal: boolean
    readonly 0: { readonly transcript: string }
}
interface SpeechRecognitionEventLike {
    readonly resultIndex: number
    readonly results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
    lang: string
    continuous: boolean
    interimResults: boolean
    start: () => void
    stop: () => void
    abort: () => void
    onresult: ((e: SpeechRecognitionEventLike) => void) | null
    onerror: ((e: { error?: string }) => void) | null
    onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === 'undefined') return null
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor
        webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Prepara o texto para o TTS: remove marcações que o sintetizador leria mal.
 * Com surface 'voice' o modelo já evita markdown; isto é rede de segurança.
 */
export function sanitizeForSpeech(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [rótulo](url) → rótulo
        .replace(/https?:\/\/\S+/g, 'link')
        .replace(/[*_#`>|~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Fatia o que ainda não foi falado em frases COMPLETAS (termina em .!?…;: ou
 * quebra de linha). Devolve as frases prontas e quantos chars do buffer foram
 * consumidos — o resto (frase ainda abrindo) fica para a próxima chamada.
 */
export function extractCompleteSentences(pending: string): { sentences: string[]; consumed: number } {
    const sentences: string[] = []
    let consumed = 0
    const re = /[^.!?…;:\n]*[.!?…;:\n]+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(pending)) !== null) {
        const raw = m[0]
        const clean = sanitizeForSpeech(raw)
        if (clean.length >= 2) sentences.push(clean)
        consumed = m.index + raw.length
    }
    return { sentences, consumed }
}

/**
 * Gate do modo voz (decisão 2/jul, feedback do Gustavo): a voz do SpeechSynthesis
 * do browser é robótica demais para o produto — o toggle fica ESCONDIDO até
 * termos TTS neural (via API) ou vozes de browser à altura. Toda a infra
 * (surface 'voice' no servidor, loop hands-free, fala em streaming) fica pronta:
 * reabilitar = NEXT_PUBLIC_ENABLE_VOICE_MODE=1 no env + deploy.
 */
export const VOICE_MODE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VOICE_MODE === '1'

/** Frase falada quando o turno pausa num card HITL. */
export const CONFIRMATION_SPEECH = 'Preparei a ação. Preciso da sua confirmação na tela.'

const hasPendingConfirmation = (msg: AssistantMessage | null): boolean =>
    !!msg?.parts?.some((p) => p.type === 'confirmation' && p.status === 'pending')

export function useVoiceMode({
    onVoiceTurn,
    liveText,
    textResetCount,
}: {
    /** Envia um turno por voz e devolve a mensagem final (null = falha/abort). */
    onVoiceTurn: (text: string) => Promise<AssistantMessage | null>
    /** Texto da resposta chegando token a token (U-STREAM) — alimenta a fala em streaming. */
    liveText: string
    /** Incrementa a cada text_reset do stream (fallback de modelo) — cancela a fala. */
    textResetCount: number
}) {
    const [state, setState] = useState<VoiceModeState>('off')
    const [interim, setInterim] = useState('') // fala parcial mostrada ao vivo
    const supported =
        typeof window !== 'undefined' && !!getSpeechRecognitionCtor() && 'speechSynthesis' in window

    const stateRef = useRef<VoiceModeState>('off')
    const recRef = useRef<SpeechRecognitionLike | null>(null)
    const activeRef = useRef(false) // o modo está ligado? (guia onend/async)
    const onVoiceTurnRef = useRef(onVoiceTurn)
    useEffect(() => {
        onVoiceTurnRef.current = onVoiceTurn
    }, [onVoiceTurn])

    const setSt = useCallback((s: VoiceModeState) => {
        stateRef.current = s
        setState(s)
    }, [])

    const stopRecognition = useCallback(() => {
        try { recRef.current?.abort() } catch { /* já parado */ }
        recRef.current = null
    }, [])

    // O ciclo (speak/turn → voltar a ouvir) pede "chame listen depois", mas
    // listen ainda não existe aqui e o Compiler proíbe ref mutável p/ isso.
    // Solução: um EPOCH de escuta — pedir escuta é incrementar o estado; um
    // effect abaixo (com listen já definido) atende o pedido.
    const [listenEpoch, setListenEpoch] = useState(0)
    const requestListen = useCallback(() => { setListenEpoch((n) => n + 1) }, [])

    // ── Fala em streaming ──
    // Quantos chars do stream já viraram fala + quantas utterances estão na fila.
    const spokenUpToRef = useRef(0)
    const queuedRef = useRef(0)
    const turnDoneRef = useRef(false)

    const cancelSpeech = useCallback(() => {
        try { window.speechSynthesis?.cancel() } catch { /* indisponível */ }
        queuedRef.current = 0
    }, [])

    /** Enfileira UMA frase; quando a fila esvazia e o turno acabou, volta a ouvir. */
    const speakChunk = useCallback((sentence: string) => {
        try {
            const u = new SpeechSynthesisUtterance(sentence)
            u.lang = 'pt-BR'
            const voices = window.speechSynthesis.getVoices()
            const voice =
                voices.find((v) => v.lang?.startsWith('pt-BR') && v.name.includes('Google')) ??
                voices.find((v) => v.lang?.startsWith('pt-BR'))
            if (voice) u.voice = voice
            const onSettled = () => {
                queuedRef.current = Math.max(0, queuedRef.current - 1)
                if (!activeRef.current) return
                if (queuedRef.current === 0 && turnDoneRef.current && stateRef.current === 'speaking') {
                    requestListen()
                }
            }
            u.onend = onSettled
            u.onerror = onSettled
            queuedRef.current += 1
            window.speechSynthesis.speak(u) // speak() ENFILEIRA — não corta a anterior
            if (stateRef.current === 'thinking') setSt('speaking')
        } catch { /* segue sem esta frase */ }
    }, [setSt, requestListen])

    const speak = useCallback((text: string, onDone: () => void) => {
        const clean = sanitizeForSpeech(text)
        if (!clean) { onDone(); return }
        try {
            const u = new SpeechSynthesisUtterance(clean)
            u.lang = 'pt-BR'
            // Voz pt-BR quando disponível (senão o browser cai na default do idioma).
            const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('pt-BR'))
            if (voice) u.voice = voice
            u.onend = onDone
            u.onerror = onDone
            window.speechSynthesis.cancel() // nunca enfileira por cima de fala antiga
            window.speechSynthesis.speak(u)
        } catch {
            onDone()
        }
    }, [])


    const runTurn = useCallback(async (transcript: string) => {
        setSt('thinking')
        setInterim('')
        spokenUpToRef.current = 0
        queuedRef.current = 0
        turnDoneRef.current = false
        let msg: AssistantMessage | null = null
        try {
            msg = await onVoiceTurnRef.current(transcript)
        } catch { /* trata como turno falho */ }
        if (!activeRef.current) return
        if (!msg) {
            // Falha/cota/abort: o banner do thread já explica; sai do modo voz.
            cancelSpeech()
            setSt('error')
            return
        }
        if (hasPendingConfirmation(msg)) {
            // Corta o que estiver falando e anuncia o card — depois pausa.
            cancelSpeech()
            setSt('speaking')
            speak(CONFIRMATION_SPEECH, () => {
                if (activeRef.current) setSt('paused_confirmation')
            })
            return
        }
        // Fala o RABO da resposta (o que o streaming ainda não falou). Se nada
        // foi falado em stream (resposta curta de um fôlego), fala inteira.
        turnDoneRef.current = true
        const remainder = sanitizeForSpeech(msg.content.slice(spokenUpToRef.current))
        if (remainder) {
            if (stateRef.current === 'thinking') setSt('speaking')
            speakChunk(remainder)
            spokenUpToRef.current = msg.content.length
        } else if (queuedRef.current === 0) {
            // nada a falar e fila vazia → volta a ouvir direto
            requestListen()
        } else if (stateRef.current === 'thinking') {
            setSt('speaking')
        }
    }, [setSt, speak, speakChunk, cancelSpeech, requestListen])

    const listen = useCallback(() => {
        if (!activeRef.current) return
        const Ctor = getSpeechRecognitionCtor()
        if (!Ctor) { setSt('error'); return }
        let rec: SpeechRecognitionLike
        try { rec = new Ctor() } catch { setSt('error'); return }
        rec.lang = 'pt-BR'
        rec.continuous = false // uma fala por vez; o silêncio encerra o resultado
        rec.interimResults = true
        let finalText = ''
        rec.onresult = (e) => {
            let interimText = ''
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i]
                if (r.isFinal) finalText += r[0].transcript
                else interimText += r[0].transcript
            }
            setInterim(finalText + interimText)
        }
        rec.onerror = (e) => {
            const err = e?.error
            if (err === 'no-speech' || err === 'aborted') return // onend decide
            recRef.current = null
            setSt('error')
        }
        rec.onend = () => {
            recRef.current = null
            if (!activeRef.current || stateRef.current !== 'listening') return
            const text = finalText.trim()
            if (text) void runTurn(text)
            else requestListen() // silêncio: continua ouvindo
        }
        recRef.current = rec
        setInterim('')
        setSt('listening')
        try { rec.start() } catch { setSt('error') }
    }, [runTurn, setSt, requestListen])

    // Atende os pedidos de escuta do ciclo (epoch > 0 = alguém pediu).
    useEffect(() => {
        if (listenEpoch === 0 || !activeRef.current) return
        listen()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listenEpoch])

    // text_reset (fallback de modelo): o texto parcial era descartável — corta a
    // fala e zera o progresso; o stream recomeça do zero em seguida.
    useEffect(() => {
        if (textResetCount === 0 || !activeRef.current) return
        cancelSpeech()
        spokenUpToRef.current = 0
        if (stateRef.current === 'speaking') setSt('thinking')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [textResetCount])

    // Fala em STREAMING: a cada avanço do liveText durante um turno de voz,
    // fatia as frases completas ainda não faladas e as enfileira no TTS.
    // Encolhimento do liveText (limpeza de fim de turno) vira slice vazio → no-op;
    // o reset de verdade chega pelo textResetCount acima.
    useEffect(() => {
        if (!activeRef.current) return
        if (stateRef.current !== 'thinking' && stateRef.current !== 'speaking') return
        if (turnDoneRef.current) return // o done já cuidou do rabo
        const pending = liveText.slice(spokenUpToRef.current)
        const { sentences, consumed } = extractCompleteSentences(pending)
        if (consumed > 0) {
            spokenUpToRef.current += consumed
            for (const sent of sentences) speakChunk(sent)
        }
    }, [liveText, speakChunk])

    const start = useCallback(() => {
        if (!supported || activeRef.current) return
        activeRef.current = true
        listen()
    }, [supported, listen])

    const stop = useCallback(() => {
        activeRef.current = false
        stopRecognition()
        cancelSpeech()
        setInterim('')
        setSt('off')
    }, [stopRecognition, cancelSpeech, setSt])

    /** Barge-in: corta a fala (ou o erro) e volta a ouvir imediatamente. */
    const interrupt = useCallback(() => {
        if (!activeRef.current) return
        cancelSpeech()
        stopRecognition()
        listen()
    }, [cancelSpeech, stopRecognition, listen])

    /** O treinador resolveu o card HITL → retoma a escuta. */
    const notifyConfirmationResolved = useCallback(() => {
        if (activeRef.current && stateRef.current === 'paused_confirmation') listen()
    }, [listen])

    // Desmontou com o modo ligado → desliga tudo (mic + fala).
    useEffect(() => () => {
        activeRef.current = false
        try { recRef.current?.abort() } catch { /* noop */ }
        try { window.speechSynthesis?.cancel() } catch { /* noop */ }
    }, [])

    return { state, interim, supported, start, stop, interrupt, notifyConfirmationResolved }
}
