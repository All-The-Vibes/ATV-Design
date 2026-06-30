import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Portability guard for the `.husky/pre-commit` hook.
 *
 * The hook pipes NUL-delimited staged paths into `xargs -0 ... biome check`.
 * It must use only POSIX-portable xargs options so the commit gate works for
 * BSD/macOS contributors, not just GNU/Linux CI. The GNU-only long option
 * `--no-run-if-empty` is rejected by BSD/macOS xargs ("illegal option"),
 * which aborts `git commit` for every macOS developer while Linux CI stays
 * green and hides the break. The portable spelling is the short flag `-r`
 * (BSD xargs additionally skips empty input by default).
 *
 * These tests (a) assert the hook source carries no GNU-only long options, and
 * (b) functionally exercise the exact xargs pipeline on this runner with both
 * an empty and a one-path staged list, asserting a clean exit either way.
 */
describe('.husky/pre-commit xargs portability', () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const hookPath = resolve(repoRoot, '.husky/pre-commit');
  const hook = readFileSync(hookPath, 'utf8');

  // The xargs invocation line (ignoring comments).
  const xargsLine =
    hook.split('\n').find((l) => !l.trimStart().startsWith('#') && l.includes('xargs')) ?? '';

  it('invokes xargs', () => {
    expect(xargsLine).toContain('xargs');
  });

  it('uses no GNU-only long options that BSD/macOS xargs rejects', () => {
    // `--no-run-if-empty` (and any `--long` form) is GNU-only; BSD xargs errors.
    expect(xargsLine).not.toMatch(/--no-run-if-empty/);
    expect(xargsLine).not.toMatch(/\s--[a-z]/);
  });

  it('uses the portable -r short flag to skip empty input', () => {
    // -r is supported by GNU and modern BSD/macOS xargs.
    expect(xargsLine).toMatch(/\s-r\b/);
  });

  it('the exact xargs pipeline exits 0 on an empty staged list', () => {
    // Mirror the hook: NUL-delimited empty input through `xargs -0 -r echo`.
    // `echo` stands in for biome so the test is hermetic and fast; we are
    // testing xargs option portability + empty-input handling, not biome.
    const code = runPipeline('');
    expect(code).toBe(0);
  });

  it('the exact xargs pipeline exits 0 on a one-path staged list', () => {
    const code = runPipeline('package.json\0');
    expect(code).toBe(0);
  });

  function runPipeline(nulInput) {
    // Reproduce `... | xargs -0 -r echo` and capture the exit code.
    try {
      execFileSync('sh', ['-c', 'xargs -0 -r echo >/dev/null'], {
        input: nulInput,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      return 0;
    } catch (err) {
      const status = err?.status;
      return typeof status === 'number' ? status : 1;
    }
  }
});
