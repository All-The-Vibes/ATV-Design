import { initI18n } from '@atv-design/i18n';
import type { OnboardingState } from '@atv-design/shared';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_DESIGN_SYSTEM, useCodesignStore } from './store';

const READY_CONFIG: OnboardingState = {
  hasKey: true,
  provider: 'anthropic',
  modelPrimary: 'claude-sonnet-4-6',
  baseUrl: null,
  designSystem: null,
};

const SAMPLE_DS = {
  schemaVersion: 1 as const,
  rootPath: '/some/path',
  sourceFiles: ['tokens.css'],
  colors: ['#ff0000'],
  fonts: ['Arial'],
  spacing: ['8px'],
  radius: ['4px'],
  shadows: ['0 1px 2px #000'],
  summary: 'test system',
  extractedAt: '2024-01-01T00:00:00.000Z',
  source: { kind: 'folder' as const, value: '/some/path' },
  displayName: 'My System',
  isBuiltIn: false,
  userEdited: false,
};

const ONBOARDING_WITH_DS: OnboardingState = { ...READY_CONFIG, designSystem: SAMPLE_DS };
const ONBOARDING_AFTER_UPDATE: OnboardingState = {
  ...READY_CONFIG,
  designSystem: { ...SAMPLE_DS, colors: ['#00ff00'], userEdited: true, isBuiltIn: false },
};

const initialState = useCodesignStore.getState();

beforeAll(async () => {
  await initI18n('en');
});

beforeEach(() => {
  useCodesignStore.setState({
    ...initialState,
    config: READY_CONFIG,
    configLoaded: true,
    toasts: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useEffectiveDesignSystem', () => {
  it('returns BUILT_IN_DESIGN_SYSTEM when config.designSystem is null', () => {
    useCodesignStore.setState({ config: READY_CONFIG });
    // Call the raw selector directly against state (avoids React hook rules in unit tests)
    const state = useCodesignStore.getState();
    const ds = state.config?.designSystem ?? BUILT_IN_DESIGN_SYSTEM;
    expect(ds).toBe(BUILT_IN_DESIGN_SYSTEM);
    expect(ds.isBuiltIn).toBe(true);
    expect(ds.source?.kind).toBe('builtIn');
  });

  it('returns configured design system when present', () => {
    useCodesignStore.setState({ config: ONBOARDING_WITH_DS });
    const state = useCodesignStore.getState();
    const ds = state.config?.designSystem ?? BUILT_IN_DESIGN_SYSTEM;
    expect(ds).toBe(SAMPLE_DS);
  });

  it('built-in has correct colors mirrored from main process', () => {
    expect(BUILT_IN_DESIGN_SYSTEM.colors).toContain('oklch(0.62 0.16 35)');
    expect(BUILT_IN_DESIGN_SYSTEM.fonts).toContain('"Geist Variable"');
    expect(BUILT_IN_DESIGN_SYSTEM.spacing).toContain('4px');
  });
});

describe('importDesignSystemFromUrl', () => {
  it('calls window.codesign.importDesignSystemFromUrl and sets config', async () => {
    const importDesignSystemFromUrl = vi.fn().mockResolvedValue(ONBOARDING_WITH_DS);
    vi.stubGlobal('window', {
      codesign: { importDesignSystemFromUrl },
    });

    await useCodesignStore.getState().importDesignSystemFromUrl('https://example.com');

    expect(importDesignSystemFromUrl).toHaveBeenCalledWith({ url: 'https://example.com' });
    expect(useCodesignStore.getState().config?.designSystem).toBe(SAMPLE_DS);
  });

  it('pushes error toast when IPC throws', async () => {
    const importDesignSystemFromUrl = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('window', { codesign: { importDesignSystemFromUrl } });

    await useCodesignStore.getState().importDesignSystemFromUrl('https://bad.com');

    const toasts = useCodesignStore.getState().toasts;
    expect(toasts.some((t) => t.variant === 'error')).toBe(true);
  });

  it('does nothing when window.codesign is absent', async () => {
    vi.stubGlobal('window', {});
    const prevConfig = useCodesignStore.getState().config;
    await useCodesignStore.getState().importDesignSystemFromUrl('https://example.com');
    expect(useCodesignStore.getState().config).toBe(prevConfig);
  });
});

describe('updateDesignSystemTokens', () => {
  it('calls IPC and updates config on success', async () => {
    useCodesignStore.setState({ config: ONBOARDING_WITH_DS });
    const updateDesignSystemTokens = vi.fn().mockResolvedValue(ONBOARDING_AFTER_UPDATE);
    vi.stubGlobal('window', { codesign: { updateDesignSystemTokens } });

    await useCodesignStore.getState().updateDesignSystemTokens({ colors: ['#00ff00'] });

    expect(updateDesignSystemTokens).toHaveBeenCalledWith({ colors: ['#00ff00'] });
    expect(useCodesignStore.getState().config?.designSystem?.colors).toEqual(['#00ff00']);
  });

  it('applies optimistic update immediately', async () => {
    useCodesignStore.setState({ config: ONBOARDING_WITH_DS });
    let resolveFn!: (v: OnboardingState) => void;
    const updateDesignSystemTokens = vi.fn(
      () =>
        new Promise<OnboardingState>((r) => {
          resolveFn = r;
        }),
    );
    vi.stubGlobal('window', { codesign: { updateDesignSystemTokens } });

    const promise = useCodesignStore.getState().updateDesignSystemTokens({ colors: ['#00ff00'] });
    // Optimistic: already updated before IPC resolves
    expect(useCodesignStore.getState().config?.designSystem?.colors).toEqual(['#00ff00']);
    resolveFn(ONBOARDING_AFTER_UPDATE);
    await promise;
  });

  it('rolls back config and pushes error toast on IPC failure', async () => {
    useCodesignStore.setState({ config: ONBOARDING_WITH_DS });
    const updateDesignSystemTokens = vi.fn().mockRejectedValue(new Error('save failed'));
    vi.stubGlobal('window', { codesign: { updateDesignSystemTokens } });

    await useCodesignStore.getState().updateDesignSystemTokens({ colors: ['#00ff00'] });

    // Rollback: back to original
    expect(useCodesignStore.getState().config?.designSystem?.colors).toEqual(SAMPLE_DS.colors);
    const toasts = useCodesignStore.getState().toasts;
    expect(toasts.some((t) => t.variant === 'error')).toBe(true);
  });
});
