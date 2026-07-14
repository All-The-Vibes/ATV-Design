import { getExamplePreview } from '@atv-design/templates';
import { useEffect, useMemo, useRef, useState } from 'react';

// Freeze motion so each card behaves like a static snapshot — same rationale as
// DesignCardPreview (many iframes in a grid should not animate in parallel).
const THUMBNAIL_STYLE = `<style>
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scrollbar-width: none !important;
}
*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
html, body { overflow: hidden !important; }
</style>`;

export function injectThumbnailStyle(srcDoc: string): string {
  if (/<\/head>/i.test(srcDoc)) {
    return srcDoc.replace(/<\/head>/i, `${THUMBNAIL_STYLE}</head>`);
  }
  return THUMBNAIL_STYLE + srcDoc;
}

// Preview canvases are authored at 1280x800 (16:10) to match the card aspect.
const CANVAS_W = 1280;
const CANVAS_H = 800;

export interface ExampleCardPreviewProps {
  exampleId: string;
  title: string;
  /** SVG thumbnail markup, rendered as the fallback when no HTML preview exists. */
  thumbnail: string;
}

/**
 * Renders a real, scaled, sandboxed iframe preview of an example's canvas when
 * one is available (see packages/templates/src/examples/previews.ts). Falls back
 * to the bundled SVG thumbnail otherwise, so every card still shows something.
 */
export function ExampleCardPreview({ exampleId, title, thumbnail }: ExampleCardPreviewProps) {
  const previewHtml = useMemo(() => getExamplePreview(exampleId), [exampleId]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.3);

  // Lazy-mount the iframe only once the card nears the viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !previewHtml) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [previewHtml]);

  // Scale the 1280x800 canvas to fully cover the card.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !previewHtml || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w <= 0 || h <= 0) continue;
        const next = Math.max(w / CANVAS_W, h / CANVAS_H);
        setScale((prev) => (Math.abs(prev - next) > 0.001 ? next : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewHtml]);

  const srcDoc = useMemo(
    () => (previewHtml ? injectThumbnailStyle(previewHtml) : null),
    [previewHtml],
  );

  // No HTML preview → keep the original SVG thumbnail treatment.
  if (!srcDoc) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: thumbnails are static bundled strings authored in-repo, not user content
        dangerouslySetInnerHTML={{ __html: thumbnail }}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="absolute inset-0 overflow-hidden bg-white transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
    >
      {visible ? (
        <div
          style={{
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            title={title}
            srcDoc={srcDoc}
            sandbox=""
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none border-0"
            style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(110deg,var(--color-background-secondary)_0%,rgba(0,0,0,0.03)_40%,var(--color-background-secondary)_80%)]" />
      )}
    </div>
  );
}
