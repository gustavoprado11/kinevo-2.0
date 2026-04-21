import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createServerClientFromToken } from './server-from-token'

const ORIGINAL_ENV = { ...process.env }

describe('createServerClientFromToken', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-tests'
    })

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV }
        vi.restoreAllMocks()
    })

    it('returns a client that exposes the Supabase public surface', () => {
        const client = createServerClientFromToken('jwt-token')
        // Shape check: both .from and .auth.getUser must exist.
        expect(typeof client.from).toBe('function')
        expect(typeof client.auth.getUser).toBe('function')
    })

    it('throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        expect(() => createServerClientFromToken('jwt-token')).toThrow(
            /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set/,
        )
    })

    it('throws a descriptive error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        expect(() => createServerClientFromToken('jwt-token')).toThrow(
            /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set/,
        )
    })

    it('throws when the token is empty', () => {
        expect(() => createServerClientFromToken('')).toThrow(/token is required/)
    })
})
