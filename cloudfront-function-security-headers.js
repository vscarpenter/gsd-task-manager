/**
 * CloudFront Function: Security Headers
 *
 * This function adds comprehensive security headers to all responses:
 * - Content Security Policy (CSP) - Defense against XSS
 * - X-Frame-Options - Prevent clickjacking
 * - X-Content-Type-Options - Prevent MIME sniffing
 * - X-XSS-Protection - Legacy XSS protection
 * - Referrer-Policy - Control referrer information
 * - Permissions-Policy - Disable unnecessary browser features
 *
 * This function should be associated with the viewer-response event type.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
 */
function handler(event) {
  var response = event.response;
  var headers = response.headers;

  // Content Security Policy - Defense-in-depth against XSS
  headers['content-security-policy'] = {
    value: "default-src 'self'; " +
           "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
           "style-src 'self' 'unsafe-inline'; " +
           "img-src 'self' data: https:; " +
           "font-src 'self' data:; " +
           "connect-src 'self' https://gsd-sync-worker-production.vscarpenter.workers.dev https://gsd-sync-worker-staging.vscarpenter.workers.dev https://gsd-sync-worker-dev.vscarpenter.workers.dev https://accounts.google.com https://appleid.apple.com; " +
           "frame-ancestors 'none'; " +
           "base-uri 'self'; " +
           "form-action 'self';"
  };

  // Prevent clickjacking attacks
  headers['x-frame-options'] = { value: 'DENY' };

  // Prevent MIME type sniffing
  headers['x-content-type-options'] = { value: 'nosniff' };

  // Enable browser XSS protection (legacy, but defense-in-depth)
  headers['x-xss-protection'] = { value: '1; mode=block' };

  // Control referrer information
  headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };

  // Disable unnecessary browser features
  headers['permissions-policy'] = { value: 'geolocation=(), microphone=(), camera=()' };

  return response;
}
