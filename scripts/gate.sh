#!/usr/bin/env bash
#
# Context-efficient gate: keep the passing case out of the agent's context.
#
# Runs the linter, then the format check, then typecheck, then the full test
# suite across every workspace. Cheapest and most mechanical first, so a lint
# slip, a formatting problem, or a type error never costs a test run.
#
#   success -> a single "✓" line
#   failure -> the real output, because only the failure is useful
#
# A passing run in this repo is ~180 test lines of noise; a failing run is 200+
# lines with one useful assertion buried in it. This is the backpressure
# pattern: swallow the pass, surface the fail.
#
# Used by `npm run gate`, the `qa` agent, /qa, and .github/workflows/ci.yml.
#
# Set GATE_REQUIRE_DB=1 to fail when the api integration tests are skipped
# (they self-skip when DATABASE_URL is unset or unreachable). CI sets it.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

require_db="${GATE_REQUIRE_DB:-0}"

if [ "$require_db" = "1" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "gate: GATE_REQUIRE_DB=1 but DATABASE_URL is unset" >&2
  exit 1
fi

out=$( { npm run lint && npm run format:check && npm run typecheck && npm test; } 2>&1 )
code=$?

if [ "$code" -ne 0 ]; then
  printf '%s\n' "$out"
  exit "$code"
fi

# A green suite is not proof the integration tests ran. The only self-skipping
# tests in this repo are the two api integration files, so "skipped" in the
# output is an exact signal rather than a heuristic.
if [ "$require_db" = "1" ] && printf '%s' "$out" | grep -q 'skipped'; then
  echo "gate: integration tests were skipped even though GATE_REQUIRE_DB=1" >&2
  printf '%s\n' "$out" | tail -20 >&2
  exit 1
fi

echo "✓ lint + format + typecheck + tests"
