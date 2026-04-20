/**
 * CloudFront Function: URL Rewrite for Static Export with Trailing Slashes
 *
 * Two responsibilities:
 *  1. Rewrite directory paths to include `index.html` for Next.js static
 *     export (e.g. `/dashboard/` → `/dashboard/index.html`).
 *  2. Markdown for Agents (RFC-style content negotiation): when the request
 *     includes `Accept: text/markdown`, rewrite the URI to the `.md` sibling
 *     so agents receive the markdown rendition while browsers continue to
 *     receive HTML by default. The companion viewer-response function adds
 *     `Vary: Accept` so caches do not collapse the two representations.
 *
 * CloudFront Functions run at CloudFront edge locations with sub-millisecond
 * latency. Security headers and Link headers are emitted by the
 * `gsd-response-headers` viewer-response function, not here.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var headers = request.headers;

  // 1. Resolve trailing-slash and extensionless paths to their `index.html`.
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.includes('.') && uri !== '/') {
    request.uri = uri + '/index.html';
  }

  // 2. Markdown for Agents — content negotiation on `Accept`.
  //    Only rewrite paths that resolve to an `index.html` (i.e. routes), and
  //    only when the client *prefers* markdown.
  var accept = headers['accept'] && headers['accept'].value;
  if (accept && /text\/markdown/i.test(accept) && request.uri.endsWith('/index.html')) {
    request.uri = request.uri.replace(/index\.html$/, 'index.md');
  }

  return request;
}
