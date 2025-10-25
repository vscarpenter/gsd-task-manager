"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getSyncQueue } from '@/lib/sync/queue';
import { getDb } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/sync/types';

export function SyncDebugPanel() {
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshQueue = async () => {
    setLoading(true);
    try {
      const queue = getSyncQueue();
      const items = await queue.getPending();
      setQueueItems(items);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearQueue = async () => {
    if (!confirm('Are you sure you want to clear all pending operations?')) {
      return;
    }
    
    const queue = getSyncQueue();
    await queue.clear();
    await refreshQueue();
  };

  const removeItem = async (id: string) => {
    const queue = getSyncQueue();
    await queue.dequeue(id);
    await refreshQueue();
  };

  useEffect(() => {
    refreshQueue();
    
    // Auto-refresh every 2 seconds
    const interval = setInterval(refreshQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Sync Queue Debug</h3>
        <div className="flex gap-2">
          <Button onClick={refreshQueue} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={clearQueue} className="bg-red-600 hover:bg-red-700">
            Clear All
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total pending operations: {queueItems.length}
        </p>
        
        {queueItems.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No pending operations</p>
        ) : (
          <div className="space-y-2">
            {queueItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 border rounded text-sm"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {item.operation} - {item.taskId.substring(0, 8)}...
                  </div>
                  <div className="text-xs text-gray-500">
                    Queue ID: {item.id.substring(0, 8)}... | 
                    Retry: {item.retryCount} | 
                    {item.consolidatedFrom && ` Consolidated: ${item.consolidatedFrom.length} |`}
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <Button
                  onClick={() => removeItem(item.id)}
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
