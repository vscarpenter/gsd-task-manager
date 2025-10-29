/**
 * OIDC OAuth Handler - Re-export for backward compatibility
 *
 * This file maintains backward compatibility by re-exporting all OIDC functions
 * from the modular implementation in the oidc/ directory.
 *
 * Modular structure (v0.5.0):
 * - oidc/helpers.ts - Utility functions for PKCE, Apple JWT, etc.
 * - oidc/token-exchange.ts - Code-to-token exchange logic
 * - oidc/id-verification.ts - ID token verification with JWKS
 * - oidc/initiate.ts - OAuth flow initiation
 * - oidc/callback.ts - OAuth callback handler (main orchestration)
 * - oidc/result.ts - OAuth result retrieval
 */

export { initiateOAuth } from './oidc/initiate';
export { handleOAuthCallback } from './oidc/callback';
export { getOAuthResult } from './oidc/result';
