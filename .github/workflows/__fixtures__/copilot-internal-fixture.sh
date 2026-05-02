#!/bin/sh
# copilot-internal-fixture.sh
# Self-test for the copilot_internal grep filter used in forbidden-endpoints.yml.
#
# The carve-out is ANCHORED: 'copilot_internal/v2/token' must be followed by
# end-of-line or a non-[A-Za-z0-9_-] char. This prevents impostor paths like
# /v2/token-stealer or /v2/tokenize from passing through the filter.
#
# Asserts:
#   good.txt  — contains only the sanctioned URL (must pass the filter, no residue)
#   bad.txt   — contains a v1/* variant (must be caught)
#   evil1.txt — contains /v2/token-stealer (must be caught — anchor regression test)
#   evil2.txt — contains /v2/tokenize (must be caught — anchor regression test)
#   evil3.txt — contains /v2/token/admin (must be caught — anchor regression test)

set -e

TMPDIR_LOCAL=$(mktemp -d)
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

GOOD="$TMPDIR_LOCAL/good.txt"
BAD="$TMPDIR_LOCAL/bad.txt"
EVIL1="$TMPDIR_LOCAL/evil1.txt"
EVIL2="$TMPDIR_LOCAL/evil2.txt"
EVIL3="$TMPDIR_LOCAL/evil3.txt"

# good.txt: only the sanctioned session-token endpoint (with closing quote → non-word char)
cat > "$GOOD" <<'EOF'
export const COPILOT_SESSION_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
EOF

# bad.txt: a v1 variant (forbidden)
cat > "$BAD" <<'EOF'
const forbidden = 'https://api.github.com/copilot_internal/v1/something';
EOF

# evil1.txt: impostor path that the OLD substring filter would have allowed
cat > "$EVIL1" <<'EOF'
const sneaky = 'https://api.github.com/copilot_internal/v2/token-stealer';
EOF

# evil2.txt: another impostor — token followed by alphanumeric
cat > "$EVIL2" <<'EOF'
const sneaky = 'https://api.github.com/copilot_internal/v2/tokenize';
EOF

# evil3.txt: token followed by /sub-path
cat > "$EVIL3" <<'EOF'
const sneaky = 'https://api.github.com/copilot_internal/v2/token/admin';
EOF

# Anchor: token must be at end-of-line, end-of-quoted-string, or followed by
# whitespace/punctuation that ends a path segment. Specifically NOT followed by:
#   - alphanumeric, underscore, dash (would form /v2/tokenize, /v2/token-stealer)
#   - forward slash (would form /v2/token/admin)
FILTER='copilot_internal/v2/token($|[^A-Za-z0-9_/-])'

assert_clean() {
  file="$1"
  label="$2"
  residue=$(grep 'copilot_internal' "$file" | grep -vE "$FILTER" || true)
  if [ -n "$residue" ]; then
    echo "FAIL: $label produced unexpected residue:"
    echo "$residue"
    exit 1
  fi
  echo "OK: $label clean."
}

assert_caught() {
  file="$1"
  label="$2"
  residue=$(grep 'copilot_internal' "$file" | grep -vE "$FILTER" || true)
  if [ -z "$residue" ]; then
    echo "FAIL: $label produced no residue — filter is not catching forbidden URLs."
    exit 1
  fi
  echo "OK: $label caught by filter."
}

echo "Testing good.txt (sanctioned URL — should pass)..."
assert_clean "$GOOD" "good.txt"

echo "Testing bad.txt (v1 variant — should be caught)..."
assert_caught "$BAD" "bad.txt"

echo "Testing evil1.txt (token-stealer impostor — should be caught)..."
assert_caught "$EVIL1" "evil1.txt"

echo "Testing evil2.txt (tokenize impostor — should be caught)..."
assert_caught "$EVIL2" "evil2.txt"

echo "Testing evil3.txt (token/admin impostor — should be caught)..."
assert_caught "$EVIL3" "evil3.txt"

echo "Fixture self-test passed (5/5 assertions)."
