import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAllTools } from './tools'

export function createMcpServer(trainerId: string): McpServer {
  const server = new McpServer({
    name: 'kinevo',
    version: '1.0.0',
  })

  registerAllTools(server, trainerId)

  return server
}
