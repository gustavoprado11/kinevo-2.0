/**
 * Tratamento de erro amigável do Assistente (Fase C — polimento).
 *
 * Os catches das rotas devolviam `error.message` cru — vaza detalhe interno
 * (stack, nomes de tabela, SQL) ao cliente. Aqui logamos o detalhe real no
 * servidor e devolvemos uma mensagem estável em PT, sem vazar nada.
 *
 * Erros ESPERADos (quota, tier, validação, rate-limit) continuam tratados nas
 * próprias rotas com seus 402/422/429 amigáveis — este helper é só o fallback
 * 500 do catch.
 */

import { NextResponse } from 'next/server'

export const ASSISTANT_GENERIC_ERROR =
    'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.'

/** Loga o detalhe real (servidor) e retorna a mensagem genérica em PT. */
export function logAssistantError(context: string, error: unknown): string {
    console.error(`[${context}]`, error)
    return ASSISTANT_GENERIC_ERROR
}

/** Resposta 500 amigável (NextResponse) — não vaza stack nem mensagem interna. */
export function assistantErrorResponse(context: string, error: unknown): NextResponse {
    return NextResponse.json(
        { error: 'internal_error', message: logAssistantError(context, error) },
        { status: 500 },
    )
}
