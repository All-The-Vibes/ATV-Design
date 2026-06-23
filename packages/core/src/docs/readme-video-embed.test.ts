/**
 * README demo-video embed contract.
 *
 * The root README advertises a "73-second demo". It must embed the video so it
 * plays *inline* on the rendered GitHub README, not link out to the `.mp4` blob.
 *
 * The old pattern — a clickable thumbnail linking to a relative `.mp4` path,
 * `[![still](./assets/video/...jpg)](./assets/video/...mp4)` — renders no
 * `<video>` element and 404s on forks/branches that lack the file. This test
 * locks in the inline-player requirement so the regression can't come back.
 *
 * The src must be a `github.com` asset/release URL: GitHub's README sanitizer
 * strips `<video>` tags whose src is `raw.githubusercontent.com` (verified
 * empirically — the tag renders as an empty `<p>`).
 *
 * Rendered-on-GitHub playback is verified separately via Agent Browser; this
 * test guards the source-level contract that runs in CI without network.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// packages/core/src/docs -> repo root is four levels up (mirrors skills/loader.test.ts).
const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const README = readFileSync(new URL('README.md', `file://${REPO_ROOT}`), 'utf-8');

/** The `src` of the README's first `<video>` tag, or '' if there is none. */
function videoSrc(): string {
  return README.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? '';
}

describe('README demo-video embed', () => {
  it('contains an inline <video> element so the demo plays in the rendered README', () => {
    expect(README).toMatch(/<video[\s>]/i);
  });

  it('gives the <video> playback controls', () => {
    const tag = README.match(/<video\b[^>]*>/i)?.[0] ?? '';
    expect(tag).toMatch(/\bcontrols\b/i);
  });

  it('sources the video from a GitHub host that renders <video> inline (not raw.githubusercontent.com, which GitHub strips from READMEs)', () => {
    // GitHub's README sanitizer keeps <video> only for github.com asset/release
    // hosts; a raw.githubusercontent.com src is stripped to an empty <p>.
    expect(videoSrc()).toMatch(/^https:\/\/github\.com\/.+\.mp4$/i);
  });

  it('points the video at the atv-design-demo.mp4 asset', () => {
    expect(videoSrc()).toContain('atv-design-demo.mp4');
  });

  it('does not use the broken relative-mp4 thumbnail-link pattern', () => {
    // [![alt](poster)](./assets/video/...mp4) — links out instead of embedding,
    // and 404s wherever the file is absent.
    expect(README).not.toMatch(/\]\(\.\/assets\/video\/[^)]*\.mp4\)/i);
  });
});
