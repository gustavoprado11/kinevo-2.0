import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// Mantém o isOwnedStoragePath REAL (queremos exercitar a validação de verdade)
// e troca só o checkVideoCompat por um stub — sem rede de fetch nos testes.
const h = vi.hoisted(() => ({ checkVideoCompat: vi.fn() }))
vi.mock('@/lib/video-codec-server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/video-codec-server')>()
    return { ...actual, checkVideoCompat: h.checkVideoCompat }
})

// Build chainable Supabase mock
function createSupabaseMock(overrides: Record<string, any> = {}) {
    const storageMock = {
        from: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue({ data: null, error: null }),
            getPublicUrl: vi.fn((p: string) => ({
                data: { publicUrl: `https://kinevo-test.supabase.co/storage/v1/object/public/trainer-videos/${p}` },
            })),
        }),
    }

    const chainable = (resolvedValue: any) => {
        const chain: any = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.insert = vi.fn().mockReturnValue(chain)
        chain.upsert = vi.fn().mockReturnValue(chain)
        chain.update = vi.fn().mockReturnValue(chain)
        chain.delete = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.single = vi.fn().mockResolvedValue(resolvedValue)
        return chain
    }

    const fromResults: Record<string, any> = {
        trainers: chainable(overrides.trainer ?? { data: { id: 'trainer-1' }, error: null }),
        trainer_exercise_videos: chainable(overrides.trainerVideo ?? { data: null, error: null }),
    }

    // Track call order for trainer_exercise_videos to return different values
    let tevCallCount = 0
    const tevResponses = overrides.tevResponses

    return {
        auth: {
            getUser: vi.fn().mockResolvedValue(
                overrides.auth ?? { data: { user: { id: 'user-1' } }, error: null }
            ),
        },
        from: vi.fn((table: string) => {
            if (table === 'trainer_exercise_videos' && tevResponses) {
                const resp = tevResponses[tevCallCount] ?? tevResponses[tevResponses.length - 1]
                tevCallCount++
                return chainable(resp)
            }
            return fromResults[table] ?? chainable({ data: null, error: null })
        }),
        storage: storageMock,
    }
}

let mockSupabase: ReturnType<typeof createSupabaseMock>

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

describe('saveTrainerVideoMetadata', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock()
        h.checkVideoCompat.mockReset().mockResolvedValue({ compatible: true })
    })

    it('returns error when not authenticated', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: { message: 'No session' } },
        })

        const { saveTrainerVideoMetadata } = await import('../manage-trainer-video')
        const result = await saveTrainerVideoMetadata({
            exerciseId: 'ex-1',
            videoType: 'upload',
            videoUrl: 'https://example.com/video.mp4',
        })

        expect(result.success).toBe(false)
        expect(result.message).toBe('Sessão inválida.')
    })

    it('returns error when trainer not found', async () => {
        mockSupabase = createSupabaseMock({
            trainer: { data: null, error: null },
        })

        const { saveTrainerVideoMetadata } = await import('../manage-trainer-video')
        const result = await saveTrainerVideoMetadata({
            exerciseId: 'ex-1',
            videoType: 'upload',
            videoUrl: 'https://example.com/video.mp4',
        })

        expect(result.success).toBe(false)
        expect(result.message).toBe('Treinador não encontrado.')
    })

    it('returns success on valid upsert', async () => {
        mockSupabase = createSupabaseMock({
            tevResponses: [
                { data: null, error: null },   // existing check
                { data: null, error: null },   // upsert
            ],
        })

        const { saveTrainerVideoMetadata } = await import('../manage-trainer-video')
        const result = await saveTrainerVideoMetadata({
            exerciseId: 'ex-1',
            videoType: 'external_url',
            videoUrl: 'https://youtube.com/watch?v=abc',
        })

        expect(result.success).toBe(true)
        expect(result.data?.video_url).toBe('https://youtube.com/watch?v=abc')
        expect(result.data?.video_type).toBe('external_url')
    })

    it('derives the fetched URL from storagePath and never fetches the client videoUrl (SSRF)', async () => {
        mockSupabase = createSupabaseMock({
            tevResponses: [
                { data: null, error: null }, // existing check
                { data: null, error: null }, // upsert
            ],
        })

        const { saveTrainerVideoMetadata } = await import('../manage-trainer-video')
        const result = await saveTrainerVideoMetadata({
            exerciseId: 'ex-1',
            videoType: 'upload',
            storagePath: 'user-1/ex-1/1718000000_video.mp4',
            // URL maliciosa do cliente: tem que ser IGNORADA pelo fetch.
            videoUrl: 'http://169.254.169.254/latest/meta-data/',
        })

        expect(result.success).toBe(true)
        // checkVideoCompat recebeu a URL DERIVADA do storagePath, não o videoUrl.
        expect(h.checkVideoCompat).toHaveBeenCalledTimes(1)
        const fetchedUrl = h.checkVideoCompat.mock.calls[0][0] as string
        expect(fetchedUrl).toContain('trainer-videos/user-1/ex-1/1718000000_video.mp4')
        expect(fetchedUrl).not.toContain('169.254.169.254')
    })

    it('rejects a foreign/traversal storagePath before any fetch', async () => {
        const { saveTrainerVideoMetadata } = await import('../manage-trainer-video')
        const result = await saveTrainerVideoMetadata({
            exerciseId: 'ex-1',
            videoType: 'upload',
            storagePath: 'user-1/../user-2/evil.mp4', // traversal pra fora do dono
            videoUrl: 'https://whatever',
        })

        expect(result.success).toBe(false)
        expect(result.message).toBe('Caminho de vídeo inválido.')
        expect(h.checkVideoCompat).not.toHaveBeenCalled()
    })
})

describe('deleteTrainerVideo', () => {
    beforeEach(() => {
        vi.resetModules()
        mockSupabase = createSupabaseMock()
    })

    it('returns error when not authenticated', async () => {
        mockSupabase = createSupabaseMock({
            auth: { data: { user: null }, error: { message: 'No session' } },
        })

        const { deleteTrainerVideo } = await import('../manage-trainer-video')
        const result = await deleteTrainerVideo('ex-1')

        expect(result.success).toBe(false)
        expect(result.message).toBe('Sessão inválida.')
    })

    it('returns error when trainer not found', async () => {
        mockSupabase = createSupabaseMock({
            trainer: { data: null, error: null },
        })

        const { deleteTrainerVideo } = await import('../manage-trainer-video')
        const result = await deleteTrainerVideo('ex-1')

        expect(result.success).toBe(false)
        expect(result.message).toBe('Treinador não encontrado.')
    })

    it('deletes storage file and DB record', async () => {
        mockSupabase = createSupabaseMock({
            tevResponses: [
                { data: { storage_path: 'uid/ex/video.mp4' }, error: null }, // existing
                { data: null, error: null }, // delete
            ],
        })

        const { deleteTrainerVideo } = await import('../manage-trainer-video')
        const result = await deleteTrainerVideo('ex-1')

        expect(result.success).toBe(true)
        expect(result.data).toBeNull()
        expect(mockSupabase.storage.from).toHaveBeenCalledWith('trainer-videos')
    })

    it('succeeds even without storage path', async () => {
        mockSupabase = createSupabaseMock({
            tevResponses: [
                { data: { storage_path: null }, error: null },
                { data: null, error: null },
            ],
        })

        const { deleteTrainerVideo } = await import('../manage-trainer-video')
        const result = await deleteTrainerVideo('ex-1')

        expect(result.success).toBe(true)
    })
})
