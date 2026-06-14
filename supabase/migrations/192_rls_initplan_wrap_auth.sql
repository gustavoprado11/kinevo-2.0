-- 192: Corrige auth_rls_initplan (advisor 0003) — envolve chamadas nuas de
-- auth.uid()/auth.jwt()/auth.role() em (select ...) nas policies do schema public,
-- para o Postgres avaliar uma vez por query (initPlan) em vez de por linha.
--
-- Semântica e segurança INALTERADAS: um scalar subselect de função stable retorna o
-- mesmo valor. Transformação validada em amostra (messages/students/exercises) antes
-- de aplicar — só a chamada nua é envolvida; subqueries e lógica booleana preservadas.
--
-- Idempotente: o filtro pega só policies com chamada NUA (sem 'select auth.'), então
-- rodar de novo é no-op. Tudo numa transação — sem janela visível sem policy.

DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_roles text;
  v_using text;
  v_with text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( (qual ~* 'auth\.(uid|jwt|role)\(\)' AND qual !~* 'select\s+auth\.')
         OR (with_check ~* 'auth\.(uid|jwt|role)\(\)' AND with_check !~* 'select\s+auth\.') )
  LOOP
    -- protege chamadas já envolvidas → envolve as nuas → restaura as protegidas
    v_qual := CASE WHEN r.qual IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(regexp_replace(r.qual,
        'select\s+auth\.(uid|jwt|role)\(\)', 'SELECT KEEP__\1', 'gi'),
        'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi'),
        'KEEP__(uid|jwt|role)', 'auth.\1()', 'gi') END;
    v_check := CASE WHEN r.with_check IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(regexp_replace(r.with_check,
        'select\s+auth\.(uid|jwt|role)\(\)', 'SELECT KEEP__\1', 'gi'),
        'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'gi'),
        'KEEP__(uid|jwt|role)', 'auth.\1()', 'gi') END;

    v_roles := (SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ')
                FROM unnest(r.roles) AS x);
    v_using := CASE WHEN v_qual  IS NULL THEN '' ELSE ' USING (' || v_qual  || ')' END;
    v_with  := CASE WHEN v_check IS NULL THEN '' ELSE ' WITH CHECK (' || v_check || ')' END;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, v_roles, v_using, v_with);
  END LOOP;
END $$;
