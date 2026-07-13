'use client'

/**
 * MicButton — ditado por voz no composer do Assistente.
 *
 * Caminho preferido (Chrome/Edge/Safari): Web Speech API
 * (webkitSpeechRecognition) → STT ON-DEVICE com resultados PARCIAIS, então o
 * texto vai aparecendo no campo EM TEMPO REAL enquanto o treinador fala.
 *
 * Fallback (navegadores sem Web Speech API, ex.: Firefox): grava com
 * MediaRecorder e transcreve no servidor via /api/assistant/voice
 * (transcribeOnly) — o texto entra de uma vez ao parar.
 *
 * Em ambos: o ditado é ANEXADO ao que já estava no campo (base capturada no
 * início) e o usuário revisa/envia pelo fluxo normal — o turno não dispara solto.
 */

import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Loader2, MicOff } from 'lucide-react'

type MicState = 'idle' | 'recording' | 'transcribing' | 'error'

interface MicButtonProps {
    disabled?: boolean
    /** Valor atual do composer (base sobre a qual o ditado é anexado). */
    value: string
    /** Define o valor do composer (o ditado ao vivo atualiza em tempo real). */
    onChange: (text: string) => void
    /** UUID do aluno em foco (opcional; passado ao fallback de transcrição). */
    studentId?: string
    /** Botão redondo — combina com o composer em pílula do dock lateral. */
    round?: boolean
}

// ── Web Speech API (não tipada na lib DOM padrão) ──
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

/** Junta a base do campo com o transcrito, sem espaços duplicados. */
function joinBase(base: string, transcript: string): string {
    return [base.trim(), transcript.trim()].filter(Boolean).join(' ')
}

export function MicButton({ disabled, value, onChange, studentId, round = false }: MicButtonProps) {
    const [state, setState] = useState<MicState>('idle')
    const [errorTitle, setErrorTitle] = useState<string | null>(null)

    // Texto que já estava no campo quando o ditado começou.
    const baseRef = useRef('')
    // Caminho ao vivo (Web Speech API).
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
    const finalRef = useRef('')
    const usesLiveRef = useRef(false)
    // Fallback (MediaRecorder → Whisper).
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)

    // ── Caminho AO VIVO ─────────────────────────────────────────────
    const startLive = useCallback(
        (Ctor: SpeechRecognitionCtor) => {
            baseRef.current = value
            finalRef.current = ''
            let rec: SpeechRecognitionLike
            try {
                rec = new Ctor()
            } catch {
                setErrorTitle('Não consegui iniciar o ditado.')
                setState('error')
                return
            }
            rec.lang = 'pt-BR'
            rec.continuous = true
            rec.interimResults = true
            rec.onresult = (e) => {
                let interim = ''
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i]
                    if (r.isFinal) finalRef.current += r[0].transcript
                    else interim += r[0].transcript
                }
                onChange(joinBase(baseRef.current, finalRef.current + interim))
            }
            rec.onerror = (e) => {
                const err = e?.error
                if (err === 'no-speech' || err === 'aborted') return // benigno: ignora
                recognitionRef.current = null
                setErrorTitle(
                    err === 'not-allowed' || err === 'service-not-allowed'
                        ? 'Permissão de microfone negada.'
                        : 'Falha no ditado por voz.',
                )
                setState('error')
            }
            rec.onend = () => {
                recognitionRef.current = null
                onChange(joinBase(baseRef.current, finalRef.current)) // commit final (sem interim)
                // Se já caiu em erro, mantém erro; senão volta ao idle.
                setState((s) => (s === 'recording' ? 'idle' : s))
            }
            try {
                rec.start()
            } catch {
                setErrorTitle('Não consegui iniciar o ditado.')
                setState('error')
                return
            }
            recognitionRef.current = rec
            setErrorTitle(null)
            setState('recording')
        },
        [value, onChange],
    )

    // ── Fallback: MediaRecorder → Whisper ───────────────────────────
    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }, [])

    const transcribeBlob = useCallback(
        async (blob: Blob) => {
            setState('transcribing')
            try {
                const form = new FormData()
                form.append('audio', blob, 'audio.webm')
                form.append('transcribeOnly', '1')
                if (studentId) form.append('studentId', studentId)
                const res = await fetch('/api/assistant/voice', { method: 'POST', body: form })
                const data = await res.json().catch(() => ({}))
                if (!res.ok || typeof data.transcript !== 'string' || !data.transcript.trim()) {
                    setErrorTitle(data?.message || 'Não consegui transcrever o áudio.')
                    setState('error')
                    return
                }
                onChange(joinBase(baseRef.current, data.transcript))
                setState('idle')
            } catch {
                setErrorTitle('Falha de conexão ao transcrever.')
                setState('error')
            }
        },
        [onChange, studentId],
    )

    const startFallback = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
            setErrorTitle('Seu navegador não suporta ditado por voz.')
            setState('error')
            return
        }
        baseRef.current = value
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            chunksRef.current = []
            const recorder = new MediaRecorder(stream)
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }
            recorder.onstop = () => {
                stopStream()
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
                if (blob.size === 0) {
                    setState('idle')
                    return
                }
                void transcribeBlob(blob)
            }
            recorder.start()
            recorderRef.current = recorder
            setErrorTitle(null)
            setState('recording')
        } catch {
            stopStream()
            setErrorTitle('Não consegui acessar o microfone. Verifique a permissão.')
            setState('error')
        }
    }, [value, stopStream, transcribeBlob])

    // ── Orquestração ────────────────────────────────────────────────
    const startRecording = useCallback(() => {
        const Ctor = getSpeechRecognitionCtor()
        if (Ctor) {
            usesLiveRef.current = true
            startLive(Ctor)
        } else {
            usesLiveRef.current = false
            void startFallback()
        }
    }, [startLive, startFallback])

    const stopRecording = useCallback(() => {
        if (usesLiveRef.current) {
            recognitionRef.current?.stop()
        } else if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
        }
    }, [])

    const onClick = useCallback(() => {
        if (disabled) return
        if (state === 'recording') stopRecording()
        else if (state === 'idle' || state === 'error') startRecording()
    }, [disabled, state, startRecording, stopRecording])

    const busy = state === 'transcribing'
    const recording = state === 'recording'
    const isError = state === 'error'

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            aria-label={recording ? 'Parar ditado' : 'Ditar por voz'}
            aria-pressed={recording}
            title={errorTitle ?? (recording ? 'Parar ditado' : 'Ditar por voz')}
            className={`flex h-9 w-9 shrink-0 items-center justify-center border transition disabled:opacity-50 ${
                round ? 'rounded-full' : 'rounded-[11px]'
            } ${
                recording
                    ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    : isError
                      ? 'border-[#F5C2C0] dark:border-rose-500/30 bg-[#FEF2F2] dark:bg-rose-500/10 text-[#BE123C] dark:text-rose-300'
                      : 'border-[#E8E8ED] dark:border-k-border-subtle text-[#6E6E73] dark:text-muted-foreground/80 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
            }`}
        >
            {busy ? (
                <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2} />
            ) : recording ? (
                <Square className="h-[15px] w-[15px] animate-pulse fill-current" strokeWidth={2} />
            ) : isError ? (
                <MicOff className="h-[17px] w-[17px]" strokeWidth={2} />
            ) : (
                <Mic className="h-[17px] w-[17px]" strokeWidth={2} />
            )}
        </button>
    )
}
