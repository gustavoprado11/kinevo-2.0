-- ============================================================================
-- 270: Funções de treino dos exercícios ("pra quê" — terceiro eixo da
-- biblioteca, ao lado de grupo muscular e padrão de movimento).
-- Sugestão de treinador (jul/2026): mobilidade por articulação, ativação,
-- potência etc. — a língua de prescrição do dia-a-dia.
--
-- Modelo espelha muscle_groups (011): catálogo + junção N:N. Na v1 o catálogo
-- é SÓ do sistema (owner_id NULL); a coluna owner_id já fica pronta para
-- funções customizadas por treinador numa fase 2. Os LINKS dos exercícios do
-- sistema entram por seed separado (classificação revisada); treinadores podem
-- taggear os próprios exercícios desde já (policy de junção).
-- ============================================================================

-- 1. Catálogo
CREATE TABLE IF NOT EXISTS exercise_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    owner_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE exercise_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View system or own functions" ON exercise_functions
    FOR SELECT USING (
        owner_id IS NULL OR owner_id = current_trainer_id()
    );
-- v1: sem policies de escrita para treinador — catálogo custom é fase 2.

-- 2. Junção exercício ↔ função
CREATE TABLE IF NOT EXISTS exercise_function_links (
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    function_id UUID REFERENCES exercise_functions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (exercise_id, function_id)
);

ALTER TABLE exercise_function_links ENABLE ROW LEVEL SECURITY;

-- Mesmo espírito da junção de grupos musculares (011): vê os links de
-- exercícios visíveis; gerencia os links dos PRÓPRIOS exercícios.
CREATE POLICY "View function links" ON exercise_function_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exercises e
            WHERE e.id = exercise_function_links.exercise_id
        )
    );

CREATE POLICY "Manage function links for own exercises" ON exercise_function_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exercises e
            WHERE e.id = exercise_function_links.exercise_id
            AND e.owner_id = current_trainer_id()
        )
    );

CREATE INDEX IF NOT EXISTS idx_exercise_function_links_function
    ON exercise_function_links(function_id);

-- 3. Seed do catálogo canônico (plano, na língua popular; mobilidade por
--    articulação como na sugestão original)
INSERT INTO exercise_functions (slug, name, sort_order) VALUES
    ('mob_quadril',       'Mob. quadril',        10),
    ('mob_tornozelo',     'Mob. tornozelo',      20),
    ('mob_ombro',         'Mob. ombro',          30),
    ('mob_toracica',      'Mob. torácica',       40),
    ('ativacao',          'Ativação',            50),
    ('core_estabilidade', 'Estabilidade / Core', 60),
    ('potencia',          'Potência',            70),
    ('pliometria',        'Pliometria',          80),
    ('condicionamento',   'Condicionamento',     90),
    ('alongamento',       'Alongamento',        100),
    ('equilibrio',        'Equilíbrio',         110)
ON CONFLICT (slug) DO NOTHING;
