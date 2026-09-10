#!/usr/bin/env bash
# Levanta el stack completo (app + MySQL + RabbitMQ) con Docker Compose.
# No hace falta tener Java, Node, MySQL ni RabbitMQ instalados: todo corre
# dentro de los contenedores, solo Docker.
#
# Uso:
#   ./run-stack.sh              # build + up en primer plano (Ctrl+C para parar)
#   ./run-stack.sh -d           # build + up en segundo plano
#   ./run-stack.sh logs [srv]   # sigue los logs de todos los servicios (o de uno)
#   ./run-stack.sh down         # para y elimina los contenedores
#   ./run-stack.sh down -v      # además borra el volumen de datos de MySQL
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v docker >/dev/null 2>&1; then
  echo "run-stack.sh: no se encuentra 'docker'. Instálalo antes de continuar." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "run-stack.sh: Docker no está corriendo (o no tienes permisos para usarlo)." >&2
  exit 1
fi

case "${1:-}" in
  down)
    shift
    echo "run-stack.sh: parando y eliminando los contenedores..."
    exec docker compose down "$@"
    ;;
  logs)
    shift
    exec docker compose logs -f "$@"
    ;;
esac

echo "run-stack.sh: construyendo y levantando el stack (app + MySQL + RabbitMQ)..."
docker compose up --build "$@"

detached=0
for arg in "$@"; do
  if [ "$arg" = "-d" ] || [ "$arg" = "--detach" ]; then
    detached=1
  fi
done

if [ "$detached" -eq 1 ]; then
  cat <<EOF

Stack levantado en segundo plano:
  App:               http://localhost:8080
  RabbitMQ (panel):  http://localhost:15672  (guest/guest)
  MySQL:             localhost:3306          (root/rootpass)

  ./run-stack.sh logs   para ver los logs
  ./run-stack.sh down   para pararlo
EOF
fi
