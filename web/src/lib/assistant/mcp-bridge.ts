/**
 * Ponte in-memory: 1 catálogo de tools (o servidor MCP), consumido pelo agente
 * web sem HTTP/OAuth (Fase 0 — IA do Treinador). Ver chat-first SPEC §1/§3.
 *
 * Detalhe crítico (verificado): o `client.tools()` do AI SDK entrega TODAS as
 * tools já com `execute` automático e descarta as annotations. Logo:
 *   - reads e writes simples passam direto (auto-execute);
 *   - tools em CONFIRM_TOOLS são SUBSTITUÍDAS por versões client-side SEM
 *     `execute` → o `streamText` pausa e o cliente renderiza o card de HITL,
 *     executando depois via /api/assistant/execute-tool.
 *
 * Subsetting (custo): com `intents`, carrega só as tools daquelas intenções
 * (+ CORE_TOOLS), cortando 60–70% do input. Sem `intents`, expõe as 55.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { experimental_createMCPClient, tool, type ToolSet } from 'ai'
import { createMcpServer } from '@/lib/mcp/server'
import { CONFIRM_TOOLS, resolveToolSubset, type ToolIntent } from './tool-policy'

export interface McpBridge {
    /** ToolSet pronto para `streamText({ tools })`. */
    tools: ToolSet
    /** Fecha o client da ponte (sempre chamar — evita conexão pendurada). */
    close: () => Promise<void>
}

export interface BuildMcpToolsOptions {
    /** Intenções para subsetting; vazio/omitido = todas as 55. */
    intents?: ToolIntent[]
    /**
     * Se true, REMOVE as CONFIRM_TOOLS do conjunto (em vez de torná-las HITL).
     * Usado pelo executor de HITL (execute-tool), que quer apenas executar a
     * tool real por nome com `execute` ativo — ele monta a ponte sem strip.
     */
    keepConfirmExecutable?: boolean
}

export async function buildMcpTools(
    trainerId: string,
    options: BuildMcpToolsOptions = {},
): Promise<McpBridge> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = createMcpServer(trainerId)
    await server.connect(serverTransport)

    const client = await experimental_createMCPClient({ transport: clientTransport })
    const rawTools = (await client.tools()) as ToolSet

    const allowed = options.intents && options.intents.length > 0
        ? new Set<string>(resolveToolSubset(options.intents))
        : null

    const tools: ToolSet = {}
    for (const [name, mcpTool] of Object.entries(rawTools)) {
        // CORE/allowed também precisa deixar passar a action generateProgram, que
        // é injetada fora da ponte pelo handler — aqui só lidamos com tools MCP.
        if (allowed && !allowed.has(name)) continue

        if (!options.keepConfirmExecutable && CONFIRM_TOOLS.has(name)) {
            // HITL: mesma description + parameters, SEM execute → pausa o stream.
            tools[name] = tool({
                description: mcpTool.description,
                parameters: mcpTool.parameters,
            })
        } else {
            tools[name] = mcpTool
        }
    }

    return { tools, close: () => client.close() }
}

/**
 * Executa UMA tool MCP por nome via ponte (caminho de confirmação do HITL).
 * Monta a ponte com `keepConfirmExecutable`, invoca a tool real e fecha.
 * Lança se a tool não existir. Retorna o resultado bruto da tool MCP.
 */
export async function executeMcpToolByName(
    trainerId: string,
    toolName: string,
    args: unknown,
): Promise<unknown> {
    const bridge = await buildMcpTools(trainerId, { keepConfirmExecutable: true })
    try {
        const target = bridge.tools[toolName]
        if (!target || typeof target.execute !== 'function') {
            throw new Error(`Tool desconhecida ou não executável: ${toolName}`)
        }
        return await target.execute(args as never, {
            toolCallId: `hitl_${toolName}`,
            messages: [],
        })
    } finally {
        await bridge.close()
    }
}
