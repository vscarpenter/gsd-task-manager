/**
 * Tests for OAuthButtons component
 * Tests OAuth provider button rendering, click handlers, loading states, and error handling
 * using the PocketBase-based authentication flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthState } from '@/lib/sync/pb-auth';

// Hoisted mocks
const { mockLoginWithGoogle, mockLoginWithGithub } = vi.hoisted(() => ({
  mockLoginWithGoogle: vi.fn(),
  mockLoginWithGithub: vi.fn(),
}));

// Mock PocketBase auth module
vi.mock('@/lib/sync/pb-auth', () => ({
  loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
  loginWithGithub: (...args: unknown[]) => mockLoginWithGithub(...args),
}));

// Import component after mocks
import { OAuthButtons } from '@/components/sync/oauth-buttons';

/** Helper to create a valid AuthState for tests */
function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    isLoggedIn: true,
    userId: 'user_abc123',
    email: 'test@example.com',
    provider: 'google',
    ...overrides,
  };
}

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: login functions resolve successfully
    mockLoginWithGoogle.mockResolvedValue(createAuthState({ provider: 'google' }));
    mockLoginWithGithub.mockResolvedValue(createAuthState({ provider: 'github' }));
  });

  describe('Button Rendering', () => {
    it('should render Google OAuth button', () => {
      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      expect(googleButton).toBeInTheDocument();
    });

    it('should render GitHub OAuth button', () => {
      render(<OAuthButtons />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      expect(githubButton).toBeInTheDocument();
    });

    it('should render both buttons enabled by default', () => {
      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      const githubButton = screen.getByRole('button', { name: /continue with github/i });

      expect(googleButton).not.toBeDisabled();
      expect(githubButton).not.toBeDisabled();
    });
  });

  describe('Click Handlers', () => {
    it('should call onStart with "google" when Google button is clicked', async () => {
      const user = userEvent.setup();
      const onStart = vi.fn();

      render(<OAuthButtons onStart={onStart} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      expect(onStart).toHaveBeenCalledWith('google');
    });

    it('should call onStart with "github" when GitHub button is clicked', async () => {
      const user = userEvent.setup();
      const onStart = vi.fn();

      render(<OAuthButtons onStart={onStart} />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      await user.click(githubButton);

      expect(onStart).toHaveBeenCalledWith('github');
    });

    it('should call loginWithGoogle when Google button is clicked', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      expect(mockLoginWithGoogle).toHaveBeenCalledOnce();
    });

    it('should call loginWithGithub when GitHub button is clicked', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      await user.click(githubButton);

      expect(mockLoginWithGithub).toHaveBeenCalledOnce();
    });
  });

  describe('Loading States', () => {
    it('should show "Connecting..." when Google OAuth is in progress', async () => {
      const user = userEvent.setup();
      // Never resolve so the loading state persists
      mockLoginWithGoogle.mockReturnValue(new Promise(() => {}));

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });
    });

    it('should show "Connecting..." when GitHub OAuth is in progress', async () => {
      const user = userEvent.setup();
      mockLoginWithGithub.mockReturnValue(new Promise(() => {}));

      render(<OAuthButtons />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      await user.click(githubButton);

      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });
    });

    it('should disable both buttons when one OAuth flow is in progress', async () => {
      const user = userEvent.setup();
      mockLoginWithGoogle.mockReturnValue(new Promise(() => {}));

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
      mockLoginWithGoogle.mockResolvedValue(createAuthState({ provider: 'google' }));

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

    it('should re-enable buttons after failed OAuth', async () => {
      const user = userEvent.setup();
      mockLoginWithGoogle.mockRejectedValue(new Error('Auth failed'));

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

  describe('Success Handling', () => {
    it('should call onSuccess with AuthState after Google login', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const expectedAuth = createAuthState({ provider: 'google' });
      mockLoginWithGoogle.mockResolvedValue(expectedAuth);

      render(<OAuthButtons onSuccess={onSuccess} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(expectedAuth);
      });
    });

    it('should call onSuccess with AuthState after GitHub login', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const expectedAuth = createAuthState({ provider: 'github' });
      mockLoginWithGithub.mockResolvedValue(expectedAuth);

      render(<OAuthButtons onSuccess={onSuccess} />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      await user.click(githubButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(expectedAuth);
      });
    });
  });

  describe('Error Handling', () => {
    it('should call onError with Error when Google login fails', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      mockLoginWithGoogle.mockRejectedValue(new Error('Google auth failed'));

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('Google auth failed');
      });
    });

    it('should call onError with Error when GitHub login fails', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      mockLoginWithGithub.mockRejectedValue(new Error('GitHub auth failed'));

      render(<OAuthButtons onError={onError} />);

      const githubButton = screen.getByRole('button', { name: /continue with github/i });
      await user.click(githubButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('GitHub auth failed');
      });
    });

    it('should wrap non-Error throwables in an Error object', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      mockLoginWithGoogle.mockRejectedValue('string error');

      render(<OAuthButtons onError={onError} />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('string error');
      });
    });

    it('should not throw when onError is not provided', async () => {
      const user = userEvent.setup();
      mockLoginWithGoogle.mockRejectedValue(new Error('Unhandled'));

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });

      // Should not throw — error is caught internally
      await expect(user.click(googleButton)).resolves.not.toThrow();
    });
  });

  describe('No Callbacks Provided', () => {
    it('should work without any callbacks', async () => {
      const user = userEvent.setup();

      render(<OAuthButtons />);

      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);

      expect(mockLoginWithGoogle).toHaveBeenCalledOnce();
    });
  });
});
