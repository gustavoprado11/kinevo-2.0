-- ============================================================================
-- Observabilidade do Assistente IA — queries para a 1ª semana de lançamento
-- (Frente 6.2). Testadas em prod (lylksbtgrihzepbteest) — read-only.
-- ============================================================================

-- Q1 — BUILDS EM FALLBACK DE MODELO (degradação silenciosa de qualidade) ------
-- Alerta se > 0 num dia: um turno de build de programa rodou FORA do Gemini
-- (caiu pro mini) → programa de qualidade inferior sem ninguém perceber.
SELECT date_trunc('day', created_at)::date AS dia,
       model,
       count(*) AS builds_fora_do_gemini
FROM assistant_turn_traces
WHERE created_at > now() - interval '7 days'
  AND tools::text ~ '(generateProgram|create_student_draft_program|create_program_template)'
  AND coalesce(model, '') NOT ILIKE 'gemini%'
GROUP BY 1, 2
ORDER BY 1 DESC;
-- LIMITAÇÃO: o trace grava o modelo do turno ORQUESTRADOR, não o do sub-build.
-- RECOMENDAÇÃO: persistir um booleano `build_fell_back` no trace quando o build
-- reinicia no mini (log [build-model-fallback] já existe — só falta materializar).

-- Q2 — 402 (COTA/FREE-TRIAL ESGOTADOS) POR DIA/TIER --------------------------
-- ⚠️ GAP: 402 NÃO é persistido — o gate rejeita ANTES de gravar trace/evento.
-- Proxy: períodos que ATINGIRAM o teto do tier (candidatos a 402 no ciclo).
SELECT p.period_start,
       coalesce(t.ai_tier, 'via_subscription') AS tier,
       count(*) AS treinadores_no_teto,
       sum(p.credits_used) AS creditos_gastos
FROM ai_usage_periods p
JOIN trainers t ON t.id = p.trainer_id
WHERE p.period_start >= date_trunc('month', now() - interval '1 month')
  AND p.credits_used >= CASE t.ai_tier
        WHEN 'free' THEN 25 WHEN 'essencial' THEN 20
        WHEN 'pro_ia' THEN 300 WHEN 'premium_ia' THEN 1000 ELSE 20 END
GROUP BY 1, 2
ORDER BY 1 DESC;
-- RECOMENDAÇÃO: incrementar um contador `ai_gate_rejections(trainer, day, reason)`
-- no gateAssistant quando retorna 402 — hoje o pico de intenção-de-compra é cego.

-- Q3 — CUSTO (COGS) POR TREINADOR / DIA --------------------------------------
SELECT trainer_id,
       date_trunc('day', created_at)::date AS dia,
       round(sum(cost_usd_micros) / 1e6::numeric, 4) AS custo_usd,
       sum(credits) AS creditos,
       count(*) AS eventos,
       round(sum(cost_usd_micros)::numeric / nullif(sum(credits), 0) / 1e6, 5) AS custo_por_credito_usd
FROM ai_usage_events
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2
ORDER BY custo_usd DESC
LIMIT 50;
-- ALERTA: custo_por_credito_usd acima de ~R$0,13/US$0,024 sustentado no Premium
-- come a margem (ver §4 do relatório de lançamento — pior caso build).

-- Q4 — TURNOS COM ERRO / FALLBACK DO MOTOR -----------------------------------
-- ⚠️ GAP: turnos que dão throw geralmente NÃO gravam trace (recordTurnTrace roda
-- no fim). Proxy: traces cuja resposta é a mensagem de degradação amigável.
SELECT date_trunc('day', created_at)::date AS dia,
       surface,
       count(*) AS turnos_degradados
FROM assistant_turn_traces
WHERE created_at > now() - interval '7 days'
  AND output ILIKE '%não consegui concluir%'
GROUP BY 1, 2
ORDER BY 1 DESC;
-- RECOMENDAÇÃO: gravar trace também no catch do turno (kind='error') com a causa,
-- para medir taxa de erro real por provedor/surface.
