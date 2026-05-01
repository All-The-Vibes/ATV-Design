import { useT } from '@open-codesign/i18n';
import {
  type EditmodeBlock,
  type TokenSchemaEntry,
  type TweakSchema,
  parseEditmodeBlock,
  parseTweakSchema,
  replaceEditmodeBlock,
} from '@open-codesign/shared';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useCodesignStore } from '../store';

type TokenValue = unknown;
type Tokens = Record<string, TokenValue>;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CSS_COLOR_RE =
  /^(#([0-9a-f]{3}|[0-9a-f]{6})|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([^)]*\)|color\([^)]*\)|[a-z]+)$/i;

function isColorString(value: unknown): value is string {
  return typeof value === 'string' && CSS_COLOR_RE.test(value.trim());
}

function isNativeColorInputValue(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function ColorSwatch({
  value,
  onChange,
  pickColorLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  pickColorLabel: string;
}) {
  const canPickNatively = isNativeColorInputValue(value);
  const swatchClassName = `relative inline-flex h-[28px] w-[28px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] shadow-[var(--shadow-inset-soft)] transition-transform duration-[var(--duration-faster)] ${
    canPickNatively
      ? 'cursor-pointer hover:scale-[1.04] active:scale-[var(--scale-press-down)]'
      : 'cursor-default'
  }`;
  const swatchFill = (
    <span className="block h-full w-full" style={{ backgroundColor: value }} aria-hidden="true" />
  );
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      {canPickNatively ? (
        <label className={swatchClassName}>
          {swatchFill}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={pickColorLabel}
          />
        </label>
      ) : (
        <div className={swatchClassName}>{swatchFill}</div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-transparent bg-[var(--color-surface-hover)] px-[var(--space-2)] py-[6px] text-[12px] text-[var(--color-text-primary)] uppercase tracking-[0.04em] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-active)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:outline-none"
        style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: "'tnum'" }}
      />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-[var(--duration-fast)] ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-active)]'
      }`}
    >
      <span
        className={`inline-block h-[14px] w-[14px] rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-soft)] transition-transform duration-[var(--duration-fast)] ${
          checked ? 'translate-x-[17px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (!Number.isNaN(n) && e.target.value.trim() !== '') onChange(n);
      }}
      className="w-full rounded-[var(--radius-sm)] border border-transparent bg-[var(--color-surface-hover)] px-[var(--space-2)] py-[6px] text-right text-[12px] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-active)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:outline-none"
      style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: "'tnum'" }}
    />
  );
}

function RangeSlider({
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string | undefined;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[4px] min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-active)] accent-[var(--color-accent)]"
      />
      <span
        className="min-w-[44px] text-right text-[11px] text-[var(--color-text-secondary)]"
        style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: "'tnum'" }}
      >
        {value}
        {unit ?? ''}
      </span>
    </div>
  );
}

function SegmentedPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)] p-[2px]">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`flex-1 truncate rounded-[var(--radius-sm)] px-[var(--space-2)] py-[4px] text-[11px] transition-colors duration-[var(--duration-faster)] ${
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-soft)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  mono = false,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  mono?: boolean;
  placeholder?: string | undefined;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder={placeholder}
      className="w-full rounded-[var(--radius-sm)] border border-transparent bg-[var(--color-surface-hover)] px-[var(--space-2)] py-[6px] text-[12px] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-active)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:outline-none"
      style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
    />
  );
}

function JsonInput({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value));
  const [valid, setValid] = useState(true);
  useEffect(() => {
    setText(JSON.stringify(value));
    setValid(true);
  }, [value]);
  return (
    <input
      type="text"
      value={text}
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
        try {
          const next = JSON.parse(e.target.value);
          setValid(true);
          onChange(next);
        } catch {
          setValid(false);
        }
      }}
      className={`w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface-hover)] px-[var(--space-2)] py-[6px] text-[11px] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-active)] focus:bg-[var(--color-surface)] focus:outline-none ${
        valid
          ? 'border-transparent focus:border-[var(--color-accent)]'
          : 'border-[var(--color-error)]'
      }`}
      style={{ fontFamily: 'var(--font-mono)' }}
    />
  );
}

function TokenRow({
  tokenKey,
  value,
  onChange,
  pickColorLabel,
  schemaEntry,
}: {
  tokenKey: string;
  value: TokenValue;
  onChange: (next: TokenValue) => void;
  pickColorLabel: string;
  schemaEntry?: TokenSchemaEntry | undefined;
}) {
  const labelText = humanize(tokenKey);

  // Schema-driven render — agent declared the control kind explicitly.
  if (schemaEntry) {
    if (schemaEntry.kind === 'boolean') {
      const v = typeof value === 'boolean' ? value : Boolean(value);
      return (
        <div className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-1_5)]">
          <span className="truncate text-[12px] text-[var(--color-text-primary)]">{labelText}</span>
          <Switch checked={v} onChange={(next) => onChange(next)} label={labelText} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-[var(--space-1_5)] py-[var(--space-1)]">
        <span
          className="text-[10px] uppercase text-[var(--color-text-muted)]"
          style={{ letterSpacing: 'var(--tracking-label)' }}
        >
          {labelText}
        </span>
        {schemaEntry.kind === 'color' ? (
          <ColorSwatch
            value={typeof value === 'string' ? value : '#000000'}
            onChange={(v) => onChange(v)}
            pickColorLabel={pickColorLabel}
          />
        ) : schemaEntry.kind === 'number' ? (
          <RangeSlider
            value={typeof value === 'number' ? value : 0}
            min={schemaEntry.min ?? 0}
            max={schemaEntry.max ?? 100}
            step={schemaEntry.step ?? 1}
            unit={schemaEntry.unit}
            onChange={(v) => onChange(v)}
          />
        ) : schemaEntry.kind === 'enum' ? (
          <SegmentedPicker
            value={typeof value === 'string' ? value : (schemaEntry.options[0] ?? '')}
            options={schemaEntry.options}
            onChange={(v) => onChange(v)}
          />
        ) : (
          <TextInput
            value={typeof value === 'string' ? value : ''}
            onChange={(v) => onChange(v)}
            placeholder={schemaEntry.placeholder}
          />
        )}
      </div>
    );
  }

  // Fallback heuristic — same as before.
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-[var(--space-3)] py-[var(--space-1_5)]">
        <span className="truncate text-[12px] text-[var(--color-text-primary)]">{labelText}</span>
        <Switch checked={value} onChange={(v) => onChange(v)} label={labelText} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-1_5)] py-[var(--space-1)]">
      <span
        className="text-[10px] uppercase text-[var(--color-text-muted)]"
        style={{ letterSpacing: 'var(--tracking-label)' }}
      >
        {labelText}
      </span>
      {isColorString(value) ? (
        <ColorSwatch value={value} onChange={(v) => onChange(v)} pickColorLabel={pickColorLabel} />
      ) : typeof value === 'number' ? (
        <NumberInput value={value} onChange={(v) => onChange(v)} />
      ) : typeof value === 'string' ? (
        <TextInput value={value} onChange={(v) => onChange(v)} />
      ) : (
        <JsonInput value={value} onChange={(v) => onChange(v)} />
      )}
    </div>
  );
}

export function TweakPanel({
  iframeRef,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
  const t = useT();
  const previewHtml = useCodesignStore((s) => s.previewHtml);
  const setPreviewHtml = useCodesignStore((s) => s.setPreviewHtml);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Drag-to-reposition state. Null = default anchored position (top-right).
  // Once dragged, the panel sticks wherever the user left it (persisted to
  // localStorage so it survives reloads).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem('codesign.tweakPanel.pos');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed;
    } catch {
      /* noop */
    }
    return null;
  });
  const dragState = useRef<{
    startX: number;
    startY: number;
    baseLeft: number;
    baseTop: number;
  } | null>(null);
  /** Sticky flag set the moment a drag starts — survives until the next click
   *  has been evaluated. Prevents the collapsed pill from auto-opening when
   *  the user releases after a drag. */
  const justDraggedRef = useRef(false);

  function savePos(next: { left: number; top: number }) {
    setPos(next);
    try {
      localStorage.setItem('codesign.tweakPanel.pos', JSON.stringify(next));
    } catch {
      /* noop */
    }
  }

  function onDragStart(e: React.MouseEvent) {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Clamp to the preview pane (the TweakPanel's offsetParent), NOT the
    // viewport — the panel should never slide over the sidebar or top bar.
    const parent = el.offsetParent as HTMLElement | null;
    const bounds = parent
      ? parent.getBoundingClientRect()
      : ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } as DOMRect);

    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseLeft: rect.left,
      baseTop: rect.top,
    };
    e.preventDefault();

    let moved = false;
    const THRESHOLD = 4;

    const onMove = (ev: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      if (!moved) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        moved = true;
        justDraggedRef.current = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      const nextLeft = Math.max(
        bounds.left + 8,
        Math.min(bounds.right - rect.width - 8, st.baseLeft + dx),
      );
      const nextTop = Math.max(
        bounds.top + 8,
        Math.min(bounds.bottom - rect.height - 8, st.baseTop + dy),
      );
      setPos({ left: nextLeft, top: nextTop });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      dragState.current = null;
      if (moved) {
        setPos((p) => {
          if (p) savePos(p);
          return p;
        });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const block: EditmodeBlock | null = useMemo(
    () => (previewHtml ? parseEditmodeBlock(previewHtml) : null),
    [previewHtml],
  );

  const schema: TweakSchema | null = useMemo(
    () => (previewHtml ? parseTweakSchema(previewHtml) : null),
    [previewHtml],
  );

  // Live working copy — drives the UI and the postMessage stream to the iframe
  // without paying for a full srcdoc reload on every keystroke. Persistence
  // back into `previewHtml` is debounced (see persistTimer below).
  const [liveTokens, setLiveTokens] = useState<Tokens | null>(null);
  const liveSigRef = useRef<string>('');
  useEffect(() => {
    if (!block) {
      setLiveTokens(null);
      liveSigRef.current = '';
      return;
    }
    const sig = Object.keys(block.tokens).sort().join('|');
    // Only resync from store when the *schema* (key set) changes — this happens
    // on a new artifact load. Otherwise we'd clobber the user's in-flight edits
    // each time `setPreviewHtml` settles from our own debounce.
    if (sig !== liveSigRef.current) {
      setLiveTokens({ ...block.tokens });
      liveSigRef.current = sig;
    }
  }, [block]);

  const initialTokensRef = useRef<Tokens | null>(null);
  useEffect(() => {
    if (!block) {
      initialTokensRef.current = null;
      return;
    }
    const sig = Object.keys(block.tokens).sort().join('|');
    if (initialTokensRef.current === null || liveSigRef.current !== sig) {
      initialTokensRef.current = { ...block.tokens };
    }
  }, [block]);

  // Debounced persist back to the artifact source so reload / snapshot / export
  // see the tweaked state. Live updates have already gone via postMessage.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!previewHtml) return null;
  const entries = liveTokens ? Object.entries(liveTokens) : [];
  const hasTokens = entries.length > 0;

  function postLive(tokens: Tokens): void {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'codesign:tweaks:update', tokens }, '*');
  }

  function schedulePersist(tokens: Tokens): void {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const html = useCodesignStore.getState().previewHtml;
      if (!html) return;
      setPreviewHtml(replaceEditmodeBlock(html, tokens));
    }, 400);
  }

  function applyTokens(next: Tokens): void {
    setLiveTokens(next);
    postLive(next);
    schedulePersist(next);
  }

  function applyChange(key: string, next: TokenValue): void {
    if (!liveTokens) return;
    applyTokens({ ...liveTokens, [key]: next });
  }

  function reset(): void {
    if (initialTokensRef.current) applyTokens({ ...initialTokensRef.current });
  }

  const isDirty =
    initialTokensRef.current !== null &&
    JSON.stringify(initialTokensRef.current) !== JSON.stringify(liveTokens);

  const titleText = t('tweaks.title');
  const closeText = t('tweaks.close');
  const resetText = t('tweaks.reset');
  const openLabel = t('tweaks.openLabel');
  const pickColorLabel = t('tweaks.pickColor');
  const emptyTitle = t('tweaks.emptyTitle');
  const emptyHint = t('tweaks.emptyHint');
  const countBadge = hasTokens ? String(entries.length) : '—';

  return (
    <div
      ref={panelRef}
      className={pos ? 'fixed z-20' : 'absolute right-[var(--space-5)] top-[var(--space-5)] z-20'}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      {open ? (
        <div
          aria-label={titleText}
          className="flex w-[280px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] backdrop-blur"
        >
          <div className="flex items-center justify-between gap-[var(--space-2)] border-b border-[var(--color-border-subtle)] px-[var(--space-3)] py-[var(--space-2)]">
            <div
              className="flex min-w-0 flex-1 items-center gap-[var(--space-2)] cursor-grab active:cursor-grabbing select-none"
              onMouseDown={onDragStart}
              title="Drag to move"
            >
              <SlidersHorizontal
                className="h-[14px] w-[14px] text-[var(--color-accent)]"
                aria-hidden="true"
              />
              <span
                className="text-[13px] text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {titleText}
              </span>
              <span
                className="rounded-full bg-[var(--color-surface-active)] px-[6px] py-[1px] text-[10px] text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: "'tnum'" }}
              >
                {countBadge}
              </span>
            </div>
            <div className="flex items-center gap-[var(--space-1)]">
              <button
                type="button"
                onClick={reset}
                disabled={!isDirty}
                title={resetText}
                aria-label={resetText}
                className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-30"
              >
                <RotateCcw className="h-[12px] w-[12px]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title={closeText}
                aria-label={closeText}
                className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-faster)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-[14px] w-[14px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {hasTokens ? (
            <div className="flex max-h-[60vh] flex-col gap-[var(--space-1)] overflow-y-auto px-[var(--space-3)] py-[var(--space-2)]">
              {entries.map(([key, value]) => (
                <TokenRow
                  key={key}
                  tokenKey={key}
                  value={value}
                  onChange={(next) => applyChange(key, next)}
                  pickColorLabel={pickColorLabel}
                  schemaEntry={schema?.[key]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-[var(--space-1_5)] px-[var(--space-3)] py-[var(--space-3)]">
              <div className="text-[12px] font-medium text-[var(--color-text-primary)]">
                {emptyTitle}
              </div>
              <div className="text-[11px] leading-[var(--leading-snug)] text-[var(--color-text-muted)]">
                {emptyHint}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onMouseDown={onDragStart}
          onClick={(e) => {
            if (justDraggedRef.current) {
              justDraggedRef.current = false;
              e.preventDefault();
              return;
            }
            setOpen(true);
          }}
          aria-label={openLabel}
          className="inline-flex h-[28px] cursor-grab items-center gap-[var(--space-1_5)] rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[12px] text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)] backdrop-blur transition-[background-color,color,transform] duration-[var(--duration-faster)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] active:scale-[var(--scale-press-down)] active:cursor-grabbing"
        >
          <SlidersHorizontal className="h-[13px] w-[13px]" aria-hidden="true" />
          <span>{titleText}</span>
          <span
            className="rounded-full bg-[var(--color-surface-active)] px-[6px] py-[1px] text-[10px] text-[var(--color-text-muted)]"
            style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: "'tnum'" }}
          >
            {countBadge}
          </span>
        </button>
      )}
    </div>
  );
}
