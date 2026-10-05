#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WIZARD="$SCRIPT_DIR/setup-provider-credentials.wizard.sh"

if [[ ! -f "$WIZARD" ]]; then
  printf 'Missing generated wizard: %s\n' "$WIZARD" >&2
  exit 1
fi

# The curated wizard template treats "8 colors" as sufficient evidence that
# all styling capabilities exist. Some valid terminfo entries (for example
# xterm-color) lack optional capabilities such as dim; under set -e that would
# abort the generated wizard before it renders. Degrade styling only when a
# capability probe proves the current terminal is incomplete.
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
  colors="$(tput colors 2>/dev/null || printf '0')"
  if [[ "$colors" =~ ^[0-9]+$ ]] && (( colors >= 8 )); then
    if ! tput bold >/dev/null 2>&1 ||
       ! tput dim >/dev/null 2>&1 ||
       ! tput sgr0 >/dev/null 2>&1 ||
       ! tput setaf 1 >/dev/null 2>&1; then
      export TERM=dumb
    fi
  fi
fi

exec bash "$WIZARD"
