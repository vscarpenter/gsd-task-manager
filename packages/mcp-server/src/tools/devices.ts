import { z } from 'zod';
import { apiRequest } from '../api/client.js';
import { deviceSchema } from '../types.js';
import type { GsdConfig, Device } from '../types.js';

/**
 * List all registered devices for the authenticated user
 * Does not require encryption (metadata only)
 */
export async function listDevices(config: GsdConfig): Promise<Device[]> {
  return apiRequest(config, '/api/devices', z.array(deviceSchema));
}
