import type { Env, RequestContext, DeviceInfo } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { TTL } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SYNC:DEVICES');

/**
 * List user's devices
 * GET /api/devices
 */
export async function listDevices(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  try {
    const userId = ctx.userId!;
    const currentDeviceId = ctx.deviceId!;

    const devices = await env.DB.prepare(
      'SELECT id, device_name, last_seen_at, is_active FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC'
    )
      .bind(userId)
      .all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deviceList: DeviceInfo[] = (devices.results || []).map((d: any) => ({
      id: d.id,
      name: d.device_name,
      lastSeenAt: d.last_seen_at,
      isActive: d.is_active === 1,
      isCurrent: d.id === currentDeviceId,
    }));

    return jsonResponse({ devices: deviceList }, 200, origin);
  } catch (error) {
    logger.error('List devices failed', error as Error, { userId: ctx.userId, operation: 'list_devices' });
    return errorResponse('Failed to list devices', 500, origin);
  }
}

/**
 * Revoke a device
 * DELETE /api/devices/:id
 */
export async function revokeDevice(
  request: Request,
  env: Env,
  ctx: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  let deviceId: string | undefined;
  try {
    const userId = ctx.userId!;
    const url = new URL(request.url);
    deviceId = url.pathname.split('/').pop();

    if (!deviceId) {
      return errorResponse('Device ID required', 400, origin);
    }

    // Deactivate device
    await env.DB.prepare(
      'UPDATE devices SET is_active = 0 WHERE id = ? AND user_id = ?'
    )
      .bind(deviceId, userId)
      .run();

    // Revoke all sessions for this device
    const sessions = await env.KV.list({ prefix: `session:${userId}:` });
    for (const key of sessions.keys) {
      const session = await env.KV.get(key.name, 'json');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (session && (session as any).deviceId === deviceId) {
        const jti = key.name.split(':')[2];
        await env.KV.put(`revoked:${userId}:${jti}`, 'true', {
          expirationTtl: TTL.REVOCATION,
        });
        await env.KV.delete(key.name);
      }
    }

    logger.info('Device revoked', { userId, deviceId });

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    logger.error('Revoke device failed', error as Error, { userId: ctx.userId, deviceId, operation: 'revoke_device' });
    return errorResponse('Failed to revoke device', 500, origin);
  }
}
