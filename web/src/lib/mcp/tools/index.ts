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
import { registerBillingWriteTools } from './billing-write'
import { registerConversationReadTools } from './conversations'
import { registerAppointmentTools } from './appointments'
import { registerFormWriteTools } from './forms'
import { registerAssessmentTools } from './assessments'
import { registerExerciseWriteTools } from './exercises-write'
import { registerInsightToolsAndCheckins } from './insights'
import { registerLeadTools } from './leads'

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
  registerBillingWriteTools(server, trainerId)
  registerConversationReadTools(server, trainerId)
  registerAppointmentTools(server, trainerId)
  registerFormWriteTools(server, trainerId)
  registerAssessmentTools(server, trainerId)
  registerExerciseWriteTools(server, trainerId)
  registerInsightToolsAndCheckins(server, trainerId)
  registerLeadTools(server, trainerId)
}
