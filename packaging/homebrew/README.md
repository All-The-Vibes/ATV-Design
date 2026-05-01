# Homebrew Cask distribution

Users install with:

```sh
brew tap opencoworkai/tap
brew install --cask open-codesign
```

## One-time tap setup

1. Create a public repo `OpenCoworkAI/homebrew-tap`.
2. Seed it with this cask (copy `open-codesign.rb` into the repo's `Casks/` directory after filling in real SHA256 values from the v0.1.2 release).
3. Store a fine-scoped PAT as the `HOMEBREW_TAP_TOKEN` repo secret with `contents:write` on the tap repo.
4. Re-enable the `homebrew` job in `.github/workflows/release.yml` (commented out until the tap exists).

## Per-release automation

Once the tap repo exists, the release workflow auto-bumps the cask on each `v*.*.*` tag by patching `version` + `sha256` in the tap and opening a PR. No hand-edits needed.
