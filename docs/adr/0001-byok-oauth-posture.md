# ADR 0001 — BYOK OAuth Posture

**Status:** Accepted (redirect URI method SUPERSEDED-IN-PART 2026-05-08)
**Date:** 2026-04-30
**Context:** Phase 0 of `.omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md` (Option E)
**Mandated-by:** Spec Principle 4 ("BYOK end-to-end with one decision committed up front") and Architect pass-1 verdict.

## Status: SUPERSEDED-IN-PART (2026-05-08)

**Section affected:** "Implementation Constraints" — desktop sign-in interaction model.

The earlier custom URL-scheme design was first superseded by loopback HTTP, and the loopback HTTP design is now superseded by GitHub device flow for the desktop app. The core BYOK posture (public client ID, no embedded secrets, optional self-registration) remains unchanged.

**Rationale:** The loopback redirect design failed against the shipped public client ID with GitHub's `redirect_uri` mismatch error. The same public client ID successfully supports GitHub's device-flow endpoints, which removes the redirect-URI registration problem entirely for ATV Design's desktop sign-in path. ATV Design now opens GitHub's device-login page, copies the one-time user code to the clipboard, and polls the token endpoint until approval, denial, or expiry. Self-registration still works, but the user's GitHub OAuth app must have device flow enabled.

## Decision

atv-design ships with a **fork-published public GitHub OAuth client ID** that uses **PKCE (Proof Key for Code Exchange, RFC 7636)** to complete the authorization-code flow without requiring a client secret. Each end user supplies:

1. Their own active GitHub Copilot subscription (any paid tier).
2. Their own GitHub account, which they sign into via the OAuth consent screen on first launch.

**No secrets are embedded in the application binary.** The published client ID is, by GitHub's design, public information for desktop apps; security comes from PKCE binding the authorization code to a per-session code-verifier that never leaves the user's machine.

## Drivers

1. **Frictionless local-dev demo (Spec Principle 5).** Forcing every user to register their own GitHub OAuth app would raise onboarding friction by roughly an order of magnitude — they'd need a GitHub account *and* enough familiarity with developer settings to register an app, configure a redirect URI, and paste a client ID into a config file.
2. **No shared secret = nothing to leak.** A traditional confidential OAuth app would require a client secret, which cannot safely be embedded in a redistributable Electron binary. PKCE was specifically designed for the public-client desktop-app case.
3. **Match the precedent set by every successful Electron OSS app.** GitHub's own VS Code Copilot extension, the `gh` CLI, and most desktop OSS apps that integrate with GitHub use a public client ID + PKCE.
4. **Architect pass-1 caught a sequencing risk** — if this decision is deferred to Phase 5, Phase 1b's OAuth implementation gets baked against the maintainer's *personal* OAuth app and someone has to remember to swap it before the rebrand goes public. Committing the decision now eliminates that drift risk.

## Implementation Constraints

- **Redirect URI:** `http://127.0.0.1:<random-port>/oauth-callback`. The provider starts a one-shot loopback server on `127.0.0.1`, asks the OS for a free ephemeral port, and passes the resulting redirect URI to GitHub for that sign-in attempt.
- **PKCE parameters:**
  - `code_verifier` — 43–128 random URL-safe characters generated per OAuth session, stored only in memory until token exchange completes.
  - `code_challenge` — `BASE64URL(SHA256(code_verifier))`, sent in the authorization URL.
  - `code_challenge_method` — `S256` always; the `plain` method is forbidden.
- **Token storage:** the GitHub OAuth access token and Copilot session-token metadata are persisted to `~/.config/atv-design/copilot-auth.json` with file mode `0600`. Tokens are NEVER logged.
- **Rotation/refresh:** GitHub OAuth access still requires a fresh sign-in on expiry. The short-lived Copilot session token is refreshed through the documented GitHub exchange before chat requests when needed.

## Alternative considered: self-registration

A privacy-and-sovereignty-conscious user can opt out of the fork-published client ID and register their own GitHub OAuth app instead. `docs/oauth-setup.md` documents both paths:

- **Default (recommended for most users):** use the fork-published public client ID.
- **Self-registration (for users who don't want their OAuth requests routed through the maintainer-controlled app):** create their own OAuth app at `https://github.com/settings/developers`, register a loopback callback URL for `/oauth-callback`, and launch ATV Design with `ATV_DESIGN_GITHUB_CLIENT_ID=<client-id>` before first launch. Legacy builds also honor `OPEN_CODESIGN_GITHUB_CLIENT_ID`.

Both paths use the same PKCE-protected authorization-code flow. Neither requires a client secret.

## Decision Update (2026-05-01): Loopback HTTP Redirect URI

**What changed:**

Redirect URI is now `http://127.0.0.1:<random-port>/oauth-callback`. The flow starts a one-shot HTTP listener bound to `localhost` with a randomly assigned port (via `:0`), passes that dynamically generated URI to the OAuth authorization endpoint, and tears down the server after the callback is received or a 2-minute timeout expires.

**Why:**

The original custom URL-scheme decision did not account for cross-platform Electron packaging complexity. Pre-mortem Scenario 2 in the ralplan identified that Windows packaged builds (installer frameworks like Squirrel and NSIS) do not reliably wire URL-scheme handlers registered at installation time; the handler registration breaks in production even though it works in dev. Loopback HTTP eliminates this surface entirely:

- No OS-level handler registration needed.
- No installer integration points for breakage.
- Works identically across macOS, Windows, and Linux.
- Codex provider (`packages/providers/src/codex/`) already uses this proven pattern.

**Trade-offs:**

Loopback requires a lightweight one-shot HTTP listener; minor risk of port collision on systems with many concurrent OAuth flows (mitigated by using `:0` for automatic assignment). The original custom scheme would have given marginal UX (no macOS permission prompt), but cross-OS fragility cost outweighed the benefit.

**Constraints retained:**

- Still public OAuth client ID (fork-published or self-registered).
- Still PKCE-protected (code-verifier, code-challenge, `S256`).
- Still no embedded `client_secret`.
- Still BYOK end-to-end.
- Self-registration alternative unchanged (users supply their own client ID and a loopback callback URL, then launch ATV Design with a client-ID override).

**Implementation location:**

Phase 1b, `packages/providers/src/copilot-sdk/` — the `CopilotSDKProvider` class uses loopback HTTP via a call to `startCallbackServer(preferredPort)` at flow start, stores the dynamically assigned `redirectUri` (with actual port), and passes it to the GitHub OAuth authorization endpoint.

## Decision Update (2026-05-01): `copilot_internal/v2/token` Carve-Out vs R11

**What changed:**

Spec Principle R11 / Plan Principle 2 ("Sanctioned auth only … never call undocumented `copilot_internal` endpoints") is hereby clarified. The exact path `https://api.github.com/copilot_internal/v2/token` is the **documented** GitHub endpoint that exchanges a GitHub OAuth access token for a short-lived Copilot session token. It is not undocumented and not reverse-engineered: it is the path GitHub publishes for OAuth Apps integrating Copilot Chat. R11's intent is to block undocumented internal variants and reverse-engineered alternatives, not the documented session-token endpoint that shares the path prefix.

**Decision:**

`https://api.github.com/copilot_internal/v2/token` is **explicitly whitelisted** as the sole sanctioned `copilot_internal/*` path. Any other `copilot_internal/*` path remains forbidden.

**CI guard update required:**

`.github/workflows/forbidden-endpoints.yml` must be amended so the `copilot_internal` regex permits exactly the substring `copilot_internal/v2/token` and continues to fail any other occurrence (e.g. `copilot_internal/v1/*`, `copilot_internal/preferences`, etc.). The whitelist is a single explicit allowlist entry, not a broadened pattern.

**Why:**

GitHub Copilot's OAuth-App integration flow is two-stage: (1) GitHub OAuth authorization-code-with-PKCE produces a long-lived GitHub OAuth access token; (2) that token is exchanged at `api.github.com/copilot_internal/v2/token` for a short-lived Copilot session token used as the `Authorization: Bearer` value against `api.githubcopilot.com/chat/completions`. Without step (2), chat completions return 401. Skipping step (2) was considered (Option B in the resolution) and rejected because the raw GitHub OAuth token is not accepted by the Copilot chat endpoint per documented behavior.

**Trade-offs:**

- Whitelisting one path widens R11's surface by a single, named, documented endpoint. The CI guard remains strict for everything else.
- Future regressions are still caught: any new `copilot_internal/*` path added in code review fails CI unless the team chooses to widen the allowlist via a follow-up ADR amendment.

**Constraints retained:**

- Still BYOK; no `client_secret` anywhere in code.
- Still public OAuth client ID + PKCE.
- The Copilot session token is held only in memory (or in the existing token-store with the same `0600` discipline as the GitHub OAuth token); never logged.
- Observability O1 still applies: session-token values are redacted from `oauth.token_exchanged` log lines exactly like the GitHub OAuth token.

**Implementation location:**

Phase 1b, `packages/providers/src/copilot-sdk/copilot-token.ts` — exchanges the GitHub OAuth access token for a Copilot session token; called lazily from `chat.ts` before the first chat completion and refreshed on 401 from the chat endpoint.

## Alternatives rejected

- **Confidential OAuth app with embedded client secret.** Rejected — the secret cannot be kept secret in a redistributable Electron binary. Anyone could extract it.
- **Per-user-mandatory self-registration.** Rejected — see Driver 1 (friction).
- **Device-flow only (no redirect URI).** Considered; rejected for atv-design's Electron context because the user is already on a desktop with a browser, so the authorization-code-with-PKCE flow gives a smoother UX (one click → consent → return to app) than device flow's manual code-entry step.
- **Use GitHub Models API (`models.github.ai`) instead of Copilot SDK.** Different product, different scope; out of scope for this M1. Tracked in spec follow-ups.

## Consequences

**Positive:**
- One-time setup for the maintainer (register the OAuth app once when publishing the rebrand).
- Zero per-user OAuth-app registration friction in the default path.
- No embedded secrets to leak.
- Self-registration alternative preserves user sovereignty.

**Negative:**
- The maintainer-controlled OAuth app sees the count and timing of authorization requests (not the content; GitHub doesn't share that). Privacy-conscious users use the self-registration path.
- If the maintainer's OAuth app is suspended by GitHub, all users on the default path lose access until they switch to self-registration. Document this in `docs/known-issues.md`.

## Verification

- [ ] Phase 0: this ADR file exists at `docs/adr/0001-byok-oauth-posture.md` (this file).
- [ ] Phase 1b: `CopilotSDKProvider` implementation generates a fresh PKCE code-verifier per session.
- [ ] Phase 1b: integration test I5 (PKCE flow) passes.
- [ ] Phase 1b: `.github/workflows/forbidden-endpoints.yml` updated — allows the exact substring `copilot_internal/v2/token`, blocks every other `copilot_internal/*` path. Test fixture proves both halves.
- [ ] Phase 5: `docs/oauth-setup.md` documents both default and self-registration paths.
- [ ] Phase 5: `docs/known-issues.md` lists OAuth-app-suspension-by-GitHub as a known dependency.
- [ ] Observability O1: `code_verifier` and `code` values are redacted from all logs.

## References

- [RFC 7636: Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [GitHub Copilot SDK OAuth (official docs)](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth)
- [GitHub OAuth apps for desktop clients](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- Spec: `.omc/specs/deep-dive-fork-open-codesign-copilot-skills.md`
- Plan: `.omc/plans/ralplan-fork-open-codesign-copilot-skills-final.md`
