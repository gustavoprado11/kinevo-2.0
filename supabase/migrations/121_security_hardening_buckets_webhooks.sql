-- Migration 121: Security hardening
-- 1) webhook_events: adicionar policy explícita (RLS estava on, sem policy = default deny;
--    queremos que apenas service_role escreva/leia, e nenhum cliente authenticated)
-- 2) Buckets públicos: restringir SELECT para que clientes não consigam LISTAR todos os
--    arquivos. URLs públicas para download continuam funcionando pois passam pela
--    rota /storage/v1/object/public que não exige policy de SELECT.

------------------------------------------------------------
-- 1. webhook_events: policy explícita service_role-only
------------------------------------------------------------
-- A política abaixo permite TUDO para service_role (operações server-side via service key).
-- Clientes anon/authenticated continuam bloqueados pelo default-deny do RLS.
DROP POLICY IF EXISTS webhook_events_service_role_all ON public.webhook_events;
CREATE POLICY webhook_events_service_role_all
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY webhook_events_service_role_all ON public.webhook_events IS
  'Webhooks Stripe são processados server-side com service key. Clientes não devem ler nem escrever.';

------------------------------------------------------------
-- 2. avatars bucket: restringir LIST ao dono da pasta
------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Authenticated lista apenas seus próprios arquivos (path = avatars/{auth_uid}/...)
CREATE POLICY "Owners can list own avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

------------------------------------------------------------
-- 3. trainer-videos bucket
------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view trainer videos" ON storage.objects;

CREATE POLICY "Owners can list own trainer videos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trainer-videos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

------------------------------------------------------------
-- 4. messages bucket
------------------------------------------------------------
DROP POLICY IF EXISTS messages_select_public ON storage.objects;

-- Path estimado: messages/{conversation_owner}/...; restringir ao dono.
-- Ajuste a expressão se o path for diferente.
CREATE POLICY messages_owner_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'messages'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

------------------------------------------------------------
-- 5. feedback bucket
------------------------------------------------------------
DROP POLICY IF EXISTS feedback_select_public ON storage.objects;

CREATE POLICY feedback_owner_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
