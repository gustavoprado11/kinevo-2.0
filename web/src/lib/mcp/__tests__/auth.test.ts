import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mocks de borda (banco, bcrypt, rate-limit). vi.hoisted compartilha estado
// mutável com as factories de vi.mock (que são içadas pro topo do módulo).
const h = vi.hoisted(() => {
  const state = { tables: {} as Record<string, { data: unknown; error: unknown }> }
  const compare = vi.fn()
  const consume = vi.fn()

  // Chain frouxo que cobre os terminais usados por auth.ts:
  // select/eq/is/in/limit/update -> retornam o próprio chain;
  // single/maybeSingle/await(then) -> resolvem a resposta configurada da tabela.
  const makeChain = (table: string) => {
    const terminal = () => state.tables[table] ?? { data: null, error: null }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'limit', 'update', 'delete', 'order']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.single = vi.fn(async () => terminal())
    chain.maybeSingle = vi.fn(async () => terminal())
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(terminal()).then(resolve)
    return chain
  }
  const from = vi.fn((table: string) => makeChain(table))
  return { state, compare, consume, from }
})

vi.mock('bcryptjs', () => ({ default: { compare: h.compare } }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: h.consume }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: h.from }) }))

import { authenticateRequest, McpAuthError } from '../auth'

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()

function req(token: string): Request {
  return new Request('http://localhost/api/mcp', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  h.compare.mockReset()
  h.consume.mockReset().mockResolvedValue({ allowed: true })
  h.from.mockClear()
  // Assinatura ativa por padrão (gate de acesso passa).
  h.state.tables = {
    subscriptions: { data: { status: 'active' }, error: null },
  }
})

describe('authenticateRequest — token OAuth (kinevo_at_*)', () => {
  beforeEach(() => {
    h.state.tables.mcp_oauth_tokens = {
      data: { id: 'oauth-row-uuid', trainer_id: 'trainer-1', expires_at: FUTURE },
      error: null,
    }
  })

  it('retorna apiKeyId NULL (não há API key) e keyId prefixado p/ rate-limit', async () => {
    const ctx = await authenticateRequest(req('kinevo_at_abc123'))
    expect(ctx.trainerId).toBe('trainer-1')
    expect(ctx.apiKeyId).toBeNull()
    expect(ctx.keyId).toBe('oauth:oauth-row-uuid')
  })

  it('REGRESSÃO: apiKeyId nunca é a string prefixada (causa do erro de uuid)', async () => {
    const ctx = await authenticateRequest(req('kinevo_at_abc123'))
    // O bug gravava `oauth:<uuid>` na coluna uuid api_key_id.
    expect(ctx.apiKeyId).toBeNull()
    if (typeof ctx.apiKeyId === 'string') {
      expect(ctx.apiKeyId.startsWith('oauth:')).toBe(false)
    }
  })

  it('rejeita token OAuth expirado', async () => {
    h.state.tables.mcp_oauth_tokens = {
      data: { id: 'x', trainer_id: 'trainer-1', expires_at: '2000-01-01T00:00:00Z' },
      error: null,
    }
    await expect(authenticateRequest(req('kinevo_at_old'))).rejects.toBeInstanceOf(McpAuthError)
  })
})

describe('authenticateRequest — API key (kinevo_trainer_*)', () => {
  beforeEach(() => {
    h.state.tables.trainer_api_keys = {
      data: [{ id: 'key-uuid-123', trainer_id: 'trainer-2', key_hash: '$2a$hash' }],
      error: null,
    }
    h.compare.mockResolvedValue(true)
  })

  it('apiKeyId é o uuid puro da chave (igual ao keyId)', async () => {
    const ctx = await authenticateRequest(req('kinevo_trainer_secret_token'))
    expect(ctx.trainerId).toBe('trainer-2')
    expect(ctx.apiKeyId).toBe('key-uuid-123')
    expect(ctx.keyId).toBe('key-uuid-123')
  })

  it('rejeita quando o bcrypt.compare não bate', async () => {
    h.compare.mockResolvedValue(false)
    await expect(authenticateRequest(req('kinevo_trainer_wrong'))).rejects.toBeInstanceOf(
      McpAuthError,
    )
  })
})

describe('authenticateRequest — gates', () => {
  it('rejeita sem header Authorization Bearer', async () => {
    const bare = new Request('http://localhost/api/mcp')
    await expect(authenticateRequest(bare)).rejects.toBeInstanceOf(McpAuthError)
  })

  it('rejeita (403) quando não há assinatura ativa', async () => {
    h.state.tables.mcp_oauth_tokens = {
      data: { id: 'o1', trainer_id: 'trainer-1', expires_at: FUTURE },
      error: null,
    }
    h.state.tables.subscriptions = { data: null, error: null }
    await expect(authenticateRequest(req('kinevo_at_abc'))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('rejeita (429) quando o rate-limit estoura', async () => {
    h.state.tables.mcp_oauth_tokens = {
      data: { id: 'o1', trainer_id: 'trainer-1', expires_at: FUTURE },
      error: null,
    }
    h.consume.mockResolvedValue({ allowed: false, error: 'Rate limit exceeded' })
    await expect(authenticateRequest(req('kinevo_at_abc'))).rejects.toMatchObject({
      statusCode: 429,
    })
  })
})
