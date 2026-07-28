import { describe, expect, it } from 'vitest';
import buildStaged from './build-staged.cjs';

const { resolveBuilderArgs, resolveBuilderEnv, rewriteBuilderConfigText } = buildStaged;

describe('rewriteBuilderConfigText', () => {
  it('rewrites output and extraResources paths for the staged project', () => {
    const original = `directories:
  output: release
extraResources:
  - from: ../../skills/ui-ux-pro-max
    to: skills/ui-ux-pro-max
  - from: ../../packages/core/src/skills/builtin
    to: skills/builtin
`;

    const next = rewriteBuilderConfigText(original, {
      releaseOutput: 'C:/tmp/release',
      skillBundle: 'C:/tmp/ui-ux-pro-max',
      builtinSkills: 'C:/tmp/core-builtin-skills',
    });

    expect(next).toContain('output: "C:/tmp/release"');
    expect(next).toContain('- from: "C:/tmp/ui-ux-pro-max"');
    expect(next).toContain('- from: "C:/tmp/core-builtin-skills"');
  });
});

describe('resolveBuilderArgs', () => {
  it('adds unsigned-Windows defaults only when code signing is unavailable', () => {
    expect(resolveBuilderArgs(['--dir', '--x64'], {}, 'win32')).toContain(
      '--config.win.signAndEditExecutable=false',
    );
    expect(
      resolveBuilderArgs(['--dir', '--x64'], { CSC_LINK: 'cert-data' }, 'win32'),
    ).not.toContain('--config.win.signAndEditExecutable=false');
  });

  it('adds forceCodeSigning when release CI requires it', () => {
    expect(
      resolveBuilderArgs(['--mac', '--arm64'], { ATV_REQUIRE_CODE_SIGNING: '1' }, 'darwin'),
    ).toContain('--config.forceCodeSigning=true');
  });
});

describe('resolveBuilderEnv', () => {
  it('disables mac identity auto-discovery when no signing config is present', () => {
    expect(resolveBuilderEnv({}, 'darwin').CSC_IDENTITY_AUTO_DISCOVERY).toBe('false');
  });

  it('rejects partial Apple API notarization configuration', () => {
    expect(() =>
      resolveBuilderEnv({ APPLE_API_KEY: 'key', APPLE_API_KEY_ID: 'id' }, 'darwin'),
    ).toThrow(/Apple API-key notarization/);
  });
});

describe('resolveLinuxTargets', () => {
  const { resolveLinuxTargets } = buildStaged;
  const has = (name) => (bin) => bin === name;
  const hasNone = () => false;
  const hasAll = () => true;

  it('drops rpm when rpmbuild is missing, keeping the other targets', () => {
    const { targets, dropped } = resolveLinuxTargets(['AppImage', 'deb', 'rpm'], has('dpkg'));
    expect(targets).toEqual(['AppImage', 'deb']);
    expect(dropped).toEqual([{ target: 'rpm', missing: 'rpmbuild' }]);
  });

  it('drops deb when dpkg is missing', () => {
    const { targets, dropped } = resolveLinuxTargets(['AppImage', 'deb', 'rpm'], has('rpmbuild'));
    expect(targets).toEqual(['AppImage', 'rpm']);
    expect(dropped).toEqual([{ target: 'deb', missing: 'dpkg' }]);
  });

  it('keeps every target when all packaging tools are present', () => {
    const { targets, dropped } = resolveLinuxTargets(['AppImage', 'deb', 'rpm'], hasAll);
    expect(targets).toEqual(['AppImage', 'deb', 'rpm']);
    expect(dropped).toEqual([]);
  });

  // AppImage has no external tool dependency, so it must always survive —
  // otherwise a bare machine would produce no Linux artifact at all.
  it('always keeps AppImage even with no packaging tools installed', () => {
    const { targets, dropped } = resolveLinuxTargets(['AppImage', 'deb', 'rpm'], hasNone);
    expect(targets).toEqual(['AppImage']);
    expect(dropped).toHaveLength(2);
  });

  it('is a no-op for non-linux target lists', () => {
    const { targets, dropped } = resolveLinuxTargets(['dmg'], hasNone);
    expect(targets).toEqual(['dmg']);
    expect(dropped).toEqual([]);
  });
});

describe('resolveBuilderArgs — linux packaging-tool degradation', () => {
  it('constrains linux targets to what the host can actually build', () => {
    // Host has dpkg but no rpmbuild — the exact situation this fixes.
    const args = resolveBuilderArgs([], {}, 'linux', (bin) => bin === 'dpkg');
    expect(args).toEqual(['--linux', 'AppImage', 'deb']);
  });

  // Regression: this was first written as repeated
  // `--config.linux.target=<t>` flags. That key is a SCALAR, so each flag
  // overwrote the last and only `deb` survived — the AppImage vanished from
  // the release dir with no warning. Must use the `--linux a b` list form.
  it('passes every surviving target, not just the last one', () => {
    const args = resolveBuilderArgs([], {}, 'linux', (bin) => bin === 'dpkg');
    expect(args).toContain('AppImage');
    expect(args).toContain('deb');
    expect(args.filter((a) => a === '--linux')).toHaveLength(1);
  });

  it('leaves args untouched when the caller already pinned a target', () => {
    const args = resolveBuilderArgs(['--linux', 'deb'], {}, 'linux', () => false);
    expect(args).toEqual(['--linux', 'deb']);
  });

  it('leaves a --dir build untouched', () => {
    expect(resolveBuilderArgs(['--dir', '--x64'], {}, 'linux', () => false)).toEqual([
      '--dir',
      '--x64',
    ]);
  });

  it('does not touch linux targets on other platforms', () => {
    expect(resolveBuilderArgs([], {}, 'darwin', () => false)).toEqual([]);
  });

  it('adds nothing when every packaging tool is present', () => {
    expect(resolveBuilderArgs([], {}, 'linux', () => true)).toEqual([]);
  });
});

describe('packaged runtime dependencies', () => {
  // `pnpm --prod deploy` prunes by apps/desktop/package.json. Anything only
  // reachable through `@atv-design/exporters` — which is a devDependency —
  // gets stripped from the shipped asar.
  //
  // That is not hypothetical: `puppeteer-core` and `pptxgenjs` were both
  // missing from every packaged build, so PDF and PPTX export failed at
  // runtime with ERR_MODULE_NOT_FOUND while working fine in dev. `zip-lib`
  // survived only because it happened to be listed here explicitly.
  it('declares every lazily-imported exporter dependency as a runtime dep', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    for (const dep of ['puppeteer-core', 'pptxgenjs', 'zip-lib']) {
      expect(
        pkg.dependencies,
        `${dep} must be a runtime dep or it is pruned from the asar`,
      ).toHaveProperty(dep);
    }
  });
});
