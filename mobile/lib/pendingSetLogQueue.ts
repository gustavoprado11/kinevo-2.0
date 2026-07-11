// ─────────────────────────────────────────────────────────────────────────────
// Fila offline de set_logs (A4). Espelha, para as séries incrementais do
// telefone, o padrão da fila de finish do Watch (finishWorkoutFromWatch.ts):
// quando o upsert/delete de um set_log falha (rede caiu no meio do treino), a
// operação entra aqui e é drenada quando a conexão volta (listener NetInfo no
// _layout) ou no próximo cold start.
//
// Semântica de sync_status: com a fila, toda linha que EXISTE no banco foi
// sincronizada na escrita — pendência vive aqui no MMKV, nunca como linha
// "pending" no servidor. Por isso as escritas continuam marcando 'synced'.
//
// Idempotência: a chave natural (workout_session_id, assigned_workout_item_id,
// set_number) deduplica a fila (última operação vence — upsert seguido de
// delete da mesma série = só o delete) e o upsert usa o mesmo onConflict do
// caminho online, então drenar duas vezes não duplica nada.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface PendingSetLogKey {
    workout_session_id: string;
    assigned_workout_item_id: string;
    set_number: number;
}

export interface PendingSetLogUpsert extends PendingSetLogKey {
    [column: string]: unknown;
}

/** FIX D: finalização offline durável do celular. Carrega tudo o que o finish
 *  precisa re-aplicar quando a rede voltar — o update da sessão p/ 'completed'
 *  e o upsert idempotente das séries montadas. Idempotente por sessionId. */
export interface PendingFinishSession {
    session_id: string;
    /** Patch aplicado à workout_sessions (status/completed_at/duration/rpe/...). */
    session_update: Record<string, unknown>;
    /** Linhas de set_logs a re-upsertar (mesmo onConflict do caminho online). */
    set_logs: PendingSetLogUpsert[];
}

interface PendingEntry {
    op: 'upsert' | 'delete' | 'discard_session' | 'finish_session';
    key: string;
    /** Presente quando op === 'upsert' */
    payload?: PendingSetLogUpsert;
    /** Presente quando op === 'delete' */
    filters?: PendingSetLogKey;
    /** Presente quando op === 'discard_session' (FIX C) */
    discardSessionId?: string;
    /** Presente quando op === 'finish_session' (FIX D) */
    finish?: PendingFinishSession;
    queuedAt: string;
}

// Storage — MMKV com fallback in-memory (mesmo padrão do workoutStatePersistence;
// o fallback cobre Expo Go e testes, onde o módulo nativo não existe).
interface StorageLike {
    getString(key: string): string | undefined;
    set(key: string, value: string): void;
    remove(key: string): void;
}

let storage: StorageLike;
try {
    const { createMMKV } = require('react-native-mmkv');
    storage = createMMKV({ id: 'kinevo-pending-setlogs' });
} catch {
    const memoryStore = new Map<string, string>();
    storage = {
        getString: (key: string) => memoryStore.get(key),
        set: (key: string, value: string) => { memoryStore.set(key, value); },
        remove: (key: string) => { memoryStore.delete(key); },
    };
}

const STORAGE_KEY = 'pending_set_logs_v1';
// FIX C: registro persistente de sessões descartadas localmente. O reattach do
// player consulta isto ANTES de rehidratar — uma sessão cujo id está aqui foi
// descartada pelo aluno e NÃO pode ser ressuscitada, mesmo que a chamada de
// rede de descarte ainda não tenha confirmado no servidor.
const DISCARDED_KEY = 'discarded_sessions_v1';

// Pendências mais velhas que isto são lixo (espelha o TTL do snapshot S4 e o
// cleanup server-side de sessões in_progress >24h).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const keyOf = (k: PendingSetLogKey) =>
    `${k.workout_session_id}:${k.assigned_workout_item_id}:${k.set_number}`;

// ── FIX C: registro de sessões descartadas (durável) ─────────────────────────

function readDiscarded(): string[] {
    try {
        const raw = storage.getString(DISCARDED_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

function writeDiscarded(ids: string[]): void {
    try {
        if (ids.length === 0) storage.remove(DISCARDED_KEY);
        else storage.set(DISCARDED_KEY, JSON.stringify(ids));
    } catch (e: any) {
        if (__DEV__) console.warn(`[pendingSetLogQueue] discarded write failed: ${e?.message}`);
    }
}

/** FIX C: marca uma sessão como descartada ANTES da chamada de rede, de forma
 *  persistente. O reattach do player ignora/abandona qualquer in_progress cujo
 *  id esteja aqui. */
export function markSessionDiscarded(sessionId: string): void {
    if (!sessionId) return;
    const ids = readDiscarded();
    if (ids.includes(sessionId)) return;
    ids.push(sessionId);
    writeDiscarded(ids);
}

/** FIX C: o reattach consulta isto pra decidir se rehidrata ou abandona. */
export function isSessionDiscarded(sessionId: string): boolean {
    if (!sessionId) return false;
    return readDiscarded().includes(sessionId);
}

/** FIX C: remove o id do registro — chamado só após o servidor confirmar o
 *  descarte (a sessão já está 'abandoned' e os set_logs apagados). */
export function unmarkSessionDiscarded(sessionId: string): void {
    const ids = readDiscarded().filter((id) => id !== sessionId);
    writeDiscarded(ids);
}

function readQueue(): PendingEntry[] {
    try {
        const raw = storage.getString(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeQueue(entries: PendingEntry[]): void {
    try {
        if (entries.length === 0) storage.remove(STORAGE_KEY);
        else storage.set(STORAGE_KEY, JSON.stringify(entries));
    } catch (e: any) {
        if (__DEV__) console.warn(`[pendingSetLogQueue] write failed: ${e?.message}`);
    }
}

function putEntry(entry: PendingEntry): void {
    const rest = readQueue().filter((e) => e.key !== entry.key);
    rest.push(entry);
    writeQueue(rest);
    if (__DEV__) console.log(`[pendingSetLogQueue] queued ${entry.op} ${entry.key} (${rest.length} pendente(s))`);
}

/** Enfileira um upsert de set_log que falhou (offline/erro transiente). */
export function enqueueSetLogUpsert(payload: PendingSetLogUpsert): void {
    putEntry({ op: 'upsert', key: keyOf(payload), payload, queuedAt: new Date().toISOString() });
}

/** Enfileira a remoção de um set_log (aluno desmarcou a série offline). */
export function enqueueSetLogDelete(filters: PendingSetLogKey): void {
    putEntry({ op: 'delete', key: keyOf(filters), filters, queuedAt: new Date().toISOString() });
}

/** FIX C: enfileira um descarte durável (delete-por-session_id + update
 *  status='abandoned'). Chave por sessionId — idempotente. */
export function enqueueDiscardSession(sessionId: string): void {
    putEntry({ op: 'discard_session', key: `discard:${sessionId}`, discardSessionId: sessionId, queuedAt: new Date().toISOString() });
}

/** FIX D: enfileira uma finalização durável do celular. Chave por sessionId —
 *  re-enfileirar (retry) substitui a entrada anterior em vez de empilhar. */
export function enqueueFinishSession(finish: PendingFinishSession): void {
    putEntry({ op: 'finish_session', key: `finish:${finish.session_id}`, finish, queuedAt: new Date().toISOString() });
}

/** Descarta pendências de uma sessão — usado quando o finish (catch-up
 *  idempotente re-envia tudo) ou o descarte (A1) tornam a fila obsoleta. */
export function clearPendingSetLogsForSession(sessionId: string): void {
    const remaining = readQueue().filter((e) =>
        !e.key.startsWith(`${sessionId}:`) &&
        e.key !== `discard:${sessionId}` &&
        e.key !== `finish:${sessionId}`
    );
    writeQueue(remaining);
}

export function pendingSetLogCount(): number {
    return readQueue().length;
}

let draining = false;

/** Drena a fila: executa cada operação contra o Supabase, removendo as que
 *  deram certo. Falhas (ainda offline) permanecem para a próxima drenagem.
 *  Concorrência-segura via guard simples — chamadas paralelas viram no-op. */
export async function drainPendingSetLogs(): Promise<{ flushed: number; remaining: number }> {
    if (draining) return { flushed: 0, remaining: pendingSetLogCount() };
    draining = true;
    try {
        const now = Date.now();
        const entries = readQueue().filter((e) => {
            // Ops TERMINAIS (finish/discard) nunca expiram: são idempotentes e
            // guardadas por status='in_progress' no servidor (replay tardio é
            // no-op seguro). Expirá-las descartava silenciosamente um treino
            // finalizado offline >24h — o aluno via "concluído" e a sessão
            // ficava órfã pra sempre. TTL continua valendo só p/ série solta.
            if (e.op === 'finish_session' || e.op === 'discard_session') return true;
            const age = now - Date.parse(e.queuedAt);
            return Number.isFinite(age) && age <= MAX_AGE_MS;
        });
        if (entries.length === 0) {
            writeQueue([]);
            return { flushed: 0, remaining: 0 };
        }

        const failed: PendingEntry[] = [];
        let flushed = 0;
        for (const entry of entries) {
            try {
                if (entry.op === 'upsert' && entry.payload) {
                    const { error } = await supabase
                        .from('set_logs' as any)
                        .upsert(entry.payload, {
                            onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                        });
                    if (error) { failed.push(entry); continue; }
                } else if (entry.op === 'delete' && entry.filters) {
                    const { error } = await supabase
                        .from('set_logs' as any)
                        .delete()
                        .eq('workout_session_id', entry.filters.workout_session_id)
                        .eq('assigned_workout_item_id', entry.filters.assigned_workout_item_id)
                        .eq('set_number', entry.filters.set_number);
                    if (error) { failed.push(entry); continue; }
                } else if (entry.op === 'discard_session' && entry.discardSessionId) {
                    // FIX C: drena o descarte durável — apaga set_logs da sessão e
                    // marca 'abandoned' (guardado por in_progress p/ não sobrescrever
                    // uma sessão que o Watch concluiu em paralelo).
                    const sid = entry.discardSessionId;
                    const { error: delError } = await supabase
                        .from('set_logs' as any)
                        .delete()
                        .eq('workout_session_id', sid);
                    if (delError) { failed.push(entry); continue; }
                    const { error: updError } = await supabase
                        .from('workout_sessions' as any)
                        .update({ status: 'abandoned' })
                        .eq('id', sid)
                        .eq('status', 'in_progress');
                    if (updError) { failed.push(entry); continue; }
                    // Servidor confirmou — o id pode sair do registro de descartadas.
                    unmarkSessionDiscarded(sid);
                } else if (entry.op === 'finish_session' && entry.finish) {
                    // FIX D: drena a finalização durável do celular — completa a
                    // sessão e re-upserta as séries (idempotente via onConflict).
                    // Aceita in_progress OU abandoned: o cron server-side
                    // (migração 243) marca abandoned sessões >48h; um finish
                    // enfileirado offline que só drena depois disso RECUPERA a
                    // sessão (abandoned→completed é legítimo). O descarte
                    // intencional não corre risco: discardWorkout limpa a fila
                    // desta sessão antes. 'completed' nunca é tocado (não
                    // sobrescreve o que o Watch concluiu em paralelo).
                    const f = entry.finish;
                    const { error: updError } = await supabase
                        .from('workout_sessions' as any)
                        .update(f.session_update)
                        .eq('id', f.session_id)
                        .in('status', ['in_progress', 'abandoned']);
                    if (updError) { failed.push(entry); continue; }
                    if (f.set_logs.length > 0) {
                        const { error: logsError } = await supabase
                            .from('set_logs' as any)
                            .upsert(f.set_logs, {
                                onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                            });
                        if (logsError) { failed.push(entry); continue; }
                    }
                }
                flushed++;
            } catch {
                failed.push(entry);
            }
        }

        writeQueue(failed);
        if (__DEV__ && flushed > 0) console.log(`[pendingSetLogQueue] drained: ${flushed} ok, ${failed.length} pendente(s)`);
        return { flushed, remaining: failed.length };
    } finally {
        draining = false;
    }
}
