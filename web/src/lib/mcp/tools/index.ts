import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerPingTool } from './ping'
import { registerStudentReadTools } from './students'
import { registerStudentWriteTools } from './students-write'
import { registerProgramReadTools } from './programs'
import { registerProgramWriteTools } from './programs-write'
import { registerExerciseReadTools } from './exercises'
import { registerWorkoutWriteTools } from './workouts-write'
import { registerProgressReadTools } from './progress'
import { registerDashboardReadTools } from './dashboard'
import { registerMessageWriteTools } from './messages'
import { registerBillingReadTools } from './billing'
import { registerConversationReadTools } from './conversations'

export function registerAllTools(server: McpServer, trainerId: string) {
  registerPingTool(server, trainerId)
  registerStudentReadTools(server, trainerId)
  registerStudentWriteTools(server, trainerId)
  registerProgramReadTools(server, trainerId)
  registerProgramWriteTools(server, trainerId)
  registerExerciseReadTools(server, trainerId)
  registerWorkoutWriteTools(server, trainerId)
  registerProgressReadTools(server, trainerId)
  registerDashboardReadTools(server, trainerId)
  registerMessageWriteTools(server, trainerId)
  registerBillingReadTools(server, trainerId)
  registerConversationReadTools(server, trainerId)
}
