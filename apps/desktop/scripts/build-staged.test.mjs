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
`;

    const next = rewriteBuilderConfigText(original, {
      releaseOutput: 'C:/tmp/release',
      skillBundle: 'C:/tmp/ui-ux-pro-max',
    });

    expect(next).toContain('output: "C:/tmp/release"');
    expect(next).toContain('- from: "C:/tmp/ui-ux-pro-max"');
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
