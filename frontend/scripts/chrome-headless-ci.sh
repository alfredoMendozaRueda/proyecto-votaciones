#!/usr/bin/env bash
# Lanza el Chromium de Puppeteer (instalado como devDependency solo para
# esto) con las flags necesarias para correr en CI/contenedores: sin
# sandbox de usuario y sin depender de un /dev/shm grande. Karma lo invoca
# a través de la variable CHROME_BIN cuando se ejecuta 'npm run test:ci'.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME_PATH="$(cd "$SCRIPT_DIR/.." && node -e "require('puppeteer').executablePath().then(p => process.stdout.write(p))")"

exec "$CHROME_PATH" --no-sandbox --disable-gpu --disable-dev-shm-usage "$@"
