/**
 * Tests for the OAuth return page: it relays the provider's answer to the tab
 * that started sign-in and says what happened.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockRelayOAuthCallback } = vi.hoisted(() => ({
  mockRelayOAuthCallback: vi.fn(),
}));

vi.mock('@/lib/sync/oauth-callback', () => ({
  relayOAuthCallback: (...args: unknown[]) => mockRelayOAuthCallback(...args),
}));

import OAuthCallbackPage from '@/app/auth/callback/page';

describe('OAuthCallbackPage', () => {
  let closeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
    window.location.hash = '#code=abc&state=s1';
  });

  afterEach(() => {
    closeSpy.mockRestore();
    window.location.hash = '';
  });

  it('relays the fragment and removes it from the address bar', async () => {
    mockRelayOAuthCallback.mockResolvedValue('delivered');

    render(<OAuthCallbackPage />);

    await screen.findByText(/you can close this window/i);
    expect(mockRelayOAuthCallback).toHaveBeenCalledWith('code=abc&state=s1');
    expect(window.location.hash).toBe('');
  });

  it('closes itself once the starting tab has the answer', async () => {
    mockRelayOAuthCallback.mockResolvedValue('delivered');

    render(<OAuthCallbackPage />);

    await screen.findByText(/you can close this window/i);
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('announces progress in a status region that exists before its text changes', async () => {
    let finish: (outcome: string) => void = () => {};
    mockRelayOAuthCallback.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

    render(<OAuthCallbackPage />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Finishing sign-in.');
    finish('delivered');

    await screen.findByText(/you can close this window/i);
    expect(screen.getByRole('status')).toBe(status);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays open and says so when no tab picked up the sign-in', async () => {
    mockRelayOAuthCallback.mockResolvedValue('unclaimed');

    render(<OAuthCallbackPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't pick up this sign-in/i);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('stays open and says so when the address carries no sign-in', async () => {
    mockRelayOAuthCallback.mockResolvedValue('invalid');

    render(<OAuthCallbackPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no sign-in to finish/i);
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
