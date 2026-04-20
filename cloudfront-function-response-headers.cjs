/**
 * CloudFront Function: Response headers for agent discovery
 *
 * Runs as a viewer-response function so it sees both the request URI and the
 * upstream response headers.
 *
 * Responsibilities:
 *  1. Emit RFC 8288 `Link` response headers on every HTML response so agents
 *     can discover the API catalog, MCP server card, agent skills index,
 *     OAuth protected resource metadata, and OpenAPI document with a single
 *     `HEAD /` request.
 *  2. Emit `Vary: Accept` on routes that participate in markdown content
 *     negotiation so shared caches do not collapse the HTML and markdown
 *     representations.
 *  3. Force `Content-Type: text/markdown; charset=utf-8` on `.md` documents
 *     because S3 may return a generic `binary/octet-stream` for them.
 *
 * Security headers (CSP, HSTS, frame options, etc.) are still emitted by the
 * `gsd-security-headers` Response Headers Policy attached to the same
 * distribution; this function only adds discovery-related headers.
 */
function handler(event) {
  var request = event.request;
  var response = event.response;
  var headers = response.headers;
  var uri = request.uri;

  var contentType = headers['content-type'] && headers['content-type'].value;
  var isHtml = contentType && contentType.indexOf('text/html') === 0;
  var isMarkdown = uri.endsWith('.md');

  // Force the canonical markdown content type — agents check this byte for byte.
  if (isMarkdown) {
    headers['content-type'] = { value: 'text/markdown; charset=utf-8' };
  }

  // RFC 8288 Link header — emitted on HTML and markdown root documents.
  // Multiple relations are comma-separated within a single header value.
  if (isHtml || isMarkdown) {
    var links = [
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</.well-known/openapi/pocketbase.json>; rel="service-desc"; type="application/openapi+json"',
      '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"; type="application/json"',
      '</.well-known/mcp/server-card.json>; rel="mcp-server"; type="application/json"',
      '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
      '<https://github.com/vscarpenter/gsd-taskmanager>; rel="describedby"; type="text/html"'
    ];
    headers['link'] = { value: links.join(', ') };
  }

  // Mark routes that participate in `Accept` content negotiation. We append
  // to any existing Vary header to preserve upstream values (e.g. `Cookie`).
  if (isHtml || isMarkdown) {
    var existingVary = headers['vary'] && headers['vary'].value;
    headers['vary'] = {
      value: existingVary && existingVary.length > 0 ? existingVary + ', Accept' : 'Accept'
    };
  }

  return response;
}

// Test-only export. CloudFront's JS runtime executes this file as a script
// where `module` is undefined, so the guarded assignment is dead code at the
// edge. Node test runners pick it up via `require()`.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handler: handler };
}
