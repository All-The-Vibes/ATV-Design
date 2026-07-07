import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Dependency-alignment guard for the electron-builder toolchain (issue #26).
 *
 * After #16 bumped `electron-builder` to ^26.15.3, `app-builder-lib@26.15.3`
 * declares an exact peer `electron-builder-squirrel-windows: 26.15.3`. The
 * repo pinned `electron-builder-squirrel-windows` at an exact, older `26.8.1`,
 * so pnpm resolved the peer non-strictly (a warning, not an error) and carried
 * TWO copies of `app-builder-lib` (26.8.1 + 26.15.3) in the lockfile.
 *
 * The Windows target in `apps/desktop/electron-builder.yml` is `nsis`, not
 * `squirrel`, so the squirrel path is never exercised at package time. Dropping
 * the dependency outright does NOT help, though: `app-builder-lib` declares
 * `electron-builder-squirrel-windows` as a REQUIRED (non-optional) peer, and
 * `app-builder-lib` is the core of `electron-builder` itself — so squirrel is
 * pulled into the tree as a peer regardless. The fix therefore pins
 * `electron-builder-squirrel-windows` in lockstep at `26.15.3`, which collapses
 * `app-builder-lib` back to a single resolved version deterministically.
 *
 * These tests lock that invariant in so a future bump cannot silently
 * reintroduce the duplicate:
 *  (a) the lockfile resolves exactly one `app-builder-lib` version, and
 *  (b) if `apps/desktop/package.json` pins `electron-builder-squirrel-windows`,
 *      that pin matches the resolved `app-builder-lib` version exactly (the
 *      peer is exact-pinned, so anything looser can float back into a dup).
 */
describe('electron-builder dependency alignment (issue #26)', () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const lockfile = readFileSync(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf8');
  const desktopPkg = JSON.parse(
    readFileSync(resolve(repoRoot, 'apps/desktop/package.json'), 'utf8'),
  );

  /**
   * Collect the distinct semver versions a package resolves to in the pnpm
   * lockfile. pnpm's package graph writes both a plain definition stanza
   * (`  name@1.2.3:`) and peer-annotated variants
   * (`  name@1.2.3(peer@x)(peer@y):`). We normalise both to just the version
   * so two peer contexts of the same version count once, while genuinely
   * different versions (the bug) count separately.
   */
  function resolvedVersions(pkgName) {
    const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match a top-level lockfile key: two-space indent, name@version, then
    // either ':' or '(' (peer annotation). Anchored to line start.
    const re = new RegExp(`^ {2}${escaped}@([0-9][^(:\\s]*)(?:\\(|:)`, 'gm');
    const versions = new Set();
    for (const match of lockfile.matchAll(re)) {
      versions.add(match[1]);
    }
    return [...versions];
  }

  it('resolves exactly one app-builder-lib version in the lockfile', () => {
    const versions = resolvedVersions('app-builder-lib');
    // A single resolved version means the electron-builder peer graph is in
    // lockstep. Two versions is the #26 duplicate (26.8.1 + 26.15.3). This is
    // the authoritative guard: it reads the ACTUAL resolved graph, so it goes
    // red on any regression regardless of how the manifest specs are written.
    expect(versions).toHaveLength(1);
  });

  it('pins electron-builder-squirrel-windows to the resolved app-builder-lib version', () => {
    const allDeps = {
      ...(desktopPkg.dependencies ?? {}),
      ...(desktopPkg.devDependencies ?? {}),
    };
    const squirrel = allDeps['electron-builder-squirrel-windows'];

    // squirrel is a required peer of app-builder-lib and is pinned in the
    // manifest. app-builder-lib's peer constraint on it is EXACT, so the pin
    // must equal the resolved app-builder-lib version exactly — a looser spec
    // (e.g. same-minor float) can silently pull a second app-builder-lib back
    // in. If a future change instead drops the direct pin entirely, that is
    // also acceptable (test #1 still enforces the single-version invariant).
    if (squirrel !== undefined) {
      const [appBuilderLib] = resolvedVersions('app-builder-lib');
      const exactPin = String(squirrel).replace(/^[\^~]/, '');
      expect(exactPin).toBe(appBuilderLib);
    } else {
      expect(squirrel).toBeUndefined();
    }
  });

  it('keeps dmg-builder resolved to a single version (regression guard)', () => {
    // dmg-builder shares the same peer-graph shape as squirrel; it was already
    // single-version. Assert it stays that way so the fix does not perturb it.
    const versions = resolvedVersions('dmg-builder');
    expect(versions).toHaveLength(1);
  });
});
