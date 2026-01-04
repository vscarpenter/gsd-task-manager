# Security Configuration

This document outlines the security measures implemented in GSD Task Manager and deployment instructions for CloudFront security headers.

## Table of Contents

- [Overview](#overview)
- [Client-Side Security](#client-side-security)
- [Cloud Sync Security](#cloud-sync-security-optional-v500)
- [MCP Server Security](#mcp-server-security-optional-v500)
- [CloudFront Security Headers](#cloudfront-security-headers)
- [Deployment Instructions](#deployment-instructions)
- [Security Best Practices](#security-best-practices)
- [Security Audit Results](#security-audit-results)

## Overview

GSD Task Manager is a privacy-first application where all data is stored locally in the browser using IndexedDB by default. **Optional cloud sync** (v5.0.0+) enables multi-device access with end-to-end encryption—the server stores only encrypted blobs and cannot decrypt task content.

## Client-Side Security

### Implemented Protections

1. **Local Data Storage by Default**
   - All tasks stored in IndexedDB (client-side)
   - No external API calls or data transmission in local-only mode
   - Export/import functionality for user-controlled backups
   - Optional cloud sync requires explicit user opt-in

2. **Input Validation**
   - Zod schema validation for all task operations
   - Sanitized error messages for import failures
   - Try-catch blocks around JSON parsing

3. **Dependency Management**
   - Regular `bun pm audit` checks for vulnerabilities
   - Automated security updates via Dependabot/Renovate
   - All packages kept at stable, non-canary versions

## Cloud Sync Security (Optional, v5.0.0+)

When users enable cloud sync, the following security measures protect their data:

### End-to-End Encryption

1. **Encryption Algorithm: AES-256-GCM**
   - Authenticated encryption with associated data (AEAD)
   - 256-bit key derived from user passphrase
   - Unique 96-bit random nonce per encryption operation
   - SHA-256 checksums for data integrity

2. **Key Derivation: PBKDF2**
   - 600,000 iterations (OWASP 2023 recommendation)
   - User passphrase + server-provided salt
   - Salt stored encrypted in Cloudflare D1 (useless without passphrase)
   - Keys never leave user's device

3. **Zero-Knowledge Architecture**
   - Worker stores only encrypted blobs
   - Server cannot decrypt task content (no access to passphrase)
   - Encryption/decryption happens entirely in browser/MCP client
   - Even Cloudflare employees cannot read your tasks

### OAuth Authentication

1. **Providers**
   - Google (OIDC-compliant)
   - Apple (OIDC-compliant)

2. **Security Features**
   - PKCE (Proof Key for Code Exchange) prevents code interception
   - State parameter prevents CSRF attacks
   - ID token signature verification (JWT)
   - Short-lived session tokens (24 hours)

3. **Token Management**
   - JWT tokens with 7-day expiration
   - HS256 signature with 256-bit secret per environment
   - Tokens stored in IndexedDB (browser-encrypted at rest)
   - Refresh flow on token expiration

### Rate Limiting

- 100 requests/minute per IP via Cloudflare KV
- Prevents brute-force attacks on authentication
- Distributed rate limiting across edge locations

### Network Security

- HTTPS-only communication
- CORS restricted to production domain (https://gsd.vinny.dev)
- HSTS headers enforce secure connections
- TLS 1.2+ required

## MCP Server Security (Optional, v5.0.0+)

The MCP server allows Claude Desktop to access tasks via natural language queries.

### Security Model

1. **Read-Only Access**
   - MCP tools can only read tasks, not modify/delete
   - No write operations implemented
   - Safe exploration without data modification risk

2. **Local Decryption**
   - Encryption passphrase stored only in Claude Desktop config
   - Passphrase never transmitted to Worker
   - Decryption happens on user's local machine

3. **Opt-In Feature**
   - Requires explicit configuration by user
   - Must set passphrase in Claude Desktop config manually
   - Not enabled by default

### Configuration Security

```json
// Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json)
{
  "mcpServers": {
    "gsd-taskmanager": {
      "env": {
        "GSD_AUTH_TOKEN": "eyJ...",  // JWT from OAuth
        "GSD_ENCRYPTION_PASSPHRASE": "..." // User's passphrase
      }
    }
  }
}
```

**Important**: The config file contains sensitive credentials. Ensure appropriate file permissions.

## CloudFront Security Headers

### Required Headers

The following security headers should be configured at the CloudFront level:

#### 1. Content Security Policy (CSP)

**Development/Testing:**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://gsd-dev.vinny.dev https://accounts.google.com https://appleid.apple.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://accounts.google.com https://appleid.apple.com;
```

**Production (Recommended):**
```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://gsd.vinny.dev https://accounts.google.com https://appleid.apple.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://accounts.google.com https://appleid.apple.com;
```

> **Note:** The production CSP removes `unsafe-inline` and `unsafe-eval`. The `connect-src` and `form-action` include OAuth providers for cloud sync authentication.

#### 2. X-Frame-Options
```
X-Frame-Options: DENY
```
Prevents clickjacking attacks by disallowing the page to be embedded in frames.

#### 3. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
Prevents MIME-sniffing attacks.

#### 4. Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
Forces HTTPS connections for 2 years and includes subdomains.

#### 5. X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
Enables browser XSS filtering (legacy but still useful).

#### 6. Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
Controls referrer information sent with requests.

#### 7. Permissions-Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```
Disables unnecessary browser features.

## Deployment Instructions

### Option 1: AWS Console (Recommended)

1. **Navigate to CloudFront Console**
   - Go to AWS CloudFront in the AWS Console
   - Click on "Policies" in the left sidebar
   - Select "Response headers"

2. **Create Response Headers Policy**
   - Click "Create response headers policy"
   - Name: `gsd-security-headers`
   - Configure each header using the values above

3. **Attach Policy to Distribution**
   - Go to your CloudFront distribution (e.g., `E1T6GDX0TQEP94`)
   - Edit the default cache behavior
   - Under "Response headers policy", select `gsd-security-headers`
   - Save changes

4. **Create Invalidation**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E1T6GDX0TQEP94 \
     --paths "/*"
   ```

### Option 2: AWS CLI

1. **Create the Response Headers Policy:**

   ```bash
   aws cloudfront create-response-headers-policy \
     --cli-input-json file://cloudfront-security-headers.json
   ```

   This will output a policy ID. Save it for the next step.

2. **Get your distribution configuration:**

   ```bash
   aws cloudfront get-distribution-config \
     --id E1T6GDX0TQEP94 > dist-config.json
   ```

3. **Extract the ETag and config:**

   The output contains an `ETag` field - you'll need this for the update.
   Edit the `DistributionConfig` section and add the policy ID to `DefaultCacheBehavior`:

   ```json
   {
     "DefaultCacheBehavior": {
       "ResponseHeadersPolicyId": "YOUR-POLICY-ID-FROM-STEP-1",
       ...
     }
   }
   ```

4. **Update the distribution:**

   ```bash
   aws cloudfront update-distribution \
     --id E1T6GDX0TQEP94 \
     --if-match ETAG-FROM-STEP-2 \
     --distribution-config file://dist-config.json
   ```

See `cloudfront-security-headers-reference.md` for detailed instructions and troubleshooting.

### Option 3: Terraform/CloudFormation

See `cloudfront-security-headers.json` for the configuration structure that can be adapted to IaC tools.

## Security Best Practices

### For Developers

1. **Regular Audits**
   ```bash
   bun pm audit
   ```

2. **Keep Dependencies Updated**
   - Review and merge Dependabot PRs promptly
   - Test thoroughly after major version updates
   - Avoid canary/RC versions in production

3. **Code Reviews**
   - Review all import/export functionality changes
   - Validate error handling in data operations
   - Check for potential XSS in user-generated content

4. **Testing**
   - Maintain >80% test coverage
   - Include security test cases for data operations
   - Test CSP headers in staging before production

### For Users

1. **Regular Backups**
   - Export tasks regularly using the export feature
   - Store backups securely (they contain your task data)

2. **Browser Security**
   - Keep browser updated to latest version
   - Be cautious about browser extensions that access storage
   - Clear browser data carefully (will delete all tasks!)

3. **Data Privacy**
   - Remember: All data is local, nothing is backed up automatically
   - Export before clearing browser data
   - Import only from trusted export files

## Vulnerability Reporting

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the repository maintainer
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Security Audit Results

### Last Audit: 2026-01-02

- ✅ All high/critical vulnerabilities resolved
- ✅ Upgraded from canary to stable releases
- ✅ Added error handling to import functions
- ✅ End-to-end encryption implemented for cloud sync
- ✅ OAuth PKCE flow implemented for authentication
- ✅ MCP server read-only access enforced

### Resolved Issues

1. **nanoid vulnerability** - Upgraded from 4.0.2 to 5.1.6
2. **Next.js SSRF vulnerability** - Upgraded from canary to stable 16.1.1
3. **React RC versions** - Upgraded to stable 19.2.3
4. **Missing error handling** - Added try-catch to importFromJson()
5. **Cloud sync security** - AES-256-GCM with PBKDF2 key derivation (600k iterations)
6. **OAuth security** - PKCE + state parameter + ID token verification

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [AWS CloudFront Security](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
