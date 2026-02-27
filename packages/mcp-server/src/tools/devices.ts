import { getSupabaseClient, resolveUserId } from '../api/client.js';
import type { GsdConfig, Device } from '../types.js';

/**
 * List all registered devices for the user
 * Does not require encryption (metadata only)
 */
export async function listDevices(config: GsdConfig): Promise<Device[]> {
  const userId = await resolveUserId(config);
  const supabase = getSupabaseClient(config);

  const { data, error } = await supabase
    .from('devices')
    .select('device_id, device_name, last_seen_at, is_active')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });

  if (error) {
    throw new Error(
      `❌ Failed to fetch devices\n\n` +
        `Database error: ${error.message}\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  return (data ?? []).map((row) => ({
    id: row.device_id,
    name: row.device_name,
    lastSeenAt: new Date(row.last_seen_at).getTime(),
    isActive: row.is_active ?? true,
    isCurrent: false, // MCP server is not a device
  }));
}
