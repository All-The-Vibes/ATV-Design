import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl } from './open-external';

describe('isAllowedExternalUrl', () => {
  it('accepts /issues/new URL (Report flow)', () => {
    expect(
      isAllowedExternalUrl('https://github.com/All-The-Vibes/ATV-Design/issues/new?title=x&body=y'),
    ).toBe(true);
  });

  it('accepts /releases URL (update banner)', () => {
    expect(
      isAllowedExternalUrl('https://github.com/All-The-Vibes/ATV-Design/releases/tag/v0.1.0'),
    ).toBe(true);
  });

  it('rejects unrelated host', () => {
    expect(
      isAllowedExternalUrl('https://evil.example.com/All-The-Vibes/ATV-Design/issues/new'),
    ).toBe(false);
  });

  it('rejects different repo path on github.com', () => {
    expect(isAllowedExternalUrl('https://github.com/attacker/malicious/issues/new')).toBe(false);
  });

  it('rejects non-https protocols', () => {
    expect(isAllowedExternalUrl('http://github.com/All-The-Vibes/ATV-Design/issues/new')).toBe(
      false,
    );
    expect(isAllowedExternalUrl('file:///Users/attacker/All-The-Vibes/ATV-Design/issues/new')).toBe(
      false,
    );
  });

  it('rejects malformed URL strings', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false);
    expect(isAllowedExternalUrl('')).toBe(false);
  });

  it('rejects repo root and other paths like /pulls', () => {
    expect(isAllowedExternalUrl('https://github.com/All-The-Vibes/ATV-Design')).toBe(false);
    expect(isAllowedExternalUrl('https://github.com/All-The-Vibes/ATV-Design/pulls/1')).toBe(false);
  });

  it('does not accept a prefix-smuggled path like /issuesFAKE', () => {
    // Exact "/issues" or "/issues/..." — not "/issuesEVIL/..."
    expect(isAllowedExternalUrl('https://github.com/All-The-Vibes/ATV-Design/issuesEVIL/1')).toBe(
      false,
    );
  });
});
