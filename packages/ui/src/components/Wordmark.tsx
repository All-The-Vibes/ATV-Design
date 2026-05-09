/**
 * ATV Design brand wordmark.
 * Clean vector artboard mark + wordmark, with optional version badge.
 */

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
    markPx: 32,
    fontSize: '15px',
    badgeSize: '8px',
    inlineGap: '8px',
    stackGap: '8px',
    badgeMarginTop: '4px',
  },
  md: {
    markPx: 42,
    fontSize: '28px',
    badgeSize: '10px',
    inlineGap: '10px',
    stackGap: '12px',
    badgeMarginTop: '7px',
  },
  lg: {
    markPx: 136,
    fontSize: '50px',
    badgeSize: '11px',
    inlineGap: '16px',
    stackGap: '14px',
    badgeMarginTop: '10px',
  },
};

function BrandMark({ size }: { size: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="20"
        y="20"
        width="120"
        height="120"
        rx="28"
        fill="#FBF6F0"
        stroke="#142D4C"
        strokeWidth="8"
      />

      <path d="M36 50H50" stroke="#142D4C" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      <path
        d="M110 36H124V50"
        stroke="#142D4C"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.68"
      />
      <path
        d="M36 110V124H50"
        stroke="#142D4C"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.68"
      />

      <path
        d="M53 112L80 48L107 112"
        stroke="#B5441A"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M65 84H95" stroke="#142D4C" strokeWidth="8" strokeLinecap="round" />

      <circle cx="80" cy="48" r="6" fill="#F97316" />
      <circle cx="48" cy="48" r="4" fill="#142D4C" opacity="0.9" />
      <circle cx="112" cy="112" r="4" fill="#F97316" opacity="0.95" />
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
            fontWeight: 580,
            letterSpacing: '-0.032em',
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
