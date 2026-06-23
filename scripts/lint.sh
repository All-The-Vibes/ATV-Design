#!/usr/bin/env sh
# Lint git-tracked source files with Biome.
#
# Why not `biome check .`? In this repo it silently resolves 0 files and exits
# non-zero ("No files were processed in the specified paths"). Biome 1.9.4's
# `vcs.useIgnoreFile` over-applies the root-anchored `/.*/` catch-all in
# .gitignore and ends up ignoring the whole working tree. That broke `pnpm lint`
# everywhere: the CI Lint job, the pre-commit hook, and the pre-push hook.
#
# Passing the git-tracked file list sidesteps the buggy traversal while still
# honoring biome.json's own `files.ignore`. Behaves identically in CI, the main
# checkout, and git worktrees. Pass --write (or any biome flag) through as args.
set -e

files=$(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' '*.json' '*.jsonc' '*.css')
if [ -z "$files" ]; then
  echo "lint: no tracked source files to check"
  exit 0
fi

# shellcheck disable=SC2086 # word-splitting the newline list into args is intended
printf '%s\n' "$files" | xargs pnpm exec biome check "$@"
