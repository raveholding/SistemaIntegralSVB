#!/usr/bin/env bash
# Aplica stub + migraciones + seed + pruebas sobre un Postgres 15/16 vacío.
# uso: PGURL=postgres://postgres@localhost:5432/svb_test ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql ${PGURL:?defina PGURL} -v ON_ERROR_STOP=1 -q"
$P -c "set client_min_messages=warning; drop schema if exists public cascade; drop schema if exists audit cascade; drop schema if exists auth cascade; create schema public;"
$P -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do $P -f "$f" >/dev/null; done
$P -f seed.sql
$P -f tests/01_flows.sql
echo "✔ Todas las pruebas pasaron"
