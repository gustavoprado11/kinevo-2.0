-- 133_trainer_instagram_handle.sql
--
-- Adiciona coluna `instagram_handle` em `trainers` para que o trainer
-- cadastre seu @ real do Instagram. Esse @ aparece no rodapé dos cards
-- de compartilhamento de treino que o aluno posta nas redes (templates
-- em mobile/components/workout/sharing/_shared/ShareBrandFooter.tsx).
--
-- Antes desta migração o footer derivava um @ falso a partir do nome
-- do trainer (ex.: "Gustavo Prado" → "@gustavo.p"), o que confundia
-- alunos e levava a tags erradas no Instagram.
--
-- Regras do handle (espelho das regras públicas do Instagram):
--   - 1 a 30 caracteres
--   - apenas letras (A-Z, a-z), dígitos (0-9), ponto (.) e underscore (_)
--   - NÃO inclui o '@' (frontend strip antes de persistir)
--
-- RLS:
--   - `trainers_update` (auth_user_id = auth.uid()) já permite o
--     trainer alterar o próprio row, então não precisamos RPC dedicado.
--   - `Students can view their trainer` (s.coach_id = trainers.id AND
--     s.auth_user_id = auth.uid()) já dá leitura pro aluno via JOIN.

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT NULL;

ALTER TABLE public.trainers
  DROP CONSTRAINT IF EXISTS trainers_instagram_handle_format;

ALTER TABLE public.trainers
  ADD CONSTRAINT trainers_instagram_handle_format
  CHECK (
    instagram_handle IS NULL
    OR instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'
  );

COMMENT ON COLUMN public.trainers.instagram_handle IS
  'Handle do Instagram do trainer (sem @). Usado no footer dos cards de share de treino. NULL = trainer ainda não cadastrou; UI esconde a linha do @ nesse caso.';
