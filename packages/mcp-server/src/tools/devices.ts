import { getPocketBase } from '../pocketbase-client.js';
import type { GsdConfig, Device } from '../types.js';

/**
 * List all registered devices for the authenticated user from PocketBase
 */
export async function listDevices(config: GsdConfig): Promise<Device[]> {
  const pb = getPocketBase(config);

  try {
    const records = await pb.collection('devices').getFullList({
      sort: '-last_seen_at',
    });

    return records.map((record) => ({
      id: record['device_id'] as string,
      name: (record['device_name'] as string) || null,
      lastSeenAt: record['last_seen_at'] as string,
      isActive: true,
      isCurrent: false,
    }));
  } catch {
    // Devices collection may not exist yet
    return [];
  }
}
