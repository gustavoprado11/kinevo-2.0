import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { generateCheckoutLinkCore } from '@/actions/financial/generate-checkout-core'
import { createPlanCore, updatePlanCore } from '@/actions/financial/plans-core'
import { createContractCore, markAsPaidCore, cancelContractCore } from '@/actions/financial/contracts-core'

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

  // ==========================================================================
  // GESTÃO DE PLANOS (sem mexer em dinheiro de aluno)
  // ==========================================================================
  server.tool(
    'kinevo_create_plan',
    "Create a billing plan (a product students can subscribe to). When with_online_payment=true and the trainer has Stripe Connect active, a Stripe Product/Price is also created so the plan can generate online checkout links; otherwise the plan is manual-billing only. Does NOT charge anyone.",
    {
      title: z.string().min(2).max(120),
      price: z.number().min(0).describe('Price in BRL (e.g. 199.90).'),
      interval: z.enum(['month', 'quarter', 'year']).describe('Billing interval.'),
      description: z.string().max(500).optional(),
      visibility: z.enum(['public', 'private']).default('public'),
      with_online_payment: z.boolean().default(true).describe('Create a Stripe price for online checkout (needs Stripe Connect active).'),
      allow_pix: z.boolean().optional(),
      allow_credit_card: z.boolean().optional(),
      allow_boleto: z.boolean().optional(),
      max_installment_count: z.number().int().min(1).max(12).optional(),
    },
    { title: 'Criar plano', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ title, price, interval, description, visibility, with_online_payment, allow_pix, allow_credit_card, allow_boleto, max_installment_count }) => {
      const supabaseAdmin = createAdminClient()
      const result = await createPlanCore(supabaseAdmin, trainerId, {
        title, price, interval,
        description: description ?? '',
        visibility,
        hasStripeConnect: with_online_payment,
        allowPix: allow_pix,
        allowCreditCard: allow_credit_card,
        allowBoleto: allow_boleto,
        maxInstallmentCount: max_installment_count,
      })
      if (result.error) return mcpError(result.error)
      return mcpSuccess({ plan_id: result.planId, message: `Plano "${title}" criado.` })
    }
  )

  server.tool(
    'kinevo_update_plan',
    "Update an existing plan. Only the fields you pass are changed (the rest keep their current values). Changing price/interval on a plan with online payment archives the old Stripe price and creates a new one — existing subscriptions keep the old price. Does NOT charge anyone.",
    {
      plan_id: z.string().uuid().describe('The plan to update (from kinevo_list_plans).'),
      title: z.string().min(2).max(120).optional(),
      price: z.number().min(0).optional(),
      interval: z.enum(['month', 'quarter', 'year']).optional(),
      description: z.string().max(500).optional(),
      visibility: z.enum(['public', 'private']).optional(),
      allow_pix: z.boolean().optional(),
      allow_credit_card: z.boolean().optional(),
      allow_boleto: z.boolean().optional(),
      max_installment_count: z.number().int().min(1).max(12).optional(),
    },
    { title: 'Atualizar plano', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ plan_id, title, price, interval, description, visibility, allow_pix, allow_credit_card, allow_boleto, max_installment_count }) => {
      const supabaseAdmin = createAdminClient()

      // Mescla sobre os valores atuais para não sobrescrever campos não informados.
      const { data: current } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, trainer_id, title, price, interval, description, visibility, allow_pix, allow_credit_card, allow_boleto, max_installment_count')
        .eq('id', plan_id)
        .single()
      if (!current || current.trainer_id !== trainerId) return mcpError('Plano não encontrado.')

      const result = await updatePlanCore(supabaseAdmin, trainerId, {
        planId: plan_id,
        title: title ?? current.title,
        price: price ?? Number(current.price),
        interval: interval ?? (current.interval ?? 'month'),
        description: description ?? (current.description ?? ''),
        visibility: visibility ?? (current.visibility ?? 'public'),
        allowPix: allow_pix ?? current.allow_pix,
        allowCreditCard: allow_credit_card ?? current.allow_credit_card,
        allowBoleto: allow_boleto ?? current.allow_boleto,
        maxInstallmentCount: max_installment_count ?? current.max_installment_count,
      })
      if (result.error) return mcpError(result.error)
      return mcpSuccess({ plan_id, message: 'Plano atualizado.' })
    }
  )

  // ==========================================================================
  // CONTRATOS / COBRANÇA — gate confirm=true (preview antes de executar)
  // ==========================================================================
  server.tool(
    'kinevo_create_contract',
    "Set up a MANUAL billing contract linking a student to a plan (or courtesy/free access). This CANCELS the student's current active contract and creates the new one. It does NOT charge the student — it just records the billing arrangement. Call WITHOUT confirm first to get a preview of exactly what will happen, then call again with confirm=true only after the trainer approved.",
    {
      student_id: z.string().uuid().describe('The student (from kinevo_list_students).'),
      plan_id: z.string().uuid().nullable().optional().describe('The plan (from kinevo_list_plans). Null only for courtesy.'),
      billing_type: z.enum(['manual_recurring', 'manual_one_off', 'courtesy']).describe('manual_recurring = renova; manual_one_off = período único; courtesy = acesso gratuito.'),
      block_on_fail: z.boolean().default(true).describe('Block student access on payment failure (ignored for courtesy).'),
      confirm: z.boolean().default(false).describe('Set true ONLY after the trainer explicitly approved. Without it, returns a preview and does nothing.'),
    },
    { title: 'Criar contrato', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ student_id, plan_id, billing_type, block_on_fail, confirm }) => {
      const supabaseAdmin = createAdminClient()

      const { data: student } = await supabaseAdmin
        .from('students').select('id, name, coach_id').eq('id', student_id).single()
      if (!student || student.coach_id !== trainerId) return mcpError('Aluno não encontrado.')

      let planLabel = 'Acesso gratuito'
      if (plan_id) {
        const { data: plan } = await supabaseAdmin
          .from('trainer_plans').select('title, price, interval, trainer_id').eq('id', plan_id).single()
        if (!plan || plan.trainer_id !== trainerId) return mcpError('Plano não encontrado.')
        planLabel = `${plan.title} (R$${Number(plan.price)}/${plan.interval})`
      } else if (billing_type !== 'courtesy') {
        return mcpError('billing_type não-courtesy exige plan_id.')
      }

      if (!confirm) {
        return mcpSuccess({
          preview: true,
          action: 'create_contract',
          message: `PRÉ-VISUALIZAÇÃO (nada foi alterado). Isto vai CANCELAR o contrato ativo atual de ${student.name} e criar um contrato ${billing_type} no plano ${planLabel}. Confirme com o treinador e chame de novo com confirm=true.`,
        })
      }

      const result = await createContractCore(supabaseAdmin, trainerId, {
        studentId: student_id,
        planId: plan_id ?? null,
        billingType: billing_type,
        blockOnFail: block_on_fail,
      })
      if (result.error) return mcpError(result.error)
      return mcpSuccess({ contract_id: result.contractId, message: `Contrato ${billing_type} criado para ${student.name} (${planLabel}).` })
    }
  )

  server.tool(
    'kinevo_mark_payment_as_paid',
    "Record a MANUAL payment on a contract: marks it active, records the revenue (financial_transactions) and renews the period for recurring plans. Use when a student paid you outside the app (cash, PIX, etc). Call WITHOUT confirm first to preview the exact amount; call again with confirm=true only after the trainer approved. Beware: calling twice records the income twice.",
    {
      contract_id: z.string().uuid().describe('The contract to mark paid (from kinevo_list_subscriptions).'),
      confirm: z.boolean().default(false).describe('Set true ONLY after the trainer approved the amount. Without it, returns a preview and does nothing.'),
    },
    { title: 'Registrar pagamento', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ contract_id, confirm }) => {
      const supabaseAdmin = createAdminClient()

      const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, trainer_id, amount, billing_type, students(name)')
        .eq('id', contract_id).single()
      if (!contract || contract.trainer_id !== trainerId) return mcpError('Contrato não encontrado.')

      const studentName = (contract.students as unknown as { name: string } | null)?.name ?? 'aluno'

      if (!confirm) {
        return mcpSuccess({
          preview: true,
          action: 'mark_payment_as_paid',
          message: `PRÉ-VISUALIZAÇÃO (nada foi registrado). Isto vai registrar R$${Number(contract.amount)} como recebido de ${studentName}${contract.billing_type === 'manual_recurring' ? ' e renovar o período' : ''}. Confirme com o treinador e chame de novo com confirm=true.`,
        })
      }

      const result = await markAsPaidCore(supabaseAdmin, trainerId, { contractId: contract_id })
      if (result.error) return mcpError(result.error)
      return mcpSuccess({ message: `Pagamento de R$${Number(contract.amount)} registrado para ${studentName}.` })
    }
  )

  server.tool(
    'kinevo_cancel_contract',
    "Cancel a student's contract. For online (Stripe/Asaas) contracts this also cancels the subscription at the provider. cancel_at_period_end=true schedules the cancellation for the end of the paid period (student keeps access until then); false cancels IMMEDIATELY (access is revoked now). HIGH IMPACT and hard to undo. Call WITHOUT confirm first to preview; call again with confirm=true only after the trainer approved.",
    {
      contract_id: z.string().uuid().describe('The contract to cancel (from kinevo_list_subscriptions).'),
      cancel_at_period_end: z.boolean().default(false).describe('true = cancel at end of period (keep access until then); false = cancel now.'),
      confirm: z.boolean().default(false).describe('Set true ONLY after the trainer explicitly approved. Without it, returns a preview and does nothing.'),
    },
    { title: 'Cancelar contrato', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ contract_id, cancel_at_period_end, confirm }) => {
      const supabaseAdmin = createAdminClient()

      const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, trainer_id, billing_type, students(name)')
        .eq('id', contract_id).single()
      if (!contract || contract.trainer_id !== trainerId) return mcpError('Contrato não encontrado.')

      const studentName = (contract.students as unknown as { name: string } | null)?.name ?? 'aluno'

      if (!confirm) {
        return mcpSuccess({
          preview: true,
          action: 'cancel_contract',
          message: `PRÉ-VISUALIZAÇÃO (nada foi cancelado). Isto vai cancelar o contrato de ${studentName}${cancel_at_period_end ? ' AO FIM DO PERÍODO (mantém acesso até lá)' : ' IMEDIATAMENTE (revoga o acesso agora)'}${contract.billing_type === 'stripe_auto' || contract.billing_type === 'asaas_auto_recurring' ? ' e a assinatura no provedor de pagamento' : ''}. Confirme com o treinador e chame de novo com confirm=true.`,
        })
      }

      const result = await cancelContractCore(supabaseAdmin, trainerId, { contractId: contract_id, cancelAtPeriodEnd: cancel_at_period_end })
      if (result.error) return mcpError(result.error)
      return mcpSuccess({
        message: result.scheduledCancellation
          ? `Cancelamento agendado para o fim do período (${studentName} mantém acesso até lá).`
          : `Contrato de ${studentName} cancelado.`,
      })
    }
  )
}
