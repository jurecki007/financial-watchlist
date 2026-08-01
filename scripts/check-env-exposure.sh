#!/usr/bin/env bash
# Guards against secrets becoming publicly readable in this repo.
#
# This repo is public. A key that reaches GitHub is compromised the moment it
# lands — deleting the commit does not help, because the object stays reachable
# and scrapers watch the public events firehose. So these checks are designed to
# fail LOUDLY and BEFORE the push, not to clean up afterwards.
#
# Runs in two places: the pre-commit hook (staged files) and CI (whole tree).

set -uo pipefail

SELF="scripts/check-env-exposure.sh"
FAILED=0

# Fail closed. Every check below derives its file list from git, so if git is
# unavailable or this is not a repo, `git ls-files` returns nothing, every check
# finds nothing, and the script cheerfully reports success while a secret sits
# on disk. A security control that passes when it cannot run is worse than none:
# it manufactures confidence. Refuse to report a verdict we cannot support.
if ! command -v git >/dev/null 2>&1; then
  printf '\033[31m✗ git not found — cannot determine which files are tracked.\033[0m\n' >&2
  exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '\033[31m✗ Not inside a git work tree — refusing to report a pass.\033[0m\n' >&2
  exit 1
fi

fail() {
  printf '\033[31m✗ %s\033[0m\n' "$1" >&2
  FAILED=1
}
pass() { printf '\033[32m✓ %s\033[0m\n' "$1"; }

# Server-only variables. If any of these ever appear with a NEXT_PUBLIC_ prefix,
# or inside a client component, the value ships to the browser.
SERVER_ONLY=(
  SUPABASE_SERVICE_ROLE_KEY
  TWELVE_DATA_API_KEY
  FINNHUB_API_KEY
  RESEND_API_KEY
)

# Files git actually tracks; everything else is irrelevant to a public repo.
tracked() { git ls-files "$@" 2>/dev/null; }

# ---------------------------------------------------------------------------
# 1. No real env files tracked
# ---------------------------------------------------------------------------
leaked_env=$(tracked | grep -E '(^|/)\.env' | grep -v '\.env\.example$' || true)
if [ -n "$leaked_env" ]; then
  fail "Env file(s) are tracked by git:"
  printf '    %s\n' $leaked_env >&2
  printf '    Remove with: git rm --cached <file>  — then ROTATE the keys.\n' >&2
else
  pass "No .env files tracked"
fi

# ---------------------------------------------------------------------------
# 2. .env.example must be a template — every value empty
# ---------------------------------------------------------------------------
if [ -f .env.example ]; then
  filled=$(grep -E '^[A-Z_][A-Z0-9_]*=.+' .env.example || true)
  if [ -n "$filled" ]; then
    fail ".env.example has non-empty values (it is a template, not a config):"
    printf '    %s\n' "$(printf '%s' "$filled" | cut -d= -f1)" >&2
  else
    pass ".env.example contains no values"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Server-only vars must never carry the NEXT_PUBLIC_ prefix
#    Next.js inlines anything NEXT_PUBLIC_* into the client bundle.
# ---------------------------------------------------------------------------
for var in "${SERVER_ONLY[@]}"; do
  hits=$(tracked | grep -v "^$SELF$" | xargs grep -l "NEXT_PUBLIC_${var}" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "NEXT_PUBLIC_${var} found — this inlines a server secret into the browser bundle:"
    printf '    %s\n' $hits >&2
  fi
done

# ---------------------------------------------------------------------------
# 4. Server-only vars must never be referenced from a client component
# ---------------------------------------------------------------------------
client_files=$(tracked '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null \
  | grep -v "^$SELF$" \
  | xargs grep -l '^\s*["'"'"']use client["'"'"']' 2>/dev/null || true)

if [ -n "$client_files" ]; then
  for var in "${SERVER_ONLY[@]}"; do
    hits=$(printf '%s\n' $client_files | xargs grep -l "$var" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      fail "$var referenced inside a client component:"
      printf '    %s\n' $hits >&2
    fi
  done
fi

# ---------------------------------------------------------------------------
# 5. Credential shapes in tracked content
#    Catches a pasted key even in a file we did not anticipate.
# ---------------------------------------------------------------------------
scan_targets=$(tracked | grep -v "^$SELF$" | grep -v '^\.env\.example$' || true)
if [ -n "$scan_targets" ]; then
  # Supabase/JWT service keys, Resend keys, generic assigned long tokens.
  patterns='eyJhbGciOi[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|(api[_-]?key|secret|token|password)["'"'"']?\s*[:=]\s*["'"'"'][A-Za-z0-9/+_-]{24,}["'"'"']'
  hits=$(printf '%s\n' $scan_targets | xargs grep -InEi "$patterns" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    fail "Possible credential in tracked content:"
    printf '    %s\n' "$hits" >&2
    printf '    If this is a false positive, narrow the pattern in %s.\n' "$SELF" >&2
  else
    pass "No credential-shaped strings in tracked files"
  fi
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\n\033[31mSecurity check failed.\033[0m If a real key was already pushed, rotate it — do not just delete the commit.\n' >&2
  exit 1
fi

printf '\n\033[32mAll env-exposure checks passed.\033[0m\n'
