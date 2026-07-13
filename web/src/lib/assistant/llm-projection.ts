/**
 * Projeção LOSSLESS dos tool-results para o LLM (P7 — versão segura).
 *
 * Medição em prod (13/jul): um kinevo_get_program de programa real pesa 4–6k
 * TOKENS, dos quais ~30% são `null`, arrays vazios e strings vazias — zero
 * informação para o modelo, custo e distração puros. Esta camada remove APENAS
 * o que é semanticamente vazio (null/undefined/''/[]/{}); nenhum valor real é
 * tocado (0 e false ficam). Por ser sem perda, não depende de eval para ser
 * segura — a versão com CORTE de conteúdo (top-N, campos) fica para quando a
 * suíte comportamental cobrir os fluxos de leitura.
 *
 * Aplicada SÓ no caminho do assistente (engine), nos READ_TOOLS — o MCP externo
 * (claude.ai/ChatGPT) segue recebendo o payload integral.
 */

/** Remove recursivamente null/undefined/''/[]/{}. Preserva 0 e false. */
export function stripEmptyDeep(value: unknown): unknown {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'string') return value === '' ? undefined : value
    if (Array.isArray(value)) {
        const out = value.map(stripEmptyDeep).filter((v) => v !== undefined)
        return out.length === 0 ? undefined : out
    }
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            const c = stripEmptyDeep(v)
            if (c !== undefined) out[k] = c
        }
        return Object.keys(out).length === 0 ? undefined : out
    }
    return value
}

/**
 * Reescreve um envelope MCP de SUCESSO ({content:[{text:'<json>'}]}) com o
 * payload enxuto. Defensivo: erro MCP ou formato inesperado passam intocados —
 * a projeção jamais pode quebrar um resultado.
 */
export function projectMcpResultForLlm(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result
    const env = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
    if (env.isError || !Array.isArray(env.content) || typeof env.content[0]?.text !== 'string') {
        return result
    }
    try {
        const payload = JSON.parse(env.content[0].text) as unknown
        const stripped = stripEmptyDeep(payload)
        if (stripped === undefined) return result
        return {
            ...env,
            content: [{ ...env.content[0], text: JSON.stringify(stripped) }, ...env.content.slice(1)],
        }
    } catch {
        return result
    }
}
