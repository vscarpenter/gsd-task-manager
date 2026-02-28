# Security Configuration

This document outlines the security measures implemented in GSD Task Manager and deployment instructions for CloudFront security headers.

## Table of Contents

- [Overview](#overview)
- [Client-Side Security](#client-side-security)
- [Cloud Sync Security](#cloud-sync-security-optional-v690)
- [MCP Server Security](#mcp-server-security-optional-v690)
- [CloudFront Security Headers](#cloudfront-security-headers)
- [Deployment Instructions](#deployment-instructions)
- [Security Best Practices](#security-best-practices)
- [Security Audit Results](#security-audit-results)

## Overview

GSD Task Manager is a privacy-first application where all data is stored locally in the browser using IndexedDB by default. **Optional cloud sync** (v6.9.0+) enables multi-device access via a self-hosted PocketBase instance — the user owns and controls the server and data.

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

## Cloud Sync Security (Optional, v6.9.0+)

When users enable cloud sync, the following security measures protect their data:

### Self-Hosted PocketBase Architecture

1. **User-Owned Server**
   - PocketBase instance runs on user's own infrastructure (e.g., AWS EC2)
   - Tasks stored as plaintext in PocketBase SQLite database
   - User has full control over data retention and access
   - No third-party cloud service has access to task data

2. **Data Model**
   - Tasks stored with owner-scoped API rules: `@request.auth.id != "" && owner = @request.auth.id`
   - Each user can only access their own tasks
   - PocketBase enforces row-level security at the API layer

3. **Sync Protocol**
   - Last-write-wins (LWW) conflict resolution using `client_updated_at` timestamps
   - PocketBase SSE (Server-Sent Events) for realtime cross-device updates
   - Echo filtering prevents processing own-device changes
   - Offline queue replays when connectivity is restored

### OAuth Authentication

1. **Providers**
   - Google (via PocketBase built-in OAuth2)
   - GitHub (via PocketBase built-in OAuth2)

2. **Security Features**
   - PocketBase SDK handles OAuth popup flow and token management
   - Auth tokens stored in PocketBase's built-in `authStore` (localStorage)
   - Tokens auto-refresh via PocketBase SDK

### Network Security

- HTTPS-only communication with PocketBase server
- CORS configured at PocketBase level
- HSTS headers enforce secure connections
- TLS 1.2+ required

## MCP Server Security (Optional, v6.9.0+)

The MCP server allows Claude Desktop to access and manage tasks via natural language queries.

### Security Model

1. **PocketBase API Access**
   - MCP server communicates directly with PocketBase using auth token
   - Auth token stored only in Claude Desktop config file
   - No encryption layer — tasks are plaintext on user's own server

2. **Read & Write Access**
   - MCP tools support both read and write operations
   - Write operations support dry-run mode for safe exploration
   - All operations scoped to authenticated user's tasks only

3. **Opt-In Feature**
   - Requires explicit configuration by user
   - Must set PocketBase URL and auth token in Claude Desktop config
   - Not enabled by default

### Configuration Security

```json
// Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json)
{
  "mcpServers": {
    "gsd-taskmanager": {
      "env": {
        "GSD_POCKETBASE_URL": "https://api.vinny.io",
        "GSD_AUTH_TOKEN": "eyJ..."
      }
    }
  }
}
```

**Important**: The config file contains the auth token. Ensure appropriate file permissions (`chmod 600`).

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
connect-src 'self' https://api.vinny.io https://accounts.google.com https://github.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://accounts.google.com https://github.com;
```

**Production (Recommended):**
```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://api.vinny.io https://accounts.google.com https://github.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://accounts.google.com https://github.com;
```

> **Note:** The production CSP removes `unsafe-inline` and `unsafe-eval`. The `connect-src` includes the PocketBase server and OAuth provider domains.

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

### Last Audit: 2026-01-23

- ✅ All critical vulnerabilities resolved
- ✅ Dependency vulnerabilities patched
- ✅ PocketBase migration completed — simplified security model
- ✅ OAuth authentication via PocketBase built-in providers
- ✅ MCP server updated to PocketBase SDK
- ✅ Row-level security enforced via PocketBase API rules

### Previously Resolved Issues

1. **nanoid vulnerability** - Upgraded from 4.0.2 to 5.1.6
2. **Next.js SSRF vulnerability** - Upgraded from canary to stable 16.1.1
3. **React RC versions** - Upgraded to stable 19.2.3
4. **Missing error handling** - Added try-catch to importFromJson()

### Known Trade-offs (Documented)

1. **Auth Token in localStorage** — PocketBase SDK stores auth tokens in localStorage via its built-in `authStore`. Mitigated by React XSS protection, CSP headers, and HTTPS-only communication. Tasks are stored on user's own PocketBase server.

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [AWS CloudFront Security](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
