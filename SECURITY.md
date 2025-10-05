# Security Configuration

This document outlines the security measures implemented in GSD Task Manager and deployment instructions for CloudFront security headers.

## Table of Contents

- [Overview](#overview)
- [Client-Side Security](#client-side-security)
- [CloudFront Security Headers](#cloudfront-security-headers)
- [Deployment Instructions](#deployment-instructions)
- [Security Best Practices](#security-best-practices)

## Overview

GSD Task Manager is a privacy-first application where all data is stored locally in the browser using IndexedDB. No user data is transmitted to external servers.

## Client-Side Security

### Implemented Protections

1. **Local Data Storage Only**
   - All tasks stored in IndexedDB (client-side)
   - No external API calls or data transmission
   - Export/import functionality for user-controlled backups

2. **Input Validation**
   - Zod schema validation for all task operations
   - Sanitized error messages for import failures
   - Try-catch blocks around JSON parsing

3. **Dependency Management**
   - Regular `pnpm audit` checks for vulnerabilities
   - Automated security updates via Dependabot/Renovate
   - All packages kept at stable, non-canary versions

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
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

**Production (Recommended):**
```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

> **Note:** The production CSP removes `unsafe-inline` and `unsafe-eval`. This requires proper asset hashing and may need adjustments based on your build configuration.

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

Use the provided configuration file:

```bash
aws cloudfront create-response-headers-policy \
  --cli-input-json file://cloudfront-security-headers.json
```

Then attach the policy to your distribution:

```bash
aws cloudfront update-distribution \
  --id E1T6GDX0TQEP94 \
  --if-match <ETAG> \
  --distribution-config file://distribution-config.json
```

### Option 3: Terraform/CloudFormation

See `cloudfront-security-headers.json` for the configuration structure that can be adapted to IaC tools.

## Security Best Practices

### For Developers

1. **Regular Audits**
   ```bash
   pnpm audit
   pnpm audit --fix
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

### Last Audit: 2025-10-04

- ✅ All high/critical vulnerabilities resolved
- ✅ Upgraded from canary to stable releases
- ✅ Added error handling to import functions
- ⚠️ 1 moderate dev-only vulnerability in esbuild (via vitest) - acceptable for development

### Resolved Issues

1. **nanoid vulnerability** - Upgraded from 4.0.2 to 5.1.6
2. **Next.js SSRF vulnerability** - Upgraded from canary to stable 15.5.4
3. **React RC versions** - Upgraded to stable 19.2.0
4. **Missing error handling** - Added try-catch to importFromJson()

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [AWS CloudFront Security](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
