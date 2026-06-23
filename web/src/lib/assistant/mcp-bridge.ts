/**
 * Ponte in-memory: 1 catálogo de tools (o servidor MCP), consumido pelo agente
 * web sem HTTP/OAuth (Fase 0 — IA do Treinador). Ver chat-first SPEC §1/§3.
 *
 * AI SDK 5 REMOVEU o `experimental_createMCPClient` do pacote `ai`. Usamos o
 * `Client` do @modelcontextprotocol/sdk direto: listamos as tools do servidor
 * in-memory e as embrulhamos como tools do AI SDK (inputSchema = JSON Schema do
 * MCP; execute = client.callTool). O resultado do callTool é o CallToolResult
 * CRU (`{content, isError}`) — que é EXATAMENTE o envelope que o `toolResultOk`
 * (turn-trace) já sabe ler. Por isso o metering/HITL não muda de comportamento.
 *
 * HITL: tools em CONFIRM_TOOLS são embrulhadas SEM `execute` → o streamText
 * pausa e o cliente renderiza o card, executando depois via execute-tool.
 *
 * Subsetting (custo): com `intents`, carrega só as tools daquelas intenções
 * (+ CORE_TOOLS), cortando 60–70% do input. Sem `intents`, expõe todas.
 */

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { tool, jsonSchema, type ToolSet } from 'ai'
import { createMcpServer } from '@/lib/mcp/server'
import { CONFIRM_TOOLS, resolveToolSubset, type ToolIntent } from './tool-policy'

export interface McpBridge {
    /** ToolSet pronto para `streamText({ tools })`. */
    tools: ToolSet
    /** Fecha o client da ponte (sempre chamar — evita conexão pendurada). */
    close: () => Promise<void>
}

export interface BuildMcpToolsOptions {
    /** Intenções para subsetting; vazio/omitido = todas. */
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

    const client = new Client({ name: 'kinevo-bridge', version: '1.0.0' }, { capabilities: {} })
    await client.connect(clientTransport)
    const { tools: mcpTools } = await client.listTools()

    const allowed = options.intents && options.intents.length > 0
        ? new Set<string>(resolveToolSubset(options.intents))
        : null

    const tools: ToolSet = {}
    for (const mt of mcpTools) {
        if (allowed && !allowed.has(mt.name)) continue

        const inputSchema = jsonSchema(mt.inputSchema as Parameters<typeof jsonSchema>[0])
        const isConfirm = !options.keepConfirmExecutable && CONFIRM_TOOLS.has(mt.name)

        tools[mt.name] = isConfirm
            ? tool({ description: mt.description ?? '', inputSchema })
            : tool({
                  description: mt.description ?? '',
                  inputSchema,
                  // Resultado CRU do callTool ({content, isError}) — toolResultOk lê direto.
                  execute: async (args: unknown) =>
                      client.callTool({
                          name: mt.name,
                          arguments: (args ?? {}) as Record<string, unknown>,
                      }),
              })
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
