-- Kinevo MCP Server: Tool usage analytics
-- Fire-and-forget inserts after each tool call for debugging and optimization

CREATE TABLE public.mcp_tool_usage_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  api_key_id  uuid NOT NULL REFERENCES public.trainer_api_keys(id) ON DELETE CASCADE,
  tool_name   text NOT NULL,
  duration_ms integer,
  success     boolean NOT NULL DEFAULT true,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_logs_trainer ON public.mcp_tool_usage_logs(trainer_id, created_at DESC);
CREATE INDEX idx_mcp_logs_tool ON public.mcp_tool_usage_logs(tool_name, created_at DESC);

ALTER TABLE public.mcp_tool_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on mcp_tool_usage_logs"
  ON public.mcp_tool_usage_logs
  FOR ALL
  USING (auth.role() = 'service_role');
