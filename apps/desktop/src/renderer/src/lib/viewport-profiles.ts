/**
 * T2/T3 — DesignCanvas split, unit 1: kind-aware viewport registry (ViewportFrame).
 *
 * Ported from Terminal 42 `DesignCanvas.tsx` (the 2,249-line god-component the
 * eng review flagged, finding CQ-F4). This is the pure, paradigm-neutral core
 * of the canvas's viewport behaviour — the `PROFILES` registry and the
 * `profileForKind()` DesignKind→profile mapping — lifted out so the ported
 * Canvas composes a tested module instead of inline state.
 *
 * No React, no window.terminal42, no IPC: just data + a switch. Attribution:
 * Terminal 42 by akwasijr (see ATTRIBUTION.md), used under the merge's MIT grant.
 */

export type Viewport = {
  id: string;
  label: string;
  width: number | null;
  height: number | null;
};

export type CanvasProfile = {
  id: string;
  viewports: Viewport[];
  defaultViewportId: string;
  showZoom: boolean;
};

/** A fixed-size artboard plus a Fluid escape hatch (print/social kinds). */
function artboard(id: string, board: Viewport): CanvasProfile {
  return {
    id,
    viewports: [board, { id: 'fluid', label: 'Fluid', width: null, height: null }],
    defaultViewportId: board.id,
    showZoom: true,
  };
}

export const PROFILES = {
  // Web pages: phone / tablet / desktop. Fluid intentionally removed — it
  // implied "browser window" but the canvas never sits at window width.
  web: {
    id: 'web',
    viewports: [
      { id: 'mobile', label: 'Mobile 375', width: 375, height: 812 },
      { id: 'tablet', label: 'Tablet 834', width: 834, height: 1112 },
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 },
    ],
    defaultViewportId: 'desktop',
    showZoom: false,
  },
  // 16:9 slide framing.
  slides: {
    id: 'slides',
    viewports: [
      { id: 'slide-1280', label: '1280 × 720', width: 1280, height: 720 },
      { id: 'slide-1920', label: '1920 × 1080', width: 1920, height: 1080 },
      { id: 'fluid', label: 'Fluid', width: null, height: null },
    ],
    defaultViewportId: 'fluid',
    showZoom: true,
  },
  // Print artboards.
  poster: artboard('print-poster', {
    id: 'a3p',
    label: 'A3 Portrait 1240 × 1754',
    width: 1240,
    height: 1754,
  }),
  flyer: artboard('print-flyer', {
    id: 'a5p',
    label: 'A5 Portrait 740 × 1050',
    width: 740,
    height: 1050,
  }),
  invitation: artboard('print-inv', {
    id: '5x7',
    label: '5 × 7 in 1500 × 2100',
    width: 1500,
    height: 2100,
  }),
  'business-card': artboard('print-bc', {
    id: 'bc',
    label: '3.5 × 2 in 1050 × 600',
    width: 1050,
    height: 600,
  }),
  certificate: artboard('print-cert', {
    id: 'a4l',
    label: 'A4 Landscape 1754 × 1240',
    width: 1754,
    height: 1240,
  }),
  // Social tiles.
  'social-post': artboard('social-post', {
    id: '1x1',
    label: '1080 × 1080',
    width: 1080,
    height: 1080,
  }),
  'social-story': artboard('social-story', {
    id: '9x16',
    label: '1080 × 1920',
    width: 1080,
    height: 1920,
  }),
  'cover-image': artboard('social-cover', {
    id: '3x1',
    label: '1500 × 500',
    width: 1500,
    height: 500,
  }),
  'ad-banner': artboard('social-ad', { id: 'lb', label: '728 × 90', width: 728, height: 90 }),
  // Email.
  email: {
    id: 'email',
    viewports: [
      { id: 'email-600', label: 'Email 600', width: 600, height: null },
      { id: 'mobile', label: 'Mobile 375', width: 375, height: null },
      { id: 'fluid', label: 'Fluid', width: null, height: null },
    ],
    defaultViewportId: 'email-600',
    showZoom: true,
  },
  // Documents (resume / one-pager / report etc).
  a4Portrait: artboard('a4p', {
    id: 'a4p',
    label: 'A4 Portrait 794 × 1123',
    width: 794,
    height: 1123,
  }),
  // Tall column (infographic).
  infographic: {
    id: 'infographic',
    viewports: [
      { id: 'infog', label: '800 wide', width: 800, height: null },
      { id: 'fluid', label: 'Fluid', width: null, height: null },
    ],
    defaultViewportId: 'infog',
    showZoom: true,
  },
  // Brochure: tri-fold wide.
  brochure: artboard('brochure', {
    id: 'tri',
    label: 'Tri-fold 2232 × 1050',
    width: 2232,
    height: 1050,
  }),
  // Chart.
  chart: artboard('chart', { id: 'chart', label: '800 × 500', width: 800, height: 500 }),
  // Component playground: pinned to real widths.
  component: {
    id: 'component',
    viewports: [
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 },
      { id: 'tablet', label: 'Tablet 834', width: 834, height: 1112 },
      { id: 'mobile', label: 'Mobile 375', width: 375, height: 812 },
    ],
    defaultViewportId: 'desktop',
    showZoom: true,
  },
  // Article column (blog post / case study).
  article: {
    id: 'article',
    viewports: [
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 800 },
      { id: 'tablet', label: 'Tablet 834', width: 834, height: 1112 },
      { id: 'mobile', label: 'Mobile 375', width: 375, height: 812 },
    ],
    defaultViewportId: 'desktop',
    showZoom: false,
  },
  // Design-system / mood-board / style-tile / user-flow / sitemap: tall+wide
  // reference docs, best viewed fluid with optional fixed widths for review.
  designRef: {
    id: 'designRef',
    viewports: [
      { id: 'fluid', label: 'Fluid', width: null, height: null },
      { id: 'desktop', label: 'Desktop 1280', width: 1280, height: 1600 },
      { id: 'tablet', label: 'Tablet 834', width: 834, height: 1400 },
    ],
    defaultViewportId: 'fluid',
    showZoom: true,
  },
  // Fallback for unenumerated kinds.
  generic: {
    id: 'generic',
    viewports: [{ id: 'fluid', label: 'Fluid', width: null, height: null }],
    defaultViewportId: 'fluid',
    showZoom: true,
  },
} satisfies Record<string, CanvasProfile>;

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export { ZOOM_LEVELS };

/** Map a design kind (T42 DesignKind, loosely typed) to its canvas profile. */
export function profileForKind(kind: string | undefined): CanvasProfile {
  switch (kind) {
    case 'landing':
    case 'website':
    case 'app':
    case 'app-screen':
    case 'dashboard':
    case 'pricing':
    case 'login':
    case 'hero':
      return PROFILES.web;
    case 'pitch-deck':
    case 'sales-deck':
    case 'talk-slides':
    case 'workshop-deck':
      return PROFILES.slides;
    case 'poster':
      return PROFILES.poster;
    case 'flyer':
      return PROFILES.flyer;
    case 'invitation':
      return PROFILES.invitation;
    case 'business-card':
      return PROFILES['business-card'];
    case 'certificate':
      return PROFILES.certificate;
    case 'social-post':
      return PROFILES['social-post'];
    case 'social-story':
      return PROFILES['social-story'];
    case 'cover-image':
      return PROFILES['cover-image'];
    case 'ad-banner':
      return PROFILES['ad-banner'];
    case 'email':
      return PROFILES.email;
    case 'infographic':
      return PROFILES.infographic;
    case 'report':
    case 'resume':
    case 'one-pager':
      return PROFILES.a4Portrait;
    case 'brochure':
      return PROFILES.brochure;
    case 'chart':
      return PROFILES.chart;
    case 'component':
      return PROFILES.component;
    case 'blog-post':
    case 'case-study':
      return PROFILES.article;
    case 'design-system':
    case 'component-library':
    case 'mood-board':
    case 'style-tile':
    case 'user-flow':
    case 'sitemap':
      return PROFILES.designRef;
    case 'wireframe':
      return PROFILES.web;
    default:
      return PROFILES.generic;
  }
}
