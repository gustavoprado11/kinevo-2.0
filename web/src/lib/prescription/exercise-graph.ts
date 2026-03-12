// ============================================================================
// Kinevo Prescription Engine — Exercise Knowledge Graph Service
// ============================================================================
// Centralized query API for the exercise knowledge graph.
// Reads from: exercise_relationships, exercise_synergies,
//             exercise_condition_constraints tables.
//
// NOT wired to any production module yet. This is Phase 2 — read-only
// service with in-memory caching and fallback guarantees.
//
// Every function wraps its DB query in try/catch and returns a safe
// fallback value on error (see Risk 5 in EXERCISE_KNOWLEDGE_GRAPH_PLAN.md).
// ============================================================================

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export type RelationshipType =
    | 'substitute'
    | 'progression'
    | 'regression'
    | 'variation'
    | 'equipment_alternative'

export type RelationshipSource =
    | 'curated'
    | 'algorithmic'
    | 'trainer_pattern'
    | 'imported'
    | 'inferred'

export type ConstraintType = 'contraindicated' | 'cautious' | 'recommended'

export interface GraphExerciseEdge {
    exercise_id: string
    exercise_name: string
    relationship_type: RelationshipType
    weight: number
    source: RelationshipSource
}

export interface GraphConditionEdge {
    exercise_id: string
    condition_id: string
    constraint_type: ConstraintType
    notes: string | null
}

export interface SynergyEdge {
    primary_group_id: string
    primary_group_name: string
    secondary_group_id: string
    secondary_group_name: string
    weight: number
}

export interface SafetyResult {
    safe: boolean
    constraints: GraphConditionEdge[]
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
    data: T
    created_at: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const CACHE_TTL = {
    synergies: 60 * 60 * 1000,      // 1 hour
    relationships: 30 * 60 * 1000,   // 30 minutes
    conditions: 60 * 60 * 1000,      // 1 hour
}

function getCached<T>(key: string, ttlMs: number): T | null {
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.created_at > ttlMs) {
        cache.delete(key)
        return null
    }
    return entry.data as T
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, created_at: Date.now() })
}

/** Clear all graph caches. Call after bulk imports or admin edits. */
export function clearGraphCache(): void {
    const size = cache.size
    cache.clear()
    console.log(`[ExerciseGraph] Cache cleared — removed ${size} entries`)
}

// ============================================================================
// Hard-coded fallbacks (current behavior, used when graph is empty/errors)
// ============================================================================

const FALLBACK_SYNERGIES: Record<string, { group: string; weight: number }[]> = {
    'Quadríceps':        [{ group: 'Glúteo', weight: 1.0 }],
    'Posterior de Coxa': [{ group: 'Glúteo', weight: 1.0 }],
    'Peito':             [{ group: 'Ombros', weight: 0.5 }, { group: 'Tríceps', weight: 0.5 }],
    'Costas':            [{ group: 'Bíceps', weight: 0.5 }],
    'Ombros':            [{ group: 'Tríceps', weight: 0.5 }],
}

// ============================================================================
// Exercise-to-Exercise Relationships
// ============================================================================

/** Get relationships of a specific type for an exercise */
export async function getRelationships(
    exerciseId: string,
    type: RelationshipType,
): Promise<GraphExerciseEdge[]> {
    const cacheKey = `relationships:${exerciseId}:${type}`
    const cached = getCached<GraphExerciseEdge[]>(cacheKey, CACHE_TTL.relationships)
    if (cached) return cached

    try {
        const supabase = await createClient()

        // Query outgoing edges
        const { data: outgoing, error: err1 } = await supabase
            .from('exercise_relationships')
            .select('target_exercise_id, relationship_type, weight, source')
            .eq('source_exercise_id', exerciseId)
            .eq('relationship_type', type)

        if (err1) throw err1

        // For bidirectional types, also query incoming edges
        const bidirectional: RelationshipType[] = ['substitute', 'variation', 'equipment_alternative']
        let incomingData: { source_exercise_id: string; relationship_type: string; weight: number | null; source: string }[] = []

        if (bidirectional.includes(type)) {
            const { data: inc, error: err2 } = await supabase
                .from('exercise_relationships')
                .select('source_exercise_id, relationship_type, weight, source')
                .eq('target_exercise_id', exerciseId)
                .eq('relationship_type', type)

            if (err2) throw err2
            incomingData = inc || []
        }

        // Collect all related exercise IDs to fetch names in one query
        const relatedIds = new Set<string>()
        for (const row of (outgoing || [])) relatedIds.add(row.target_exercise_id)
        for (const row of incomingData) relatedIds.add(row.source_exercise_id)

        // Fetch exercise names
        const nameMap = new Map<string, string>()
        if (relatedIds.size > 0) {
            const { data: exercises } = await supabase
                .from('exercises')
                .select('id, name')
                .in('id', [...relatedIds])
            for (const ex of (exercises || [])) {
                nameMap.set(ex.id, ex.name)
            }
        }

        const edges: GraphExerciseEdge[] = []
        const seenIds = new Set<string>()

        for (const row of (outgoing || [])) {
            if (!seenIds.has(row.target_exercise_id)) {
                seenIds.add(row.target_exercise_id)
                edges.push({
                    exercise_id: row.target_exercise_id,
                    exercise_name: nameMap.get(row.target_exercise_id) ?? '',
                    relationship_type: row.relationship_type as RelationshipType,
                    weight: row.weight ?? 0.5,
                    source: row.source as RelationshipSource,
                })
            }
        }

        for (const row of incomingData) {
            if (!seenIds.has(row.source_exercise_id)) {
                seenIds.add(row.source_exercise_id)
                edges.push({
                    exercise_id: row.source_exercise_id,
                    exercise_name: nameMap.get(row.source_exercise_id) ?? '',
                    relationship_type: row.relationship_type as RelationshipType,
                    weight: row.weight ?? 0.5,
                    source: row.source as RelationshipSource,
                })
            }
        }

        // Sort by weight descending
        edges.sort((a, b) => b.weight - a.weight)

        setCache(cacheKey, edges)
        return edges
    } catch (err) {
        console.error(`[ExerciseGraph] getRelationships error:`, err)
        return [] // Fallback: no relationships
    }
}

/** Get substitute exercises (same function, interchangeable) */
export async function getSubstitutes(exerciseId: string): Promise<GraphExerciseEdge[]> {
    return getRelationships(exerciseId, 'substitute')
}

/** Get progression chain (harder versions) */
export async function getProgressions(exerciseId: string): Promise<GraphExerciseEdge[]> {
    return getRelationships(exerciseId, 'progression')
}

/** Get regression chain (easier/safer versions) */
export async function getRegressions(exerciseId: string): Promise<GraphExerciseEdge[]> {
    return getRelationships(exerciseId, 'regression')
}

/** Get all variations (different angle/grip/stance) */
export async function getVariations(exerciseId: string): Promise<GraphExerciseEdge[]> {
    return getRelationships(exerciseId, 'variation')
}

/** Get equipment alternatives (same movement, different equipment) */
export async function getEquipmentAlternatives(exerciseId: string): Promise<GraphExerciseEdge[]> {
    return getRelationships(exerciseId, 'equipment_alternative')
}

// ============================================================================
// Condition Safety
// ============================================================================

/** Get all constraints for a condition */
export async function getConditionConstraints(
    conditionId: string,
): Promise<GraphConditionEdge[]> {
    const cacheKey = `conditions:${conditionId}`
    const cached = getCached<GraphConditionEdge[]>(cacheKey, CACHE_TTL.conditions)
    if (cached) return cached

    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('exercise_condition_constraints')
            .select('exercise_id, condition_id, constraint_type, notes')
            .eq('condition_id', conditionId)

        if (error) throw error

        const edges: GraphConditionEdge[] = (data || []).map(row => ({
            exercise_id: row.exercise_id,
            condition_id: row.condition_id,
            constraint_type: row.constraint_type as ConstraintType,
            notes: row.notes,
        }))

        setCache(cacheKey, edges)
        return edges
    } catch (err) {
        console.error(`[ExerciseGraph] getConditionConstraints error:`, err)
        return [] // Fallback: no constraints (current behavior)
    }
}

/** Get exercises contraindicated for a condition */
export async function getContraindicatedExercises(
    conditionId: string,
): Promise<string[]> {
    const constraints = await getConditionConstraints(conditionId)
    return constraints
        .filter(c => c.constraint_type === 'contraindicated')
        .map(c => c.exercise_id)
}

/** Get exercises recommended for a condition */
export async function getRecommendedExercises(
    conditionId: string,
): Promise<GraphConditionEdge[]> {
    const constraints = await getConditionConstraints(conditionId)
    return constraints.filter(c => c.constraint_type === 'recommended')
}

/** Check if an exercise is safe for a set of conditions */
export async function isExerciseSafe(
    exerciseId: string,
    conditionIds: string[],
): Promise<SafetyResult> {
    if (conditionIds.length === 0) {
        return { safe: true, constraints: [] }
    }

    try {
        const allConstraints: GraphConditionEdge[] = []
        for (const conditionId of conditionIds) {
            const constraints = await getConditionConstraints(conditionId)
            const matching = constraints.filter(c => c.exercise_id === exerciseId)
            allConstraints.push(...matching)
        }

        const hasContraindication = allConstraints.some(
            c => c.constraint_type === 'contraindicated',
        )

        return {
            safe: !hasContraindication,
            constraints: allConstraints,
        }
    } catch (err) {
        console.error(`[ExerciseGraph] isExerciseSafe error:`, err)
        return { safe: true, constraints: [] } // Fallback: assume safe
    }
}

/** Filter an exercise pool by condition safety */
export async function filterBySafety(
    exerciseIds: string[],
    conditionIds: string[],
): Promise<{ safe: string[]; cautious: string[]; contraindicated: string[] }> {
    if (conditionIds.length === 0) {
        return { safe: exerciseIds, cautious: [], contraindicated: [] }
    }

    try {
        // Fetch all constraints for all conditions
        const allConstraints: GraphConditionEdge[] = []
        for (const conditionId of conditionIds) {
            const constraints = await getConditionConstraints(conditionId)
            allConstraints.push(...constraints)
        }

        const contraindicatedSet = new Set<string>()
        const cautiousSet = new Set<string>()

        for (const c of allConstraints) {
            if (c.constraint_type === 'contraindicated') {
                contraindicatedSet.add(c.exercise_id)
            } else if (c.constraint_type === 'cautious') {
                cautiousSet.add(c.exercise_id)
            }
        }

        const safe: string[] = []
        const cautious: string[] = []
        const contraindicated: string[] = []

        for (const id of exerciseIds) {
            if (contraindicatedSet.has(id)) {
                contraindicated.push(id)
            } else if (cautiousSet.has(id)) {
                cautious.push(id)
            } else {
                safe.push(id)
            }
        }

        return { safe, cautious, contraindicated }
    } catch (err) {
        console.error(`[ExerciseGraph] filterBySafety error:`, err)
        return { safe: exerciseIds, cautious: [], contraindicated: [] } // Fallback
    }
}

// ============================================================================
// Synergies (Secondary Muscle Activation)
// ============================================================================

/** Get the full synergy map from the database (replaces hard-coded maps) */
export async function getAllSynergies(): Promise<Map<string, SynergyEdge[]>> {
    const cacheKey = 'synergies:all'
    const cached = getCached<Map<string, SynergyEdge[]>>(cacheKey, CACHE_TTL.synergies)
    if (cached) return cached

    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('exercise_synergies')
            .select('primary_group_id, secondary_group_id, weight')

        if (error) throw error

        if (!data || data.length === 0) {
            console.log('[ExerciseGraph] No synergies in DB, using fallback')
            return buildFallbackSynergyMap()
        }

        // Fetch muscle group names
        const groupIds = new Set<string>()
        for (const row of data) {
            groupIds.add(row.primary_group_id)
            groupIds.add(row.secondary_group_id)
        }
        const { data: groups } = await supabase
            .from('muscle_groups')
            .select('id, name')
            .in('id', [...groupIds])

        const groupNameMap = new Map<string, string>()
        for (const g of (groups || [])) {
            groupNameMap.set(g.id, g.name)
        }

        const map = new Map<string, SynergyEdge[]>()

        for (const row of data) {
            const primaryName = groupNameMap.get(row.primary_group_id)
            const secondaryName = groupNameMap.get(row.secondary_group_id)
            if (!primaryName || !secondaryName) continue

            const edge: SynergyEdge = {
                primary_group_id: row.primary_group_id,
                primary_group_name: primaryName,
                secondary_group_id: row.secondary_group_id,
                secondary_group_name: secondaryName,
                weight: row.weight,
            }

            const existing = map.get(primaryName) || []
            existing.push(edge)
            map.set(primaryName, existing)
        }

        setCache(cacheKey, map)
        return map
    } catch (err) {
        console.error(`[ExerciseGraph] getAllSynergies error:`, err)
        return buildFallbackSynergyMap()
    }
}

/** Get secondary muscle activations for a specific primary group */
export async function getSynergies(primaryGroupName: string): Promise<SynergyEdge[]> {
    const allSynergies = await getAllSynergies()
    return allSynergies.get(primaryGroupName) || []
}

function buildFallbackSynergyMap(): Map<string, SynergyEdge[]> {
    const map = new Map<string, SynergyEdge[]>()
    for (const [primary, secondaries] of Object.entries(FALLBACK_SYNERGIES)) {
        map.set(
            primary,
            secondaries.map(s => ({
                primary_group_id: '',
                primary_group_name: primary,
                secondary_group_id: '',
                secondary_group_name: s.group,
                weight: s.weight,
            })),
        )
    }
    return map
}

// ============================================================================
// Composite Queries
// ============================================================================

/**
 * For a stalled exercise, find the best variation or progression.
 * Traverses: exercise → variation/progression → filter by equipment + safety.
 */
export async function findVariationForStalled(
    stalledExerciseId: string,
    availableEquipment: string[],
    conditionIds: string[],
): Promise<GraphExerciseEdge[]> {
    try {
        // Get variations and progressions in parallel
        const [variations, progressions] = await Promise.all([
            getVariations(stalledExerciseId),
            getProgressions(stalledExerciseId),
        ])

        const candidates = [...variations, ...progressions]
        if (candidates.length === 0) return []

        // Filter by safety
        const candidateIds = candidates.map(c => c.exercise_id)
        const safety = await filterBySafety(candidateIds, conditionIds)
        const safeIds = new Set([...safety.safe, ...safety.cautious])

        // Filter by equipment (if we have equipment data)
        // Note: equipment filtering requires exercise data not available in edges.
        // For now, return safety-filtered candidates. Equipment check can be done
        // by the caller using the exercise pool data.
        const filtered = candidates.filter(c => safeIds.has(c.exercise_id))

        // Sort: variations first (same difficulty), then progressions, by weight
        filtered.sort((a, b) => {
            if (a.relationship_type === 'variation' && b.relationship_type !== 'variation') return -1
            if (a.relationship_type !== 'variation' && b.relationship_type === 'variation') return 1
            return b.weight - a.weight
        })

        return filtered
    } catch (err) {
        console.error(`[ExerciseGraph] findVariationForStalled error:`, err)
        return [] // Fallback: no suggestions
    }
}

// ============================================================================
// Batch Queries (avoid N+1 during slot filling)
// ============================================================================

/**
 * Batch fetch substitutes for multiple exercises in one query.
 * Returns a Map from exerciseId to its substitute edges.
 * Much more efficient than calling getSubstitutes() N times.
 */
export async function getSubstitutesForBatch(
    exerciseIds: string[],
): Promise<Map<string, GraphExerciseEdge[]>> {
    const result = new Map<string, GraphExerciseEdge[]>()
    if (exerciseIds.length === 0) return result

    // Check cache first — return cached entries and collect uncached IDs
    const uncachedIds: string[] = []
    for (const id of exerciseIds) {
        const cacheKey = `relationships:${id}:substitute`
        const cached = getCached<GraphExerciseEdge[]>(cacheKey, CACHE_TTL.relationships)
        if (cached) {
            result.set(id, cached)
        } else {
            uncachedIds.push(id)
        }
    }

    if (uncachedIds.length === 0) return result

    try {
        const supabase = await createClient()

        // Batch query: outgoing substitute edges for all uncached IDs
        const { data: outgoing, error: err1 } = await supabase
            .from('exercise_relationships')
            .select('source_exercise_id, target_exercise_id, relationship_type, weight, source')
            .in('source_exercise_id', uncachedIds)
            .eq('relationship_type', 'substitute')

        if (err1) throw err1

        // Batch query: incoming substitute edges (bidirectional)
        const { data: incoming, error: err2 } = await supabase
            .from('exercise_relationships')
            .select('source_exercise_id, target_exercise_id, relationship_type, weight, source')
            .in('target_exercise_id', uncachedIds)
            .eq('relationship_type', 'substitute')

        if (err2) throw err2

        // Collect all related IDs for name lookup
        const relatedIds = new Set<string>()
        for (const row of (outgoing || [])) relatedIds.add(row.target_exercise_id)
        for (const row of (incoming || [])) relatedIds.add(row.source_exercise_id)

        // Batch fetch names
        const nameMap = new Map<string, string>()
        if (relatedIds.size > 0) {
            const { data: exercises } = await supabase
                .from('exercises')
                .select('id, name')
                .in('id', [...relatedIds])
            for (const ex of (exercises || [])) {
                nameMap.set(ex.id, ex.name)
            }
        }

        // Group edges by source exercise
        const edgesByExercise = new Map<string, GraphExerciseEdge[]>()
        for (const id of uncachedIds) {
            edgesByExercise.set(id, [])
        }

        const seenByExercise = new Map<string, Set<string>>()
        for (const id of uncachedIds) {
            seenByExercise.set(id, new Set())
        }

        for (const row of (outgoing || [])) {
            const seen = seenByExercise.get(row.source_exercise_id)
            if (!seen || seen.has(row.target_exercise_id)) continue
            seen.add(row.target_exercise_id)

            edgesByExercise.get(row.source_exercise_id)!.push({
                exercise_id: row.target_exercise_id,
                exercise_name: nameMap.get(row.target_exercise_id) ?? '',
                relationship_type: row.relationship_type as RelationshipType,
                weight: row.weight ?? 0.5,
                source: row.source as RelationshipSource,
            })
        }

        for (const row of (incoming || [])) {
            const seen = seenByExercise.get(row.target_exercise_id)
            if (!seen || seen.has(row.source_exercise_id)) continue
            seen.add(row.source_exercise_id)

            edgesByExercise.get(row.target_exercise_id)!.push({
                exercise_id: row.source_exercise_id,
                exercise_name: nameMap.get(row.source_exercise_id) ?? '',
                relationship_type: row.relationship_type as RelationshipType,
                weight: row.weight ?? 0.5,
                source: row.source as RelationshipSource,
            })
        }

        // Sort each by weight and cache
        for (const [id, edges] of edgesByExercise) {
            edges.sort((a, b) => b.weight - a.weight)
            setCache(`relationships:${id}:substitute`, edges)
            result.set(id, edges)
        }

        return result
    } catch (err) {
        console.error('[ExerciseGraph] getSubstitutesForBatch error:', err)
        // Return empty arrays for uncached IDs
        for (const id of uncachedIds) {
            result.set(id, [])
        }
        return result
    }
}

// ============================================================================
// Diagnostics (for Phase 2 validation)
// ============================================================================

/** Returns summary statistics of the graph for diagnostic comparison */
export async function getGraphDiagnostics(): Promise<{
    relationship_count: number
    relationships_by_type: Record<string, number>
    relationships_by_source: Record<string, number>
    synergy_count: number
    condition_constraint_count: number
    constraints_by_type: Record<string, number>
    constraints_by_condition: Record<string, number>
}> {
    try {
        const supabase = await createClient()

        const [relResult, synResult, conResult] = await Promise.all([
            supabase.from('exercise_relationships').select('relationship_type, source'),
            supabase.from('exercise_synergies').select('id'),
            supabase.from('exercise_condition_constraints').select('condition_id, constraint_type'),
        ])

        const rels = relResult.data || []
        const syns = synResult.data || []
        const cons = conResult.data || []

        const relsByType: Record<string, number> = {}
        const relsBySource: Record<string, number> = {}
        for (const r of rels) {
            relsByType[r.relationship_type] = (relsByType[r.relationship_type] || 0) + 1
            relsBySource[r.source] = (relsBySource[r.source] || 0) + 1
        }

        const consByType: Record<string, number> = {}
        const consByCondition: Record<string, number> = {}
        for (const c of cons) {
            consByType[c.constraint_type] = (consByType[c.constraint_type] || 0) + 1
            consByCondition[c.condition_id] = (consByCondition[c.condition_id] || 0) + 1
        }

        return {
            relationship_count: rels.length,
            relationships_by_type: relsByType,
            relationships_by_source: relsBySource,
            synergy_count: syns.length,
            condition_constraint_count: cons.length,
            constraints_by_type: consByType,
            constraints_by_condition: consByCondition,
        }
    } catch (err) {
        console.error(`[ExerciseGraph] getGraphDiagnostics error:`, err)
        return {
            relationship_count: 0,
            relationships_by_type: {},
            relationships_by_source: {},
            synergy_count: 0,
            condition_constraint_count: 0,
            constraints_by_type: {},
            constraints_by_condition: {},
        }
    }
}
