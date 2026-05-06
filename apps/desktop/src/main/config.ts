import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  CodesignError,
  type Config,
  ConfigV3Schema,
  ERROR_CODES,
  parseConfigFlexible,
  toPersistedV3,
} from '@atv-design/shared';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { getActiveStorageLocations } from './storage-settings';

const XDG_DEFAULT = join(homedir(), '.config', 'atv-design');
const LEGACY_CONFIG_DIRS = ['open-codesign'] as const;
const CONFIG_FILENAME = 'config.toml';
const LEGACY_SIDECAR_FILES = [
  'codex-auth.json',
  'copilot-auth.json',
  'preferences.json',
  'locale.json',
] as const;

export function defaultConfigDir(): string {
  const xdg = process.env['XDG_CONFIG_HOME'];
  if (xdg && xdg.length > 0) return join(xdg, 'atv-design');
  return XDG_DEFAULT;
}

export function configDir(): string {
  return getActiveStorageLocations().configDir ?? defaultConfigDir();
}

export function configPath(): string {
  return join(configDir(), CONFIG_FILENAME);
}

export async function readConfig(): Promise<Config | null> {
  const located = await locateReadableConfig();
  if (located === null) return null;
  const { path, raw, legacyDir } = located;

  let parsed: unknown;
  try {
    parsed = parseToml(raw);
  } catch (err) {
    throw new CodesignError(
      `Config at ${path} is not valid TOML`,
      ERROR_CODES.CONFIG_PARSE_FAILED,
      {
        cause: err,
      },
    );
  }

  const validated = safeParseConfig(parsed);
  if (!validated.ok) {
    throw new CodesignError(
      `Config at ${path} does not match the expected schema: ${validated.error}`,
      ERROR_CODES.CONFIG_SCHEMA_INVALID,
      { cause: validated.cause },
    );
  }
  if (legacyDir !== null) {
    await persistLegacyMigration(validated.data, legacyDir);
  }
  return validated.data;
}

async function locateReadableConfig(): Promise<{
  path: string;
  raw: string;
  legacyDir: string | null;
} | null> {
  const path = configPath();
  const raw = await tryReadUtf8(path);
  if (raw !== null) return { path, raw, legacyDir: null };
  if (getActiveStorageLocations().configDir !== undefined) return null;
  for (const legacyDir of legacyConfigDirs()) {
    const legacyPath = join(legacyDir, CONFIG_FILENAME);
    const legacyRaw = await tryReadUtf8(legacyPath);
    if (legacyRaw !== null) {
      return { path: legacyPath, raw: legacyRaw, legacyDir };
    }
  }
  return null;
}

function legacyConfigDirs(): string[] {
  const xdg = process.env['XDG_CONFIG_HOME'];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return LEGACY_CONFIG_DIRS.map((dirName) => join(base, dirName));
}

async function tryReadUtf8(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (isNotFound(err)) return null;
    throw new CodesignError(`Failed to read config at ${path}`, ERROR_CODES.CONFIG_READ_FAILED, {
      cause: err,
    });
  }
}

async function persistLegacyMigration(config: Config, legacyDir: string): Promise<void> {
  await writeConfig(config);
  await copyLegacySidecars(legacyDir, configDir());
}

async function copyLegacySidecars(legacyDir: string, targetDir: string): Promise<void> {
  const allowed = new Set<string>(LEGACY_SIDECAR_FILES);
  const entries = await readdir(legacyDir, { withFileTypes: true });
  const sidecars = entries.filter((entry) => entry.isFile() && allowed.has(entry.name));
  if (sidecars.length === 0) return;
  await mkdir(targetDir, { recursive: true });
  for (const entry of sidecars) {
    const from = join(legacyDir, entry.name);
    const to = join(targetDir, entry.name);
    const existing = await tryReadUtf8(to);
    if (existing !== null) continue;
    await copyFile(from, to);
    if (process.platform !== 'win32') {
      try {
        await chmod(to, 0o600);
      } catch {
        // best-effort only
      }
    }
  }
}

function safeParseConfig(
  parsed: unknown,
): { ok: true; data: Config } | { ok: false; error: string; cause: unknown } {
  try {
    return { ok: true, data: parseConfigFlexible(parsed) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      cause: err,
    };
  }
}

export async function writeConfig(config: Config): Promise<void> {
  const persisted = toPersistedV3(config);
  // Fail fast on shape drift at write-time instead of letting a broken
  // config land on disk and crash the NEXT boot. This is how the v0.1
  // "app won't reopen after deleting all providers" bug shipped —
  // activeModel='' was written here, then readConfig's parse rejected it.
  ConfigV3Schema.parse(persisted);
  const dir = configDir();
  await mkdir(dir, { recursive: true });
  const path = configPath();
  const body = stringifyToml(persisted as Record<string, unknown>);
  await writeFile(path, body, { encoding: 'utf8', mode: 0o600 });
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}
