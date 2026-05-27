-- 167_trainer_landing_fields.sql
-- Campos da landing pública do trainer em public.trainers.
--
-- Junto com 164 (marca) e 166 (leads), forma o trio da captação:
--   164  → identidade visual (logo + cor + nome)
--   166  → leads recebidos
--   167  → conteúdo + URL pública (este arquivo)
--
-- Backward compatible: só ADD COLUMN com defaults seguros. Trainer
-- existente continua funcionando — landing fica como rascunho até o
-- trainer entrar em /settings e configurar.
--
-- A policy de leitura pública (anon role) NÃO é criada aqui de propósito —
-- ela só faz sentido com a página pública (M2) e exige cuidado de coluna.
-- Será adicionada na migration que ship com /com/[slug].

ALTER TABLE public.trainers
    -- URL: kinevoapp.com/com/<public_slug>. Unique p/ evitar colisão.
    -- Validado pela CHECK abaixo: a-z, 0-9, hífen; min 3 max 40 chars.
    ADD COLUMN IF NOT EXISTS public_slug             TEXT UNIQUE,

    -- Toggle publish/draft. Default false: trainer precisa publicar
    -- explicitamente.
    ADD COLUMN IF NOT EXISTS landing_published       BOOLEAN NOT NULL DEFAULT false,

    -- Conteúdo editorial. Defaults vêm do trainer (name, etc) quando NULL.
    ADD COLUMN IF NOT EXISTS landing_headline        TEXT,
    ADD COLUMN IF NOT EXISTS landing_subheadline     TEXT,
    ADD COLUMN IF NOT EXISTS landing_bio             TEXT,
    ADD COLUMN IF NOT EXISTS landing_city            TEXT,
    ADD COLUMN IF NOT EXISTS landing_cref            TEXT,
    ADD COLUMN IF NOT EXISTS landing_certifications  TEXT[],
    ADD COLUMN IF NOT EXISTS landing_specializations TEXT[],
    ADD COLUMN IF NOT EXISTS landing_year_started    INT,

    -- Stats/depoimentos/FAQ como JSONB pra flexibilidade.
    -- landing_stats:        { students_count: int, rating: number, reviews_count: int }
    -- landing_testimonials: [{ name, photo_url, quote, role, goal }]
    -- landing_faq:          [{ question, answer }]
    ADD COLUMN IF NOT EXISTS landing_stats           JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS landing_testimonials    JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS landing_faq             JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Plano/preço.
    ADD COLUMN IF NOT EXISTS landing_price_label     TEXT,

    -- Foto hero (override opcional do avatar p/ a landing).
    ADD COLUMN IF NOT EXISTS landing_hero_image_url  TEXT;

-- Slug: lowercase a-z, dígitos, hífen interno; precisa começar e terminar
-- com alfanumérico; mínimo 3, máximo 40 chars.
ALTER TABLE public.trainers
    DROP CONSTRAINT IF EXISTS trainers_public_slug_format_chk;

ALTER TABLE public.trainers
    ADD CONSTRAINT trainers_public_slug_format_chk
    CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');

-- Índice extra p/ lookup por slug (UNIQUE já cria, mas explicito p/ doc).
CREATE INDEX IF NOT EXISTS idx_trainers_public_slug
    ON public.trainers (public_slug)
    WHERE public_slug IS NOT NULL;

COMMENT ON COLUMN public.trainers.public_slug             IS 'URL pública: kinevoapp.com/com/<public_slug>. Unique. NULL = sem landing.';
COMMENT ON COLUMN public.trainers.landing_published       IS 'Toggle de publicar/despublicar. Defaults false.';
COMMENT ON COLUMN public.trainers.landing_headline        IS 'Headline grande do hero. NULL = default sensato.';
COMMENT ON COLUMN public.trainers.landing_subheadline     IS 'Subhead do hero. NULL = default.';
COMMENT ON COLUMN public.trainers.landing_bio             IS 'Parágrafo curto de bio.';
COMMENT ON COLUMN public.trainers.landing_city            IS 'Cidade (ex.: "Belo Horizonte"). Usado em eyebrow do hero.';
COMMENT ON COLUMN public.trainers.landing_cref            IS 'CREF (ex.: "042319-G/SP").';
COMMENT ON COLUMN public.trainers.landing_certifications  IS 'Lista de certificações exibidas no strip.';
COMMENT ON COLUMN public.trainers.landing_specializations IS 'Chips de especialização (ex.: hipertrofia, emagrecimento).';
COMMENT ON COLUMN public.trainers.landing_year_started    IS 'Ano em que começou a treinar (alimenta o "Since YY" do hero).';
COMMENT ON COLUMN public.trainers.landing_stats           IS 'JSONB: { students_count, rating, reviews_count }.';
COMMENT ON COLUMN public.trainers.landing_testimonials    IS 'JSONB array: [{ name, photo_url, quote, role, goal }].';
COMMENT ON COLUMN public.trainers.landing_faq             IS 'JSONB array: [{ question, answer }].';
COMMENT ON COLUMN public.trainers.landing_price_label     IS 'Label de preço (ex.: "R$ 380/mês" ou "Sob consulta").';
COMMENT ON COLUMN public.trainers.landing_hero_image_url  IS 'Foto override pro hero. NULL = usa avatar_url.';
