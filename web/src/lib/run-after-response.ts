import { after } from 'next/server'

/**
 * Agenda trabalho para DEPOIS da resposta ser enviada, sem congelar junto
 * com a lambda (AG2): `void (async () => ...)()` morria no freeze da função
 * serverless — o sync Google Calendar podia nunca executar. `after()` mantém
 * a função viva até o callback terminar.
 *
 * Fora de request scope (unit tests com vitest), `after()` lança — caímos no
 * fire-and-forget, que nos testes é inofensivo (dependências mockadas).
 */
export function runAfterResponse(task: () => Promise<void>): void {
    try {
        after(task)
    } catch {
        void task().catch((err) => {
            console.error('[runAfterResponse] task error:', err)
        })
    }
}
