/**
 * Limpeza de estado no logout.
 *
 * A sessão de auth fica no SecureStore (limpa pelo supabase.auth.signOut()).
 * Mas caches e stores persistidos em MMKV NÃO são escopados por usuário —
 * sem esta limpeza, o próximo usuário no mesmo aparelho herdaria dashboard,
 * lista de alunos (PII), contador de notificações, sessões da sala de treino
 * e rascunhos do usuário anterior.
 */
import { clearAllCache } from "./cache";
import { clearStoredTokens as clearStravaTokens } from "./strava/oauth";
import { useNotificationStore } from "../stores/notification-store";
import { useProgramBuilderStore } from "../stores/program-builder-store";
import { useTrainingRoomStore } from "../stores/training-room-store";
import { useAssessmentDraftStore } from "../stores/assessmentDraftStore";
import { useAssessmentTemplateDraftStore } from "../stores/assessmentTemplateDraftStore";
import { useFormsTabStateStore } from "../stores/formsTabStateStore";

export function clearUserScopedState(): void {
    // Caches de dados (dashboard, alunos, exercícios, etc.) — vetor de PII.
    try {
        clearAllCache();
    } catch (e: unknown) {
        if (__DEV__) console.warn("[logout] clearAllCache falhou:", e);
    }

    // Stores com reset em memória (cobre memória + storage no próximo write).
    try {
        useNotificationStore.getState().resetUnread();
        useProgramBuilderStore.getState().reset();
        useTrainingRoomStore.getState().reset();
    } catch (e: unknown) {
        if (__DEV__) console.warn("[logout] reset de stores falhou:", e);
    }

    // Tokens OAuth do Strava (SecureStore) — sem isto, o próximo usuário no
    // mesmo aparelho herdaria a conexão Strava (e os dados) do usuário anterior.
    // Best-effort assíncrono: o logout não precisa esperar.
    clearStravaTokens().catch((e: unknown) => {
        if (__DEV__) console.warn("[logout] clearStravaTokens falhou:", e);
    });

    // Stores de rascunho sem reset dedicado — limpa o storage persistido.
    for (const store of [
        useAssessmentDraftStore,
        useAssessmentTemplateDraftStore,
        useFormsTabStateStore,
    ]) {
        try {
            store.persist?.clearStorage?.();
        } catch (e: unknown) {
            if (__DEV__) console.warn("[logout] clearStorage falhou:", e);
        }
    }
}
