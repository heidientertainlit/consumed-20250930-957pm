#!/usr/bin/env bash
# Disposable LOCAL PostgreSQL only. No project credentials or production calls.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$(mktemp -d /tmp/delete-library-media.XXXXXX)"
cleanup() {
  pg_ctl -D "$TEMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TEMP"
}
trap cleanup EXIT
initdb -D "$TEMP/data" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$TEMP/data" -l "$TEMP/postgres.log" \
  -o "-k $TEMP -p 55439 -c listen_addresses=''" start >/dev/null
psql -X -h "$TEMP" -p 55439 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/fixtures/delete-library-media-schema.sql" \
  -f "$ROOT/supabase/migrations/20261107050000_delete_own_library_media.sql" \
  -f "$ROOT/scripts/fixtures/delete-library-media.test.sql" \
  -f "$ROOT/supabase/tests/delete_own_library_media_live.sql"
