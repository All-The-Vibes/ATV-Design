import { describe, expect, it } from 'vitest';
import { PROFILES, profileForKind } from './viewport-profiles';

/**
 * T2/T3 — DesignCanvas split, unit 1: the kind-aware viewport registry.
 *
 * Ported from Terminal 42's DesignCanvas.tsx (lines 17-169), which the eng
 * review flagged as a 2,249-line god-component (finding CQ-F4). The plan splits
 * it into Canvas / useDesignStream / TokenInspector / ViewportFrame /
 * useAnnotations; this is ViewportFrame's pure core — the PROFILES registry and
 * profileForKind() mapping — lifted out verbatim so it is unit-testable in
 * isolation, with no React, no window.terminal42, no IPC.
 *
 * This is the highest-value, lowest-risk slice of the port: T42's distinctive
 * "kind-aware viewport PROFILES" (analysis doc §2 calls it part of the crown
 * jewel) becomes a tested module the ported Canvas composes, instead of inline
 * god-component state.
 */

describe('viewport-profiles — registry integrity', () => {
  it('every profile has at least one viewport and a defaultViewportId that exists', () => {
    for (const [name, profile] of Object.entries(PROFILES)) {
      expect(profile.viewports.length, `${name} has viewports`).toBeGreaterThan(0);
      const ids = profile.viewports.map((v) => v.id);
      expect(ids, `${name} default is a real viewport`).toContain(profile.defaultViewportId);
    }
  });

  it('artboard profiles always offer a Fluid escape hatch alongside the fixed board', () => {
    // artboard() composes [board, fluid] — print/social kinds must keep Fluid so
    // a user can break out of the fixed aspect when reviewing. Reached via the
    // public profileForKind() entry point rather than indexing PROFILES by string.
    for (const kind of ['poster', 'flyer', 'business-card', 'social-post', 'ad-banner']) {
      const ids = profileForKind(kind).viewports.map((v) => v.id);
      expect(ids, `${kind} includes fluid`).toContain('fluid');
    }
  });

  it('web profile defaults to desktop and exposes mobile/tablet/desktop', () => {
    const web = PROFILES.web;
    expect(web.defaultViewportId).toBe('desktop');
    expect(web.viewports.map((v) => v.id).sort()).toEqual(['desktop', 'mobile', 'tablet']);
  });

  it('fluid viewports carry null width and height', () => {
    const fluid = PROFILES.generic?.viewports.find((v) => v.id === 'fluid');
    expect(fluid?.width).toBeNull();
    expect(fluid?.height).toBeNull();
  });
});

describe('profileForKind — DesignKind → profile mapping', () => {
  it('maps web-like kinds to the web profile', () => {
    for (const kind of ['landing', 'website', 'app', 'dashboard', 'wireframe']) {
      expect(profileForKind(kind).id).toBe('web');
    }
  });

  it('maps deck kinds to the slides profile', () => {
    for (const kind of ['pitch-deck', 'sales-deck', 'talk-slides', 'workshop-deck']) {
      expect(profileForKind(kind).id).toBe('slides');
    }
  });

  it('maps document kinds (resume/report/one-pager) to A4 portrait', () => {
    for (const kind of ['resume', 'report', 'one-pager']) {
      expect(profileForKind(kind).viewports[0]?.id).toBe('a4p');
    }
  });

  it('maps design-system / reference kinds to the fluid-first designRef profile', () => {
    for (const kind of ['design-system', 'mood-board', 'style-tile', 'user-flow', 'sitemap']) {
      const p = profileForKind(kind);
      expect(p.id).toBe('designRef');
      expect(p.defaultViewportId).toBe('fluid');
    }
  });

  it('falls back to the generic fluid profile for unknown or undefined kinds', () => {
    expect(profileForKind(undefined).id).toBe('generic');
    expect(profileForKind('totally-made-up-kind').id).toBe('generic');
  });

  it('returns a usable profile (non-empty viewports) for every enumerated kind', () => {
    const kinds = [
      'landing',
      'website',
      'app',
      'dashboard',
      'pitch-deck',
      'poster',
      'flyer',
      'invitation',
      'business-card',
      'certificate',
      'social-post',
      'social-story',
      'cover-image',
      'ad-banner',
      'email',
      'infographic',
      'report',
      'resume',
      'one-pager',
      'brochure',
      'chart',
      'component',
      'blog-post',
      'case-study',
      'design-system',
      'wireframe',
    ];
    for (const kind of kinds) {
      expect(profileForKind(kind).viewports.length, kind).toBeGreaterThan(0);
    }
  });
});
