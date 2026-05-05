# Known Issues

## Current M1 realities

- No automatic migration from `~/.config/open-codesign/` to `~/.config/atv-design/`. Move old config or tokens manually if you still need them.
- The default GitHub Copilot OAuth path depends on a maintainer-controlled public client ID. Use `ATV_DESIGN_GITHUB_CLIENT_ID` if you need ATV Design to authenticate with your own OAuth app instead.
- Packaging and release polish are behind the source-build path. The canonical install path today is `pnpm install && pnpm dev`; packaging smoke exists, but release-grade installers are still M2 work.
- The preserved `skills/ui-ux-pro-max/` bundle is a source-checkout helper today. Packaged M1 builds guarantee the flattened builtin skill entrypoints, not the repo-local support bundle paths.
- The Copilot client-ID override is env-only today; there is no dedicated UI field in the app yet.
