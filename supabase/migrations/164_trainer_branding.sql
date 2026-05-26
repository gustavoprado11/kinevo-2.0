-- 164_trainer_branding.sql
-- Marca do estúdio (white-label leve): o personal define logo, cor e nome de
-- marca que o app do aluno aplica como camada de identidade sobre o Kinevo.
--
-- Backward compatible: só adiciona colunas com defaults seguros. Nada lê/escreve
-- até o código novo embarcar. A leitura pelo aluno já é coberta pela policy
-- "Students can view their trainer" (091_trainers_student_read_policy.sql) —
-- RLS é por linha, então as colunas novas ficam visíveis pela mesma policy.

ALTER TABLE public.trainers
    -- Nome de marca exibido no app do aluno. NULL = usa trainers.name.
    ADD COLUMN IF NOT EXISTS brand_name text,
    -- Cor primária da marca em hex (#RRGGBB). NULL = roxo Kinevo padrão (#7C3AED).
    ADD COLUMN IF NOT EXISTS brand_color text,
    -- URL pública do logo (bucket avatars). NULL = ícone Kinevo padrão.
    ADD COLUMN IF NOT EXISTS brand_logo_url text,
    -- Selo "powered by Kinevo" na tela de abertura do app do aluno.
    ADD COLUMN IF NOT EXISTS brand_show_powered_by boolean NOT NULL DEFAULT true,
    -- Flag de disponibilidade da feature. Hoje true p/ todos; quando o tier Pro
    -- existir, amarrar ao plano (sem nova migration de schema).
    ADD COLUMN IF NOT EXISTS branding_enabled boolean NOT NULL DEFAULT true;

-- Garante formato hex válido quando preenchido (NULL continua permitido).
ALTER TABLE public.trainers
    DROP CONSTRAINT IF EXISTS trainers_brand_color_hex_chk;
ALTER TABLE public.trainers
    ADD CONSTRAINT trainers_brand_color_hex_chk
    CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.trainers.brand_name IS 'Nome de marca exibido no app do aluno; NULL = usa name';
COMMENT ON COLUMN public.trainers.brand_color IS 'Cor primária da marca em hex #RRGGBB; NULL = roxo Kinevo';
COMMENT ON COLUMN public.trainers.brand_logo_url IS 'URL pública do logo da marca; NULL = ícone Kinevo';
COMMENT ON COLUMN public.trainers.brand_show_powered_by IS 'Exibe selo "powered by Kinevo" no app do aluno';
COMMENT ON COLUMN public.trainers.branding_enabled IS 'Feature de marca habilitada (futuro: amarrar ao tier Pro)';
