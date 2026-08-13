import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CloudFront response headers policy", () => {
	it("keeps CSP base and connection directives tight", () => {
		const policyPath = resolve(
			__dirname,
			"../../cloudfront/response-headers-policy.json",
		);
		const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
		const csp =
			policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;

		expect(csp).toContain("base-uri 'none'");
		expect(csp).toContain(
			"connect-src 'self' https://api.vinny.io https://accounts.google.com https://github.com https://*.ingest.us.sentry.io",
		);
		expect(csp).not.toContain("connect-src 'self' https: wss:");
		expect(csp).not.toContain("'unsafe-eval'");
		expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
		expect(csp).toContain("style-src-elem 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it("lets Radix inject its scroll-lock stylesheet", () => {
		const policyPath = resolve(
			__dirname,
			"../../cloudfront/response-headers-policy.json",
		);
		const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
		const csp =
			policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
		const styleSrcElem = csp.match(/style-src-elem[^;]*/)?.[0] ?? "";

		// react-remove-scroll interpolates the measured scrollbar width into the
		// stylesheet it injects, so its text differs per device and cannot be
		// hash-pinned. A hash in this directive would also make 'unsafe-inline'
		// a no-op, so the two cannot coexist.
		expect(styleSrcElem).toContain("'unsafe-inline'");
		expect(styleSrcElem).not.toContain("sha256-");
	});
});
