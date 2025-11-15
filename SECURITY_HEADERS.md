# Security Headers Configuration

Since GSD Task Manager uses Next.js static export mode, security headers cannot be configured in `next.config.ts`. Instead, they must be configured at the CDN/hosting level.

## CloudFront Configuration

### Option 1: CloudFront Response Headers Policy (Recommended)

Create a custom response headers policy in CloudFront:

```bash
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://cloudfront-response-headers-policy.json
```

**cloudfront-response-headers-policy.json**:
```json
{
  "Name": "GSD-Security-Headers",
  "Comment": "Security headers for GSD Task Manager",
  "SecurityHeadersConfig": {
    "ContentSecurityPolicy": {
      "ContentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://gsd.vinny.dev https://gsd-dev.vinny.dev http://localhost:8787; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
      "Override": true
    },
    "ContentTypeOptions": {
      "Override": true
    },
    "FrameOptions": {
      "FrameOption": "DENY",
      "Override": true
    },
    "ReferrerPolicy": {
      "ReferrerPolicy": "strict-origin-when-cross-origin",
      "Override": true
    },
    "StrictTransportSecurity": {
      "AccessControlMaxAgeSec": 31536000,
      "IncludeSubdomains": true,
      "Override": true
    },
    "XSSProtection": {
      "Protection": true,
      "ModeBlock": true,
      "Override": true
    }
  },
  "CustomHeadersConfig": {
    "Items": [
      {
        "Header": "Permissions-Policy",
        "Value": "camera=(), microphone=(), geolocation=()",
        "Override": true
      }
    ]
  }
}
```

Then attach the policy to your CloudFront distribution:

```bash
aws cloudfront update-distribution \
  --id E1T6GDX0TQEP94 \
  --distribution-config file://distribution-config.json
```

### Option 2: Lambda@Edge Function

Create a Lambda@Edge function to add headers:

```javascript
exports.handler = async (event) => {
  const response = event.Records[0].cf.response;
  const headers = response.headers;

  headers['content-security-policy'] = [{
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://gsd.vinny.dev https://gsd-dev.vinny.dev http://localhost:8787; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
  }];

  headers['x-content-type-options'] = [{
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }];

  headers['x-frame-options'] = [{
    key: 'X-Frame-Options',
    value: 'DENY'
  }];

  headers['x-xss-protection'] = [{
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }];

  headers['referrer-policy'] = [{
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }];

  headers['strict-transport-security'] = [{
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  }];

  headers['permissions-policy'] = [{
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }];

  return response;
};
```

## Other Hosting Platforms

### Netlify

Create a `_headers` file in the `public/` directory:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://gsd.vinny.dev https://gsd-dev.vinny.dev http://localhost:8787; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Vercel

Create a `vercel.json` file in the project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://gsd.vinny.dev https://gsd-dev.vinny.dev http://localhost:8787; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

## Testing Security Headers

After deployment, verify headers are correctly set:

```bash
curl -I https://gsd.vinny.dev
```

Or use online tools:
- https://securityheaders.com/
- https://observatory.mozilla.org/

## CSP Policy Breakdown

- **default-src 'self'**: Only load resources from same origin
- **script-src 'self' 'unsafe-inline' 'unsafe-eval'**: Allow scripts from same origin + inline scripts (required for Next.js)
- **style-src 'self' 'unsafe-inline'**: Allow styles from same origin + inline styles (required for Tailwind)
- **img-src 'self' data: https:**: Allow images from same origin, data URIs, and HTTPS sources
- **font-src 'self' data:**: Allow fonts from same origin and data URIs
- **connect-src 'self' https://gsd.vinny.dev https://gsd-dev.vinny.dev http://localhost:8787**: Allow API connections to Worker endpoints
- **frame-ancestors 'none'**: Prevent clickjacking
- **base-uri 'self'**: Prevent base tag injection
- **form-action 'self'**: Restrict form submissions to same origin
- **upgrade-insecure-requests**: Automatically upgrade HTTP to HTTPS

## Notes

- **unsafe-inline** and **unsafe-eval** are required for Next.js to function correctly
- Consider tightening CSP once you've identified all legitimate script sources
- Test thoroughly after implementing to ensure the app functions correctly
- Monitor CSP violation reports if you implement report-uri
