-- ============================================================================
-- 237 — Saúde F2 (C13): realtime nas tabelas de saúde do aluno.
--
-- Sem isto, uma gravação server-side (webhook Oura/Strava, cron de reconcile,
-- ou sync de OUTRO device) só aparecia na aba após refocus/pull. Agora a aba
-- Saúde assina as próprias linhas (RLS já filtra por student) e reflete na hora.
--
-- Idempotente: só adiciona à publicação o que ainda não está lá.
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'daily_sleep_samples',
    'daily_activity_samples',
    'hr_resting_samples',
    'hrv_samples',
    'readiness_scores',
    'external_activities'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
