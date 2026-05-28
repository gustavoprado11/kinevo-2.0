-- 168_trainer_leads_status_read.sql
-- Corrige o CHECK do status de trainer_leads pra incluir 'read'.
--
-- O M3 (web + mobile) marca o lead como 'read' assim que o trainer abre o
-- detalhe de um lead 'new' — mas o CHECK original (166) só permitia
-- ('new','contacted','converted','archived'). Sem leads reais ainda, o bug
-- ficou latente: o primeiro UPDATE status='read' falharia com violação de
-- constraint.
--
-- Pipeline real: new → read → contacted → converted | archived.
--
-- Backward compatible: nenhuma row existente usa 'read' (não era aceito),
-- então recriar a constraint é seguro.

ALTER TABLE public.trainer_leads
    DROP CONSTRAINT IF EXISTS trainer_leads_status_check;

ALTER TABLE public.trainer_leads
    ADD CONSTRAINT trainer_leads_status_check
    CHECK (status IN ('new','read','contacted','converted','archived'));

COMMENT ON COLUMN public.trainer_leads.status IS 'new → read → contacted → converted | archived.';
