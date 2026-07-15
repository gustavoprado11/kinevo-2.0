-- ============================================================================
-- 254: Estúdios v1 — write-gate (177) reconhece acesso herdado da org
-- ============================================================================
-- O gate RESTRICTIVE de escrita (177) exige assinatura SOLO ativa via
-- current_trainer_id_active(). Um coach de estúdio não tem assinatura solo — ele
-- herda o acesso ao núcleo pela organização (mesmo princípio do
-- hasOrgCoreAccess). Sem isto, todo INSERT/UPDATE/DELETE de um coach de estúdio
-- era barrado por trainer_active_gate_* (visto na matriz adversarial: writes
-- cruzados legítimos falhando com 42501).
--
-- Troca cirúrgica de UMA função (choke point de todos os gates de escrita):
-- devolve o trainer id quando a assinatura própria está ativa OU quando ele é
-- membro ativo de uma org com billing ativo. Só ADICIONA acesso — solo sem org
-- avalia o segundo braço como falso, comportamento inalterado.
--
-- Espelha isOrgBillingActive (web/src/lib/studio/org-access.ts): active/trialing,
-- ou past_due dentro de grace_until.
-- ============================================================================

create or replace function public.current_trainer_id_active()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
    select t.id
    from trainers t
    where t.auth_user_id = auth.uid()
      and (
        -- Solo: assinatura própria mais recente ativa.
        (
            select s.status
            from subscriptions s
            where s.trainer_id = t.id
            order by s.created_at desc
            limit 1
        ) in ('active', 'trialing')
        or
        -- Estúdio: membro ativo de org com billing ativo (acesso ao núcleo).
        exists (
            select 1
            from organization_members om
            join organizations o on o.id = om.organization_id
            where om.trainer_id = t.id
              and om.status = 'active'
              and (
                o.subscription_status in ('active', 'trialing')
                or (
                    o.subscription_status = 'past_due'
                    and o.grace_until is not null
                    and o.grace_until > now()
                )
              )
        )
      )
$$;
