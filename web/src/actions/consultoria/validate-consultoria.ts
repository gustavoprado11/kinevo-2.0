'use server'

// Consultoria IA — o PORTÃO: validação humana CREF (PLANO.md §5.1 estágio 3).
//
// Regras inegociáveis do portão:
//   • Nada publica sem ação afirmativa do treinador (sem auto-publish).
//   • Aprovar exige CREF cadastrado — o carimbo é snapshot legal no programa.
//   • Triagem amarela exige reconhecimento explícito das flags (acknowledgeFlags).
//   • Vermelho nunca chega aqui (blocked não gera rascunho).
//
// approveConsultoria delega a publicação ao approveProgram existente (completa
// programa ativo anterior, ativa o draft, computa o diff IA-vs-editado — nossa
// telemetria anti-carimbo M3 — e notifica o aluno com push), e por cima aplica
// o carimbo CREF + fecha o pedido.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { approveProgram } from '@/actions/prescription/approve-program'
import { resolveTrainer } from './consultoria-core'

interface ValidateResult {
    success: boolean
    error?: string
    /** Código para a UI reagir (ex.: abrir settings quando falta CREF). */
    code?: 'missing_cref' | 'flags_not_acknowledged'
}

/** Marca o início da revisão (telemetria anti-carimbo M4: tempo em revisão). */
export async function startConsultoriaReview(requestId: string): Promise<void> {
    try {
        const supabase = await createClient()
        const trainer = await resolveTrainer(supabase)
        if (!trainer) return
        await supabase
            .from('consultoria_requests')
            .update({ review_started_at: new Date().toISOString() })
            .eq('id', requestId)
            .eq('trainer_id', trainer.id)
            .is('review_started_at', null)
    } catch (err) {
        console.error('[startConsultoriaReview] error:', err)
    }
}

export async function approveConsultoria(
    requestId: string,
    options?: { acknowledgeFlags?: boolean },
): Promise<ValidateResult> {
    try {
        const supabase = await createClient()
        const trainer = await resolveTrainer(supabase)
        if (!trainer) return { success: false, error: 'Não autorizado' }

        // O carimbo CREF é pré-requisito legal da aprovação.
        const cref = trainer.cref?.trim()
        if (!cref) {
            return {
                success: false,
                code: 'missing_cref',
                error: 'Cadastre seu CREF nas Configurações para validar prescrições.',
            }
        }
        // O carimbo exibido ao aluno exige nome + CREF (o app esconde o selo
        // se qualquer um faltar) — aprovar sem nome anularia o selo legal.
        const trainerName = trainer.name?.trim()
        if (!trainerName) {
            return {
                success: false,
                error: 'Cadastre seu nome nas Configurações para validar prescrições.',
            }
        }

        const { data: request } = await supabase
            .from('consultoria_requests')
            .select('id, student_id, status, triage_level, generation_id, program_id')
            .eq('id', requestId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!request) return { success: false, error: 'Consultoria não encontrada.' }
        if (request.status !== 'pending_validation') {
            return { success: false, error: `Consultoria não está aguardando validação (status: ${request.status}).` }
        }
        if (!request.generation_id || !request.program_id) {
            return { success: false, error: 'Consultoria sem rascunho vinculado.' }
        }

        // Ação afirmativa nas flags: amarelo exige reconhecimento explícito.
        if (request.triage_level === 'yellow' && options?.acknowledgeFlags !== true) {
            return {
                success: false,
                code: 'flags_not_acknowledged',
                error: 'Confirme que revisou os sinais de alerta da triagem antes de aprovar.',
            }
        }

        const now = new Date().toISOString()

        // Carimbo CREF no programa ANTES de publicar — se o carimbo falhar,
        // nada vai ao ar (um programa ativo sem o snapshot legal derrotaria o
        // propósito da feature). O draft carimbado sem publicação é inócuo:
        // o aluno só vê o selo em programa ativo, e re-aprovar re-carimba.
        const { error: stampError } = await supabase
            .from('assigned_programs')
            .update({
                validated_by_name: trainerName,
                validator_cref: cref,
                validated_at: now,
            })
            .eq('id', request.program_id)
        if (stampError) {
            console.error('[approveConsultoria] stamp error:', stampError)
            return { success: false, error: 'Erro ao aplicar o carimbo de validação. Tente novamente.' }
        }

        // Publica pelo fluxo existente (ativa draft + diff IA-vs-editado + push).
        const approval = await approveProgram(request.generation_id)
        if (!approval.success) {
            return { success: false, error: approval.error ?? 'Erro ao ativar o programa.' }
        }

        // Transição guardada: só fecha se ainda estiver pendente (evita
        // sobrescrever um reject concorrente que tenha vencido a corrida).
        const { error: closeError } = await supabase
            .from('consultoria_requests')
            .update({
                status: 'approved',
                validated_at: now,
                validator_cref: cref,
            })
            .eq('id', requestId)
            .eq('status', 'pending_validation')
        if (closeError) {
            // Programa já está ativo — não desfaz; loga para correção manual.
            console.error('[approveConsultoria] close error:', closeError)
        }

        revalidatePath('/consultoria')
        revalidatePath(`/students/${request.student_id}`)
        return { success: true }
    } catch (err) {
        console.error('[approveConsultoria] unexpected error:', err)
        return { success: false, error: 'Erro inesperado ao aprovar.' }
    }
}

export async function rejectConsultoria(
    requestId: string,
    reason: string,
): Promise<ValidateResult> {
    try {
        const supabase = await createClient()
        const trainer = await resolveTrainer(supabase)
        if (!trainer) return { success: false, error: 'Não autorizado' }

        const trimmedReason = reason?.trim()
        if (!trimmedReason) {
            return { success: false, error: 'Informe o motivo da rejeição.' }
        }

        const { data: request } = await supabase
            .from('consultoria_requests')
            .select('id, student_id, status, generation_id')
            .eq('id', requestId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!request) return { success: false, error: 'Consultoria não encontrada.' }

        // Rejeitável em qualquer estado aberto (inclui cancelar awaiting/blocked).
        const rejectable = ['awaiting_anamnese', 'ready_to_generate', 'blocked', 'pending_validation']
        if (!rejectable.includes(request.status)) {
            return { success: false, error: `Consultoria não pode ser rejeitada (status: ${request.status}).` }
        }

        const { error } = await supabase
            .from('consultoria_requests')
            .update({ status: 'rejected', rejection_reason: trimmedReason })
            .eq('id', requestId)
            .in('status', rejectable)
        if (error) {
            console.error('[rejectConsultoria] update error:', error)
            return { success: false, error: 'Erro ao rejeitar a consultoria.' }
        }

        // Marca a geração como rejeitada (status permitido pelo CHECK da 035).
        // O rascunho (draft) permanece no perfil do aluno para edição/descarte manual.
        if (request.generation_id) {
            await supabase
                .from('prescription_generations')
                .update({ status: 'rejected' })
                .eq('id', request.generation_id)
                .eq('status', 'pending_review')
        }

        revalidatePath('/consultoria')
        revalidatePath(`/students/${request.student_id}`)
        return { success: true }
    } catch (err) {
        console.error('[rejectConsultoria] unexpected error:', err)
        return { success: false, error: 'Erro inesperado ao rejeitar.' }
    }
}
