#!/usr/bin/env bash
# Fase de captura do QA Visual Loop: garante Chrome de debug -> cria conta QA
# descartável -> dirige as rotas e gera shots/ + manifest.json.
# NÃO faz teardown (a conta é necessária enquanto o Workflow analisa).
# Rode o teardown depois com: node lib/qa-account.mjs teardown <trainerId> <authUserId>
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE=/tmp/kinevo-qa-chrome-profile

# 1) dev server precisa estar no ar
if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || true)" != "200" ]; then
  echo "ERRO: dev server não responde em :3000. Rode 'npm run dev' no web/ antes." >&2
  exit 1
fi

# 2) Chrome de debug com profile descartável (não toca o Chrome do Gustavo)
if ! curl -s http://localhost:9222/json/version >/dev/null 2>&1; then
  echo ">> subindo Chrome de debug em :9222"
  rm -rf "$PROFILE"; mkdir -p "$PROFILE"
  nohup "$CHROME" --remote-debugging-port=9222 --user-data-dir="$PROFILE" \
    --no-first-run --no-default-browser-check "--remote-allow-origins=*" \
    about:blank >/tmp/kinevo-qa-chrome.log 2>&1 &
  disown
  for i in $(seq 1 10); do curl -s http://localhost:9222/json/version >/dev/null 2>&1 && break; sleep 1; done
fi

# 3) conta QA descartável
echo ">> criando conta QA" >&2
ACCT="$(node lib/qa-account.mjs bootstrap)"
echo "$ACCT" > shots/account.json
EMAIL="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("shots/account.json","utf8")).email)')"
echo ">> conta: $EMAIL" >&2

# 4) dirigir e capturar
echo ">> dirigindo rotas (pode levar ~2min)" >&2
node drive.mjs "$ACCT" >/dev/null

echo ""
echo "OK. Manifest: $(pwd)/shots/manifest.json"
echo "Conta QA salva em shots/account.json (faça teardown após a análise):"
TD="$(node -e 'const a=JSON.parse(require("fs").readFileSync("shots/account.json","utf8"));console.log(a.trainerId,a.authUserId)')"
echo "  node lib/qa-account.mjs teardown $TD"
