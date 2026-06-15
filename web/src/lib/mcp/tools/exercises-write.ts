import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerExerciseWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_create_exercise',
    "Create a custom exercise in THIS trainer's own library (owner = the trainer), e.g. when you want to prescribe a movement that isn't in the catalog yet. Link it to muscle groups by name — existing groups (the trainer's own + Kinevo's) are matched case-insensitively; names that don't match are reported back (not created). After creating, the exercise is available to kinevo_list_exercises and the program builder.",
    {
      name: z.string().min(2).max(120).describe('Exercise name (e.g. "Agachamento búlgaro com halteres").'),
      equipment: z.string().max(80).optional().describe('Equipment used (e.g. "halteres", "barra", "peso corporal").'),
      video_url: z.string().url().optional().describe('Optional demonstration video URL.'),
      instructions: z.string().max(2000).optional().describe('Optional execution cues / instructions.'),
      muscle_groups: z.array(z.string()).optional().describe('Muscle group names to link (e.g. ["Quadríceps","Glúteos"]).'),
    },
    { title: 'Criar exercício', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ name, equipment, video_url, instructions, muscle_groups }) => {
      const supabaseAdmin = createAdminClient()

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
