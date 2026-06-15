-- 199_mcp_usage_log_nullable_api_key.sql
--
-- Fix: telemetria de uso do MCP falhava em TODA chamada autenticada via OAuth.
-- mcp_tool_usage_logs.api_key_id é FK -> trainer_api_keys(id) e era NOT NULL.
-- Tokens OAuth (mcp_oauth_tokens) NÃO são API keys, então não há linha de
-- trainer_api_keys para referenciar -> o INSERT estourava
-- ("invalid input syntax for type uuid: 'oauth:<id>'" no caller, e mesmo o uuid
-- puro violaria a FK/NOT NULL). Resultado: 0 linhas de telemetria desde a
-- introdução do OAuth.
--
-- Correção backward-compat: permitir api_key_id NULL. Chamadas via API key
-- continuam gravando o uuid da chave; chamadas via OAuth gravam NULL (não há
-- API key associada). A FK já aceita NULL; linhas e inserts existentes ficam
-- intactos. Reversível com SET NOT NULL caso a tabela volte a ter só API keys.

ALTER TABLE public.mcp_tool_usage_logs
  ALTER COLUMN api_key_id DROP NOT NULL;

COMMENT ON COLUMN public.mcp_tool_usage_logs.api_key_id IS
  'API key usada (FK trainer_api_keys). NULL quando a chamada foi autenticada por token OAuth (mcp_oauth_tokens), que não é uma API key.';
