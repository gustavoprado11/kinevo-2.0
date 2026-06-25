/**
 * useAssistantMode — modo da Home (Clássico/Assistente) com sync ao servidor.
 *
 * Fonte de verdade na UI: o store local (MMKV, resposta instantânea). Em paralelo
 * sincroniza com `trainers.home_style` (migration 210) para paridade web↔mobile:
 *  - leitura: syncAssistantModeFromServer() na entrada do dashboard.
 *  - escrita: setMode() persiste no servidor (fire-and-forget).
 *
 * RLS já permite o treinador atualizar a própria linha (mesma operação da action
 * web setHomeStyle), então escrevemos direto pelo client Supabase — sem endpoint.
 * `home_style` ainda não está no database.ts gerado → casts pontuais.
 */
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAssistantModeStore, type AssistantMode } from '../stores/assistantModeStore';

/** Lê home_style do servidor e atualiza o store (servidor = verdade no load). */
export async function syncAssistantModeFromServer(): Promise<void> {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const res = await supabase
            .from('trainers')
            .select('home_style')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        const hs = (res.data as unknown as { home_style?: string | null } | null)?.home_style ?? null;
        if (hs === 'assistant' || hs === 'classic') {
            useAssistantModeStore.getState().setMode(hs);
        }
    } catch {
        // best-effort: sem rede, mantém o valor local.
    }
}

/** Persiste a preferência em trainers.home_style (fire-and-forget). */
export async function persistAssistantMode(mode: AssistantMode): Promise<void> {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
            .from('trainers')
            .update({ home_style: mode } as never)
            .eq('auth_user_id', user.id);
    } catch {
        // best-effort: o store local já reflete a escolha.
    }
}

export interface UseAssistantModeReturn {
    mode: AssistantMode;
    setMode: (mode: AssistantMode) => void;
}

export function useAssistantMode(): UseAssistantModeReturn {
    const mode = useAssistantModeStore((s) => s.mode);
    const setStore = useAssistantModeStore((s) => s.setMode);
    const setMode = useCallback(
        (next: AssistantMode) => {
            setStore(next);
            void persistAssistantMode(next);
        },
        [setStore],
    );
    return { mode, setMode };
}
