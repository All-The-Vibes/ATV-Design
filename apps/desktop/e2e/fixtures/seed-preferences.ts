/**
 * Preference / config seeding helper for E2E tests.
 *
 * Seeds the minimum files that the main process reads at boot so the app
 * renders past the login-card onboarding gate without touching a real
 * provider network.
 *
 * Strategy (two files written into `userDataDir`):
 *  1. `storage-settings.json`  — tells the main process where to find
 *     `config.toml`.  We redirect configDir into the same temp dir so
 *     nothing leaks to the developer's real XDG config.
 *  2. `config.toml` (at the configDir location) — v3 config with
 *     the built-in `ollama` provider as activeProvider.  Ollama is
 *     keyless (`requiresApiKey: false`) so `isKeylessProviderAllowed`
 *     returns true and `toState()` sets `hasKey: true`.  No real
 *     network call is made because the test never sends a prompt.
 *
 * `preferences.json` is not required — the main process falls back to
 * DEFAULTS when the file is absent (ENOENT is handled gracefully).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Minimal valid config.toml (v3, ollama keyless provider). */
const FAKE_CONFIG_TOML = `version = 3
activeProvider = "ollama"
activeModel = "llama3.2"

[providers.ollama]
id = "ollama"
name = "Ollama (local)"
builtin = true
wire = "openai-chat"
baseUrl = "http://localhost:11434/v1"
defaultModel = "llama3.2"
requiresApiKey = false

[providers.ollama.capabilities]
supportsKeyless = true
supportsModelsEndpoint = true
supportsChatCompletions = true
supportsResponsesApi = false
supportsSystemRole = true
supportsDeveloperRole = false
supportsReasoning = false
supportsToolCalling = true
requiresClaudeCodeIdentity = false
modelDiscoveryMode = "models"
`;

/**
 * Write preferences + config so the app boots past the onboarding gate.
 *
 * @param userDataDir  The temp dir passed as `ELECTRON_USER_DATA_DIR`.
 */
export async function seedOnboardedPreferences(userDataDir: string): Promise<void> {
  // Point configDir at a sub-directory of our temp dir so it's fully
  // isolated from the developer's real XDG config.
  const configDir = join(userDataDir, 'codesign-config');
  await mkdir(configDir, { recursive: true });

  // storage-settings.json — tells initStorageSettings() where configDir is.
  const storageSettings = {
    schemaVersion: 1,
    configDir,
  };
  await writeFile(
    join(userDataDir, 'storage-settings.json'),
    `${JSON.stringify(storageSettings, null, 2)}\n`,
    'utf8',
  );

  // config.toml — the main process reads this on boot via readConfig().
  await writeFile(join(configDir, 'config.toml'), FAKE_CONFIG_TOML, 'utf8');
}
