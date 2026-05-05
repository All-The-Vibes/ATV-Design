# GitHub Copilot OAuth Setup

ATV Design uses the GitHub Copilot SDK OAuth flow with PKCE and a one-shot loopback callback server.

## Default path

1. Open ATV Design.
2. Click **Sign in with GitHub** in the Copilot provider flow.
3. The app starts a local callback server on `http://127.0.0.1:<random-port>/oauth-callback` and opens your browser to GitHub.
4. Approve the OAuth consent screen.
5. GitHub redirects back to the local callback URL. You can close the browser tab and return to the app.

Credentials are stored locally at `~/.config/atv-design/copilot-auth.json` with restrictive file permissions.

## Self-registration

If you do not want to use the built-in client ID, create your own GitHub OAuth app and launch ATV Design with a client-ID override.

1. Create an OAuth app in GitHub developer settings.
2. Register a loopback callback URL on `127.0.0.1` using the `/oauth-callback` path.
3. Set `ATV_DESIGN_GITHUB_CLIENT_ID` to your OAuth app client ID before starting ATV Design.
4. Launch ATV Design and use **Sign in with GitHub** normally.

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

- If the browser says the sign-in completed but the app does not update, retry the flow and ensure local loopback callbacks are not blocked by firewall or endpoint-security software.
- To force a clean sign-in, sign out in the app or remove `~/.config/atv-design/copilot-auth.json` before trying again.
