-- 193: Secret de autenticação da edge function oura-webhook-setup.
--
-- A função aceitava POST anônimo (verify_jwt=false, sem secret) → qualquer um podia
-- disparar criação/renovação de subscriptions na Oura (abuso de quota). Achado pelo
-- security-loop (REPORT-SEGURANCA-2026-06-14).
--
-- Fonte ÚNICA na própria tabela de config do Oura (padrão do _shared/oura.ts: config
-- vive em wearable_provider_config, não em Deno.env). O valor é gerado no banco e
-- nunca sai dele: a função lê via getOuraConfig; o cron (migration 194) lê o mesmo
-- valor pra montar o header x-setup-secret.

ALTER TABLE public.wearable_provider_config
  ADD COLUMN IF NOT EXISTS setup_secret text;

UPDATE public.wearable_provider_config
  SET setup_secret = encode(gen_random_bytes(32), 'hex')
  WHERE source = 'oura'
    AND (setup_secret IS NULL OR setup_secret = '');
