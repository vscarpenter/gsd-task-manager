/**
 * OAuth Message Validation Schemas
 *
 * Validates postMessage payloads from OAuth callback popup.
 * Prevents malicious payloads and ensures data integrity.
 */

import { z } from 'zod';
import { OAUTH_STATE_CONFIG } from './oauth-config';

/**
 * OAuth Success Message Schema
 * Validates the authData structure from successful OAuth flows
 */
export const OAuthSuccessMessageSchema = z.object({
  type: z.literal('oauth_success'),
  state: z.string().min(OAUTH_STATE_CONFIG.MIN_STATE_LENGTH, {
    message: 'State token too short - potential security issue',
  }),
  authData: z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    deviceId: z.string().min(1, { message: 'Device ID is required' }),
    email: z.string().email({ message: 'Invalid email format' }),
    token: z.string().min(1, { message: 'Auth token is required' }),
    expiresAt: z.number().positive({ message: 'Invalid expiration timestamp' }),
    requiresEncryptionSetup: z.boolean(),
    provider: z.enum(['google', 'apple'], {
      error: 'Invalid OAuth provider',
    }),
    encryptionSalt: z.string().optional(),
  }),
});

/**
 * OAuth Error Message Schema
 * Validates error messages from failed OAuth flows
 */
export const OAuthErrorMessageSchema = z.object({
  type: z.literal('oauth_error'),
  error: z.string().min(1, { message: 'Error message is required' }),
  state: z.string().optional(),
});

/**
 * Union type for all valid OAuth messages
 */
export const OAuthMessageSchema = z.discriminatedUnion('type', [
  OAuthSuccessMessageSchema,
  OAuthErrorMessageSchema,
]);

/**
 * Type exports for TypeScript
 */
export type OAuthSuccessMessage = z.infer<typeof OAuthSuccessMessageSchema>;
export type OAuthErrorMessage = z.infer<typeof OAuthErrorMessageSchema>;
export type OAuthMessage = z.infer<typeof OAuthMessageSchema>;

/**
 * Validate OAuth message with detailed error reporting
 */
export function validateOAuthMessage(data: unknown): {
  success: boolean;
  data?: OAuthMessage;
  error?: string;
} {
  try {
    const parsed = OAuthMessageSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Invalid OAuth message structure: ${errorDetails}`,
      };
    }
    return {
      success: false,
      error: 'Failed to validate OAuth message',
    };
  }
}
