-- Sprint 2T: novo status pra saques aguardando MFA na Asaas
-- Quando a Asaas devolve PENDING significa "esperando o trainer confirmar
-- por SMS no painel". A gente colapsava isso em 'processing' antes —
-- invisível pro trainer, que ficava sem entender por que o dinheiro
-- nunca chegava. Agora distinguimos.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'awaiting_authorization'
        AND enumtypid = (
            SELECT atttypid FROM pg_attribute
            WHERE attrelid = 'public.payouts'::regclass AND attname = 'status'
        )
    ) THEN
        ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'awaiting_authorization';
    END IF;
END $$;
