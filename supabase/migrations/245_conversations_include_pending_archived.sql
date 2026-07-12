-- D4 (decisões 12/jul): o painel de mensagens filtrava students.status='active',
-- então a conversa de um aluno RECÉM-CRIADO (pending) não aparecia — dava pra
-- enviar do perfil, mas a thread sumia — e o histórico de arquivados ficava
-- inacessível sem reativar o aluno.
--
-- v2 da RPC: alunos 'pending' entram SEMPRE (caso comum: criar aluno e já
-- mandar mensagem); 'archived' entra sob demanda via p_include_archived
-- (default false — chamadas existentes de 1 argumento seguem funcionando).
-- DROP antes do CREATE: assinatura nova criaria um OVERLOAD, não substituição.

DROP FUNCTION IF EXISTS public.get_trainer_conversations(uuid);

CREATE FUNCTION public.get_trainer_conversations(
  p_trainer_id uuid,
  p_include_archived boolean DEFAULT false
)
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
    AND (
      s.status IN ('active', 'pending')
      OR (p_include_archived AND s.status = 'archived')
    )
  ORDER BY lm.created_at DESC NULLS LAST, s.name ASC;
END;
$function$;

COMMENT ON FUNCTION public.get_trainer_conversations(uuid, boolean) IS
  'Resumo de conversas do treinador (última mensagem + não-lidas por aluno). Inclui pending; archived via p_include_archived (D4).';
