/**
 * Tests for OAuthButtons component
 * Tests OAuth provider button rendering, click handlers, loading states, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OAuthAuthData, OAuthHandshakeEvent } from '@/lib/sync/oauth-handshake';

// Hoisted mocks
const {
  mockFetch,
  mockSubscribeToOAuthHandshake,
  mockCanUsePopups,
  mockGetPlatformInfo,
  mockWindowOpen,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockSubscribeToOAuthHandshake: vi.fn(),
  mockCanUsePopups: vi.fn(),
  mockGetPlatformInfo: vi.fn(),
  mockWindowOpen: vi.fn(),
}));

// Mock modules
vi.mock('@/lib/sync/oauth-handshake', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribeToOAuthHandshake: (callback: any) => mockSubscribeToOAuthHandshake(callback),
}));

vi.mock('@/lib/pwa-detection', () => ({
  canUsePopups: () => mockCanUsePopups(),
  getPlatformInfo: () => mockGetPlatformInfo(),
}));

vi.mock('@/lib/oauth-config', () => ({
  OAUTH_STATE_CONFIG: {
    MAX_STATE_AGE_MS: 10 * 60 * 1000,
    MIN_STATE_LENGTH: 32,
    CLEANUP_INTERVAL_MS: 60 * 1000,
  },
  getOAuthEnvironment: () => 'local',
}));

vi.mock('@/lib/env-config', () => ({
  getEnvironmentConfig: () => ({
    apiBaseUrl: 'http://localhost:8787',
    oauthCallbackUrl: 'http://localhost:3000/auth/callback',
    isDevelopment: true,
    isProduction: false,
    isStaging: false,
    environment: 'development',
  }),
}));

// Import component after mocks
import { OAuthButtons } from '@/components/sync/oauth-buttons';

describe('OAuthButtons', () => {
  let oauthCallback: ((event: OAuthHandshakeEvent) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    oauthCallback = null;

    // Setup global fetch mock
    global.fetch = mockFetch;

    // Setup window.open mock
    mockWindowOpen.mockReturnValue({
      focus: vi.fn(),
      close: vi.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.window.open = mockWindowOpen as any;

    // Setup default mock implementations
    mockCanUsePopups.mockReturnValue(true);
    mockGetPlatformInfo.mockReturnValue({
      platform: 'desktop',
      standalone: false,
      mobile: false,
      canUsePopups: true,
    });

    // Capture OAuth callback
    unsubscribeFn = vi.fn();
    mockSubscribeToOAuthHandshake.mockImplementation((callback) => {
      oauthCallback = callback;
      return unsubscribeFn;
    });

    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        authUrl: 'https://accounts.google.com/oauth',
        state: 'test-state-token-12345678901234567890',
      }),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Button Rendering', () => {
    it('should render Google OAuth button', () => {
      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      expect(googleButton).toBeInTheDocument();
    });

    it('should render Apple OAuth button', () => {
      render(<OAuthButtons />);

      const appleButton = screen.getByRole('button', { name: /continue with apple/i });
      expect(appleButton).toBeInTheDocument();
    });

    it('should render both buttons enabled by default', () => {
      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      const appleButton = screen.getByRole('button', { name: /continue with apple/i });

      expect(googleButton).not.toBeDisabled();
      expect(appleButton).not.toBeDisabled();
    });
  });

  describe('Click Handlers', () => {
    it('should call onStart callback when Google button is clicked', async () => {
      const user = userEvent.setup();
      const onStart = vi.fn();

      render(<OAuthButtons onStart={onStart} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      expect(onStart).toHaveBeenCalledWith('google');
    });

    it('should call onStart callback when Apple button is clicked', async () => {
      const user = userEvent.setup();
      const onStart = vi.fn();

      render(<OAuthButtons onStart={onStart} />);

      const appleButton = screen.getByRole('button', { name: /continue with apple/i });
      await user.click(appleButton);

      expect(onStart).toHaveBeenCalledWith('apple');
    });

    it('should fetch OAuth start endpoint for Google', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/oauth/google/start'),
          expect.objectContaining({
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'include',
          })
        );
      });
    });

    it('should fetch OAuth start endpoint for Apple', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const appleButton = screen.getByRole('button', { name: /continue with apple/i });
      await user.click(appleButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/oauth/apple/start'),
          expect.objectContaining({
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'include',
          })
        );
      });
    });

    it('should open popup window when popups are supported', async () => {
      const user = userEvent.setup();
      mockCanUsePopups.mockReturnValue(true);

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          'https://accounts.google.com/oauth',
          'google_oauth',
          expect.stringContaining('width=500')
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading text when Google OAuth is in progress', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(/connecting\.\.\./i)).toBeInTheDocument();
      });
    });

    it('should show loading text when Apple OAuth is in progress', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const appleButton = screen.getByRole('button', { name: /continue with apple/i });
      await user.click(appleButton);

      await waitFor(() => {
        expect(screen.getByText(/connecting\.\.\./i)).toBeInTheDocument();
      });
    });

    it('should disable both buttons when one OAuth flow is in progress', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toBeDisabled();
        });
      });
    });

    it('should re-enable buttons after successful OAuth', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      // Wait for loading state
      await waitFor(() => {
        expect(screen.getByText(/connecting\.\.\./i)).toBeInTheDocument();
      });

      // Simulate successful OAuth
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state-token-12345678901234567890',
      });

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).not.toBeDisabled();
        });
      });
    });
  });

  describe('Success Handling', () => {
    it('should call onSuccess callback with auth data', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(<OAuthButtons onSuccess={onSuccess} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state-token-12345678901234567890',
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(authData);
      });
    });

    it('should close popup on successful OAuth', async () => {
      const user = userEvent.setup();
      const mockPopup = {
        focus: vi.fn(),
        close: vi.fn(),
      };
      mockWindowOpen.mockReturnValue(mockPopup);

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state-token-12345678901234567890',
      });

      await waitFor(() => {
        expect(mockPopup.close).toHaveBeenCalled();
      });
    });

    it('should ignore OAuth result with mismatched provider', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<OAuthButtons onSuccess={onSuccess} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      // Return Apple auth data when Google was requested
      const authData: OAuthAuthData = {
        userId: 'user123',
        deviceId: 'device123',
        email: 'test@example.com',
        token: 'oauth-token',
        expiresAt: Date.now() + 3600000,
        provider: 'apple', // Mismatch!
      };

      oauthCallback?.({
        status: 'success',
        authData,
        state: 'test-state-token-12345678901234567890',
      });

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Provider mismatch'),
          expect.any(Object)
        );
      });

      expect(onSuccess).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should call onError callback on OAuth failure', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      oauthCallback?.({
        status: 'error',
        error: 'Authentication failed',
        state: 'test-state-token-12345678901234567890',
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('Authentication failed');
      });
    });

    it('should handle network errors during fetch', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('Network error');
      });
    });

    it('should handle HTTP error responses', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toContain('500');
      });
    });

    it('should handle invalid state token from server', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          authUrl: 'https://accounts.google.com/oauth',
          state: 'short', // Too short
        }),
      });

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toContain('Invalid state token');
      });
    });

    it('should handle blocked popup', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      mockWindowOpen.mockReturnValue(null); // Popup blocked

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toContain('Popup blocked');
      });
    });

    it('should clear loading state on error', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).not.toBeDisabled();
        });
      });
    });
  });

  describe('Redirect Flow', () => {
    it('should redirect to auth URL when popups are not supported', async () => {
      const user = userEvent.setup();
      mockCanUsePopups.mockReturnValue(false);

      // Save original location and replace with mock
      const originalLocation = window.location;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).location;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.location = { href: '', hostname: 'localhost' } as any;

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(window.location.href).toBe('https://accounts.google.com/oauth');
      });

      // Restore original location to prevent test contamination
      window.location = originalLocation;
    });
  });

  describe('Platform Detection', () => {
    it('should log platform information when initiating OAuth', async () => {
      const user = userEvent.setup();
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      mockGetPlatformInfo.mockReturnValue({
        platform: 'ios',
        standalone: true,
        mobile: true,
        canUsePopups: false,
      });

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('Initiating flow'),
          expect.objectContaining({
            provider: 'google',
            platform: expect.objectContaining({
              platform: 'ios',
              standalone: true,
            }),
          })
        );
      });

      consoleInfoSpy.mockRestore();
    });
  });

  describe('Subscription Cleanup', () => {
    it('should unsubscribe from OAuth handshake on unmount', () => {
      const { unmount } = render(<OAuthButtons />);

      expect(mockSubscribeToOAuthHandshake).toHaveBeenCalled();

      unmount();

      expect(unsubscribeFn).toHaveBeenCalled();
    });
  });
});
