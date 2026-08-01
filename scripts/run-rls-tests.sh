#!/usr/bin/env bash
# Runs the RLS isolation suite against the local Supabase stack.
#
# Keys are read from `supabase status` rather than hardcoded. They are the same
# on every local install and carry no risk, but sourcing them keeps the test
# file free of anything key-shaped — which stops the secret scanners flagging
# the test suite and, more importantly, stops anyone learning the habit of
# pasting keys into tracked files.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! supabase status >/dev/null 2>&1; then
  echo "Local Supabase stack is not running. Start it with: supabase start" >&2
  exit 1
fi

eval "$(supabase status -o env |
  sed -n 's/^API_URL=/export SUPABASE_URL=/p;
          s/^PUBLISHABLE_KEY=/export SUPABASE_PUBLISHABLE_KEY=/p;
          s/^SECRET_KEY=/export SUPABASE_SECRET_KEY=/p')"

# Older CLI builds report the legacy names; fall back so this works on both.
if [ -z "${SUPABASE_SECRET_KEY:-}" ]; then
  eval "$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY=/export SUPABASE_SECRET_KEY=/p')"
fi
if [ -z "${SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  eval "$(supabase status -o env | sed -n 's/^ANON_KEY=/export SUPABASE_PUBLISHABLE_KEY=/p')"
fi

exec node --test tests/rls.test.ts
