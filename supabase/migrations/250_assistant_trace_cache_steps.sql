-- Instrumentação de custo real do assistente (análise de custo 13/jul):
--   - cached_input_tokens: subconjunto do input servido do cache do provider
--     (o COGS registrado assumia cache=0 — teto, não medição);
--   - steps: nº de passos do agent loop no turno (era inferido por divisão de
--     tokens; necessário p/ diagnosticar builds que morrem no teto de passos).
-- Aditivo e nullable — código antigo segue inserindo sem as colunas.
alter table public.assistant_turn_traces
  add column if not exists cached_input_tokens integer,
  add column if not exists steps smallint;
