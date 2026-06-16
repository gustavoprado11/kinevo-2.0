import { describe, it, expect, afterEach } from 'vitest'
import { transcribeAudio } from './voice'

const ORIGINAL_KEY = process.env.OPENAI_API_KEY

afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY
})

describe('transcribeAudio', () => {
    it('falha claramente quando não há OPENAI_API_KEY', async () => {
        delete process.env.OPENAI_API_KEY
        const audio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
        await expect(transcribeAudio(audio)).rejects.toThrow(/OPENAI_API_KEY/)
    })
})
