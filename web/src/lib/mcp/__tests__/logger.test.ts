import { describe, it, expect, beforeEach, vi } from 'vitest'

// Captura o payload do insert em mcp_tool_usage_logs.
const h = vi.hoisted(() => {
  const insert = vi.fn((_payload: Record<string, unknown>) => ({
    // logToolUsage é fire-and-forget: encerra com .then()
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  }))
  const from = vi.fn(() => ({ insert }))
  return { insert, from }
})

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: h.from }) }))

import { logToolUsage } from '../logger'

beforeEach(() => {
  h.insert.mockClear()
  h.from.mockClear()
})

describe('logToolUsage', () => {
  it('grava na tabela mcp_tool_usage_logs', () => {
    logToolUsage('trainer-1', null, 'kinevo_ping', 12, true)
    expect(h.from).toHaveBeenCalledWith('mcp_tool_usage_logs')
  })

  it('OAuth: api_key_id NULL é inserido como null (não string prefixada)', () => {
    logToolUsage('trainer-1', null, 'kinevo_ping', 12, true)
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trainer_id: 'trainer-1',
        api_key_id: null,
        tool_name: 'kinevo_ping',
        duration_ms: 12,
        success: true,
        error: null,
      }),
    )
  })

  it('API key: grava o uuid puro da chave', () => {
    logToolUsage('trainer-2', 'key-uuid-123', 'kinevo_list_students', 30, true)
    const payload = h.insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.api_key_id).toBe('key-uuid-123')
  })

  it('REGRESSÃO: nunca insere um api_key_id prefixado com "oauth:"', () => {
    // Antes do fix, o keyId `oauth:<uuid>` chegava aqui e estourava o uuid.
    logToolUsage('trainer-1', null, 'kinevo_ping', 5, false, 'HTTP 500')
    const payload = h.insert.mock.calls[0][0] as { api_key_id: unknown; error: unknown }
    expect(payload.api_key_id).toBeNull()
    expect(payload.error).toBe('HTTP 500')
    if (typeof payload.api_key_id === 'string') {
      expect(payload.api_key_id.startsWith('oauth:')).toBe(false)
    }
  })
})
