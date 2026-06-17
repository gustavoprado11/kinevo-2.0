'use client'

/**
 * MicButton — ditado por voz no composer do Assistente.
 *
 * Grava o microfone (MediaRecorder), envia o áudio para /api/assistant/voice com
 * `transcribeOnly=1` (transcreve no servidor via OpenAI, SEM rodar o turno) e
 * devolve o texto por `onTranscript`. O usuário revisa e envia pelo fluxo normal
 * — assim o turno é persistido na conversa, não disparado solto.
 *
 * Estados: idle (mic) → recording (quadrado pulsando, clique para parar) →
 * transcribing (spinner). Falhas (permissão negada, sem suporte, erro de STT)
 * caem num estado de erro discreto com title explicativo.
 */

import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Loader2, MicOff } from 'lucide-react'

type MicState = 'idle' | 'recording' | 'transcribing' | 'error'

interface MicButtonProps {
    disabled?: boolean
    onTranscript: (text: string) => void
    /** UUID do aluno em foco (opcional; passado adiante p/ contexto). */
    studentId?: string
}

export function MicButton({ disabled, onTranscript, studentId }: MicButtonProps) {
    const [state, setState] = useState<MicState>('idle')
    const [errorTitle, setErrorTitle] = useState<string | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }, [])

    const transcribe = useCallback(
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
                onTranscript(data.transcript.trim())
                setState('idle')
            } catch {
                setErrorTitle('Falha de conexão ao transcrever.')
                setState('error')
            }
        },
        [onTranscript, studentId],
    )

    const startRecording = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
            setErrorTitle('Seu navegador não suporta gravação de voz.')
            setState('error')
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            chunksRef.current = []
            const recorder = new MediaRecorder(stream)
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            recorder.onstop = () => {
                stopStream()
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
                if (blob.size === 0) { setState('idle'); return }
                void transcribe(blob)
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
    }, [stopStream, transcribe])

    const stopRecording = useCallback(() => {
        recorderRef.current?.state === 'recording' && recorderRef.current.stop()
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
            aria-label={recording ? 'Parar gravação' : 'Ditar por voz'}
            aria-pressed={recording}
            title={errorTitle ?? (recording ? 'Parar e transcrever' : 'Ditar por voz')}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border transition disabled:opacity-50 ${
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
