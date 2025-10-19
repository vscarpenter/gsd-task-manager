# OAuth Security Implementation

## Overview

This document describes the multi-layered security implementation for OAuth authentication flows in the GSD Task Manager. The implementation follows OAuth 2.0 security best practices and implements defense-in-depth principles to prevent common attack vectors.

## Security Issue Addressed

**Original Problem**: The OAuth callback listener used a strict same-origin check (`event.origin !== window.location.origin`) which could:
- Reject legitimate callbacks if the callback URL changes
- Fail silently without proper validation
- Lack CSRF protection through state validation
- Be vulnerable to malicious postMessage injection

**Risk Assessment**: Medium-High
- **CSRF attacks**: Without state validation, attackers could inject fake OAuth responses
- **Payload injection**: Malformed or malicious data could be processed
- **Configuration fragility**: Single point of failure if callback URL changes
- **Silent failures**: Users unable to authenticate with no clear error messages

## Solution: Multi-Layer Security

The new implementation uses **4 layers of validation** for every OAuth callback message:

### Layer 1: Origin Validation
**Purpose**: Ensure messages only come from trusted origins

```typescript
// Allowed origins are explicitly allowlisted
const ALLOWED_OAUTH_ORIGINS = [
  'https://gsd.vinny.dev',                               // Production app
  'https://gsd-sync-worker.vscarpenter.workers.dev',     // Production worker
  'http://localhost:3000',                               // Local development
  // ... additional trusted origins
];

if (!isOAuthOriginAllowed(event.origin)) {
  console.warn('[OAuth Security] Rejected untrusted origin');
  return; // Reject the message
}
```

**Prevents**:
- Cross-site scripting (XSS) attacks via postMessage
- Malicious websites sending fake OAuth responses
- Man-in-the-middle attacks from untrusted domains

### Layer 2: Message Structure Validation
**Purpose**: Validate payload structure and data types using Zod schemas

```typescript
const validation = validateOAuthMessage(event.data);
if (!validation.success) {
  console.warn('[OAuth Security] Invalid message structure:', validation.error);
  return; // Reject malformed messages
}
```

**Validates**:
- Message type (oauth_success or oauth_error)
- Required fields present (userId, email, token, etc.)
- Data types correct (strings, numbers, booleans)
- Email format valid
- Provider is either 'google' or 'apple'
- State token minimum length (32 characters)

**Prevents**:
- Payload injection attacks
- Type confusion vulnerabilities
- Missing required authentication data
- Invalid email addresses

### Layer 3: State Validation (CSRF Protection)
**Purpose**: Verify the state parameter matches our initiated OAuth flow

```typescript
const pendingState = pendingStates.current.get(successMessage.state);

if (!pendingState) {
  console.warn('[OAuth Security] Unknown or reused state token');
  return; // Reject unknown states
}

// Check state hasn't expired (10 minute max)
const stateAge = Date.now() - pendingState.timestamp;
if (stateAge > OAUTH_STATE_CONFIG.MAX_STATE_AGE_MS) {
  console.warn('[OAuth Security] Expired state token');
  return; // Reject expired states
}
```

**Prevents**:
- Cross-Site Request Forgery (CSRF) attacks
- Replay attacks (state is single-use)
- OAuth session fixation
- Man-in-the-middle session hijacking
- Timing attacks (states expire after 10 minutes)

### Layer 4: Provider Validation
**Purpose**: Ensure the provider matches what we initiated

```typescript
if (successMessage.authData.provider !== pendingState.provider) {
  console.warn('[OAuth Security] Provider mismatch');
  return; // Reject provider mismatch
}
```

**Prevents**:
- Provider confusion attacks
- Token substitution from different OAuth providers
- Cross-provider token replay

## Security Features

### Automatic State Cleanup
- States are automatically cleaned up after 10 minutes
- Prevents memory leaks from abandoned OAuth flows
- Runs every 60 seconds to remove expired states

```typescript
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    // Remove states older than 10 minutes
  }, OAUTH_STATE_CONFIG.CLEANUP_INTERVAL_MS);

  return () => clearInterval(cleanupInterval);
}, []);
```

### Comprehensive Security Logging
All security events are logged with context for monitoring:

```typescript
console.info('[OAuth Security] Flow initiated:', {
  provider,
  state: state.substring(0, 8) + '...',  // Only log first 8 chars
  environment: getOAuthEnvironment(),
});

console.warn('[OAuth Security] Rejected postMessage from untrusted origin:', {
  origin: event.origin,
  expected: 'one of allowed origins',
  environment: getOAuthEnvironment(),
});
```

**Logged Events**:
- ✅ Successful authentication
- ⚠️ Rejected origins
- ⚠️ Invalid message structures
- ⚠️ Unknown/expired states
- ⚠️ Provider mismatches
- ⚠️ Expired state cleanup
- ℹ️ Flow initiation
- ℹ️ User-closed popups

### Single-Use States
Each state token:
- Is generated server-side with 32+ characters of entropy
- Can only be used once (deleted after successful validation)
- Expires after 10 minutes
- Is bound to a specific provider (google/apple)

## Configuration

### Adding Allowed Origins
To add a new trusted origin (e.g., for staging environment):

```typescript
// lib/oauth-config.ts
export const ALLOWED_OAUTH_ORIGINS = [
  'https://gsd.vinny.dev',
  'https://staging.gsd.vinny.dev',  // Add new origin
  // ...
];
```

### Adjusting Timeouts
To modify state expiration or cleanup intervals:

```typescript
// lib/oauth-config.ts
export const OAUTH_STATE_CONFIG = {
  MAX_STATE_AGE_MS: 10 * 60 * 1000,      // 10 minutes
  MIN_STATE_LENGTH: 32,                   // Minimum 32 chars
  CLEANUP_INTERVAL_MS: 60 * 1000,         // Clean every 1 minute
};
```

## Testing

Comprehensive test suite covers all security layers:

```bash
# Run OAuth security tests
pnpm test tests/security/oauth-security.test.ts
```

**Test Coverage**:
- ✅ Origin validation (trusted/untrusted)
- ✅ Message structure validation
- ✅ State validation (unknown, expired, reused)
- ✅ Provider validation
- ✅ Attack scenarios (CSRF, XSS, replay)
- ✅ Edge cases (null origins, malformed messages)

**Results**: 23 tests, all passing ✅

## Migration Notes

### Breaking Changes
None. This is a **backwards-compatible security enhancement**.

### What Changed
- **Origin validation**: Now accepts messages from allowlisted origins (not just same-origin)
- **State tracking**: Now tracks and validates state tokens client-side
- **Error logging**: Now logs all security events for monitoring
- **Message validation**: Now validates all message payloads with Zod

### What Stayed the Same
- OAuth flow remains unchanged (initiate → popup → callback → success)
- API contracts unchanged (same authData structure)
- User experience unchanged (same UI, same buttons)

## Security Recommendations

### For Developers
1. **Never bypass validation layers** - Each layer catches different attack vectors
2. **Monitor security logs** - Watch for patterns of rejected messages
3. **Rotate secrets regularly** - Update OAuth client secrets quarterly
4. **Test in production** - Verify OAuth flows work after deployment
5. **Review allowed origins** - Audit the allowlist periodically

### For Production Deployment
1. **Enable CSP headers** - Content-Security-Policy should allow worker domain
2. **Use HTTPS everywhere** - Never allow OAuth over HTTP (except localhost)
3. **Monitor auth failures** - Set up alerts for repeated auth failures
4. **Rate limit OAuth endpoints** - Prevent brute force attacks
5. **Keep dependencies updated** - Zod, jose, and other security libraries

## Attack Scenarios Prevented

### CSRF Attack
**Attack**: Attacker initiates OAuth on their site, captures callback, sends to victim
**Prevention**: State validation (Layer 3) ensures state matches our initiated flow

### Payload Injection
**Attack**: Malicious site sends crafted postMessage with XSS payload
**Prevention**: Message validation (Layer 2) rejects malformed payloads, origin validation (Layer 1) rejects untrusted origins

### Replay Attack
**Attack**: Attacker captures valid OAuth response, replays it later
**Prevention**: Single-use states (Layer 3), state expiration (10 minutes)

### Provider Confusion
**Attack**: Attacker substitutes Google token with Apple token
**Prevention**: Provider validation (Layer 4) ensures provider matches

### Man-in-the-Middle
**Attack**: Attacker intercepts callback, modifies data
**Prevention**: Origin validation (Layer 1) + HTTPS ensures authenticity

## References

- [RFC 6749: OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 6819: OAuth 2.0 Threat Model and Security Considerations](https://datatracker.ietf.org/doc/html/rfc6819)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP Top 10 - A07:2021 Identification and Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)

## Version History

- **v1.0** (2025-10-18): Initial multi-layer security implementation
  - Added origin validation with allowlist
  - Added Zod schema validation for messages
  - Added state validation with CSRF protection
  - Added provider validation
  - Added comprehensive security logging
  - Added 23 security tests (all passing)

---

For questions or security concerns, please open an issue on GitHub or contact the security team.
