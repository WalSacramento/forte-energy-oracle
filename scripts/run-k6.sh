#!/bin/bash
set -e
SCRIPT_NAME="$1"
shift

mkdir -p results/local/k6

exec docker run --rm \
  --network=host \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd):/project" \
  -w /project \
  grafana/k6:latest \
  run \
  --env BASE_URL="${BASE_URL:-http://localhost:4000}" \
  --env HEMS_URL="${HEMS_URL:-http://localhost:3000}" \
  "$@" \
  "/project/performance/k6/scripts/${SCRIPT_NAME}"
