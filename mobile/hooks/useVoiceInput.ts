/**
 * useVoiceInput — ditado (speech-to-text) para o composer do Assistente.
 *
 * Wrapper sobre @react-native-voice/voice (módulo nativo). Reconhecimento em
 * pt-BR; emite o transcript (parcial + final) via onText.
 *
 * O módulo nativo cria um NativeEventEmitter no IMPORT — num binário sem ele
 * linkado (antes do rebuild EAS) isso derrubaria a tela. Por isso carregamos via
 * require guardado (mesmo padrão do themePreferenceStore com MMKV): se o módulo
 * não estiver presente, `available` fica false e o toggle vira no-op.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

type VoiceModule = typeof import('@react-native-voice/voice').default;

function loadVoice(): VoiceModule | null {
    try {
        return (require('@react-native-voice/voice') as { default: VoiceModule }).default;
    } catch {
        return null;
    }
}

// Carrega uma vez no import deste módulo (require é cacheado pelo Metro).
const Voice = loadVoice();

export interface UseVoiceInputReturn {
    isListening: boolean;
    available: boolean;
    toggle: () => void;
}

export function useVoiceInput(onText: (text: string) => void): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [available, setAvailable] = useState(false);
    const onTextRef = useRef(onText);
    onTextRef.current = onText;

    useEffect(() => {
        if (!Voice) return;
        let mounted = true;
        try {
            Voice.onSpeechResults = (e: SpeechResultsEvent) => {
                const t = e.value?.[0];
                if (t) onTextRef.current(t);
            };
            Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
                const t = e.value?.[0];
                if (t) onTextRef.current(t);
            };
            Voice.onSpeechEnd = () => setIsListening(false);
            Voice.onSpeechError = (_e: SpeechErrorEvent) => setIsListening(false);
            Voice.isAvailable()
                .then((v) => {
                    if (mounted) setAvailable(!!v);
                })
                .catch(() => {
                    if (mounted) setAvailable(false);
                });
        } catch {
            setAvailable(false);
        }
        return () => {
            mounted = false;
            try {
                void Voice?.destroy().then(() => Voice?.removeAllListeners());
            } catch {
                // módulo nativo ausente — nada a limpar.
            }
        };
    }, []);

    const start = useCallback(async () => {
        if (!Voice) return;
        try {
            await Voice.start('pt-BR');
            setIsListening(true);
        } catch {
            setIsListening(false);
        }
    }, []);

    const stop = useCallback(async () => {
        if (!Voice) return;
        try {
            await Voice.stop();
        } catch {
            // ignore
        }
        setIsListening(false);
    }, []);

    const toggle = useCallback(() => {
        if (isListening) void stop();
        else void start();
    }, [isListening, start, stop]);

    return { isListening, available, toggle };
}
