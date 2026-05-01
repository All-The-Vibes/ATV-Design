/**
 * Pure URL validation for the `codesign:v1:open-external` IPC.
 *
 * The renderer is only allowed to open two kinds of URLs on the GitHub repo:
 *   - `/releases/...`  — update banner → release notes
 *   - `/issues/...`    — Report flow → prefilled bug issue
 *
 * Anything else (different host, different repo, different path) is rejected
 * so a compromised renderer can't coerce the main process into opening an
 * attacker-controlled URL via `shell.openExternal`.
 */

const GITHUB_OWNER = 'OpenCoworkAI';
const GITHUB_REPO = 'open-codesign';
const ALLOWED_HOST = 'github.com';
const ALLOWED_PATHS = [
  `/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
  `/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
];

export function isAllowedExternalUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname !== ALLOWED_HOST) return false;
  return ALLOWED_PATHS.some((p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`));
}
