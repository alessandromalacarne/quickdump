#!/usr/bin/env bash
set -euo pipefail

# Keeps an explicit DATABASE_URL (e.g. test database) over the .env one
_override_database_url="${DATABASE_URL:-}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -n "$_override_database_url" ]; then
  export DATABASE_URL="$_override_database_url"
fi

exec nix shell nixpkgs#prisma-engines --command bash -c '
  export PRISMA_SCHEMA_ENGINE_BINARY="$(command -v schema-engine)"
  exec npx prisma "$@"
' -- "$@"
