// ============================================================================
// Kinevo Prescription Engine v2 — Program Cache
// ============================================================================
// Avoids redundant LLM calls by caching generation results keyed on a
// deterministic hash of the student's prescription profile.
//
// Design:
//   - Hash is computed from the parameters that affect exercise selection:
//     level, goal, days, duration, equipment, restrictions, favorites/dislikes
//   - Cache is in-memory (Map) with TTL expiration
//   - Engine version is part of the key → auto-invalidates on version bumps
//   - When trainer answers questions, cache is bypassed (personalized generation)
//   - Future: can be migrated to Redis or Supabase for multi-server deployments
//
// Conservative estimate: 20-30% cache hit rate at scale.

import type { StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'
import type { CompactGenerationOutput } from './schemas'

// ============================================================================
// Config
// ============================================================================

/** Cache entries expire after this many milliseconds (24 hours) */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

/** Maximum number of cached entries (LRU eviction when exceeded) */
const MAX_CACHE_SIZE = 500

/** Current engine version — included in hash to auto-invalidate on upgrades */
const CACHE_ENGINE_VERSION = '2.0.0'

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
    output: CompactGenerationOutput
    created_at: number
    hit_count: number
}

export interface CacheLookupResult {
    hit: boolean
    output: CompactGenerationOutput | null
    cache_key: string
}

export interface CacheStats {
    size: number
    hits: number
    misses: number
    evictions: number
}

// ============================================================================
// Cache Store (module-level singleton)
// ============================================================================

const cache = new Map<string, CacheEntry>()
let stats = { hits: 0, misses: 0, evictions: 0 }

// ============================================================================
// Public API
// ============================================================================

/**
 * Looks up a cached generation result for the given profile.
 * Returns { hit: true, output } if found and fresh, { hit: false } otherwise.
 */
export function lookupCache(
    profile: StudentPrescriptionProfile,
    ttlMs: number = DEFAULT_TTL_MS,
): CacheLookupResult {
    const key = computeCacheKey(profile)

    const entry = cache.get(key)
    if (!entry) {
        stats.misses++
        return { hit: false, output: null, cache_key: key }
    }

    // Check TTL
    if (Date.now() - entry.created_at > ttlMs) {
        cache.delete(key)
        stats.misses++
        return { hit: false, output: null, cache_key: key }
    }

    entry.hit_count++
    stats.hits++
    console.log(`[ProgramCache] HIT — key=${key.slice(0, 12)}… hits=${entry.hit_count}`)

    return { hit: true, output: entry.output, cache_key: key }
}

/**
 * Stores a generation result in the cache.
 * Should be called after a successful generation + validation pass.
 */
export function storeInCache(
    profile: StudentPrescriptionProfile,
    output: CompactGenerationOutput,
): string {
    const key = computeCacheKey(profile)

    // LRU eviction if cache is full
    if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
        evictOldest()
    }

    cache.set(key, {
        output,
        created_at: Date.now(),
        hit_count: 0,
    })

    console.log(`[ProgramCache] STORE — key=${key.slice(0, 12)}… size=${cache.size}`)
    return key
}

/**
 * Invalidates all cache entries. Called when engine version changes
 * or when exercise library is updated.
 */
export function clearCache(): void {
    const size = cache.size
    cache.clear()
    stats = { hits: 0, misses: 0, evictions: 0 }
    console.log(`[ProgramCache] CLEARED — removed ${size} entries`)
}

/**
 * Returns current cache statistics.
 */
export function getCacheStats(): CacheStats {
    return {
        size: cache.size,
        ...stats,
    }
}

// ============================================================================
// Cache Key Computation
// ============================================================================

/**
 * Computes a deterministic cache key from the profile parameters that
 * affect program generation. Uses a simple hash of the sorted, normalized
 * input values.
 *
 * Parameters included:
 *   - engine version (auto-invalidates on upgrades)
 *   - training_level
 *   - goal
 *   - available_days (sorted)
 *   - session_duration_minutes (bucketed to 5-min increments)
 *   - available_equipment (sorted)
 *   - medical_restriction descriptions (sorted, for determinism)
 *   - favorite_exercise_ids (sorted)
 *   - disliked_exercise_ids (sorted)
 *
 * NOT included (intentionally):
 *   - student_id, trainer_id (program structure doesn't depend on identity)
 *   - adherence_rate (affects constraints, not cache — different adherence
 *     should produce different constraints which means different prompts)
 *   - cycle_observation (free text, always bypasses cache)
 */
export function computeCacheKey(profile: StudentPrescriptionProfile): string {
    const input = {
        v: CACHE_ENGINE_VERSION,
        l: profile.training_level,
        g: profile.goal,
        d: [...profile.available_days].sort((a, b) => a - b),
        m: bucketDuration(profile.session_duration_minutes),
        e: [...profile.available_equipment].sort(),
        r: profile.medical_restrictions
            .map(r => r.description)
            .sort(),
        f: [...profile.favorite_exercise_ids].sort(),
        x: [...profile.disliked_exercise_ids].sort(),
    }

    return simpleHash(JSON.stringify(input))
}

/**
 * Buckets session duration to 5-minute increments.
 * 47 → 45, 52 → 50, 60 → 60
 * This prevents cache misses from trivial duration differences.
 */
function bucketDuration(minutes: number): number {
    return Math.round(minutes / 5) * 5
}

// ============================================================================
// Hash Function
// ============================================================================

/**
 * Simple deterministic hash function (FNV-1a 32-bit).
 * Produces a hex string. Not cryptographic — used only for cache keys.
 * Chosen for simplicity and zero dependencies (no crypto import needed).
 */
function simpleHash(str: string): string {
    let hash = 0x811c9dc5 // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193) // FNV prime
    }
    // Convert to unsigned 32-bit, then to hex
    return (hash >>> 0).toString(16).padStart(8, '0')
}

// ============================================================================
// LRU Eviction
// ============================================================================

/**
 * Evicts the oldest cache entry (by created_at timestamp).
 */
function evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of cache) {
        if (entry.created_at < oldestTime) {
            oldestTime = entry.created_at
            oldestKey = key
        }
    }

    if (oldestKey) {
        cache.delete(oldestKey)
        stats.evictions++
        console.log(`[ProgramCache] EVICT — key=${oldestKey.slice(0, 12)}…`)
    }
}
