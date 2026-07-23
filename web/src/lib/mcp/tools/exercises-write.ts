import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

// ----------------------------------------------------------------------------
// Guardrail: atividade aeróbia NÃO é exercício de biblioteca
// ----------------------------------------------------------------------------
// Visto em prod (jul/2026): um agente criou "Corrida — Longão / Fácil /
// Qualidade" como exercícios de FORÇA ("registrar km no campo de reps") por não
// conhecer o fluxo aeróbio. Corrida/bike/natação etc. são BLOCOS CARDIO
// (kinevo_add_cardio_to_session), com alvo estruturado, timer guiado e
// progressão semanal — nunca itens da biblioteca de exercícios.

const AEROBIC_NAME_WORDS = new Set([
  'corrida', 'correr', 'trote', 'rodagem', 'longao', 'fartlek', 'sprint',
  'caminhada', 'caminhar', 'esteira', 'bike', 'bicicleta', 'ciclismo',
  'pedalar', 'pedalada', 'spinning', 'eliptico', 'transport', 'remo', 'remar',
  'natacao', 'nadar', 'nado', 'hiit', 'cardio', 'aerobio', 'aerobico',
  'cooper', 'maratona', 'intervalado',
])

/** Nome parece atividade aeróbia? Match por PALAVRA inteira, sem acentos —
 *  "Remada curvada" não dispara ("remada" ≠ "remo"); "Corrida — Longão" sim. */
export function looksLikeAerobicActivity(name: string): boolean {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
  return words.some(w => AEROBIC_NAME_WORDS.has(w))
}

export function registerExerciseWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_create_exercise',
    "Create a custom STRENGTH exercise in THIS trainer's own library (owner = the trainer), e.g. when you want to prescribe a movement that isn't in the catalog yet. Link it to muscle groups by name — existing groups (the trainer's own + Kinevo's) are matched case-insensitively; names that don't match are reported back (not created). After creating, the exercise is available to kinevo_list_exercises and the program builder. IMPORTANT: aerobic ACTIVITIES (running, walking, bike, swimming, treadmill, rowing…) are NOT library exercises — prescribe them as cardio blocks via kinevo_add_cardio_to_session (standalone cardio sessions via session_type='cardio'), which gives the student a guided timer, structured intensity (zones/RPE/pace) and weekly progression. Names that look aerobic are rejected unless confirm_strength=true.",
    {
      name: z.string().min(2).max(120).describe('Exercise name (e.g. "Agachamento búlgaro com halteres").'),
      equipment: z.string().max(80).optional().describe('Equipment used (e.g. "halteres", "barra", "peso corporal").'),
      video_url: z.string().url().optional().describe('Optional demonstration video URL.'),
      instructions: z.string().max(2000).optional().describe('Optional execution cues / instructions.'),
      muscle_groups: z.array(z.string()).optional().describe('Muscle group names to link (e.g. ["Quadríceps","Glúteos"]).'),
      confirm_strength: z.boolean().optional().describe('Escape hatch for false positives of the aerobic-name guard: pass true ONLY when the name looks aerobic but the movement really is a strength exercise (e.g. "Corrida de trenó"/sled sprint). Never use it to create running/bike/swimming as an exercise.'),
    },
    { title: 'Criar exercício', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ name, equipment, video_url, instructions, muscle_groups, confirm_strength }) => {
      const supabaseAdmin = createAdminClient()

      // Guardrail: atividade aeróbia vira bloco cardio, não exercício.
      if (!confirm_strength && looksLikeAerobicActivity(name)) {
        return mcpError(
          `"${name}" parece uma ATIVIDADE AERÓBIA — não crie exercício de biblioteca para isso. ` +
          `O fluxo certo no Kinevo: (1) sessão aeróbia exclusiva → kinevo_add_workout_session com session_type='cardio' (ou o bloco no fim de uma sessão de força); ` +
          `(2) o bloco → kinevo_add_cardio_to_session, com modalidade (equipment: outdoor_run, treadmill, bike…), alvo de tempo OU distância, intensidade estruturada (zone Z1–Z5 / target_rpe / pace_min_per_km), fases (segments) e PROGRESSÃO SEMANAL (progression) quando o plano muda semana a semana. ` +
          `Assim o aluno executa com timer guiado e o treino aparece como aeróbio de verdade. ` +
          `Se for mesmo um exercício de FORÇA com nome parecido (ex.: "Corrida de trenó"), repita com confirm_strength=true.`
        )
      }

      // 1. Cria o exercício (mesmas colunas do modal da UI; defaults cobrem o resto).
      const { data: created, error: createError } = await supabaseAdmin
        .from('exercises')
        .insert({
          name: name.trim(),
          equipment: equipment?.trim() || null,
          video_url: video_url?.trim() || null,
          instructions: instructions?.trim() || null,
          owner_id: trainerId,
        })
        .select('id')
        .single()

      if (createError) return mcpError(`Erro ao criar exercício: ${createError.message}`)
      const exerciseId = created.id

      // 2. Resolve grupos musculares por nome (próprios do treinador + de sistema).
      const linked: string[] = []
      const unmatched: string[] = []
      if (muscle_groups && muscle_groups.length > 0) {
        const { data: groups } = await supabaseAdmin
          .from('muscle_groups')
          .select('id, name')
          .or(`owner_id.eq.${trainerId},owner_id.is.null`)

        const byLower = new Map((groups ?? []).map(g => [g.name.trim().toLowerCase(), g]))
        const relations: { exercise_id: string; muscle_group_id: string }[] = []
        const seen = new Set<string>()
        for (const raw of muscle_groups) {
          const hit = byLower.get(raw.trim().toLowerCase())
          if (hit && !seen.has(hit.id)) {
            seen.add(hit.id)
            relations.push({ exercise_id: exerciseId, muscle_group_id: hit.id })
            linked.push(hit.name)
          } else if (!hit) {
            unmatched.push(raw)
          }
        }
        if (relations.length > 0) {
          const { error: linkError } = await supabaseAdmin
            .from('exercise_muscle_groups')
            .insert(relations)
          if (linkError) return mcpError(`Exercício criado (${exerciseId}) mas falha ao vincular grupos: ${linkError.message}`)
        }
      }

      return mcpSuccess({
        exercise_id: exerciseId,
        name: name.trim(),
        linked_muscle_groups: linked,
        unmatched_muscle_groups: unmatched,
        message: `Exercício "${name.trim()}" criado na biblioteca do treinador${linked.length ? ` e vinculado a ${linked.join(', ')}` : ''}.${unmatched.length ? ` Grupos não encontrados (ignorados): ${unmatched.join(', ')}.` : ''}`,
      })
    }
  )
}
