import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type CFHeader = { value: string };
type CFRequest = { uri: string; headers: Record<string, CFHeader> };
type CFResponse = { headers: Record<string, CFHeader> };
type CFEvent = { request: CFRequest; response?: CFResponse };
type Handler = (event: CFEvent) => CFRequest | CFResponse;

// Both CloudFront source files end with a `typeof module !== 'undefined'`
// guard that exposes the handler as a CommonJS export. The guard is dead
// code at the edge (CloudFront's JS runtime has no `module` global) so this
// import path is test-only and adds no edge runtime cost.
const requireCjs = createRequire(resolve(__dirname, '../../package.json'));
const { handler: urlRewrite } = requireCjs('./cloudfront-function-url-rewrite.cjs') as { handler: Handler };
const { handler: responseHeaders } = requireCjs('./cloudfront-function-response-headers.cjs') as { handler: Handler };

const makeRequest = (uri: string, headers: Record<string, string> = {}): CFRequest => ({
	uri,
	headers: Object.fromEntries(
		Object.entries(headers).map(([k, v]) => [k.toLowerCase(), { value: v }]),
	),
});

const makeResponse = (headers: Record<string, string>): CFResponse => ({
	headers: Object.fromEntries(
		Object.entries(headers).map(([k, v]) => [k.toLowerCase(), { value: v }]),
	),
});

describe('cloudfront-function-url-rewrite (viewer-request)', () => {
	it('appends index.html for trailing-slash URIs', () => {
		const req = makeRequest('/dashboard/');
		const out = urlRewrite({ request: req }) as CFRequest;
		expect(out.uri).toBe('/dashboard/index.html');
	});

	it('appends /index.html for extensionless paths', () => {
		const req = makeRequest('/about');
		const out = urlRewrite({ request: req }) as CFRequest;
		expect(out.uri).toBe('/about/index.html');
	});

	it('passes through asset paths with extensions unchanged', () => {
		const req = makeRequest('/_next/static/chunks/main.js');
		const out = urlRewrite({ request: req }) as CFRequest;
		expect(out.uri).toBe('/_next/static/chunks/main.js');
	});

	it('rewrites to .md when the client sends Accept: text/markdown', () => {
		const req = makeRequest('/about/', { accept: 'text/markdown, text/html;q=0.9' });
		const out = urlRewrite({ request: req }) as CFRequest;
		expect(out.uri).toBe('/about/index.md');
	});

	it('keeps .html when Accept does not include text/markdown', () => {
		const req = makeRequest('/about/', { accept: 'text/html' });
		const out = urlRewrite({ request: req }) as CFRequest;
		expect(out.uri).toBe('/about/index.html');
	});
});

describe('cloudfront-function-response-headers (viewer-response)', () => {
	it('emits a Link header with all discovery relations on HTML responses', () => {
		const event: CFEvent = {
			request: makeRequest('/index.html'),
			response: makeResponse({ 'content-type': 'text/html; charset=utf-8' }),
		};
		const out = responseHeaders(event) as CFResponse;
		const link = out.headers['link']?.value ?? '';
		expect(link).toContain('rel="api-catalog"');
		expect(link).toContain('rel="service-desc"');
		expect(link).toContain('rel="oauth-protected-resource"');
		expect(link).toContain('rel="mcp-server"');
		expect(link).toContain('rel="agent-skills"');
	});

	it('forces text/markdown content type on .md responses', () => {
		const event: CFEvent = {
			request: makeRequest('/index.md'),
			response: makeResponse({ 'content-type': 'binary/octet-stream' }),
		};
		const out = responseHeaders(event) as CFResponse;
		expect(out.headers['content-type']?.value).toBe('text/markdown; charset=utf-8');
	});

	it('appends Accept to an existing Vary header', () => {
		const event: CFEvent = {
			request: makeRequest('/index.html'),
			response: makeResponse({
				'content-type': 'text/html',
				vary: 'Cookie',
			}),
		};
		const out = responseHeaders(event) as CFResponse;
		expect(out.headers['vary']?.value).toBe('Cookie, Accept');
	});

	it('does not emit a Link header on non-HTML, non-markdown assets', () => {
		const event: CFEvent = {
			request: makeRequest('/_next/static/chunks/main.js'),
			response: makeResponse({ 'content-type': 'application/javascript' }),
		};
		const out = responseHeaders(event) as CFResponse;
		expect(out.headers['link']).toBeUndefined();
	});
});
