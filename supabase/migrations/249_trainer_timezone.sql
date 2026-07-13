-- 249: fuso horário por treinador.
--
-- O contexto do Assistente resolvia "hoje/amanhã/quinta" e a semana atual do
-- programa SEMPRE em America/Sao_Paulo (hardcoded no context-builder) — errado
-- para treinador fora desse fuso. A coluna alimenta o contexto do Assistente;
-- validação de IANA acontece no app (Intl), aqui só o default seguro.

ALTER TABLE trainers
    ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN trainers.timezone IS
    'Fuso IANA do treinador (ex.: America/Sao_Paulo). Usado pelo Assistente para "hoje/amanhã" e semana do programa. Editável em Configurações → Perfil.';
