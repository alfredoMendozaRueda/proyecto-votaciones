#!/usr/bin/env bash
# Ejecuta toda la batería de comprobaciones del proyecto en un único
# comando: tests del backend, y lint + formato + tests del frontend. Es lo
# mismo que corren el hook de pre-push y el CI, pensado para usar en el
# día a día antes de hacer commit/push.
#
# Uso:
#   ./run-tests.sh              # todo: backend + frontend
#   ./run-tests.sh --backend    # solo mvn test
#   ./run-tests.sh --frontend   # solo lint + format:check + test:ci
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

run_backend=1
run_frontend=1

case "${1:-}" in
  --backend)
    run_frontend=0
    ;;
  --frontend)
    run_backend=0
    ;;
  -h | --help)
    echo "Uso: $0 [--backend|--frontend]"
    exit 0
    ;;
  "") ;;
  *)
    echo "run-tests.sh: opción desconocida '$1'. Usa --backend, --frontend o nada." >&2
    exit 1
    ;;
esac

if [ "$run_backend" -eq 1 ]; then
  echo "==> Backend: mvn test"
  mvn test
fi

if [ "$run_frontend" -eq 1 ]; then
  if [ ! -d frontend/node_modules ]; then
    echo "==> Frontend: instalando dependencias (npm ci)..."
    (cd frontend && npm ci)
  fi

  echo "==> Frontend: lint (ESLint)"
  (cd frontend && npm run lint)

  echo "==> Frontend: formato (Prettier)"
  (cd frontend && npm run format:check)

  echo "==> Frontend: tests unitarios (Karma + Jasmine, headless)"
  (cd frontend && npm run test:ci)
fi

echo
echo "run-tests.sh: todo correcto."
