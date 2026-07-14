/**
 * Unit tests for TopBar navigation intent + test-id contract. The wordmark's
 * "home" action must target the hub Recent tab; asserted on the pure descriptor
 * so no component mount is required.
 */
import { describe, expect, it } from 'vitest';
import { TOPBAR_TEST_IDS, hubHomeNavigation } from './TopBar';

describe('hubHomeNavigation', () => {
  it('targets the hub Recent tab (canonical home)', () => {
    expect(hubHomeNavigation()).toEqual({ hubTab: 'recent', view: 'hub' });
  });
});

describe('TOPBAR_TEST_IDS', () => {
  it('exposes a stable home-button test id', () => {
    expect(TOPBAR_TEST_IDS.buttonHome).toBe('topbar-button-home');
  });
});
