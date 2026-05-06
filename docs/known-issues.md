# Known Issues

## Current M1 realities

- The default GitHub Copilot OAuth path depends on a maintainer-controlled public client ID. Use `ATV_DESIGN_GITHUB_CLIENT_ID` if you need ATV Design to authenticate with your own OAuth app instead.
- Unsigned local packaging now works through the staged desktop build path, but release signing, notarization, and wider installer polish are still M2 work.
- The Copilot client-ID override is env-only today; there is no dedicated UI field in the app yet.
