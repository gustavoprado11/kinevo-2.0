-- PF2/PF3 (análise complementar 11/jul): resumo de conversas agregado no banco.
--
-- Antes, web (getConversations) e mobile (useTrainerConversations) baixavam
-- TODAS as mensagens de todos os alunos, sem LIMIT, só para extrair a última
-- por aluno + contagem de não-lidas — payload O(histórico inteiro) a cada
-- abertura da aba (e, no web, a cada INSERT realtime). Acima de 1000 linhas
-- (cap do PostgREST) o preview ainda ficava errado.
--
-- Esta RPC devolve 1 linha por aluno ATIVO do treinador: última mensagem
-- (lateral com idx_messages_student_created) + não-lidas (lateral com
-- idx_messages_unread, parcial). Ordenação: com mensagens por recência,
-- depois sem mensagens por nome — mesma semântica das duas telas.
--
-- Guarda idêntica ao padrão do repo (074/149): service_role passa;
-- authenticated só enxerga o próprio trainer.

CREATE OR REPLACE FUNCTION public.get_trainer_conversations(p_trainer_id uuid)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  avatar_url text,
  student_status text,
  last_content text,
  last_image_url text,
  last_sender_type text,
  last_created_at timestamptz,
  unread_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_trainer_id IS DISTINCT FROM (SELECT public.current_trainer_id())
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.avatar_url,
    s.status,
    lm.content,
    lm.image_url,
    lm.sender_type,
    lm.created_at,
    COALESCE(uc.unread, 0)::integer
  FROM public.students s
  LEFT JOIN LATERAL (
    SELECT m.content, m.image_url, m.sender_type, m.created_at
    FROM public.messages m
    WHERE m.student_id = s.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS unread
    FROM public.messages m
    WHERE m.student_id = s.id
      AND m.sender_type = 'student'
      AND m.read_at IS NULL
  ) uc ON true
  WHERE s.coach_id = p_trainer_id
    AND s.status = 'active'
  ORDER BY lm.created_at DESC NULLS LAST, s.name ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_trainer_conversations(uuid) IS
  'Resumo de conversas do treinador: última mensagem + não-lidas por aluno ativo, agregado no banco (PF2/PF3).';
