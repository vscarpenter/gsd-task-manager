import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDb } from '@/lib/db';
import { FailedSyncOperations } from '@/components/settings/failed-sync-operations';
import { localRow, signedIn, SAVED } from '../data/sync/support/fake-pocketbase';
import * as recovery from '@/lib/sync/failed-recovery';
import { toast } from 'sonner';

const requestSync = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/lib/sync/sync-coordinator', () => ({ getSyncCoordinator: () => ({ requestSync }) }));
afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncMetadata.put(signedIn());
  await db.tasks.put(localRow(SAVED));
  await db.syncQueue.add({
    id: 'failed-row', taskId: 'task-a', operation: 'update', timestamp: 100,
    status: 'failed', retryCount: 5, lastError: 'validation_failed', payload: localRow(SAVED),
  });
  requestSync.mockClear();
});

describe('failed sync operations', () => {
  it('shows failed task details and lets the person retry', async () => {
    render(<FailedSyncOperations />);
    const region = await screen.findByRole('region', { name: /failed sync operations/i });
    expect(within(region).getByText('Read later')).toBeInTheDocument();
    expect(within(region).getByText(/validation_failed/)).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Retry Read later' })).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(requestSync).toHaveBeenCalledWith('user'));
    expect((await getDb().syncQueue.toArray())[0].status).toBe('pending');
  });

  it('explains dismissal and preserves the unsynced copy in Trash', async () => {
    render(<FailedSyncOperations />);
    expect(await screen.findByText(/dismiss moves unsynced tasks to trash/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(async () => expect(await getDb().deletedTasks.get('task-a')).toBeDefined());
    expect(await getDb().syncQueue.count()).toBe(0);
    expect(requestSync).not.toHaveBeenCalled();
  });

  it('hides recovery actions when signed out', async () => {
    await getDb().syncMetadata.put({ ...signedIn(), enabled: false });
    render(<FailedSyncOperations />);
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    expect(await getDb().syncQueue.count()).toBe(1);
  });

  it('reports a rejected recovery without losing its diagnostic', async () => {
    const error = vi.spyOn(toast, 'error');
    vi.spyOn(recovery, 'recoverFailedSyncItem').mockRejectedValueOnce(new Error('Session changed'));
    render(<FailedSyncOperations />);
    await userEvent.click(await screen.findByRole('button', { name: /retry/i }));
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('Check your sync account')));
    expect(await getDb().syncQueue.get('failed-row')).toBeDefined();
  });

  it('clears a failed delete without inventing a task title or a retry', async () => {
    await getDb().tasks.clear();
    await getDb().syncQueue.update('failed-row', { operation: 'delete', payload: null, lastError: undefined });
    render(<FailedSyncOperations />);
    expect(await screen.findByText('Deleted task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(async () => expect(await getDb().syncQueue.count()).toBe(0));
    expect(requestSync).not.toHaveBeenCalled();
  });
});
