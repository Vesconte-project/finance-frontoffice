#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  printf 'Usage: %s <label> <command> [args...]\n' "$0" >&2
  exit 2
fi

label="$1"
shift
slug="$(printf '%s' "$label" | tr -cs '[:alnum:]' '-' | tr '[:upper:]' '[:lower:]')"
log="$(mktemp "${TMPDIR:-/tmp}/vesconte-${slug%-}.XXXXXX.log")"

printf 'Running %s; full log: %s\n' "$label" "$log"
if "$@" >"$log" 2>&1; then
  printf 'PASS %s\n' "$label"
  tail -n 24 "$log"
else
  status=$?
  printf 'FAIL %s (exit %s); full output follows\n' "$label" "$status" >&2
  cat "$log" >&2
  exit "$status"
fi
