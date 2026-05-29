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
	});
});
