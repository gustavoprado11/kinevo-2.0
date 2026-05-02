import { describe, it, expect } from 'vitest'
import { mapExerciseRows } from '../get-trainer-library'

describe('mapExerciseRows', () => {
    it('returns empty array for null/undefined input', () => {
        expect(mapExerciseRows(null)).toEqual([])
        expect(mapExerciseRows(undefined)).toEqual([])
        expect(mapExerciseRows([])).toEqual([])
    })

    it('flattens the nested exercise_muscle_groups join into muscle_groups', () => {
        const rows = [{
            id: 'ex-1',
            name: 'Bench Press',
            equipment: 'barbell',
            owner_id: null,
            original_system_id: null,
            video_url: 'https://example.com/v.mp4',
            exercise_muscle_groups: [
                { muscle_groups: { id: 'mg-1', name: 'Chest', owner_id: null, created_at: '2026-01-01' } },
                { muscle_groups: { id: 'mg-2', name: 'Triceps', owner_id: null, created_at: '2026-01-01' } },
            ],
        }]
        const out = mapExerciseRows(rows)
        expect(out).toHaveLength(1)
        expect(out[0].id).toBe('ex-1')
        expect(out[0].muscle_groups).toEqual([
            { id: 'mg-1', name: 'Chest', owner_id: null, created_at: '2026-01-01' },
            { id: 'mg-2', name: 'Triceps', owner_id: null, created_at: '2026-01-01' },
        ])
    })

    it('handles missing exercise_muscle_groups gracefully', () => {
        const rows = [{
            id: 'ex-1',
            name: 'Foo',
            equipment: null,
            owner_id: 'trainer-1',
            original_system_id: null,
            video_url: null,
            // exercise_muscle_groups undefined
        }]
        const out = mapExerciseRows(rows)
        expect(out[0].muscle_groups).toEqual([])
    })

    it('filters out null muscle_groups inside the join (defensive against partial rows)', () => {
        const rows = [{
            id: 'ex-1',
            name: 'Foo',
            equipment: null,
            owner_id: null,
            original_system_id: null,
            video_url: null,
            exercise_muscle_groups: [
                { muscle_groups: { id: 'mg-1', name: 'Chest', owner_id: null, created_at: '2026-01-01' } },
                { muscle_groups: null },
            ],
        }]
        const out = mapExerciseRows(rows)
        expect(out[0].muscle_groups).toHaveLength(1)
        expect(out[0].muscle_groups[0].id).toBe('mg-1')
    })

    it('coerces empty/missing video_url to null', () => {
        const rows = [
            { id: 'a', name: 'A', equipment: null, owner_id: null, original_system_id: null, video_url: '' },
            { id: 'b', name: 'B', equipment: null, owner_id: null, original_system_id: null, video_url: undefined },
        ]
        const out = mapExerciseRows(rows)
        expect(out[0].video_url).toBeNull()
        expect(out[1].video_url).toBeNull()
    })

    it('preserves owner_id so the builder can distinguish system vs trainer-owned exercises', () => {
        const rows = [
            { id: 'sys', name: 'System', equipment: null, owner_id: null, original_system_id: null, video_url: null },
            { id: 'mine', name: 'Mine', equipment: null, owner_id: 'trainer-1', original_system_id: null, video_url: null },
        ]
        const out = mapExerciseRows(rows)
        expect(out[0].owner_id).toBeNull()
        expect(out[1].owner_id).toBe('trainer-1')
    })

    it('emits stable timestamps so React Query keying upstream stays consistent', () => {
        const rows = [{ id: 'a', name: 'A', equipment: null, owner_id: null, original_system_id: null, video_url: null }]
        const a = mapExerciseRows(rows)
        const b = mapExerciseRows(rows)
        expect(a[0].created_at).toBe(b[0].created_at)
        expect(a[0].updated_at).toBe(b[0].updated_at)
    })
})
