#!/usr/bin/env bash
# ============================================================================
# Provisionamento da integração Oura — roda TUDO de uma vez.
# Pré-requisitos:
#   1. App registrado em https://cloud.ouraring.com/oauth/applications
#      (redirect URI: https://www.kinevoapp.com/oura-callback ;
#       scopes: personal, daily, heartrate)
#   2. supabase CLI logado e o projeto linkado (`supabase link`)
#   3. mobile/app.json → extra.oura.clientId preenchido com o client_id
#
# Uso:
#   export OURA_CLIENT_ID="..."
#   export OURA_CLIENT_SECRET="..."
#   export OURA_WEBHOOK_VERIFICATION_TOKEN="$(openssl rand -hex 24)"  # você escolhe
#   export SUPABASE_PROJECT_REF="xxxxxxxxxxxx"   # ref do projeto remoto
#   bash scripts/provision-oura.sh
#
# Spec: mobile/specs/active/oura-integration.md
# ============================================================================
set -euo pipefail

: "${OURA_CLIENT_ID:?defina OURA_CLIENT_ID}"
: "${OURA_CLIENT_SECRET:?defina OURA_CLIENT_SECRET}"
: "${OURA_WEBHOOK_VERIFICATION_TOKEN:?defina OURA_WEBHOOK_VERIFICATION_TOKEN}"
: "${SUPABASE_PROJECT_REF:?defina SUPABASE_PROJECT_REF}"

CALLBACK_URL="https://${SUPABASE_PROJECT_REF}.functions.supabase.co/oura-webhook"

echo "▶ 1/5 Setando secrets no Supabase…"
supabase secrets set \
  OURA_CLIENT_ID="$OURA_CLIENT_ID" \
  OURA_CLIENT_SECRET="$OURA_CLIENT_SECRET" \
  OURA_WEBHOOK_VERIFICATION_TOKEN="$OURA_WEBHOOK_VERIFICATION_TOKEN" \
  OURA_WEBHOOK_CALLBACK_URL="$CALLBACK_URL"

echo "▶ 2/5 Aplicando migrations (inclui 153_oura_integration)…"
supabase db push

echo "▶ 3/5 Deployando edge functions…"
# Funções do usuário → exigem JWT (default).
supabase functions deploy oura-oauth-exchange
supabase functions deploy oura-sync
supabase functions deploy oura-disconnect
# Webhook é chamado pela Oura (sem JWT do Supabase; validamos x-oura-signature).
supabase functions deploy oura-webhook --no-verify-jwt
# Cron/admin (invocadas por pg_cron com service key) → sem JWT de usuário.
supabase functions deploy oura-token-refresh --no-verify-jwt
supabase functions deploy oura-webhook-setup --no-verify-jwt

echo "▶ 4/5 Criando/renovando as subscriptions de webhook…"
supabase functions invoke oura-webhook-setup --no-verify-jwt

echo "▶ 5/5 Agendando crons (pg_cron)…"
echo "   Rode o SQL de scripts/oura-cron.sql no SQL editor do Supabase"
echo "   (precisa de pg_cron + pg_net habilitados; ajusta o project ref e a service key)."

echo "✅ Provisionamento concluído. Teste conectando o Oura no app (Perfil → Conexões)."
