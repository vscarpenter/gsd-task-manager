# Next.js 16 TypeScript Web Application Security & Standards Review

You are conducting a comprehensive security audit and standards compliance review of this Next.js 16 TypeScript web application deployed on Cloudflare Workers, using React 19 and Dexie (IndexedDB).

## Setup Instructions

1. First, use the `view` tool to read `coding-standards.md` to understand the project's specific coding standards and design patterns
2. Use the `view` tool to examine the project structure, focusing on:
   - `/app` directory (App Router structure)
   - `/pages/api` or `/app/api` (API routes)
   - Cloudflare Workers files (`wrangler.toml`, worker scripts)
   - Database schema and Dexie configuration
   - Middleware files
3. Review `package.json`, `package-lock.json`, and `wrangler.toml` for dependencies and configuration

## Part 1: Security Vulnerability Analysis

### Next.js 16 & React 19 Specific Security

**Server Components vs Client Components**
- Verify proper `'use client'` and `'use server'` directives
- Check for sensitive data leakage from Server Components to Client Components
- Ensure secrets/API keys never appear in Client Component code
- Review serialization of data between server and client boundaries

**Server Actions Security**
- Authentication/authorization checks in all Server Actions
- Input validation before processing form data
- CSRF protection (Next.js 16 built-in protections are enabled)
- Rate limiting on Server Actions to prevent abuse
- Proper error handling without exposing internal details

**Route Handlers & API Routes**
- Authentication middleware on protected endpoints
- HTTP method validation (GET, POST, PUT, DELETE restrictions)
- Request body validation and sanitization
- Response header security (CORS, Content-Type)
- Rate limiting implementation

**React 19 Security Patterns**
- Safe usage of new concurrent features
- Proper cleanup in useEffect hooks to prevent memory leaks
- Secure handling of suspense boundaries with sensitive data
- XSS prevention in JSX (avoid dangerouslySetInnerHTML)
- Form action security with proper validation

### Cloudflare Workers Specific Security

**Edge Runtime Constraints**
- Proper handling of limited Node.js API availability
- Secure use of Cloudflare bindings (KV, R2, D1, Durable Objects)
- Environment variable security in `wrangler.toml` and deployment
- Secrets management (use `wrangler secret` not hardcoded values)
- Request size limits and validation

**Worker Configuration**
- `wrangler.toml` security settings review
- Route patterns that might expose unintended endpoints
- CORS configuration in Workers
- CSP headers implementation in middleware
- WAF and rate limiting through Cloudflare dashboard integration

### Dexie/IndexedDB Security

**Client-Side Data Storage**
- Never store sensitive data unencrypted in IndexedDB
- Proper data sanitization before storage
- Schema migration security (prevent data corruption)
- Query injection risks in Dexie queries
- Data expiration and cleanup policies
- Browser storage quota handling

**Data Sync Patterns**
- Validation of data synced from server to IndexedDB
- Prevention of data tampering (integrity checks)
- Handling of offline data conflicts securely
- Encryption of sensitive cached data

### Authentication & Authorization

- Next.js middleware authentication checks
- JWT/session token validation (edge-compatible)
- Protected routes (both App Router and API routes)
- Role-based access control implementation
- Secure cookie configuration (httpOnly, secure, sameSite, path)
- OAuth/third-party auth integration security

### Input Validation & Injection Prevention

- Form data validation (both client and server-side)
  - React Hook Form or Zod schema validation
  - Server Action input validation
- XSS prevention strategies
  - Sanitization of user content
  - Safe rendering of dynamic content
- API parameter validation
- SQL/NoSQL injection (if using any database through Workers)
- Command injection in any system calls

### Data Protection & Privacy

- Sensitive data exposure in:
  - Client-side bundle code
  - Source maps in production
  - Console.log statements
  - Error messages and stack traces
  - Network requests (DevTools inspection)
- Environment variables properly segregated (`.env.local`, Cloudflare secrets)
- API keys and tokens never in client code
- PII handling compliance
- Data retention and cleanup policies

### Next.js Build & Deployment Security

- `next.config.js` security headers configuration:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security
  - Permissions-Policy
- Source map configuration for production
- Image optimization security (`next/image`)
- Static asset security
- Environment variable exposure checks

### Dependency Security

- Run and analyze: `npm audit` or `pnpm audit`
- Next.js version (using latest 16.x patches)
- React 19 version (stable vs RC/beta)
- Dexie version and known vulnerabilities
- Cloudflare Workers runtime compatibility
- Unnecessary packages that expand attack surface

### TypeScript Configuration Security

- `tsconfig.json` strict mode enabled
- `noImplicitAny`, `strictNullChecks` enforced
- Unsafe `any` types in security-critical code
- Type assertions that bypass safety
- Missing null/undefined checks

## Part 2: Coding Standards Compliance

Review against `coding-standards.md` requirements:

### Next.js Patterns
- App Router vs Pages Router usage consistency
- Server/Client Component organization
- Metadata API usage
- Dynamic routes and params handling
- Loading and error UI patterns
- Streaming and Suspense usage

### React 19 Patterns
- Hook usage patterns (useState, useEffect, useTransition, etc.)
- Component composition and reusability
- Props validation and TypeScript interfaces
- Ref forwarding patterns
- Error boundary implementation

### Dexie Patterns
- Database initialization and versioning
- Schema definition standards
- Query patterns and optimization
- Transaction usage
- Error handling in database operations

### Cloudflare Workers Patterns
- Request/Response handling patterns
- Binding usage (KV, R2, etc.)
- Error handling and logging
- Performance optimization
- Cold start considerations

### General Standards
- File and folder naming conventions
- Import organization and barrel files
- Code documentation (JSDoc/TSDoc)
- Error handling consistency
- Async/await patterns
- Testing patterns (unit, integration, e2e)

## Analysis Approach

### Priority Order

1. **Server Actions and API Routes** - Highest risk for data exposure
2. **Cloudflare Worker configurations** - Infrastructure security
3. **Authentication/Authorization middleware** - Access control
4. **Client-Server data boundaries** - Data leakage prevention
5. **IndexedDB/Dexie usage** - Client-side data security
6. **Form handling and validation** - Input security
7. **Environment and build configuration** - Deployment security
8. **Third-party integrations** - External attack vectors

### Files to Prioritize

- `middleware.ts` or `middleware.js`
- `app/api/**/*.ts` - API routes
- Server Actions files (functions with `'use server'`)
- `wrangler.toml` and Worker entry points
- `next.config.js`
- Dexie database schema files
- Authentication utilities
- `.env.example` and environment configuration

## Output Format

Organize findings by severity:

```
[CRITICAL] Issue Title
Location: app/api/user/route.ts:45-52
Category: Authentication | Input Validation | Data Protection | etc.

Issue: 
Clear description of the security vulnerability or standards violation

Impact: 
What could happen? (e.g., "Allows unauthenticated users to access sensitive user data")

Current Code:
```typescript
// problematic code snippet with context
```

Recommended Fix:
```typescript
// corrected code with explanation
```

Standards Reference: 
Section 3.2 of coding-standards.md (if applicable)

---
```

## Stack-Specific Checks

### Next.js 16 Checklist
- [ ] All Server Actions have authentication checks
- [ ] No secrets in Client Components
- [ ] Security headers configured in `next.config.js`
- [ ] Proper error handling in route handlers
- [ ] Image optimization properly configured
- [ ] Metadata doesn't leak sensitive info

### Cloudflare Workers Checklist
- [ ] All secrets use `wrangler secret` not environment vars
- [ ] CORS properly configured for your domains
- [ ] Rate limiting implemented on sensitive endpoints
- [ ] Worker bindings properly typed and secured
- [ ] Request size validation implemented

### Dexie/IndexedDB Checklist
- [ ] No sensitive data stored unencrypted
- [ ] Schema versioning properly implemented
- [ ] Proper error handling for quota exceeded
- [ ] Data cleanup/expiration strategy in place
- [ ] No user input directly in queries without validation

### React 19 Checklist
- [ ] No XSS vulnerabilities in JSX
- [ ] Form actions properly validated
- [ ] Concurrent rendering doesn't expose race conditions
- [ ] Suspense boundaries don't leak sensitive data
- [ ] useEffect cleanup prevents memory leaks

## Final Summary

Provide:

1. **Executive Summary**: Total findings by severity
2. **Critical Path**: Top 5 issues requiring immediate attention
3. **Quick Wins**: Easy fixes that improve security significantly
4. **Architectural Concerns**: Patterns suggesting deeper issues
5. **Preventive Measures**: 
   - ESLint rules to add
   - Pre-commit hooks to implement
   - CI/CD security checks to enable
6. **Next Steps**: Recommended priority order for remediation

## Recommended Follow-up Actions

After review completion:
- Generate `SECURITY_REVIEW.md` with all findings
- Create separate `REMEDIATION_PLAN.md` with prioritized fix schedule
- Suggest specific ESLint rules for Next.js/React/TypeScript security
- Recommend Cloudflare security features to enable (WAF rules, rate limiting)

---

## Usage with Claude Code

After the review, you can follow up with:
- "Create a git branch and fix all CRITICAL issues"
- "Generate ESLint config to prevent these issues"
- "Create GitHub issues for each HIGH+ severity finding"
- "Update the README with security best practices based on findings"
