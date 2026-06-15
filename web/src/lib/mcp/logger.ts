import { createAdminClient } from '@/lib/supabase/admin'

export function logToolUsage(
  trainerId: string,
  apiKeyId: string | null,
  toolName: string,
  durationMs: number,
  success: boolean,
  error?: string
): void {
  // Fire-and-forget — never blocks the response
  const supabaseAdmin = createAdminClient()
  supabaseAdmin
    .from('mcp_tool_usage_logs')
    .insert({
      trainer_id: trainerId,
      api_key_id: apiKeyId,
      tool_name: toolName,
      duration_ms: durationMs,
      success,
      error: error ?? null,
    })
    .then()
}
