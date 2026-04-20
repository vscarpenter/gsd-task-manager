import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../public');

const readJson = <T,>(relativePath: string): T => {
	const raw = readFileSync(resolve(root, relativePath), 'utf-8');
	return JSON.parse(raw) as T;
};

describe('robots.txt content signals', () => {
	it('declares Content-Signal preferences before the User-agent block', () => {
		const robots = readFileSync(resolve(root, 'robots.txt'), 'utf-8');
		const signalIndex = robots.search(/^Content-Signal:/m);
		const userAgentIndex = robots.search(/^User-agent:/m);
		expect(signalIndex).toBeGreaterThanOrEqual(0);
		expect(userAgentIndex).toBeGreaterThan(signalIndex);
		expect(robots).toMatch(/Content-Signal:[^\n]*ai-train=no/);
		expect(robots).toMatch(/Content-Signal:[^\n]*search=yes/);
	});
});

describe('/.well-known/api-catalog (RFC 9727)', () => {
	type Linkset = { linkset: Array<Record<string, unknown>> };
	const catalog = readJson<Linkset>('.well-known/api-catalog');

	it('is a non-empty linkset', () => {
		expect(Array.isArray(catalog.linkset)).toBe(true);
		expect(catalog.linkset.length).toBeGreaterThan(0);
	});

	it('every entry has an anchor URL', () => {
		for (const entry of catalog.linkset) {
			expect(typeof entry.anchor).toBe('string');
			expect(entry.anchor as string).toMatch(/^https?:\/\//);
		}
	});

	it('first entry advertises service-doc, service-desc, and status', () => {
		const first = catalog.linkset[0]!;
		expect(first['service-doc']).toBeDefined();
		expect(first['service-desc']).toBeDefined();
		expect(first['status']).toBeDefined();
	});
});

describe('/.well-known/oauth-protected-resource (RFC 9728)', () => {
	type Resource = {
		resource: string;
		authorization_servers: string[];
		bearer_methods_supported: string[];
		scopes_supported: string[];
	};
	const meta = readJson<Resource>('.well-known/oauth-protected-resource');

	it('points to the GSD origin as the resource', () => {
		expect(meta.resource).toBe('https://gsd.vinny.dev');
	});

	it('lists at least one authorization server', () => {
		expect(meta.authorization_servers.length).toBeGreaterThan(0);
		expect(meta.authorization_servers[0]).toMatch(/^https:\/\//);
	});

	it('declares header-based bearer tokens and at least one scope', () => {
		expect(meta.bearer_methods_supported).toContain('header');
		expect(meta.scopes_supported.length).toBeGreaterThan(0);
	});
});

describe('/.well-known/mcp/server-card.json', () => {
	type ServerCard = {
		serverInfo: { name: string; version: string };
		transports: Array<{ type: string; install?: { command: string } }>;
		tools: Array<{ name: string; category: string }>;
	};
	const card = readJson<ServerCard>('.well-known/mcp/server-card.json');

	it('matches the published npm package name', () => {
		expect(card.serverInfo.name).toBe('gsd-mcp-server');
		expect(card.serverInfo.version).toMatch(/^\d+\.\d+\.\d+/);
	});

	it('declares a stdio transport with an install command', () => {
		const stdio = card.transports.find((t) => t.type === 'stdio');
		expect(stdio).toBeDefined();
		expect(stdio?.install?.command).toBeDefined();
	});

	it('lists the 20 documented MCP tools', () => {
		expect(card.tools).toHaveLength(20);
		const names = new Set(card.tools.map((t) => t.name));
		for (const required of ['list_tasks', 'create_task', 'get_productivity_metrics']) {
			expect(names.has(required)).toBe(true);
		}
	});
});

describe('/.well-known/agent-skills/index.json', () => {
	type SkillsIndex = {
		version: string;
		skills: Array<{ name: string; url: string; sha256: string }>;
	};
	const index = readJson<SkillsIndex>('.well-known/agent-skills/index.json');

	it('uses the v0.2.0 schema', () => {
		expect(index.version).toBe('0.2.0');
	});

	it('digest matches the actual SKILL.md bytes for every skill', () => {
		for (const skill of index.skills) {
			const path = resolve(root, '.well-known/agent-skills', skill.name, 'SKILL.md');
			const bytes = readFileSync(path);
			const digest = createHash('sha256').update(bytes).digest('hex');
			expect(digest).toBe(skill.sha256);
		}
	});
});

describe('/.well-known/openapi/pocketbase.json', () => {
	type OpenApi = {
		openapi: string;
		info: { title: string; version: string };
		paths: Record<string, unknown>;
	};
	const spec = readJson<OpenApi>('.well-known/openapi/pocketbase.json');

	it('is OpenAPI 3.1+', () => {
		expect(spec.openapi).toMatch(/^3\.[1-9]/);
	});

	it('describes the tasks collection endpoints', () => {
		expect(Object.keys(spec.paths)).toContain('/api/collections/tasks/records');
	});
});
