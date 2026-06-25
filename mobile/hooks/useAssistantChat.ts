/**
 * useAssistantChat — conversa do Assistente do treinador no mobile.
 *
 * Fala com os endpoints Bearer do web (/api/trainer/assistant/*). Fase 2:
 * NÃO-streaming — o POST do turno devolve o payload final (userMessage +
 * message). Mantém uma única thread ativa (criada sob demanda no 1º envio).
 *
 * Idempotência: cada envio carrega um clientMessageId (UUID) — re-tentativas
 * não duplicam o turno (contrato C4 do backend).
 */
import { useCallback, useRef, useState } from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from '../lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kinevoapp.com';

// ── Tipos espelhados de lib/assistant (web) ──
export interface ToolConfirmationRequest {
    toolName: string;
    title: string;
    summary: string;
    args: Record<string, unknown>;
    destructive: boolean;
    idempotencyKey?: string;
    editableField?: string;
    editableLabel?: string;
    recipientName?: string;
}
export interface QuestionRequest {
    question: string;
    options: string[];
    multiple: boolean;
    allowOther: boolean;
}
export interface ProposalRequest {
    items: { label: string; value: string }[];
    approveLabel: string;
}

export type AssistantPart =
    | { type: 'executed'; toolName: string; result: unknown }
    | { type: 'confirmation'; request: ToolConfirmationRequest; status: 'pending' | 'confirmed' | 'cancelled'; result?: unknown }
    | { type: 'question'; request: QuestionRequest; status: 'pending' | 'answered' }
    | { type: 'proposal'; request: ProposalRequest; status: 'pending' | 'answered' };

export type ConfirmationPart = Extract<AssistantPart, { type: 'confirmation' }>;

export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    parts: AssistantPart[];
    credits_cost: number;
    created_at: string;
}

export type AssistantErrorKind = 'tier_locked' | 'quota_exceeded' | 'rate_limited' | 'generic';
export interface AssistantError {
    kind: AssistantErrorKind;
    message: string;
}

interface ServerError {
    error?: string;
    message?: string;
}

function uuidv4(): string {
    // Suficiente para chave de idempotência (o backend só valida o formato UUID).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function mapError(json: ServerError | null, fallback = 'Erro ao falar com o assistente.'): AssistantError {
    const code = json?.error;
    const kind: AssistantErrorKind =
        code === 'tier_locked'
            ? 'tier_locked'
            : code === 'quota_exceeded'
              ? 'quota_exceeded'
              : code === 'rate_limited'
                ? 'rate_limited'
                : 'generic';
    return { kind, message: json?.message || fallback };
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('no-session');
    return fetch(`${WEB_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
        },
    });
}

interface StreamReader {
    read(): Promise<{ value?: Uint8Array; done: boolean }>;
}

interface NdjsonResult {
    ok: boolean;
    done: Record<string, unknown> | null;
    errorBody: ServerError | null;
}

/**
 * Envia o turno e consome a resposta NDJSON via expo/fetch (streaming): emite
 * progresso ao vivo e captura o evento final {done}. Faz fallback para leitura
 * do corpo inteiro caso o streaming não esteja disponível em runtime.
 */
async function streamTurn(
    convId: string,
    payload: Record<string, unknown>,
    onProgress: (label: string) => void,
): Promise<NdjsonResult> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('no-session');

    const res = await expoFetch(`${WEB_URL}/api/trainer/assistant/conversations/${convId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as ServerError | null;
        return { ok: false, done: null, errorBody };
    }

    let done: Record<string, unknown> | null = null;
    let sawError: boolean = false;

    const handleLine = (line: string) => {
        const t = line.trim();
        if (!t) return;
        let ev: { type?: string; label?: string } & Record<string, unknown>;
        try {
            ev = JSON.parse(t);
        } catch {
            return;
        }
        if (ev.type === 'progress' && typeof ev.label === 'string') onProgress(ev.label);
        else if (ev.type === 'done') done = ev;
        else if (ev.type === 'error') sawError = true;
    };

    const body = res.body as { getReader?: () => StreamReader } | null;
    const reader = body?.getReader?.();
    const TextDecoderCtor = (
        globalThis as unknown as {
            TextDecoder?: new () => { decode: (input?: Uint8Array, opts?: { stream?: boolean }) => string };
        }
    ).TextDecoder;

    if (reader && TextDecoderCtor) {
        const decoder = new TextDecoderCtor();
        let buffer = '';
        for (;;) {
            const { value, done: rd } = await reader.read();
            if (rd) break;
            if (value) buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
                handleLine(buffer.slice(0, nl));
                buffer = buffer.slice(nl + 1);
            }
        }
        if (buffer) handleLine(buffer);
    } else {
        // Fallback: lê o corpo inteiro (sem progresso ao vivo).
        const text = await res.text();
        for (const line of text.split('\n')) handleLine(line);
    }

    if (sawError && !done) {
        return { ok: false, done: null, errorBody: { error: 'stream_error', message: 'Erro ao gerar a resposta.' } };
    }
    return { ok: true, done, errorBody: null };
}

export interface UseAssistantChatReturn {
    messages: AssistantMessage[];
    isSending: boolean;
    progress: string | null;
    error: AssistantError | null;
    send: (text: string) => Promise<void>;
    confirmAction: (part: ConfirmationPart, editedArgs?: Record<string, unknown>) => Promise<void>;
    cancelAction: (part: ConfirmationPart) => Promise<void>;
    loadConversation: (id: string) => Promise<void>;
    reset: () => void;
    clearError: () => void;
}

/** Fecha (pending → confirmed/cancelled) a confirmação pendente mais recente do toolName. */
function closeConfirmation(
    messages: AssistantMessage[],
    toolName: string,
    status: 'confirmed' | 'cancelled',
    result: unknown,
): AssistantMessage[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const idx = m.parts.findIndex(
            (p) => p.type === 'confirmation' && p.status === 'pending' && p.request.toolName === toolName,
        );
        if (idx >= 0) {
            const newParts = m.parts.map((p, j) =>
                j === idx && p.type === 'confirmation' ? { ...p, status, result } : p,
            );
            const next = [...messages];
            next[i] = { ...m, parts: newParts };
            return next;
        }
    }
    return messages;
}

export function useAssistantChat(): UseAssistantChatReturn {
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [error, setError] = useState<AssistantError | null>(null);
    const convIdRef = useRef<string | null>(null);
    const sendingRef = useRef(false);

    const resolveConfirmation = useCallback(
        async (
            part: ConfirmationPart,
            decision: 'confirmed' | 'cancelled',
            editedArgs?: Record<string, unknown>,
        ) => {
            const convId = convIdRef.current;
            if (!convId || sendingRef.current) return;
            sendingRef.current = true;
            setIsSending(true);
            setError(null);

            try {
                let result: unknown = null;

                // 1. Confirmado → executa a tool (re-valida tudo no servidor).
                if (decision === 'confirmed') {
                    const args = editedArgs ? { ...part.request.args, ...editedArgs } : part.request.args;
                    const exRes = await authedFetch('/api/trainer/assistant/execute-tool', {
                        method: 'POST',
                        body: JSON.stringify({
                            toolName: part.request.toolName,
                            args,
                            idempotencyKey: part.request.idempotencyKey || uuidv4(),
                        }),
                    });
                    const exJson = await exRes.json().catch(() => null);
                    if (!exRes.ok || exJson?.success !== true) {
                        setError(mapError(exJson, 'Não foi possível executar a ação.'));
                        return;
                    }
                    result = exJson.result ?? null;
                }

                // 2. Registra o desfecho na conversa (fecha o card + mensagem de fechamento).
                const outRes = await authedFetch(`/api/trainer/assistant/conversations/${convId}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        confirmation: { toolName: part.request.toolName, status: decision, result },
                    }),
                });
                const outJson = await outRes.json().catch(() => null);
                const outMessage: AssistantMessage | null = outJson?.message ?? null;

                setMessages((prev) => {
                    const closed = closeConfirmation(prev, part.request.toolName, decision, result);
                    return outMessage ? [...closed, outMessage] : closed;
                });
            } catch {
                setError({ kind: 'generic', message: 'Não foi possível concluir. Tente novamente.' });
            } finally {
                sendingRef.current = false;
                setIsSending(false);
            }
        },
        [],
    );

    const confirmAction = useCallback(
        (part: ConfirmationPart, editedArgs?: Record<string, unknown>) =>
            resolveConfirmation(part, 'confirmed', editedArgs),
        [resolveConfirmation],
    );
    const cancelAction = useCallback(
        (part: ConfirmationPart) => resolveConfirmation(part, 'cancelled'),
        [resolveConfirmation],
    );

    const loadConversation = useCallback(async (id: string) => {
        if (sendingRef.current) return;
        try {
            const res = await authedFetch(`/api/trainer/assistant/conversations/${id}`, { method: 'GET' });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(mapError(json, 'Não foi possível abrir a conversa.'));
                return;
            }
            const msgs: AssistantMessage[] = Array.isArray(json?.messages) ? json.messages : [];
            convIdRef.current = id;
            setMessages(msgs);
            setError(null);
        } catch {
            setError({ kind: 'generic', message: 'Não foi possível abrir a conversa.' });
        }
    }, []);

    const reset = useCallback(() => {
        convIdRef.current = null;
        setMessages([]);
        setError(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const send = useCallback(async (text: string) => {
        const content = text.trim();
        if (!content || sendingRef.current) return;

        sendingRef.current = true;
        setIsSending(true);
        setProgress(null);
        setError(null);

        const tempId = `temp-${uuidv4()}`;
        const tempUser: AssistantMessage = {
            id: tempId,
            role: 'user',
            content,
            parts: [],
            credits_cost: 0,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUser]);

        const dropTemp = () => setMessages((prev) => prev.filter((m) => m.id !== tempId));

        try {
            // 1. Garante uma conversa (cria sob demanda).
            let convId = convIdRef.current;
            if (!convId) {
                const cRes = await authedFetch('/api/trainer/assistant/conversations', {
                    method: 'POST',
                    body: JSON.stringify({}),
                });
                const cJson = await cRes.json().catch(() => null);
                if (!cRes.ok) {
                    setError(mapError(cJson));
                    dropTemp();
                    return;
                }
                convId = cJson?.conversation?.id ?? null;
                if (!convId) {
                    setError({ kind: 'generic', message: 'Não foi possível iniciar a conversa.' });
                    dropTemp();
                    return;
                }
                convIdRef.current = convId;
            }

            // 2. Envia o turno (streaming NDJSON com progresso ao vivo).
            const result = await streamTurn(
                convId,
                { input: content, clientMessageId: uuidv4() },
                (label) => setProgress(label),
            );

            if (!result.ok) {
                setError(mapError(result.errorBody));
                dropTemp();
                return;
            }

            const userMessage = (result.done?.userMessage as AssistantMessage | undefined) ?? null;
            const assistantMessage = (result.done?.message as AssistantMessage | undefined) ?? null;

            setMessages((prev) => {
                const without = prev.filter((m) => m.id !== tempId);
                const next = [...without, userMessage ?? tempUser];
                if (assistantMessage) next.push(assistantMessage);
                return next;
            });
        } catch {
            setError({ kind: 'generic', message: 'Não foi possível conectar. Tente novamente.' });
            dropTemp();
        } finally {
            sendingRef.current = false;
            setIsSending(false);
            setProgress(null);
        }
    }, []);

    return { messages, isSending, progress, error, send, confirmAction, cancelAction, loadConversation, reset, clearError };
}
