import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { generateCheckoutLinkCore } from '@/actions/financial/generate-checkout-core'

export function registerBillingWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_plans',
    "List this trainer's billing plans (the products a student can be charged for). Use to pick a plan_id before generating a checkout link with kinevo_generate_checkout_link. `checkout_ready` is true only when the plan has a Stripe price configured — checkout links can only be generated for those.",
    {
      only_active: z.boolean().default(true).describe('When true (default), only active plans are returned.'),
      limit: z.number().min(1).max(50).default(30),
    },
    { title: 'Listar planos', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ only_active, limit }) => {
      const supabaseAdmin = createAdminClient()

      let query = supabaseAdmin
        .from('trainer_plans')
        .select('id, title, description, price, interval, interval_count, is_active, visibility, stripe_price_id, allow_pix, allow_credit_card, allow_boleto, max_installment_count')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (only_active) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) return mcpError(`Erro ao listar planos: ${error.message}`)

      const plans = (data ?? []).map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: Number(p.price),
        interval: p.interval,
        interval_count: p.interval_count,
        is_active: p.is_active,
        visibility: p.visibility,
        checkout_ready: p.stripe_price_id !== null,
        payment_methods: {
          pix: p.allow_pix,
          credit_card: p.allow_credit_card,
          boleto: p.allow_boleto,
          max_installments: p.max_installment_count,
        },
      }))

      return mcpSuccess({ plans, total: plans.length })
    }
  )

  server.tool(
    'kinevo_generate_checkout_link',
    "Generate a Stripe Checkout payment link to charge a student for a plan (recurring subscription). Returns a URL the trainer sends to the student to pay. This STARTS A BILLING flow — ALWAYS confirm the exact student AND plan with the trainer before calling (e.g. \"Gerar o link do plano Mensal R$199 para a Maria?\"). Pick plan_id via kinevo_list_plans (only plans with checkout_ready=true work) and student_id via kinevo_list_students. Requires the trainer to have an active Stripe Connect account.",
    {
      student_id: z.string().uuid().describe('The student to be charged (from kinevo_list_students).'),
      plan_id: z.string().uuid().describe('The plan to charge for (from kinevo_list_plans, must be checkout_ready).'),
    },
    { title: 'Gerar link de pagamento', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ student_id, plan_id }) => {
      const supabaseAdmin = createAdminClient()
      const result = await generateCheckoutLinkCore(supabaseAdmin, trainerId, {
        studentId: student_id,
        planId: plan_id,
      })

      if (!result.success) return mcpError(result.error ?? 'Erro ao gerar link de pagamento.')

      return mcpSuccess({
        checkout_url: result.url,
        message: 'Link de pagamento gerado. Envie para o aluno concluir a assinatura.',
      })
    }
  )
}
