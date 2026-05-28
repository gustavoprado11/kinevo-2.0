-- 169_trainer_landing_plans.sql
-- Planos de preço estruturados da landing pública (Fase 2).
--
-- Hoje a landing tem só `landing_price_label` (texto livre). Esta coluna
-- adiciona cards de plano de verdade: nome, preço, período, o que inclui e
-- destaque. price_label continua existindo como fallback (landing sem planos
-- estruturados mostra o texto livre).
--
-- Estrutura de cada item em landing_plans (JSONB array):
--   { name, price, period?, features: string[], highlight?: bool }
--
-- Backward compatible: ADD COLUMN com default '[]'. Landing existente não
-- muda de comportamento até o trainer cadastrar planos.

ALTER TABLE public.trainers
    ADD COLUMN IF NOT EXISTS landing_plans JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.trainers.landing_plans IS
    'Cards de plano da landing: [{ name, price, period?, features[], highlight? }]. Fallback: landing_price_label.';
