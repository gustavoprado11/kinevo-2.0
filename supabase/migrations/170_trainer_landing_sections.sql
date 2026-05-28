-- 170_trainer_landing_sections.sql
-- Visibilidade de seções da landing pública (Fase 3).
--
-- O trainer pode ligar/desligar seções não-essenciais da landing. Guardado
-- como mapa { [key]: boolean }. Semântica: chave ausente ou true = visível;
-- só `false` esconde. Hero, formulário e footer não são togláveis.
--
-- Keys: credenciais, metodo, app, depoimentos, processo, planos, faq.
--
-- Backward compatible: ADD COLUMN default '{}' → landing existente mostra
-- tudo (nenhuma chave = nada escondido).

ALTER TABLE public.trainers
    ADD COLUMN IF NOT EXISTS landing_sections JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trainers.landing_sections IS
    'Visibilidade de seções da landing: { key: bool }. Ausente/true = visível. Keys: credenciais, metodo, app, depoimentos, processo, planos, faq.';
