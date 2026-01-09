import {
  getSyncStatus,
  listDevices,
  getTaskStats,
  listTasks,
  getTask,
  searchTasks,
  type GsdConfig,
} from '../../tools.js';
import {
  isTokenExpired,
  getDaysUntilExpiration,
  getTokenExpiration,
  parseJWT,
} from '../../jwt.js';

/**
 * Read-only tool handlers for accessing task data and metadata
 */

/**
 * Get token status with expiration warnings
 */
function getTokenStatus(token: string) {
  const expired = isTokenExpired(token);
  const daysRemaining = getDaysUntilExpiration(token);
  const expirationDate = getTokenExpiration(token);

  let status: 'expired' | 'critical' | 'warning' | 'healthy';
  let message: string;

  if (expired) {
    status = 'expired';
    message = '❌ Token has expired. Please re-authenticate.';
  } else if (daysRemaining <= 1) {
    status = 'critical';
    message = `⚠️ Token expires in ${daysRemaining <= 0 ? 'less than a day' : '1 day'}! Re-authenticate soon.`;
  } else if (daysRemaining <= 3) {
    status = 'warning';
    message = `⚠️ Token expires in ${daysRemaining} days. Consider re-authenticating.`;
  } else {
    status = 'healthy';
    message = `✓ Token valid for ${daysRemaining} more days.`;
  }

  return {
    status,
    expired,
    daysRemaining,
    expiresAt: expirationDate?.toISOString() || null,
    message,
  };
}

export async function handleGetSyncStatus(config: GsdConfig) {
  const status = await getSyncStatus(config);
  const tokenStatus = getTokenStatus(config.authToken);

  // Include token status in response
  const enrichedStatus = {
    ...status,
    tokenStatus: {
      status: tokenStatus.status,
      daysRemaining: tokenStatus.daysRemaining,
      expiresAt: tokenStatus.expiresAt,
      message: tokenStatus.message,
    },
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(enrichedStatus, null, 2),
      },
    ],
  };
}

/**
 * Handle get_token_status tool
 * Provides detailed token information and expiration warnings
 */
export async function handleGetTokenStatus(config: GsdConfig) {
  const tokenStatus = getTokenStatus(config.authToken);

  let payload;
  try {
    payload = parseJWT(config.authToken);
  } catch {
    payload = null;
  }

  const result = {
    ...tokenStatus,
    details: payload
      ? {
          userId: payload.sub,
          email: payload.email,
          deviceId: payload.deviceId,
          issuedAt: new Date(payload.iat * 1000).toISOString(),
        }
      : null,
    instructions:
      tokenStatus.status !== 'healthy'
        ? [
            '1. Visit https://gsd.vinny.dev and log in',
            '2. Open DevTools → Application → Local Storage',
            '3. Copy the gsd_auth_token value',
            '4. Update GSD_AUTH_TOKEN in Claude Desktop config',
            '5. Restart Claude Desktop',
          ]
        : null,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleListDevices(config: GsdConfig) {
  const devices = await listDevices(config);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(devices, null, 2),
      },
    ],
  };
}

export async function handleGetTaskStats(config: GsdConfig) {
  const stats = await getTaskStats(config);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}

export async function handleListTasks(
  config: GsdConfig,
  args: { quadrant?: string; completed?: boolean; tags?: string[] }
) {
  const tasks = await listTasks(config, args);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(tasks, null, 2),
      },
    ],
  };
}

export async function handleGetTask(config: GsdConfig, args: { taskId: string }) {
  const task = await getTask(config, args.taskId);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(task, null, 2),
      },
    ],
  };
}

export async function handleSearchTasks(config: GsdConfig, args: { query: string }) {
  const tasks = await searchTasks(config, args.query);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(tasks, null, 2),
      },
    ],
  };
}
