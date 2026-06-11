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

interface PendingEntry {
    op: 'upsert' | 'delete';
    key: string;
    /** Presente quando op === 'upsert' */
    payload?: PendingSetLogUpsert;
    /** Presente quando op === 'delete' */
    filters?: PendingSetLogKey;
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

// Pendências mais velhas que isto são lixo (espelha o TTL do snapshot S4 e o
// cleanup server-side de sessões in_progress >24h).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const keyOf = (k: PendingSetLogKey) =>
    `${k.workout_session_id}:${k.assigned_workout_item_id}:${k.set_number}`;

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

/** Descarta pendências de uma sessão — usado quando o finish (catch-up
 *  idempotente re-envia tudo) ou o descarte (A1) tornam a fila obsoleta. */
export function clearPendingSetLogsForSession(sessionId: string): void {
    const remaining = readQueue().filter((e) => !e.key.startsWith(`${sessionId}:`));
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
