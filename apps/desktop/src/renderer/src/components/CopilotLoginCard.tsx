import { useT } from '@atv-design/i18n';
import { Button } from '@atv-design/ui';
import { Loader2, LogOut, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CopilotOAuthStatus } from '../../../preload/index';
import { useCodesignStore } from '../store';

export interface CopilotLoginCardProps {
  /** Called after a successful login or logout so the parent can refresh its provider list. */
  onStatusChange?: () => void | Promise<void>;
  /** When false, the renderer is running without the Electron preload bridge. */
  bridgeAvailable?: boolean;
}

export type CopilotViewState = 'not-logged-in' | 'loading' | 'logged-in';

export function resolveViewState(
  status: CopilotOAuthStatus | null,
  loading: boolean,
): CopilotViewState {
  if (loading) return 'loading';
  if (status?.loggedIn) return 'logged-in';
  return 'not-logged-in';
}

interface CopilotOAuthApi {
  status(): Promise<CopilotOAuthStatus>;
  login(): Promise<CopilotOAuthStatus>;
  cancelLogin(): Promise<boolean>;
  logout(): Promise<CopilotOAuthStatus>;
}

type PushToastLike = (toast: { variant: 'error'; title: string; description?: string }) => unknown;

export interface PerformLoginDeps {
  api: CopilotOAuthApi;
  setStatus: (s: CopilotOAuthStatus) => void;
  setLoading: (v: boolean) => void;
  pushToast: PushToastLike;
  onStatusChange?: () => void | Promise<void>;
  strings: { failedTitle: string; unknownError: string };
}

function isCopilotLoginCancelledError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /Copilot login cancelled|GitHub OAuth callback aborted/i.test(err.message);
}

export async function performLogin(deps: PerformLoginDeps): Promise<void> {
  deps.setLoading(true);
  try {
    const next = await deps.api.login();
    deps.setStatus(next);
    await deps.onStatusChange?.();
  } catch (err) {
    if (isCopilotLoginCancelledError(err)) return;
    deps.pushToast({
      variant: 'error',
      title: deps.strings.failedTitle,
      description: err instanceof Error ? err.message : deps.strings.unknownError,
    });
  } finally {
    deps.setLoading(false);
  }
}

export interface PerformLogoutDeps {
  api: CopilotOAuthApi;
  setStatus: (s: CopilotOAuthStatus) => void;
  pushToast: PushToastLike;
  confirm: (message: string) => boolean;
  onStatusChange?: () => void | Promise<void>;
  strings: { confirmMessage: string; failedTitle: string; unknownError: string };
}

export async function performLogout(deps: PerformLogoutDeps): Promise<boolean> {
  if (!deps.confirm(deps.strings.confirmMessage)) return false;
  try {
    const next = await deps.api.logout();
    deps.setStatus(next);
    await deps.onStatusChange?.();
    return true;
  } catch (err) {
    deps.pushToast({
      variant: 'error',
      title: deps.strings.failedTitle,
      description: err instanceof Error ? err.message : deps.strings.unknownError,
    });
    return false;
  }
}

export interface PerformFetchStatusDeps {
  api: CopilotOAuthApi;
  setStatus: (s: CopilotOAuthStatus | null) => void;
  pushToast: PushToastLike;
  isMounted: () => boolean;
  strings: { failedTitle: string; unknownError: string };
}

export async function performFetchStatus(deps: PerformFetchStatusDeps): Promise<void> {
  try {
    const status = await deps.api.status();
    if (deps.isMounted()) deps.setStatus(status);
  } catch (err) {
    if (!deps.isMounted()) return;
    deps.setStatus(null);
    deps.pushToast({
      variant: 'error',
      title: deps.strings.failedTitle,
      description: err instanceof Error ? err.message : deps.strings.unknownError,
    });
  }
}

function resolveIdentity(status: CopilotOAuthStatus | null): string | null {
  if (status === null) return null;
  const value = status.accountLabel ?? status.username ?? status.email ?? null;
  return value !== null && value.length > 0 ? value : null;
}

export function CopilotLoginCard({
  onStatusChange,
  bridgeAvailable = true,
}: CopilotLoginCardProps) {
  const t = useT();
  const pushToast = useCodesignStore((s) => s.pushToast);
  const [status, setStatus] = useState<CopilotOAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!bridgeAvailable) return;
    if (!window.codesign) return;
    void performFetchStatus({
      api: window.codesign.copilotOAuth,
      setStatus,
      pushToast,
      isMounted: () => mountedRef.current,
      strings: {
        failedTitle: t('settings.providers.copilotLogin.statusFailedTitle'),
        unknownError: t('settings.providers.copilotLogin.unknownError'),
      },
    });
  }, [bridgeAvailable, pushToast, t]);

  const handleLogin = useCallback(async () => {
    if (!window.codesign) return;
    await performLogin({
      api: window.codesign.copilotOAuth,
      setStatus: (next) => {
        if (mountedRef.current) setStatus(next);
      },
      setLoading: (next) => {
        if (mountedRef.current) setLoading(next);
      },
      pushToast,
      strings: {
        failedTitle: t('settings.providers.copilotLogin.loginFailedTitle'),
        unknownError: t('settings.providers.copilotLogin.unknownError'),
      },
      ...(onStatusChange !== undefined ? { onStatusChange } : {}),
    });
  }, [onStatusChange, pushToast, t]);

  const handleCancel = useCallback(async () => {
    if (!window.codesign) return;
    const cancelled = await window.codesign.copilotOAuth.cancelLogin();
    if (!cancelled && mountedRef.current) setLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    if (!window.codesign) return;
    await performLogout({
      api: window.codesign.copilotOAuth,
      setStatus: (next) => {
        if (mountedRef.current) setStatus(next);
      },
      pushToast,
      confirm: (message) => window.confirm(message),
      strings: {
        confirmMessage: t('settings.providers.copilotLogin.confirmLogout'),
        failedTitle: t('settings.providers.copilotLogin.logoutFailedTitle'),
        unknownError: t('settings.providers.copilotLogin.unknownError'),
      },
      ...(onStatusChange !== undefined ? { onStatusChange } : {}),
    });
  }, [onStatusChange, pushToast, t]);

  const viewState = resolveViewState(status, loading);
  const identity = useMemo(() => resolveIdentity(status), [status]);

  if (viewState === 'logged-in' && status) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] border-l-[var(--size-accent-stripe)] border-l-[var(--color-accent)] bg-[var(--color-accent-tint)] px-[var(--space-3)] py-[var(--space-2_5)] flex items-center gap-[var(--space-3)]">
        <div className="min-w-0 flex-1 flex items-center gap-[var(--space-2)] flex-wrap">
          <span className="inline-flex items-center gap-[var(--space-1)] px-[var(--space-1_5)] py-[var(--space-0_5)] rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] bg-transparent text-[var(--font-size-badge)] font-medium leading-none">
            <Sparkles className="w-[var(--size-icon-xs)] h-[var(--size-icon-xs)]" />
            {t('settings.providers.copilotLogin.loggedInBadge')}
          </span>
          {identity !== null && (
            <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] truncate">
              {identity}
            </span>
          )}
        </div>
        <div className="shrink-0">
          <Button variant="secondary" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="w-[var(--size-icon-sm)] h-[var(--size-icon-sm)]" />
            {t('settings.providers.copilotLogin.logout')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2_5)] flex items-start gap-[var(--space-3)]">
      <div className="min-w-0 flex-1">
        <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          {t('settings.providers.copilotLogin.title')}
        </div>
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-[var(--space-0_5)] leading-[var(--leading-body)]">
          {t('settings.providers.copilotLogin.description')}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-[var(--space-2)]">
        {viewState === 'loading' ? (
          <>
            <Button variant="primary" size="sm" disabled>
              <Loader2 className="w-[var(--size-icon-sm)] h-[var(--size-icon-sm)] animate-spin" />
              {t('settings.providers.copilotLogin.inProgress')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void handleCancel()}>
              {t('common.cancel')}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!bridgeAvailable}
            title={
              !bridgeAvailable
                ? t('settings.providers.desktopBridgeUnavailableButton', {
                    defaultValue: 'Open the ATV Design desktop window to use OAuth',
                  })
                : undefined
            }
            onClick={() => void handleLogin()}
          >
            <Sparkles className="w-[var(--size-icon-sm)] h-[var(--size-icon-sm)]" />
            {t('settings.providers.copilotLogin.signIn')}
          </Button>
        )}
      </div>
    </div>
  );
}
