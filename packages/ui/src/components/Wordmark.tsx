/**
 * ATV Design brand wordmark.
 * Vector-first brand mark + word, with optional version badge.
 * Use anywhere the app needs to identify itself.
 */

import { useId } from 'react';

interface WordmarkProps {
  badge?: string;
  layout?: 'inline' | 'stacked';
  size?: 'sm' | 'md' | 'lg';
}

interface SizeConfig {
  badgeSize: string;
  fontSize: string;
  inlineGap: string;
  markPx: number;
  badgeMarginTop: string;
  stackGap: string;
}

const SIZE_CONFIG: Record<NonNullable<WordmarkProps['size']>, SizeConfig> = {
  sm: {
    markPx: 36,
    fontSize: '16px',
    badgeSize: '8px',
    inlineGap: '8px',
    stackGap: '8px',
    badgeMarginTop: '4px',
  },
  md: {
    markPx: 54,
    fontSize: '30px',
    badgeSize: '10px',
    inlineGap: '12px',
    stackGap: '12px',
    badgeMarginTop: '8px',
  },
  lg: {
    markPx: 176,
    fontSize: '52px',
    badgeSize: '11px',
    inlineGap: '18px',
    stackGap: '16px',
    badgeMarginTop: '10px',
  },
};

function BrandMark({ size }: { size: number }) {
  const uniqueId = useId().replace(/:/g, '');
  const paperId = `${uniqueId}-paper`;
  const orangeId = `${uniqueId}-orange`;
  const shadowId = `${uniqueId}-shadow`;

  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={paperId}
          x1="25"
          y1="22"
          x2="116"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FBF6F0" />
          <stop offset="1" stopColor="#F3E8DC" />
        </linearGradient>
        <linearGradient
          id={orangeId}
          x1="78"
          y1="44"
          x2="144"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#D45A1F" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <filter
          id={shadowId}
          x="10"
          y="12"
          width="138"
          height="118"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#142D4C" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        <g transform="rotate(-8 72 62)">
          <rect
            x="24"
            y="22"
            width="94"
            height="76"
            rx="18"
            fill={`url(#${paperId})`}
            stroke="#142D4C"
            strokeWidth="6"
          />
          <path
            d="M38 43H61"
            stroke="#142D4C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="4 8"
            opacity="0.85"
          />
          <path
            d="M44 76C54 60 62 50 72 44C81 49 90 59 98 76"
            stroke="#142D4C"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M57 61H87" stroke="#B5441A" strokeWidth="5.5" strokeLinecap="round" />
          <path
            d="M41 57C59 33 87 31 104 46"
            stroke="#B5441A"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="5 8"
            opacity="0.9"
          />
          <rect x="36" y="36" width="10" height="10" rx="2" fill="#142D4C" opacity="0.92" />
          <rect x="92" y="34" width="10" height="10" rx="2" fill="#F97316" opacity="0.95" />
          <rect x="39" y="84" width="8" height="8" rx="2" fill="#B5441A" opacity="0.92" />
          <circle cx="73" cy="44" r="4.5" fill="#F97316" />
        </g>
      </g>

      <g transform="translate(95 54) rotate(18)">
        <rect x="0" y="0" width="38" height="16" rx="8" fill={`url(#${orangeId})`} />
        <rect x="8" y="0" width="5" height="16" fill="#142D4C" opacity="0.95" />
        <path d="M38 0L54 8L38 16V0Z" fill="#F4C69A" />
        <path d="M46 4.5L54 8L46 11.5V4.5Z" fill="#142D4C" />
        <path d="M2 8H13" stroke="#FBF6F0" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      </g>

      <path
        d="M118 34L121 28M126 41L133 39M121 47L124 53"
        stroke="#F97316"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ badge, layout = 'inline', size = 'md' }: WordmarkProps) {
  const config = SIZE_CONFIG[size];
  const inline = layout === 'inline';

  return (
    <span
      role="img"
      aria-label="ATV Design"
      className="inline-flex leading-none"
      style={{
        alignItems: 'center',
        flexDirection: inline ? 'row' : 'column',
        gap: inline ? config.inlineGap : config.stackGap,
      }}
    >
      <BrandMark size={config.markPx} />

      <span
        className="flex flex-col"
        style={{
          alignItems: inline ? 'flex-start' : 'center',
          textAlign: inline ? 'left' : 'center',
        }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: config.fontSize,
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          <span style={{ color: '#142D4C' }}>ATV</span>
          <span style={{ color: '#B5441A', marginLeft: '0.22em' }}>Design</span>
        </span>
        {badge ? (
          <span
            className="font-medium uppercase leading-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: config.badgeSize,
              letterSpacing: '0.12em',
              color: '#9A8A7C',
              marginTop: config.badgeMarginTop,
            }}
          >
            {badge}
          </span>
        ) : null}
      </span>
    </span>
  );
}
