#!/usr/bin/env bash
# =============================================================================
# Wrapper que automatiza o import da biblioteca de vídeos do Lucas.
#
# O que faz:
#   1. Localiza a pasta dos vídeos no Desktop automaticamente.
#   2. Pede a service-role key (sem ecoar na tela).
#   3. Roda um dry-run e mostra o resultado.
#   4. Após confirmação, roda o pipeline real (10–15 min).
#   5. No final, instrui você a avisar o Claude pra fechar com o SQL final.
# =============================================================================

set -euo pipefail

KINEVO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$KINEVO_ROOT/web/scripts"

echo "=========================================="
echo "  Kinevo — Import biblioteca de vídeos"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# 1. Localiza TODAS as pastas dos vídeos e consolida via hardlinks
# -----------------------------------------------------------------------------
SOURCE_DIRS=()

# find é mais robusto que glob com nomes contendo acentos (NFD vs NFC no macOS)
# Pattern "*xerc*" casa "exercícios", "Exercícios", "exercicios" sem se importar com acento
while IFS= read -r -d '' d; do
  SOURCE_DIRS+=("$d")
done < <(find "$HOME/Desktop" -maxdepth 1 -type d \
            \( -iname "*xerc*" -o -iname "*videos-lucas*" \) \
            -print0 2>/dev/null)

if [ "${#SOURCE_DIRS[@]}" -eq 0 ]; then
  echo "Não localizei nenhuma pasta de vídeos no Desktop."
  echo "Tente: ls -1 ~/Desktop  pra ver os nomes exatos."
  echo "Cola o path completo abaixo (separa múltiplas pastas com ;)."
  read -r -p "Pasta(s): " RAW_PATHS
  IFS=';' read -r -a SOURCE_DIRS <<< "$RAW_PATHS"
  for i in "${!SOURCE_DIRS[@]}"; do
    SOURCE_DIRS[$i]="${SOURCE_DIRS[$i]/#\~/$HOME}"
  done
fi

echo "Pastas detectadas (${#SOURCE_DIRS[@]}):"
for d in "${SOURCE_DIRS[@]}"; do
  c=$(find "$d" -maxdepth 1 -iname "*.mov" | wc -l | tr -d ' ')
  echo "  • $d  ($c arquivos)"
done

# Consolida via hardlinks em /tmp (zero overhead de disco)
VIDEOS_DIR="$(mktemp -d -t kinevo-import-XXXXXX)"
echo ""
echo "Consolidando em: $VIDEOS_DIR (hardlinks — não ocupa disco extra)"

LINKED=0
for d in "${SOURCE_DIRS[@]}"; do
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    # Em caso de nome duplicado entre pastas, sufixa com índice
    target="$VIDEOS_DIR/$base"
    n=2
    while [ -e "$target" ]; do
      target="$VIDEOS_DIR/${base%.*}_$n.${base##*.}"
      n=$((n+1))
    done
    # Hardlink se mesma partição; senão cp -p
    if ! ln "$f" "$target" 2>/dev/null; then
      cp -p "$f" "$target"
    fi
    LINKED=$((LINKED+1))
  done < <(find "$d" -maxdepth 1 -iname "*.mov" -print0)
done

COUNT=$(find "$VIDEOS_DIR" -maxdepth 1 -iname "*.mov" | wc -l | tr -d ' ')
echo "Total consolidado: $COUNT arquivos .mov (esperado 143)"
echo ""

if [ "$COUNT" -lt 130 ]; then
  echo "Aviso: contagem abaixo do esperado. Confere se faltou alguma pasta."
  read -r -p "Continuar mesmo assim? (y/n) " yn
  [ "$yn" != "y" ] && { rm -rf "$VIDEOS_DIR"; exit 1; }
fi

# Cleanup ao sair (mesmo se interrompido)
trap 'rm -rf "$VIDEOS_DIR"' EXIT INT TERM

# -----------------------------------------------------------------------------
# 2. Service-role key
# -----------------------------------------------------------------------------
export SUPABASE_URL="https://lylksbtgrihzepbteest.supabase.co"

if [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo ""
  echo "Cola a service-role key do Supabase (Settings → API → service_role secret)."
  echo "Não vai aparecer na tela enquanto você digita/cola."
  read -rs -p "Service key: " SUPABASE_SERVICE_KEY
  echo ""
  export SUPABASE_SERVICE_KEY
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Key vazia. Abortando."
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Garantir node_modules
# -----------------------------------------------------------------------------
if [ ! -d "$KINEVO_ROOT/node_modules/@supabase/supabase-js" ]; then
  echo "Instalando dependências node..."
  ( cd "$KINEVO_ROOT" && npm install --silent )
fi

# -----------------------------------------------------------------------------
# 4. Dry-run
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Dry-run (sem mexer em nada)"
echo "=========================================="

cd "$KINEVO_ROOT"
node "$SCRIPT_DIR/import-exercise-library-videos.mjs" \
  --input-dir="$VIDEOS_DIR" \
  --manifest="$SCRIPT_DIR/drive_videos_manifest.json" \
  --decisions="$SCRIPT_DIR/decisions.json" \
  --dry-run

echo ""
echo "=========================================="
read -r -p "Dry-run OK. Rodar pra valer agora? (10-15 min) [y/n] " yn
if [ "$yn" != "y" ]; then
  echo "Abortado por usuário."
  exit 0
fi

# -----------------------------------------------------------------------------
# 5. Pipeline real
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Pipeline real (transcoda + uploads)"
echo "=========================================="

# Use uma pasta tmp dentro do home com mais espaço previsível (em vez de /var/folders)
PIPE_TMP="$HOME/.kinevo-import-tmp"
mkdir -p "$PIPE_TMP"

# Limpa apenas tmpdirs órfãos DESSA pasta especificamente. Não mexer em
# /var/folders/ porque a pasta consolidada (VIDEOS_DIR) está lá e ainda
# em uso neste run.
rm -rf "$PIPE_TMP"/kinevo-import-* 2>/dev/null || true

echo "Tmp dir do pipeline: $PIPE_TMP"
df -h "$PIPE_TMP" | tail -1
echo ""

node "$SCRIPT_DIR/import-exercise-library-videos.mjs" \
  --input-dir="$VIDEOS_DIR" \
  --manifest="$SCRIPT_DIR/drive_videos_manifest.json" \
  --decisions="$SCRIPT_DIR/decisions.json" \
  --tmp-dir="$PIPE_TMP" \
  --concurrency=1

# Cleanup do tmp ao final
rm -rf "$PIPE_TMP" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✓ Concluído!"
echo "=========================================="
echo ""
echo "Próximo passo: avisa o Claude na conversa que terminou."
echo "Ele vai rodar o post_import_muscle_groups.sql via MCP pra finalizar."
echo ""
echo "Log detalhado em: $SCRIPT_DIR/import-log-*.json"
