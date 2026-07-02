/**
 * Rótulos humanos (PT-BR) das ações do Assistente — fonte única compartilhada
 * pela conversa (aba) e pelo ⌘K. Nunca exponha `toolName` cru (kinevo_*) na UI.
 */

export const EXECUTED_LABEL: Record<string, string> = {
    generateProgram: 'Programa gerado (rascunho)',
    kinevo_assign_program: 'Programa atribuído',
    kinevo_send_message: 'Mensagem enviada',
    kinevo_send_form: 'Formulário enviado',
    kinevo_schedule_form: 'Formulário recorrente agendado',
    kinevo_create_appointment: 'Sessão agendada',
    kinevo_reschedule_appointment: 'Sessão remarcada',
    kinevo_update_student: 'Aluno atualizado',
    kinevo_create_student: 'Aluno criado',
    kinevo_create_program_template: 'Template criado na biblioteca',
    kinevo_create_student_draft_program: 'Rascunho criado no perfil do aluno',
    kinevo_delete_program: 'Rascunho descartado',
    kinevo_archive_student: 'Aluno arquivado',
    kinevo_correct_assessment: 'Avaliação corrigida',
    kinevo_duplicate_program: 'Programa duplicado',
    kinevo_send_message_batch: 'Mensagens enviadas',
}

/** Rótulo curto p/ chips de ação já executada (sem detalhes do resultado). */
export function executedLabel(toolName: string): string {
    return EXECUTED_LABEL[toolName] ?? 'Ação executada'
}

/**
 * Texto da ação executada preferindo a mensagem do resultado (quando a tool
 * devolve `message`/`error`), caindo no rótulo humano do `toolName`.
 */
export function executedText(toolName: string, result: unknown): string {
    const r = result as { message?: string; error?: string; success?: boolean } | null
    if (r && typeof r === 'object') {
        if (r.success === false && r.error) return r.error
        if (r.message) return r.message
    }
    return executedLabel(toolName)
}
