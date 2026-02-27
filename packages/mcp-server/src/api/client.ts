/**
 * Supabase client for MCP server
 * Uses service role key to bypass RLS, filters by user_id
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GsdConfig } from '../types.js';
import { createMcpLogger } from '../utils/logger.js';

const logger = createMcpLogger('SUPABASE_CLIENT');

let supabaseInstance: SupabaseClient | null = null;
let cachedUserId: string | null = null;

/**
 * Get or create Supabase client (singleton)
 */
export function getSupabaseClient(config: GsdConfig): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.supabaseUrl, config.serviceKey);
  }
  return supabaseInstance;
}

/**
 * Resolve user_id from email address via profiles table
 * Cached after first lookup
 */
export async function resolveUserId(config: GsdConfig): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', config.userEmail)
    .single();

  if (error || !data) {
    throw new Error(
      `❌ User not found: ${config.userEmail}\n\n` +
        `No profile found for this email address.\n\n` +
        `Please check:\n` +
        `  1. GSD_USER_EMAIL is correct\n` +
        `  2. You have signed into the GSD app at least once\n` +
        `  3. GSD_SUPABASE_URL points to the correct project\n\n` +
        `Run: npx gsd-mcp-server --validate`
    );
  }

  cachedUserId = data.id;
  logger.debug('Resolved user ID', { email: config.userEmail });
  return data.id;
}

/**
 * Clear cached state (for testing or config changes)
 */
export function clearClientCache(): void {
  supabaseInstance = null;
  cachedUserId = null;
}
