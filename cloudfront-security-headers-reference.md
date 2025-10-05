# CloudFront Security Headers Reference

This document explains the security headers configuration for AWS CloudFront.

## Quick Start

### Create the Response Headers Policy

```bash
aws cloudfront create-response-headers-policy \
  --cli-input-json file://cloudfront-security-headers.json
```

This will output a policy ID. Save it for the next step.

### Attach Policy to CloudFront Distribution

1. Get your distribution config:
```bash
aws cloudfront get-distribution-config \
  --id E1T6GDX0TQEP94 > distribution-config.json
```

2. Edit `distribution-config.json` and add the policy ID to the default cache behavior:
```json
{
  "DefaultCacheBehavior": {
    "ResponseHeadersPolicyId": "YOUR-POLICY-ID-HERE",
    ...
  }
}
```

3. Update the distribution:
```bash
aws cloudfront update-distribution \
  --id E1T6GDX0TQEP94 \
  --if-match ETAG-FROM-STEP-1 \
  --distribution-config file://distribution-config.json
```

4. Create invalidation:
```bash
aws cloudfront create-invalidation \
  --distribution-id E1T6GDX0TQEP94 \
  --paths "/*"
```

## Headers Explained

### Content Security Policy (CSP)

**Current Configuration:**
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

**Directive Explanations:**
- `default-src 'self'` - Only allow resources from same origin by default
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` - Required for Next.js hydration and React DevTools
- `style-src 'self' 'unsafe-inline'` - Required for Tailwind and inline styles
- `img-src 'self' data: blob:` - Allow images from same origin, data URIs, and blobs
- `font-src 'self' data:` - Allow fonts from same origin and data URIs
- `connect-src 'self'` - Only allow fetch/XHR to same origin
- `frame-ancestors 'none'` - Prevent clickjacking (same as X-Frame-Options: DENY)
- `base-uri 'self'` - Restrict `<base>` tag URLs
- `form-action 'self'` - Restrict form submissions to same origin

**Production-Optimized CSP** (remove if you can eliminate inline scripts/styles):
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

### Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- Forces HTTPS connections for 2 years (63072000 seconds)
- Includes all subdomains
- Eligible for browser HSTS preload lists

### X-Frame-Options

```
X-Frame-Options: DENY
```

Prevents the page from being embedded in `<frame>`, `<iframe>`, or `<object>` tags, protecting against clickjacking attacks.

### X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

Prevents browsers from MIME-sniffing a response away from the declared content-type, protecting against MIME confusion attacks.

### X-XSS-Protection

```
X-XSS-Protection: 1; mode=block
```

Enables browser's built-in XSS filter and tells it to block the page rather than sanitize it.

### Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Controls how much referrer information is sent with requests:
- Same origin: Full URL
- Cross-origin HTTPS: Origin only
- Cross-origin HTTP: No referrer

### Permissions-Policy

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

Disables browser features that the application doesn't use, reducing attack surface.

## Testing Your Headers

After deployment, verify headers are working:

```bash
curl -I https://gsd.vinny.dev
```

Or use online tools:
- https://securityheaders.com
- https://observatory.mozilla.org

## Troubleshooting

### Policy Name Already Exists

If you get a "policy name already exists" error:

```bash
# List existing policies
aws cloudfront list-response-headers-policies

# Delete the old policy
aws cloudfront delete-response-headers-policy \
  --id POLICY-ID \
  --if-match ETAG
```

### CSP Blocking Resources

If CSP is too strict and blocking legitimate resources, check browser console for CSP violations and adjust directives accordingly.

### Headers Not Appearing

1. Verify the policy is attached to the distribution
2. Create a CloudFront invalidation
3. Wait for distribution deployment (can take 15-30 minutes)
4. Clear browser cache and test again

## Alternative: AWS Console Method

If you prefer using the AWS Console:

1. Go to **CloudFront** → **Policies** → **Response headers**
2. Click **Create response headers policy**
3. Name: `gsd-security-headers`
4. Configure each section:
   - **Security headers**: Enable all and configure as shown above
   - **Custom headers**: Add Permissions-Policy
5. Click **Create**
6. Go to your distribution → **Behaviors** → Edit default behavior
7. Select your new policy under **Response headers policy**
8. Save changes and wait for deployment

## References

- [AWS CloudFront Response Headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
