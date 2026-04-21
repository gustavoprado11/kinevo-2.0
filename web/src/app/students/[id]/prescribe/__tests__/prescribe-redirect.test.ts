import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
    permanentRedirect: vi.fn((url: string) => {
        throw new Error(`__REDIRECT__:${url}`)
    }),
    redirect: vi.fn(),
}))

import { permanentRedirect } from 'next/navigation'
import PrescribeRedirect from '../page'

describe('PrescribeRedirect', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(permanentRedirect).mockImplementation((url: string) => {
            throw new Error(`__REDIRECT__:${url}`)
        })
    })

    it('redirects to /program/new?mode=ai', async () => {
        await expect(
            PrescribeRedirect({
                params: Promise.resolve({ id: 'stu-1' }),
                searchParams: Promise.resolve({}),
            }),
        ).rejects.toThrow('__REDIRECT__:/students/stu-1/program/new?mode=ai')
        expect(permanentRedirect).toHaveBeenCalledWith('/students/stu-1/program/new?mode=ai')
    })

    it('preserves ?scheduled=true', async () => {
        await expect(
            PrescribeRedirect({
                params: Promise.resolve({ id: 'stu-2' }),
                searchParams: Promise.resolve({ scheduled: 'true' }),
            }),
        ).rejects.toThrow('__REDIRECT__:/students/stu-2/program/new?mode=ai&scheduled=true')
    })
})
