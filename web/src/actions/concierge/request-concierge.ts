'use server'

import { createClient } from '@/lib/supabase/server'

// WhatsApp do time (Gustavo) e mensagem padrão pré-preenchida — o que aparece
// pra equipe quando o trainer abre a conversa.
const WHATSAPP_NUMBER = '5531999064997'
const WHATSAPP_MESSAGE =
    'Oi, vim do Kinevo. Quero montar minha biblioteca de vídeos com a equipe.'

export type RequestConciergeResult = {
    success: boolean
    whatsappUrl?: string
    message?: string
}

/**
 * Grava o lead na tabela concierge_requests (métricas) e devolve a URL do
 * WhatsApp pré-preenchido. Falha no insert NÃO bloqueia a abertura do
 * WhatsApp — preferimos a continuidade da conversa à precisão da métrica.
 *
 * @param source Onde o trainer clicou (ex.: 'biblioteca_button',
 *               'exercise_empty', 'settings_link').
 */
export async function requestConcierge(source: string): Promise<RequestConciergeResult> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, message: 'Sessão inválida. Faça login novamente.' }
        }

        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (trainerError || !trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }

        const { error: insertError } = await supabase
            .from('concierge_requests' as never)
            .insert({
                trainer_id: trainer.id,
                source: source || 'unknown',
                channel: 'whatsapp',
            } as never)

        if (insertError) {
            // Log mas segue — a abertura do WhatsApp é mais importante que a métrica.
            console.error('[requestConcierge] Insert error:', insertError)
        }

        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
        return { success: true, whatsappUrl: url }
    } catch (error) {
        console.error('[requestConcierge] Unexpected error:', error)
        return {
            success: false,
            message: 'Não foi possível registrar agora. Tente de novo em instantes.',
        }
    }
}
