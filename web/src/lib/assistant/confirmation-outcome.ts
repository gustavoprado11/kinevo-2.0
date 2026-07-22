/**
 * Texto do desfecho de uma confirmação HITL na thread — compartilhado pelas
 * rotas de conversa web e mobile. Genérico para a maioria das tools; específico
 * no fluxo de programa (preview-first): salvar rascunho / ativar / descartar.
 */

/** Desempacota um resultado MCP ({content:[{text:'<json>'}]}) — best-effort. */
function mcpPayload(result: unknown): Record<string, unknown> | null {
    const content = (result as { content?: Array<{ text?: string }> } | null)?.content
    if (Array.isArray(content) && typeof content[0]?.text === 'string') {
        try { return JSON.parse(content[0].text) as Record<string, unknown> } catch { return null }
    }
    return null
}

export function confirmationOutcomeContent(toolName: string, confirmed: boolean, result: unknown): string {
    if (toolName === 'kinevo_create_student_draft_program') {
        if (!confirmed) return 'Prévia descartada — nada foi criado. Se quiser outra versão, me diga o que ajustar.'
        const payload = mcpPayload(result)
        if (payload?.activated === true) return 'Programa ativado para o aluno — já visível no app dele.'
        if (payload?.activation_failed === true) {
            return 'Rascunho salvo no perfil do aluno, mas a ativação falhou — você pode ativar pelo card acima ou pelo builder.'
        }
        return 'Rascunho salvo no perfil do aluno — revise no builder e ative quando quiser.'
    }
    if (toolName === 'kinevo_assign_program' && confirmed) {
        return 'Programa ativado para o aluno — já visível no app dele.'
    }
    return confirmed ? '✓ Ação confirmada e executada.' : 'Ação cancelada.'
}
