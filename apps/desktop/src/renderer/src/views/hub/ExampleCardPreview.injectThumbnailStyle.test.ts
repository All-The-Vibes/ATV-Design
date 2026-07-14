/**
 * Unit tests for ExampleCardPreview's pure srcDoc-preparation helper.
 * The motion-freeze style must be injected regardless of document shape so a
 * grid of preview iframes never animates in parallel.
 */
import { describe, expect, it } from 'vitest';
import { injectThumbnailStyle } from './ExampleCardPreview';

describe('injectThumbnailStyle', () => {
  it('injects the freeze style just before </head> when a head exists', () => {
    const out = injectThumbnailStyle('<html><head><title>x</title></head><body>hi</body></html>');
    expect(out).toContain('animation-duration: 0s');
    // Style lands inside <head>, before the closing tag.
    const styleIdx = out.indexOf('<style>');
    const headCloseIdx = out.indexOf('</head>');
    expect(styleIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeLessThan(headCloseIdx);
  });

  it('prepends the freeze style when the document has no head', () => {
    const out = injectThumbnailStyle('<body>just a fragment</body>');
    expect(out.startsWith('<style>')).toBe(true);
    expect(out).toContain('just a fragment');
  });

  it('is case-insensitive about the closing head tag', () => {
    const out = injectThumbnailStyle('<HEAD></HEAD><body>x</body>');
    expect(out).toContain('<style>');
    // Only injected once.
    expect(out.match(/animation-duration/g)?.length).toBe(1);
  });
});
