-- Preferência de Início do treinador: dashboard clássico vs home do Assistente (Cowork).
-- Aditiva. 'classic' = dashboard atual; 'assistant' = home conversacional (/assistente).
alter table public.trainers
  add column if not exists home_style text not null default 'classic'
    check (home_style in ('classic', 'assistant'));
