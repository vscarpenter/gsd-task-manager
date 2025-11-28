/**
 * OAuth handshake type definitions
 */

export interface OAuthAuthData {
  userId: string;
  deviceId: string;
  email: string;
  token: string;
  expiresAt: number;
  requiresEncryptionSetup?: boolean;
  encryptionSalt?: string;
  provider: string;
}

export interface OAuthHandshakeSuccess {
  status: 'success';
  state: string;
  authData: OAuthAuthData;
}

export interface OAuthHandshakeError {
  status: 'error';
  state: string;
  error: string;
}

export type OAuthHandshakeEvent = OAuthHandshakeSuccess | OAuthHandshakeError;

export interface BroadcastPayload {
  type: 'oauth_handshake';
  state: string;
  success: boolean;
  error?: string | null;
  timestamp: number;
  result?: OAuthHandshakeEvent;
}
