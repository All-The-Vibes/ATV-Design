import { describe, expect, it, vi } from 'vitest';
import type { CopilotOAuthStatus } from '../../../preload/index';
import {
  performFetchStatus,
  performLogin,
  performLogout,
  resolveViewState,
} from './CopilotLoginCard';

const LOGIN_STRINGS = {
  failedTitle: 'login failed',
  unknownError: 'unknown',
};
const LOGOUT_STRINGS = {
  confirmMessage: 'sign out?',
  failedTitle: 'logout failed',
  unknownError: 'unknown',
};
const STATUS_STRINGS = { failedTitle: 'status read failed', unknownError: 'unknown' };

function statusLoggedIn(overrides: Partial<CopilotOAuthStatus> = {}): CopilotOAuthStatus {
  return {
    loggedIn: true,
    username: 'octocat',
    email: 'octocat@github.test',
    accountLabel: 'GitHub Copilot',
    ...overrides,
  };
}

function statusLoggedOut(): CopilotOAuthStatus {
  return { loggedIn: false };
}

describe('resolveViewState', () => {
  it('returns not-logged-in when status is null', () => {
    expect(resolveViewState(null, false)).toBe('not-logged-in');
  });

  it('returns logged-in when status has loggedIn=true', () => {
    expect(resolveViewState(statusLoggedIn(), false)).toBe('logged-in');
  });

  it('returns loading while a login request is in-flight', () => {
    expect(resolveViewState(statusLoggedIn(), true)).toBe('loading');
    expect(resolveViewState(null, true)).toBe('loading');
  });
});

describe('performFetchStatus', () => {
  it('updates status when the initial status fetch succeeds', async () => {
    const next = statusLoggedIn();
    const api = {
      status: vi.fn().mockResolvedValue(next),
      login: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
    };
    const setStatus = vi.fn();
    const pushToast = vi.fn();

    await performFetchStatus({
      api,
      setStatus,
      pushToast,
      isMounted: () => true,
      strings: STATUS_STRINGS,
    });

    expect(api.status).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith(next);
    expect(pushToast).not.toHaveBeenCalled();
  });
});

describe('performLogin', () => {
  it('updates status and notifies the parent on login success', async () => {
    const next = statusLoggedIn({ username: 'hubot' });
    const api = {
      status: vi.fn(),
      login: vi.fn().mockResolvedValue(next),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
    };
    const setStatus = vi.fn();
    const setLoading = vi.fn();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const pushToast = vi.fn();

    await performLogin({
      api,
      setStatus,
      setLoading,
      pushToast,
      onStatusChange,
      strings: LOGIN_STRINGS,
    });

    expect(api.login).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith(next);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(pushToast).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenNthCalledWith(2, false);
  });

  it('shows an error toast when login fails', async () => {
    const api = {
      status: vi.fn(),
      login: vi.fn().mockRejectedValue(new Error('oauth exchange failed')),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
    };
    const setStatus = vi.fn();
    const setLoading = vi.fn();
    const pushToast = vi.fn();

    await performLogin({ api, setStatus, setLoading, pushToast, strings: LOGIN_STRINGS });

    expect(setStatus).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        title: 'login failed',
        description: 'oauth exchange failed',
      }),
    );
    expect(setLoading).toHaveBeenNthCalledWith(2, false);
  });

  it('silently handles user-cancelled login errors', async () => {
    const api = {
      status: vi.fn(),
      login: vi.fn().mockRejectedValue(new Error('GitHub OAuth callback aborted by signal')),
      cancelLogin: vi.fn(),
      logout: vi.fn(),
    };
    const setLoading = vi.fn();
    const pushToast = vi.fn();

    await performLogin({
      api,
      setStatus: vi.fn(),
      setLoading,
      pushToast,
      strings: LOGIN_STRINGS,
    });

    expect(pushToast).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenNthCalledWith(2, false);
  });
});

describe('performLogout', () => {
  it('requires confirmation before logging out', async () => {
    const api = {
      status: vi.fn(),
      login: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn().mockResolvedValue(statusLoggedOut()),
    };
    const setStatus = vi.fn();
    const pushToast = vi.fn();
    const confirm = vi.fn().mockReturnValue(false);

    const result = await performLogout({
      api,
      setStatus,
      pushToast,
      confirm,
      strings: LOGOUT_STRINGS,
    });

    expect(result).toBe(false);
    expect(confirm).toHaveBeenCalledWith('sign out?');
    expect(api.logout).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('updates status and notifies the parent after confirmed logout', async () => {
    const next = statusLoggedOut();
    const api = {
      status: vi.fn(),
      login: vi.fn(),
      cancelLogin: vi.fn(),
      logout: vi.fn().mockResolvedValue(next),
    };
    const setStatus = vi.fn();
    const pushToast = vi.fn();
    const confirm = vi.fn().mockReturnValue(true);
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const result = await performLogout({
      api,
      setStatus,
      pushToast,
      confirm,
      onStatusChange,
      strings: LOGOUT_STRINGS,
    });

    expect(result).toBe(true);
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith(next);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(pushToast).not.toHaveBeenCalled();
  });
});
