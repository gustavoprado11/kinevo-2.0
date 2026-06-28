import { describe, it, expect, vi } from 'vitest'

// forms.ts importa cadeias que tocam o supabase-admin (env não setada em teste).
// Mockamos só os imports pesados — o studentIdsSchema é zod real, definido
// inline no módulo, então continua sendo o schema de verdade.
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/actions/forms/assign-form-core', () => ({ assignFormCore: vi.fn() }))
vi.mock('@/actions/forms/form-schedules-core', () => ({
  createFormSchedulesCore: vi.fn(),
  getStudentFormSchedulesCore: vi.fn(),
}))

import { studentIdsSchema, MAX_FORM_STUDENTS_PER_CALL } from '../tools/forms'

const uuid = (i: number) => `00000000-0000-4000-8000-${i.toString().padStart(12, '0')}`
const ids = (n: number) => Array.from({ length: n }, (_, i) => uuid(i + 1))

describe('forms studentIdsSchema (per-call cap)', () => {
  it('accepts 1 id and exactly the cap', () => {
    expect(studentIdsSchema.safeParse(ids(1)).success).toBe(true)
    expect(studentIdsSchema.safeParse(ids(MAX_FORM_STUDENTS_PER_CALL)).success).toBe(true)
  })

  it('rejects more than the cap', () => {
    expect(studentIdsSchema.safeParse(ids(MAX_FORM_STUDENTS_PER_CALL + 1)).success).toBe(false)
  })

  it('rejects an empty array', () => {
    expect(studentIdsSchema.safeParse([]).success).toBe(false)
  })

  it('rejects non-uuid entries', () => {
    expect(studentIdsSchema.safeParse(['not-a-uuid']).success).toBe(false)
  })
})
