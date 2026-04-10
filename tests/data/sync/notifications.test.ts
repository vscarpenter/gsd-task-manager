vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { notifySyncSuccess, notifySyncError } from '@/lib/sync/notifications';

describe('Sync Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifySyncSuccess', () => {
    it('should be silent when there are 0 changes', () => {
      notifySyncSuccess(0, 0);

      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should show singular "change" when only 1 pushed', () => {
      notifySyncSuccess(1, 0);

      expect(toast.success).toHaveBeenCalledWith('Sync completed', {
        description: '1 change uploaded',
        duration: 3000,
      });
    });

    it('should show both pushed and pulled in description', () => {
      notifySyncSuccess(3, 2);

      expect(toast.success).toHaveBeenCalledWith('Sync completed', {
        description: '3 changes uploaded, 2 changes downloaded',
        duration: 3000,
      });
    });

    it('should not show toast when enabled is false', () => {
      notifySyncSuccess(5, 3, { enabled: false });

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('notifySyncError', () => {
    it('should show transient error toast with "Sync failed"', () => {
      notifySyncError('Network timeout');

      expect(toast.error).toHaveBeenCalledWith('Sync failed', {
        description: 'Network timeout',
        duration: 5000,
      });
    });

    it('should show permanent error toast with "Sync permanently failed"', () => {
      notifySyncError('Invalid credentials', true);

      expect(toast.error).toHaveBeenCalledWith('Sync permanently failed', {
        description: 'Invalid credentials',
        duration: 10000,
      });
    });

    it('should not show toast when enabled is false', () => {
      notifySyncError('Some error', false, { enabled: false });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should use fallback message when error string is empty', () => {
      notifySyncError('', false);

      expect(toast.error).toHaveBeenCalledWith('Sync failed', {
        description: 'Will retry automatically.',
        duration: 5000,
      });
    });
  });
});
