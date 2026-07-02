import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { buildComputedMetricsFromSchema, SUBJECT_SEX_KEY, SUBJECT_AGE_KEY } from '@/lib/assessment-computed'
import type {
  MeasurementInput,
  AssessmentTemplateSchema,
} from '@kinevo/shared/types/assessments'

const MEASUREMENT_UNITS = ['kg', 'g', 'cm', 'mm', 'm', '%', 's', 'ms', 'reps', 'rpm', 'w', 'kg/m²'] as const
const MEASUREMENT_SIDES = ['left', 'right', 'both', 'unilateral'] as const

const measurementSchema = z.object({
  metric_key: z.string().describe('Chave da métrica do template (ex.: "weight", "waist", "skinfold_triceps").'),
  value_numeric: z.number().nullable().optional().describe('Valor numérico (peso, circunferência, dobra...).'),
  value_text: z.string().nullable().optional().describe('Valor textual, quando a métrica não é numérica.'),
  value_unit: z.enum(MEASUREMENT_UNITS).nullable().optional(),
  side: z.enum(MEASUREMENT_SIDES).nullable().optional().describe('Lateralidade, para medidas bilaterais.'),
  attempt_number: z.number().int().min(1).optional().describe('Nº da tentativa (default 1).'),
  is_selected: z.boolean().optional().describe('Se esta é a tentativa válida (default true).'),
})

export function registerAssessmentTools(server: McpServer, trainerId: string) {
  // --------------------------------------------------------------------------
  // READ — histórico/evolução
  // --------------------------------------------------------------------------
  server.tool(
    'kinevo_get_assessments',
    "Read a student's physical assessment sessions (anthropometry: weight, circumferences, skinfolds, body fat, BMI). Pass session_id to get one full session with all measurements and computed metrics; otherwise lists the trainer's sessions (optionally filtered by student or status). Use for \"how is the student's body composition evolving?\".",
    {
      session_id: z.string().uuid().optional().describe('When set, returns this single session in full (measurements + computed metrics).'),
      student_id: z.string().uuid().optional().describe('Filter the list to one student.'),
      status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
      limit: z.number().min(1).max(100).default(30),
    },
    { title: 'Ver avaliações físicas', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ session_id, student_id, status, limit }) => {
      const supabaseAdmin = createAdminClient()

      if (session_id) {
        const { data, error } = await supabaseAdmin.rpc('get_assessment_session' as never, {
          p_trainer_id: trainerId,
          p_session_id: session_id,
        } as never)
        if (error) return mcpError(`Erro ao buscar avaliação: ${error.message}`)
        return mcpSuccess({ session: data })
      }

      const { data, error } = await supabaseAdmin.rpc('get_assessment_sessions' as never, {
        p_trainer_id: trainerId,
        p_student_id: student_id ?? null,
        p_status: status ?? null,
        p_limit: limit,
      } as never)
      if (error) return mcpError(`Erro ao listar avaliações: ${error.message}`)

      const sessions = (data as unknown as unknown[]) ?? []
      return mcpSuccess({ sessions, total: sessions.length })
    }
  )

  // --------------------------------------------------------------------------
  // WRITE — abrir sessão
  // --------------------------------------------------------------------------
  server.tool(
    'kinevo_create_assessment_session',
    "Open a physical assessment session for a student. Pick template_id via kinevo_list_form_templates with category='assessment'. Returns session_id — then record data with kinevo_save_assessment_measurements and close with kinevo_finalize_assessment. Omit scheduled_at to start an assessment right now (in_progress); set it to schedule for later.",
    {
      student_id: z.string().uuid().describe('The student being assessed (from kinevo_list_students).'),
      template_id: z.string().uuid().describe("An assessment template (kinevo_list_form_templates, category='assessment')."),
      scheduled_at: z.string().optional().describe('Optional ISO 8601 date/time to schedule for later. Omit to start now.'),
      notes: z.string().max(1000).optional(),
      subject_sex: z.enum(['male', 'female']).optional().describe('Subject sex — needed by body-fat protocols (Jackson & Pollock etc).'),
      subject_age_years: z.number().int().min(5).max(120).optional().describe('Subject age in years — needed by body-fat protocols.'),
    },
    { title: 'Abrir avaliação física', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ student_id, template_id, scheduled_at, notes, subject_sex, subject_age_years }) => {
      const supabaseAdmin = createAdminClient()

      const { data, error } = await supabaseAdmin.rpc('create_assessment_session' as never, {
        p_trainer_id: trainerId,
        p_student_id: student_id,
        p_template_id: template_id,
        p_scheduled_at: scheduled_at ?? null,
        p_notes: notes ?? null,
      } as never)
      if (error) return mcpError(`Erro ao abrir avaliação: ${error.message}`)

      const sessionId = data as unknown as string

      // Contexto do sujeito (sexo/idade) entra como measurements — necessário
      // para os protocolos de % de gordura. Mesma lógica da action web.
      const subjectMeasurements: MeasurementInput[] = []
      if (subject_sex) {
        subjectMeasurements.push({ metric_key: SUBJECT_SEX_KEY, value_text: subject_sex, is_selected: true })
      }
      if (subject_age_years != null) {
        subjectMeasurements.push({ metric_key: SUBJECT_AGE_KEY, value_numeric: subject_age_years, is_selected: true })
      }
      if (subjectMeasurements.length > 0) {
        const { error: mErr } = await supabaseAdmin.rpc('save_assessment_measurements' as never, {
          p_trainer_id: trainerId,
          p_session_id: sessionId,
          p_measurements: subjectMeasurements,
        } as never)
        if (mErr) return mcpError(`Avaliação criada mas contexto não salvo: ${mErr.message}`)
      }

      return mcpSuccess({
        session_id: sessionId,
        message: 'Avaliação aberta. Registre as medidas com kinevo_save_assessment_measurements e feche com kinevo_finalize_assessment.',
      })
    }
  )

  // --------------------------------------------------------------------------
  // WRITE — registrar medidas
  // --------------------------------------------------------------------------
  server.tool(
    'kinevo_save_assessment_measurements',
    'Record measurements into an open assessment session (weight, circumferences, skinfolds, etc). Metric keys come from the session template. Can be called multiple times; only works while the session is scheduled or in_progress.',
    {
      session_id: z.string().uuid().describe('The open session (from kinevo_create_assessment_session).'),
      measurements: z.array(measurementSchema).min(1).describe('One or more measurements to save.'),
    },
    { title: 'Registrar medidas', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ session_id, measurements }) => {
      const supabaseAdmin = createAdminClient()
      const { data, error } = await supabaseAdmin.rpc('save_assessment_measurements' as never, {
        p_trainer_id: trainerId,
        p_session_id: session_id,
        p_measurements: measurements,
      } as never)
      if (error) return mcpError(`Erro ao salvar medidas: ${error.message}`)

      return mcpSuccess({ saved_count: (data as unknown as number) ?? 0 })
    }
  )

  // --------------------------------------------------------------------------
  // WRITE — finalizar (calcula métricas + notifica o aluno)
  // --------------------------------------------------------------------------
  server.tool(
    'kinevo_finalize_assessment',
    'Finalize an assessment: computes the derived metrics (BMI, body-fat %, lean/fat mass, WHR) from the saved measurements using the template protocol, marks it completed, and notifies the student (inbox). This shares the results WITH THE STUDENT — confirm with the trainer before finalizing. Cannot be undone.',
    {
      session_id: z.string().uuid().describe('The session to finalize (must have its measurements already saved).'),
      notes: z.string().max(1000).optional(),
    },
    { title: 'Finalizar avaliação', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ session_id, notes }) => {
      const supabaseAdmin = createAdminClient()

      // Busca a sessão (snapshot do template + medidas) e recalcula as métricas
      // com o MESMO motor da UI, garantindo paridade.
      const { data: sessionData, error: fetchErr } = await supabaseAdmin.rpc('get_assessment_session' as never, {
        p_trainer_id: trainerId,
        p_session_id: session_id,
      } as never)
      if (fetchErr) return mcpError(`Erro ao carregar avaliação: ${fetchErr.message}`)

      const payload = sessionData as unknown as {
        session?: { template_snapshot?: AssessmentTemplateSchema | null }
        measurements?: MeasurementInput[]
      } | null

      const schema = payload?.session?.template_snapshot ?? null
      const measurements = payload?.measurements ?? []
      const computedMetrics = buildComputedMetricsFromSchema(schema, measurements)

      const { data, error } = await supabaseAdmin.rpc('finalize_assessment_session' as never, {
        p_trainer_id: trainerId,
        p_session_id: session_id,
        p_computed_metrics: computedMetrics,
        p_notes: notes ?? null,
      } as never)
      if (error) return mcpError(`Erro ao finalizar avaliação: ${error.message}`)

      return mcpSuccess({
        result: data,
        computed_metrics: computedMetrics,
        message: 'Avaliação finalizada e compartilhada com o aluno.',
      })
    }
  )

  // --------------------------------------------------------------------------
  // WRITE — corrigir uma avaliação JÁ finalizada (Onda 5)
  // --------------------------------------------------------------------------
  server.tool(
    'kinevo_correct_assessment',
    "Correct measurements of an assessment that was ALREADY finalized (status completed) — e.g. a typo in weight or a skinfold. Records each corrected value as a new SELECTED attempt (the original stays in history, unselected), recomputes the derived metrics (BMI, body-fat %, lean/fat mass, WHR) with the same engine as finalization, and updates the results already shared with the student (no new notification). For sessions still open use kinevo_save_assessment_measurements. Without confirm=true it returns a PREVIEW of the current vs corrected values.",
    {
      session_id: z.string().uuid().describe('The COMPLETED assessment session to correct (from kinevo_get_assessments).'),
      measurements: z.array(measurementSchema).min(1)
        .describe('The corrected measurements. Each replaces the currently selected value of the same metric_key (+side).'),
      notes: z.string().max(1000).optional().describe('Optional note about the correction, appended to the session notes.'),
      confirm: z.boolean().default(false)
        .describe('Set true ONLY after the trainer explicitly confirmed the correction.'),
    },
    { title: 'Corrigir avaliação finalizada', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ session_id, measurements, notes, confirm }) => {
      const supabaseAdmin = createAdminClient()

      // Carrega a sessão pelo MESMO RPC das demais tools (valida posse).
      const { data: sessionData, error: fetchErr } = await supabaseAdmin.rpc('get_assessment_session' as never, {
        p_trainer_id: trainerId,
        p_session_id: session_id,
      } as never)
      if (fetchErr) return mcpError(`Erro ao carregar avaliação: ${fetchErr.message}`)

      const payload = sessionData as unknown as {
        session?: { id?: string; status?: string; notes?: string | null; template_snapshot?: AssessmentTemplateSchema | null }
        measurements?: Array<MeasurementInput & { side?: string | null; attempt_number?: number | null; is_selected?: boolean | null }>
      } | null
      if (!payload?.session?.id) return mcpError('Avaliação não encontrada ou não pertence a este treinador.')
      if (payload.session.status !== 'completed') {
        return mcpError(
          `Esta sessão está "${payload.session.status}". kinevo_correct_assessment é só para sessões FINALIZADAS — para sessões abertas use kinevo_save_assessment_measurements.`,
        )
      }

      const existing = payload.measurements ?? []
      const selectedFor = (key: string, side: string | null | undefined) =>
        existing.find(
          (m) => m.metric_key === key && (m.side ?? null) === (side ?? null) && (m.is_selected ?? true),
        )

      if (!confirm) {
        const changes = measurements.map((m) => {
          const cur = selectedFor(m.metric_key, m.side)
          return {
            metric_key: m.metric_key,
            side: m.side ?? null,
            current_value: cur?.value_numeric ?? cur?.value_text ?? null,
            corrected_value: m.value_numeric ?? m.value_text ?? null,
          }
        })
        return mcpSuccess({
          preview: true,
          changes,
          message: 'PRÉ-VISUALIZAÇÃO — nada foi alterado. Confira os valores atuais vs corrigidos com o treinador e repita com confirm=true.',
        })
      }

      // Correção: desmarca a(s) tentativa(s) selecionada(s) da métrica e insere a
      // corrigida como nova tentativa selecionada — preserva o histórico.
      for (const m of measurements) {
        let unselect = supabaseAdmin
          .from('assessment_measurements')
          .update({ is_selected: false })
          .eq('session_id', session_id)
          .eq('metric_key', m.metric_key)
        unselect = m.side ? unselect.eq('side', m.side) : unselect.is('side', null)
        const { error: unselErr } = await unselect
        if (unselErr) return mcpError(`Erro ao corrigir ${m.metric_key}: ${unselErr.message}`)

        const attempts = existing
          .filter((e) => e.metric_key === m.metric_key && (e.side ?? null) === (m.side ?? null))
          .map((e) => e.attempt_number ?? 1)
        const nextAttempt = attempts.length > 0 ? Math.max(...attempts) + 1 : 1

        const { error: insErr } = await supabaseAdmin.from('assessment_measurements').insert({
          session_id,
          metric_key: m.metric_key,
          value_numeric: m.value_numeric ?? null,
          value_text: m.value_text ?? null,
          value_unit: m.value_unit ?? null,
          side: m.side ?? null,
          attempt_number: nextAttempt,
          is_selected: true,
        })
        if (insErr) return mcpError(`Erro ao gravar correção de ${m.metric_key}: ${insErr.message}`)
      }

      // Recalcula as métricas derivadas com o estado FRESCO (mesmo motor do finalize).
      const { data: freshData, error: freshErr } = await supabaseAdmin.rpc('get_assessment_session' as never, {
        p_trainer_id: trainerId,
        p_session_id: session_id,
      } as never)
      if (freshErr) return mcpError(`Correções gravadas, mas falhou ao recarregar: ${freshErr.message}`)
      const fresh = freshData as unknown as {
        session?: { template_snapshot?: AssessmentTemplateSchema | null }
        measurements?: MeasurementInput[]
      } | null
      const computedMetrics = buildComputedMetricsFromSchema(
        fresh?.session?.template_snapshot ?? null,
        fresh?.measurements ?? [],
      )

      const newNotes = notes
        ? `${payload.session.notes ? `${payload.session.notes}\n` : ''}[Correção] ${notes}`
        : undefined
      const { error: updErr } = await supabaseAdmin
        .from('assessment_sessions')
        .update({
          computed_metrics: computedMetrics,
          ...(newNotes !== undefined ? { notes: newNotes } : {}),
        })
        .eq('id', session_id)
        .eq('trainer_id', trainerId)
      if (updErr) return mcpError(`Correções gravadas, mas falhou ao atualizar métricas: ${updErr.message}`)

      return mcpSuccess({
        corrected: measurements.map((m) => m.metric_key),
        computed_metrics: computedMetrics,
        message: `Avaliação corrigida (${measurements.length} medida(s)) e métricas recalculadas. Os resultados compartilhados com o aluno já refletem a correção.`,
      })
    }
  )
}
