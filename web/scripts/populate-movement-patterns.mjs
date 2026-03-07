/**
 * Sprint 2A — Populate movement_pattern for all exercises.
 * Run AFTER migration 061.
 * Usage: cd web && node scripts/populate-movement-patterns.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ============================================================================
// Inference Rules (cascade order — first match wins)
// ============================================================================

const RULES = [
  {
    pattern: 'squat',
    nameMatchers: [
      /agachamento/i, /leg\s*press/i, /hack/i,
      /squat/i, /cadeira\s*(?:45|90)/i,
    ],
    muscleGroupRequired: ['Quadríceps', 'Glúteo'],
  },
  {
    pattern: 'hinge',
    nameMatchers: [
      /stiff/i, /terra/i, /deadlift/i, /bom\s*dia/i, /good\s*morning/i,
      /eleva[çc][aã]o\s*(?:de\s*)?quadril/i, /hip\s*thrust/i,
      /ponte/i, /bridge/i, /gl[úu]teo\s*(?:na|no|com)/i,
    ],
    muscleGroupRequired: ['Posterior de Coxa', 'Glúteo'],
  },
  {
    pattern: 'lunge',
    nameMatchers: [
      /afundo/i, /lunge/i, /passada/i, /b[úu]lgaro/i, /bulgarian/i,
      /avan[çc]o/i, /step[\s-]*up/i, /subida/i,
    ],
  },
  {
    pattern: 'push_h',
    nameMatchers: [
      /supino/i, /bench\s*press/i, /flex[aã]o\s*(?:de\s*)?bra[çc]o/i,
      /push[\s-]*up/i, /crossover/i, /crucifixo/i, /fly/i,
      /peck[\s-]*deck/i, /voador/i,
    ],
    muscleGroupRequired: ['Peito'],
  },
  {
    pattern: 'push_v',
    nameMatchers: [
      /desenvolvimento/i, /shoulder\s*press/i, /militar/i,
      /arnold/i, /eleva[çc][aã]o\s*frontal/i,
    ],
    muscleGroupRequired: ['Ombros'],
    nameExclude: [/lateral/i],
  },
  {
    pattern: 'pull_v',
    nameMatchers: [
      /puxada/i, /pulldown/i, /lat[\s-]*pull/i, /barra\s*fixa/i,
      /chin[\s-]*up/i, /pull[\s-]*up/i, /graviton/i,
      /pulley/i, /pullover/i,
    ],
    muscleGroupRequired: ['Costas'],
    nameExclude: [/remada/i, /row/i],
  },
  {
    pattern: 'pull_h',
    nameMatchers: [
      /remada/i, /row/i, /serrote/i, /cavaleiro/i,
    ],
    muscleGroupRequired: ['Costas'],
  },
  {
    pattern: 'core',
    nameMatchers: [
      /prancha/i, /plank/i, /abdominal/i, /crunch/i,
      /infra/i, /supra/i, /obl[ií]quo/i, /pallof/i,
      /rolo/i, /ab[\s-]*wheel/i,
    ],
    muscleGroupRequired: ['Abdominais', 'Oblíquos'],
  },
  {
    pattern: 'isolation',
    nameMatchers: [
      /rosca/i, /curl/i, /extens[aã]o/i, /tr[ií]ceps/i,
      /eleva[çc][aã]o\s*lateral/i, /panturrilha/i, /g[êe]meos/i,
      /s[oó]leo/i, /abdu[çc][aã]o/i, /adu[çc][aã]o/i,
      /flexora/i, /extensora/i, /mesa/i, /cadeira/i,
      /face[\s-]*pull/i, /encolhimento/i, /shrug/i,
      /antebraço/i, /wrist/i, /remada\s*alta/i,
      /eleva[çc][aã]o\s*(?:de\s*)?(?:pernas|calcanhares)/i,
    ],
  },
]

function inferMovementPattern(name, muscleGroups) {
  for (const rule of RULES) {
    const nameMatch = rule.nameMatchers.some(r => r.test(name))
    if (!nameMatch) continue

    if (rule.nameExclude?.some(r => r.test(name))) continue

    if (rule.muscleGroupRequired) {
      const hasGroup = rule.muscleGroupRequired.some(g => muscleGroups.includes(g))
      if (!hasGroup) continue
    }

    return rule.pattern
  }

  // Fallback
  return 'isolation'
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Fetching all active exercises...')

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select(`
      id, name,
      exercise_muscle_groups (
        muscle_groups ( name )
      )
    `)
    .eq('is_archived', false)

  if (error) {
    console.error('Failed to fetch exercises:', error)
    process.exit(1)
  }

  console.log(`Found ${exercises.length} active exercises`)

  // Infer patterns
  const updates = []
  const distribution = {}

  for (const ex of exercises) {
    const muscleGroups = (ex.exercise_muscle_groups || [])
      .map(emg => emg.muscle_groups?.name)
      .filter(Boolean)

    const pattern = inferMovementPattern(ex.name, muscleGroups)
    distribution[pattern] = (distribution[pattern] || 0) + 1
    updates.push({ id: ex.id, name: ex.name, pattern, muscleGroups })
  }

  // Log distribution
  console.log('\n=== DISTRIBUTION ===')
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  for (const [pattern, count] of sorted) {
    console.log(`  ${pattern}: ${count}`)
  }
  console.log(`  TOTAL: ${exercises.length}`)

  // Log some examples per pattern
  console.log('\n=== EXAMPLES (3 per pattern) ===')
  for (const pattern of ['squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v', 'core', 'isolation']) {
    const examples = updates.filter(u => u.pattern === pattern).slice(0, 3)
    console.log(`\n${pattern}:`)
    for (const ex of examples) {
      console.log(`  - ${ex.name} [${ex.muscleGroups.join(', ')}]`)
    }
  }

  // Apply updates in batches
  console.log('\n=== APPLYING UPDATES ===')
  let updated = 0
  let errors = 0

  // Batch by pattern for efficiency
  for (const [pattern, _count] of sorted) {
    const ids = updates.filter(u => u.pattern === pattern).map(u => u.id)

    const { error: updateError } = await supabase
      .from('exercises')
      .update({ movement_pattern: pattern })
      .in('id', ids)

    if (updateError) {
      console.error(`Failed to update ${pattern}:`, updateError.message)
      errors += ids.length
    } else {
      updated += ids.length
      console.log(`  ${pattern}: ${ids.length} updated`)
    }
  }

  console.log(`\nDone: ${updated} updated, ${errors} errors`)

  // Verify: count NULLs
  const { count } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('is_archived', false)
    .is('movement_pattern', null)

  console.log(`NULL movement_pattern remaining: ${count}`)
}

main().catch(console.error)
