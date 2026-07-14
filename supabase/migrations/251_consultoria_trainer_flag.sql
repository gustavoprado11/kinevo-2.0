-- Consultoria IA — flag por treinador (dogfooding / beta fechado).
--
-- Até aqui a Consultoria IA era a ÚNICA superfície sem gate: qualquer treinador
-- logado via o item na sidebar e abria /consultoria. Ela ainda não tem preço,
-- não tem limite de uso e o portão humano (validação com CREF) é caro — então
-- fica restrita a quem for explicitamente habilitado, no mesmo padrão de
-- trainers.ai_prescriptions_enabled (migration 036): opt-in por linha, default
-- fechado, sem deploy para liberar mais alguém.
--
-- Ninguém em produção tinha pedidos de consultoria quando isto entrou (0 linhas
-- em consultoria_requests), então nenhum treinador perde trabalho em andamento.

ALTER TABLE public.trainers
    ADD COLUMN IF NOT EXISTS consultoria_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.trainers.consultoria_enabled IS
    'Libera a Consultoria IA (/consultoria) para este treinador. Default fechado — beta fechado/dogfooding. Ver migration 251.';

-- O opt-in é um UPDATE por linha, feito à mão em produção — de propósito NÃO
-- versionado aqui: este repositório é público e a migration viraria a lista de
-- quem tem o acesso privilegiado. Para liberar alguém:
--     UPDATE public.trainers SET consultoria_enabled = true WHERE id = '<uuid>';
-- Ambiente novo nasce com todo mundo fechado, que é o default correto.
