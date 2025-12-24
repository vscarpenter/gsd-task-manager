# Next.js 16.1 Upgrade Plan

## Executive Summary

**Current Version:** Next.js 16.0.10
**Target Version:** Next.js 16.1
**Risk Level:** LOW ✅
**Estimated Effort:** 1-2 hours

Since the codebase is already on Next.js 16.0.10, upgrading to 16.1 is a **minor version bump with no breaking changes**. The upgrade primarily brings performance improvements, security patches, and new developer experience features.

---

## Current State Analysis

### ✅ Pre-flight Checks (All Passed)

| Requirement | Current | Status |
|------------|---------|--------|
| Node.js version | v22.21.1 | ✅ (requires 20.9.0+) |
| TypeScript version | 5.9.3 | ✅ (requires 5.1.0+) |
| React version | 19.2.3 | ✅ (compatible) |
| React DOM version | 19.2.3 | ✅ (compatible) |

### Current Configuration

**next.config.ts:**
```typescript
{
  output: "export",           // Static export mode
  trailingSlash: true,        // Required for S3/CloudFront
  images: { unoptimized: true },
  typedRoutes: true,          // Type-safe navigation
  reactCompiler: true         // React Compiler enabled
}
```

**Architecture Features:**
- ✅ Static export mode (no server runtime)
- ✅ All pages are client-side (`"use client"`)
- ✅ No middleware.ts file (no proxy.ts migration needed)
- ✅ No async request APIs (params, searchParams, cookies, headers)
- ✅ PWA with service worker
- ✅ CloudFront Function for SPA routing
- ✅ React Compiler already enabled

---

## What's New in Next.js 16.1

### 1. **Turbopack File System Caching (Stable)**
- **Feature:** Compiler artifacts now cached on disk for faster dev server restarts
- **Impact:** Development experience improvement (10-14× faster compile times)
- **Action:** Enabled by default, no configuration needed
- **Benefit:** Significantly faster `pnpm dev` restarts

### 2. **New Bundle Analyzer (Experimental)**
- **Feature:** Turbopack-compatible bundle analysis
- **Impact:** Optional, can enable with `experimental.bundleAnalyzer`
- **Action:** Consider enabling for bundle size monitoring

### 3. **`next upgrade` Command**
- **Feature:** New CLI command for future upgrades
- **Impact:** Easier upgrade process for future versions
- **Action:** Available after upgrading to 16.1

### 4. **Security Patches**
- **CVE-2025-55182 & CVE-2025-66478:** Remote Code Execution vulnerabilities
- **Impact:** Critical security fixes in RSC protocol deserialization
- **Action:** **Upgrade recommended for security**

### 5. **Performance Improvements**
- React.dev: ~10× faster
- Next.js.org: ~5× faster
- Large apps: ~14× faster with caching

---

## Upgrade Steps

### Phase 1: Pre-Upgrade Validation (15 minutes)

1. **Ensure clean git state:**
   ```bash
   git status
   # Should show: "nothing to commit, working tree clean"
   ```

2. **Run existing tests:**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

3. **Create upgrade branch:**
   ```bash
   git checkout -b upgrade/nextjs-16.1
   ```

### Phase 2: Dependency Upgrade (10 minutes)

**Option A: Automated Upgrade (Recommended)**
```bash
npx @next/codemod@canary upgrade latest
```
This will:
- Update `next` to 16.1
- Update `react` and `react-dom` if needed
- Update `eslint-config-next` to match
- Run codemods for any breaking changes

**Option B: Manual Upgrade**
```bash
pnpm update next@16.1 eslint-config-next@16.1
```

### Phase 3: Post-Upgrade Validation (30 minutes)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run type checking:**
   ```bash
   pnpm typecheck
   ```

3. **Run tests:**
   ```bash
   pnpm test
   pnpm test -- --coverage  # Verify ≥80% coverage maintained
   ```

4. **Run linting:**
   ```bash
   pnpm lint
   ```

5. **Test development server:**
   ```bash
   pnpm dev
   ```
   - Verify app loads at http://localhost:3000
   - Test key features:
     - Create/edit/delete tasks
     - Matrix view and dashboard
     - PWA functionality
     - Theme switching
     - Search and filters
     - Cloud sync (if configured)
     - Command palette (⌘K/Ctrl+K)

6. **Test production build:**
   ```bash
   pnpm build
   ```
   - Verify no build errors
   - Check build output for warnings
   - Verify static export generates `out/` directory

7. **Test static export:**
   ```bash
   pnpm export
   ```
   - Verify all routes exported correctly
   - Check for any new warnings/errors

### Phase 4: CloudFront Compatibility Check (15 minutes)

Since the app uses CloudFront Functions for SPA routing, verify compatibility:

1. **Review CloudFront Function:**
   ```bash
   cat cloudfront-function-url-rewrite.js
   ```
   - No changes needed (routing logic unchanged)

2. **Test locally with static server:**
   ```bash
   npx serve out
   ```
   - Navigate to different routes
   - Verify trailing slash behavior
   - Test direct URL access to `/dashboard/`, `/archive/`, etc.

### Phase 5: PWA Verification (15 minutes)

1. **Build and serve PWA:**
   ```bash
   pnpm build
   npx serve out
   ```

2. **Test PWA features:**
   - Service worker registration
   - Offline functionality
   - Install prompt
   - Update notifications
   - Manifest.json served correctly

---

## Breaking Changes Assessment

### ✅ No Impact on This Codebase

The major breaking changes in Next.js 16.0 **do not affect this project**:

| Breaking Change | Impact | Reason |
|----------------|--------|--------|
| Async Request APIs | ❌ None | No server components using params/searchParams |
| `middleware.ts` → `proxy.ts` | ❌ None | No middleware file exists |
| Turbopack as default | ❌ None | Can opt-out with `--webpack` if needed |
| React 19 requirement | ✅ Already on 19.2.3 | No changes needed |

---

## Risk Assessment

### Low Risk Areas ✅

1. **Static Export Mode:** No server runtime = no server-side breaking changes
2. **Client-Side Only:** All components use `"use client"` = no RSC changes
3. **No Middleware:** No proxy.ts migration needed
4. **No Async APIs:** No params/searchParams refactoring needed
5. **React 19 Compatible:** Already on latest React version

### Medium Risk Areas ⚠️

1. **Turbopack File System Caching:**
   - **Risk:** New caching could cause stale build artifacts
   - **Mitigation:** Clear `.next` cache if issues arise
   - **Command:** `pnpm clean` (already in scripts)

2. **React Compiler:**
   - **Risk:** Compiler behavior changes in newer React versions
   - **Mitigation:** Already enabled and tested in 16.0.10
   - **Action:** Monitor build warnings

3. **PWA Service Worker:**
   - **Risk:** Build output changes could affect SW caching
   - **Mitigation:** Test offline functionality thoroughly
   - **Action:** Clear browser cache and re-register SW

### Critical Dependencies to Monitor

```json
{
  "next": "16.0.10" → "16.1",
  "react": "19.2.3",              // Should remain stable
  "react-dom": "19.2.3",          // Should remain stable
  "eslint-config-next": "16.0.10" → "16.1"
}
```

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback
```bash
git checkout main
pnpm install
pnpm dev
```

### Partial Rollback (Keep Dependencies, Revert Code)
```bash
git revert <commit-hash>
pnpm install
```

### Nuclear Option (Complete Rollback)
```bash
git reset --hard HEAD~1
pnpm install --force
```

---

## Post-Upgrade Monitoring

### Week 1: Development Monitoring

- [ ] Monitor dev server startup times (should be faster)
- [ ] Check for any new console warnings/errors
- [ ] Verify hot module replacement (HMR) works correctly
- [ ] Test all routes and navigation

### Week 2: Production Monitoring

- [ ] Monitor CloudFront logs for 403/404 errors
- [ ] Check PWA installation rates (should remain stable)
- [ ] Monitor service worker update success rates
- [ ] Verify analytics dashboard data integrity

### Week 3: Performance Validation

- [ ] Measure build times (should be similar or faster)
- [ ] Check bundle sizes (should remain stable)
- [ ] Validate Lighthouse scores (should maintain 90+)
- [ ] Test on multiple devices/browsers

---

## Optional Enhancements (Post-Upgrade)

### 1. Enable Bundle Analyzer (Experimental)

Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // ... existing config
  experimental: {
    bundleAnalyzer: {
      enabled: process.env.ANALYZE === 'true'
    }
  }
};
```

Run with: `ANALYZE=true pnpm build`

### 2. Optimize Turbopack Caching

Turbopack caching is enabled by default in 16.1. To clear cache if needed:
```bash
rm -rf .next
pnpm dev
```

### 3. Update Documentation

- [ ] Update CLAUDE.md with Next.js 16.1 mention
- [ ] Update README.md with current version
- [ ] Document any new features used
- [ ] Update deployment docs if needed

---

## Success Criteria

The upgrade is successful when:

- ✅ All tests pass (`pnpm test`)
- ✅ Type checking passes (`pnpm typecheck`)
- ✅ Linting passes (`pnpm lint`)
- ✅ Development server starts without errors (`pnpm dev`)
- ✅ Production build completes (`pnpm build`)
- ✅ Static export generates correctly (`pnpm export`)
- ✅ PWA functionality works (offline, install, updates)
- ✅ CloudFront routing works (trailing slashes, direct URLs)
- ✅ All features work as expected (tasks, sync, dashboard)
- ✅ No new console errors in browser
- ✅ Bundle size remains similar or smaller
- ✅ Performance metrics maintained or improved

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Pre-Upgrade Validation | 15 min | Test current state, create branch |
| Dependency Upgrade | 10 min | Run upgrade command, install deps |
| Post-Upgrade Validation | 30 min | Tests, type checking, builds |
| CloudFront Check | 15 min | Verify routing compatibility |
| PWA Verification | 15 min | Test offline, install, updates |
| **Total** | **~1.5 hours** | Core upgrade process |
| Optional Enhancements | 30 min | Bundle analyzer, docs updates |
| **Grand Total** | **~2 hours** | Complete upgrade |

---

## Questions & Considerations

### Q: Should we upgrade now or wait?
**A: Upgrade now.**
- Security patches (CVE-2025-55182, CVE-2025-66478) are critical
- No breaking changes from 16.0.10 → 16.1
- Performance improvements are valuable
- Low risk given current architecture

### Q: What if Turbopack causes issues?
**A: Opt out temporarily:**
```bash
pnpm dev --webpack
```
Then investigate and report issues to Next.js team.

### Q: Will CloudFront routing break?
**A: No.**
- Static export behavior unchanged
- Trailing slash config unchanged
- CloudFront Function logic independent of Next.js version

### Q: Will PWA functionality break?
**A: Unlikely.**
- Service worker is custom (`public/sw.js`)
- Manifest is static (`public/manifest.json`)
- Build output structure unchanged

---

## References & Resources

- [Next.js 16.1 Release Notes](https://nextjs.org/blog/next-16-1)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 Release Announcement](https://nextjs.org/blog/next-16)
- [Wisp CMS: Next.js 16.1 Upgrade Guide](https://www.wisp.blog/blog/nextjs-16-1-upgrade-guide)
- [StaticMania: Next.js 16.1 Review](https://staticmania.com/blog/next.js-16.1-review)

---

## Sign-Off

**Prepared by:** Claude Code
**Date:** 2025-12-24
**Current Version:** Next.js 16.0.10, React 19.2.3
**Target Version:** Next.js 16.1
**Risk Assessment:** LOW ✅
**Recommendation:** PROCEED with upgrade
