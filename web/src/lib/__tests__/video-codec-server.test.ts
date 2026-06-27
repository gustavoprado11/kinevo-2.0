import { describe, it, expect } from 'vitest'
import { isOwnedStoragePath } from '../video-codec-server'

const OWNER = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('isOwnedStoragePath', () => {
    it('accepts a canonical path under the owner prefix', () => {
        // Convenção de upload: `${authUserId}/${exerciseId}/${ts}_video.mp4`
        expect(isOwnedStoragePath(`${OWNER}/ex-1/1718000000_video.mp4`, OWNER)).toBe(true)
    })

    it('rejects traversal even under the owner prefix', () => {
        expect(isOwnedStoragePath(`${OWNER}/../other/x.mp4`, OWNER)).toBe(false)
        expect(isOwnedStoragePath(`${OWNER}/ex/..%2f..%2fx`, OWNER)).toBe(false)
    })

    it("rejects another user's prefix", () => {
        expect(isOwnedStoragePath('b9999999-0000-4000-8000-000000000002/ex/x.mp4', OWNER)).toBe(false)
    })

    it('rejects absolute paths and leading slash', () => {
        expect(isOwnedStoragePath('/etc/passwd', OWNER)).toBe(false)
        expect(isOwnedStoragePath(`/${OWNER}/x.mp4`, OWNER)).toBe(false)
    })

    it('rejects an embedded scheme / URL (SSRF host injection)', () => {
        expect(isOwnedStoragePath('http://169.254.169.254/latest/meta-data/', OWNER)).toBe(false)
        expect(isOwnedStoragePath(`${OWNER}/http://169.254.169.254/`, OWNER)).toBe(false)
    })

    it('rejects backslashes', () => {
        expect(isOwnedStoragePath(`${OWNER}\\..\\x`, OWNER)).toBe(false)
    })

    it('rejects control characters / NUL', () => {
        expect(isOwnedStoragePath(`${OWNER}/x${String.fromCharCode(0)}.mp4`, OWNER)).toBe(false)
        expect(isOwnedStoragePath(`${OWNER}/x${String.fromCharCode(0x7f)}.mp4`, OWNER)).toBe(false)
    })

    it('rejects the bare prefix with no filename', () => {
        expect(isOwnedStoragePath(`${OWNER}/`, OWNER)).toBe(false)
    })

    it('rejects empty / non-string inputs and empty owner', () => {
        expect(isOwnedStoragePath('', OWNER)).toBe(false)
        expect(isOwnedStoragePath(null, OWNER)).toBe(false)
        expect(isOwnedStoragePath(undefined, OWNER)).toBe(false)
        expect(isOwnedStoragePath(`${OWNER}/x.mp4`, '')).toBe(false)
    })
})
