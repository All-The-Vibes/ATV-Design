/**
 * open-codesign brand wordmark.
 * Logo icon + word, optional pre-alpha pill.
 * Use anywhere the app needs to identify itself.
 */

import logoSrc from '../assets/logo.png';

interface WordmarkProps {
  badge?: string;
  size?: 'sm' | 'md';
}

export function Wordmark({ badge, size = 'md' }: WordmarkProps) {
  const markPx = size === 'sm' ? 36 : 88;
  const fontSize = size === 'sm' ? '16px' : '30px';
  const badgeSize = size === 'sm' ? '8px' : '10px';
  const gap = size === 'sm' ? '8px' : '16px';
  const badgeMarginTop = size === 'sm' ? '4px' : '10px';
  return (
    <span className="inline-flex items-center leading-none" style={{ gap }}>
      <img
        src={logoSrc}
        alt=""
        width={markPx}
        height={markPx}
        className="shrink-0"
        draggable={false}
      />
      <span className="flex flex-col">
        <span
          className="leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize,
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          <span style={{ color: '#142d4c' }}>Open </span>
          <span style={{ color: '#b5441a' }}>CoDesign</span>
        </span>
        {badge ? (
          <span
            className="font-medium uppercase leading-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: badgeSize,
              letterSpacing: '0.12em',
              color: '#9a8a7c',
              marginTop: badgeMarginTop,
            }}
          >
            {badge}
          </span>
        ) : null}
      </span>
    </span>
  );
}
