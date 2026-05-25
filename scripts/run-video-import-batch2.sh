#!/usr/bin/env bash
# =============================================================================
# Import do batch 2 (Footcore / Panturrilha / Pliometria) — 10 vídeos novos.
#
# O que faz:
#   1. Pergunta a pasta onde você baixou os 10 vídeos do Drive.
#   2. Pede a service-role key (sem ecoar na tela).
#   3. Roda um dry-run e mostra o plano.
#   4. Após confirmação, roda o pipeline real (transcoda + upload + DB).
#   5. No final, avise o Claude pra rodar o SQL de grupos musculares + publicação.
# =============================================================================

set -euo pipefail

KINEVO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$KINEVO_ROOT/web/scripts"

echo "=========================================="
echo "  Kinevo — Import batch 2 (Footcore etc.)"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# 1. Pasta dos vídeos
# -----------------------------------------------------------------------------
# Tenta achar automaticamente uma pasta no Desktop com nome plausível.
GUESS=""
while IFS= read -r -d '' d; do GUESS="$d"; break; done < <(
  find "$HOME/Desktop" -maxdepth 1 -type d \
    \( -iname "*footcore*" -o -iname "*panturrilha*" -o -iname "*batch*2*" \) \
    -print0 2>/dev/null)

if [ -n "$GUESS" ]; then
  echo "Pasta candidata encontrada: $GUESS"
  read -r -p "Usar esta? [Y/n] " yn
  [ "${yn:-y}" = "n" ] && GUESS=""
fi

if [ -z "$GUESS" ]; then
  read -r -p "Cole o caminho da pasta com os 10 vídeos: " GUESS
  GUESS="${GUESS/#\~/$HOME}"
fi

VIDEOS_DIR="$GUESS"
if [ ! -d "$VIDEOS_DIR" ]; then
  echo "Pasta não existe: $VIDEOS_DIR"; exit 1
fi

COUNT=$(find "$VIDEOS_DIR" -maxdepth 1 \( -iname "*.mov" -o -iname "*.mp4" \) | wc -l | tr -d ' ')
echo "Arquivos de vídeo encontrados: $COUNT (esperado 10)"
find "$VIDEOS_DIR" -maxdepth 1 \( -iname "*.mov" -o -iname "*.mp4" \) -exec basename {} \;
echo ""
if [ "$COUNT" -lt 10 ]; then
  read -r -p "Contagem abaixo de 10. Continuar mesmo assim? [y/n] " yn
  [ "$yn" != "y" ] && exit 1
fi

# -----------------------------------------------------------------------------
# 2. Service-role key
# -----------------------------------------------------------------------------
export SUPABASE_URL="https://lylksbtgrihzepbteest.supabase.co"

if [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo "Cola a service-role key do Supabase (Settings → API → service_role secret)."
  echo "Não aparece na tela enquanto você cola."
  read -rs -p "Service key: " SUPABASE_SERVICE_KEY
  echo ""
  export SUPABASE_SERVICE_KEY
fi
[ -z "$SUPABASE_SERVICE_KEY" ] && { echo "Key vazia. Abortando."; exit 1; }

# -----------------------------------------------------------------------------
# 3. node_modules
# -----------------------------------------------------------------------------
if [ ! -d "$KINEVO_ROOT/node_modules/@supabase/supabase-js" ]; then
  echo "Instalando dependências node..."
  ( cd "$KINEVO_ROOT" && npm install --silent )
fi

# -----------------------------------------------------------------------------
# 4. Dry-run
# -----------------------------------------------------------------------------
echo ""
echo "========== Dry-run (não mexe em nada) =========="
cd "$KINEVO_ROOT"
node "$SCRIPT_DIR/import-exercise-library-videos.mjs" \
  --input-dir="$VIDEOS_DIR" \
  --manifest="$SCRIPT_DIR/batch2_footcore_manifest.json" \
  --decisions="$SCRIPT_DIR/batch2_footcore_decisions.json" \
  --dry-run

echo ""
read -r -p "Dry-run OK. Rodar pra valer agora? [y/n] " yn
[ "$yn" != "y" ] && { echo "Abortado."; exit 0; }

# -----------------------------------------------------------------------------
# 5. Pipeline real
# -----------------------------------------------------------------------------
PIPE_TMP="$HOME/.kinevo-import-tmp"
mkdir -p "$PIPE_TMP"
rm -rf "$PIPE_TMP"/kinevo-import-* 2>/dev/null || true

echo ""
echo "========== Pipeline real (transcoda + upload) =========="
node "$SCRIPT_DIR/import-exercise-library-videos.mjs" \
  --input-dir="$VIDEOS_DIR" \
  --manifest="$SCRIPT_DIR/batch2_footcore_manifest.json" \
  --decisions="$SCRIPT_DIR/batch2_footcore_decisions.json" \
  --tmp-dir="$PIPE_TMP" \
  --concurrency=1

rm -rf "$PIPE_TMP" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✓ Upload + DB concluídos!"
echo "=========================================="
echo ""
echo "Próximo passo: avise o Claude na conversa que terminou."
echo "Ele roda o SQL final (grupo 'Estabilização do Arco Plantar',"
echo "associação de grupos musculares e publicação dos 9 novos)."
