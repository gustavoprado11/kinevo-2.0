-- Fase 17a — Onboarding v2 · Foundation
--
-- Adiciona modalidade de atuação declarada pelo trainer (presencial · online · ambos).
-- Drives personalization no onboarding v2 (welcome tour, checklist, per-screen tours).
-- Editável depois em /ajuda e /settings/perfil (Fase 17c).
--
-- Default null = trainer ainda não respondeu. UI trata null como "ambos" (mostra tudo).
-- Mantemos null em vez de default 'ambos' pra preservar o sinal "ainda não respondeu" —
-- usado pela inferência por comportamento (Fase 17b).
--
-- Observação sobre alinhamento com students.modality:
-- O enum/coluna students.modality em prod hoje contém valores 'online' e 'presential'
-- (não 'presencial'). A coluna trainers.modality_focus usa 'presencial' (pt-BR correto).
-- Fase 17b vai normalizar na hora da inferência (presential -> presencial).

alter table public.trainers
    add column if not exists modality_focus text
    check (modality_focus is null or modality_focus in ('presencial', 'online', 'ambos'));

comment on column public.trainers.modality_focus is
    'Modalidade de atuação declarada pelo trainer. Drives o que aparece no onboarding '
    '(welcome tour, checklist, per-screen tours). Editável em /ajuda e /settings/perfil. '
    'Null = ainda não respondeu (UI trata como "ambos" / híbrido). Fase 17a.';
