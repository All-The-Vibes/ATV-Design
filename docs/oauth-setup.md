# GitHub Copilot OAuth Setup

ATV Design uses GitHub's device flow for Copilot sign-in in the desktop app.

## Default path

1. Open ATV Design.
2. Click **Sign in with Copilot** in the Copilot provider flow.
3. ATV Design requests a one-time device code, copies it to your clipboard, and opens your browser to GitHub's device login page.
4. If GitHub asks for a code, paste the code that ATV Design showed in the sign-in dialog.
5. Approve the OAuth consent screen and return to ATV Design.

Credentials are stored locally at `~/.config/atv-design/copilot-auth.json` with restrictive file permissions.
If you already have `~/.config/open-codesign/` state from an earlier build, ATV Design copies the known config and OAuth sidecars forward on first read instead of requiring a manual re-login.

## Self-registration

If you do not want to use the built-in client ID, create your own GitHub OAuth app with **device flow enabled** and launch ATV Design with a client-ID override.

1. Create an OAuth app in GitHub developer settings.
2. Enable **Device Flow** for that OAuth app.
3. Set `ATV_DESIGN_GITHUB_CLIENT_ID` to your OAuth app client ID before starting ATV Design.
4. Launch ATV Design and use **Sign in with Copilot** normally.

PowerShell:

```powershell
$env:ATV_DESIGN_GITHUB_CLIENT_ID = 'Iv1.yourclientid'
pnpm dev
```

macOS / Linux:

```bash
ATV_DESIGN_GITHUB_CLIENT_ID=Iv1.yourclientid pnpm dev
```

Legacy builds still honor `OPEN_CODESIGN_GITHUB_CLIENT_ID`, but new docs and automation should use the ATV Design name.

## Troubleshooting

- If GitHub says the code expired or the app never finishes logging in, retry the sign-in flow to get a fresh device code.
- If the sign-in page shows a redirect URI error, you are likely on an older build that still used the loopback redirect flow. Update to a build that uses device flow.
- To force a clean sign-in, sign out in the app or remove `~/.config/atv-design/copilot-auth.json` before trying again.
