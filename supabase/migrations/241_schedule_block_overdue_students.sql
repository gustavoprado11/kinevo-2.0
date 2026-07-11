-- FIN2 (auditoria 11/jul): o job pg_cron do bloqueio por inadimplência existia
-- SÓ como agendamento manual em prod (o cron.schedule da migração 140 estava
-- num comentário). Se o job manual sumisse (restore, recriação do banco), o
-- bloqueio parava silenciosamente — aluno inadimplente mantinha acesso.
-- Versiona o agendamento. cron.schedule com o MESMO jobname atualiza o job
-- existente (idempotente sobre o manual: 'block-overdue-students-daily',
-- 0 6 * * *, ativo — verificado em prod em 11/jul/2026).
SELECT cron.schedule(
    'block-overdue-students-daily',
    '0 6 * * *',
    $$SELECT public.block_overdue_students();$$
);
