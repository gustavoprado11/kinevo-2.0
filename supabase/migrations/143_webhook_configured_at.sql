-- Sprint 2P: Auto-cadastro de webhook Asaas
-- Marca quando o webhook foi configurado na subconta do trainer. Usado pelo
-- auto-trigger silencioso na home /financial pra não bater na Asaas em
-- toda visita — só quando ainda não tá configurado.

ALTER TABLE public.trainer_payment_accounts
ADD COLUMN IF NOT EXISTS webhook_configured_at timestamptz;

COMMENT ON COLUMN public.trainer_payment_accounts.webhook_configured_at IS
'Quando o webhook Kinevo foi cadastrado na subconta Asaas. NULL = nunca rodou setup. Auto-trigger na home tenta cadastrar quando NULL e wallet aprovada.';
