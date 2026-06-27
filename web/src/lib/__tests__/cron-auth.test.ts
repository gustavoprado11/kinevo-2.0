import { describe, it, expect, afterEach } from 'vitest'
import { verifyCronAuth } from '../cron-auth'

function req(auth?: string): Request {
    const headers: Record<string, string> = {}
    if (auth !== undefined) headers['authorization'] = auth
    return new Request('http://localhost/api/cron/x', { headers })
}

const original = process.env.CRON_SECRET
afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
})

describe('verifyCronAuth', () => {
    it('accepts the correct Bearer token', () => {
        process.env.CRON_SECRET = 's3cr3t-value'
        expect(verifyCronAuth(req('Bearer s3cr3t-value'))).toBe(true)
    })

    it('rejects a wrong token', () => {
        process.env.CRON_SECRET = 's3cr3t-value'
        expect(verifyCronAuth(req('Bearer wrong'))).toBe(false)
        expect(verifyCronAuth(req('s3cr3t-value'))).toBe(false) // sem prefixo Bearer
    })

    it('rejects a missing Authorization header', () => {
        process.env.CRON_SECRET = 's3cr3t-value'
        expect(verifyCronAuth(req())).toBe(false)
    })

    it('FAIL-CLOSED: rejects everything when CRON_SECRET is unset', () => {
        delete process.env.CRON_SECRET
        // O buraco de hoje: o esperado virava `Bearer ${undefined}` === "Bearer
        // undefined", então este header passava. Agora tem que ser rejeitado.
        expect(verifyCronAuth(req('Bearer undefined'))).toBe(false)
        expect(verifyCronAuth(req('Bearer anything'))).toBe(false)
        expect(verifyCronAuth(req())).toBe(false)
    })

    it('treats an empty CRON_SECRET as unset (fail-closed)', () => {
        process.env.CRON_SECRET = ''
        expect(verifyCronAuth(req('Bearer '))).toBe(false)
    })
})
