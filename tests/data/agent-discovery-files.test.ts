import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

	// PocketBase issues its own tokens and serves no RFC 8414 metadata, so
	// there is no authorization server for the catalog to point at.
	it('names no OAuth authorization server', () => {
		for (const entry of catalog.linkset) {
			expect(entry).not.toHaveProperty('oauth-authorization-server');
		}
	});
});

describe('/.well-known/oauth-protected-resource (RFC 9728)', () => {
	const meta = readJson<Record<string, unknown>>('.well-known/oauth-protected-resource');

	it('points to the GSD origin as the resource', () => {
		expect(meta.resource).toBe('https://gsd.vinny.dev');
	});

	// api.vinny.io answers 404 for RFC 8414 and OpenID discovery, and the
	// static site takes no tokens and signs nothing. Each of these fields
	// would send an agent looking for something that isn't there.
	it('claims no authorization server, scope, bearer method, or signing algorithm', () => {
		for (const field of [
			'authorization_servers',
			'scopes_supported',
			'bearer_methods_supported',
			'resource_signing_alg_values_supported',
		]) {
			expect(meta).not.toHaveProperty(field);
		}
	});
});

describe('/.well-known/mcp/server-card.json', () => {
	type ServerCard = {
		serverInfo: { name: string; version: string };
		transports: Array<{
			type: string;
			install?: { command: string };
			env?: Record<string, { required?: boolean; secret?: boolean }>;
		}>;
		tools: Array<{ name: string; category: string }>;
		capabilities: { prompts: boolean; logging: boolean };
	};
	const card = readJson<ServerCard>('.well-known/mcp/server-card.json');
	const schemaDir = resolve(__dirname, '../../packages/mcp-server/src/tools/schemas');
	const registeredTools = readdirSync(schemaDir)
		.filter((file) => file.endsWith('-tools.ts'))
		.flatMap((file) =>
			[...readFileSync(resolve(schemaDir, file), 'utf-8').matchAll(/^ {2}name: '([a-z_]+)'/gm)].map((match) => match[1])
		);

	it('matches the MCP package name and release version', () => {
		const manifest = JSON.parse(
			readFileSync(resolve(__dirname, '../../packages/mcp-server/package.json'), 'utf8')
		) as { name: string; version: string };
		expect(card.serverInfo.name).toBe(manifest.name);
		expect(card.serverInfo.version).toBe(manifest.version);
	});

	it('declares a stdio transport with an install command', () => {
		const stdio = card.transports.find((t) => t.type === 'stdio');
		expect(stdio).toBeDefined();
		expect(stdio?.install?.command).toBeDefined();
	});

	it('lists exactly the tools the MCP server registers', () => {
		expect(registeredTools).toHaveLength(20);
		expect(card.tools.map((t) => t.name).sort()).toEqual([...registeredTools].sort());
	});

	it('advertises the capabilities the MCP server declares: prompts, and no logging', () => {
		expect(card.capabilities.prompts).toBe(true);
		expect(card.capabilities.logging).toBe(false);
	});

	// The MCP server authenticates with a token the user pastes into
	// GSD_AUTH_TOKEN, not an OAuth flow, so the card carries no OAuth block.
	it('claims no OAuth authentication the MCP server does not use', () => {
		expect(card).not.toHaveProperty('authentication');
	});

	it('declares the pasted auth token as a required secret', () => {
		const env = card.transports.find((t) => t.type === 'stdio')?.env;
		expect(env?.GSD_AUTH_TOKEN).toMatchObject({ required: true, secret: true });
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

describe('/.well-known/ard.json (Agentic Resource Discovery)', () => {
	type ArdEntry = {
		identifier: string;
		displayName: string;
		type: string;
		url?: string;
		data?: unknown;
		representativeQueries?: string[];
	};
	type ArdManifest = {
		specVersion: string;
		host: { displayName: string; identifier: string };
		entries: ArdEntry[];
	};
	const ORIGIN = 'https://gsd.vinny.dev/';
	const manifest = readJson<ArdManifest>('.well-known/ard.json');

	// ARD v0.91 moved the manifest to ard.json. Scanners and older consumers
	// still read the predecessor path, so the two files must never drift.
	it('serves the same bytes at the legacy ai-catalog.json path', () => {
		const legacy = readFileSync(resolve(root, '.well-known/ai-catalog.json'));
		const current = readFileSync(resolve(root, '.well-known/ard.json'));
		expect(legacy.equals(current)).toBe(true);
	});

	// A did:web identifier would promise a /.well-known/did.json this site
	// does not publish, so the host is named by its domain instead.
	it('declares the AI Catalog 0.9 data model and names its host by domain', () => {
		expect(manifest.specVersion).toBe('0.9');
		expect(manifest.host.displayName).toBe('GSD Task Manager');
		expect(manifest.host.identifier).toBe('gsd.vinny.dev');
	});

	it('gives every entry a unique urn:air identifier under gsd.vinny.dev', () => {
		const ids = manifest.entries.map((entry) => entry.identifier);
		for (const id of ids) {
			expect(id).toMatch(/^urn:air:gsd\.vinny\.dev:[^:]+(:[^:]+)?$/);
		}
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every entry a display name, a media type, and exactly one of url or data', () => {
		for (const entry of manifest.entries) {
			expect(entry.displayName.length).toBeGreaterThan(0);
			expect(entry.type).toMatch(/^application\/[a-z0-9.+-]+$/);
			expect(['url', 'data'].filter((key) => key in entry)).toHaveLength(1);
		}
	});

	it('gives every entry 2 to 5 representative queries for registry search', () => {
		for (const entry of manifest.entries) {
			const count = entry.representativeQueries?.length ?? 0;
			expect(count).toBeGreaterThanOrEqual(2);
			expect(count).toBeLessThanOrEqual(5);
		}
	});

	it('lists the MCP server card and every published agent skill', () => {
		const skills = readJson<{ skills: Array<{ url: string }> }>('.well-known/agent-skills/index.json').skills;
		const expected = [
			['application/mcp-server-card+json', `${ORIGIN}.well-known/mcp/server-card.json`],
			...skills.map((skill) => ['application/agent-skills+md', skill.url]),
		];
		expect(manifest.entries.map((entry) => [entry.type, entry.url])).toEqual(expected);
	});

	it('points every url at a file this site publishes', () => {
		for (const entry of manifest.entries) {
			const url = entry.url ?? '';
			expect(url.startsWith(ORIGIN)).toBe(true);
			expect(existsSync(resolve(root, url.slice(ORIGIN.length)))).toBe(true);
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

describe('/.well-known/security.txt (RFC 9116)', () => {
	const securityTxt = readFileSync(resolve(root, '.well-known/security.txt'), 'utf-8');

	const field = (name: string): string | undefined =>
		securityTxt.match(new RegExp(`^${name}:[ \\t]*(.+)$`, 'm'))?.[1]?.trim();

	it('declares a Contact field, the one field RFC 9116 requires', () => {
		const contact = field('Contact');
		expect(contact).toBeDefined();
		expect(contact).toMatch(/^(https:\/\/|mailto:)/);
	});

	it('declares Canonical as the production security.txt URL', () => {
		expect(field('Canonical')).toBe('https://gsd.vinny.dev/.well-known/security.txt');
	});

	it('points Policy at the checked-in SECURITY.md', () => {
		expect(field('Policy')).toBe(
			'https://github.com/vscarpenter/gsd-task-manager/blob/main/SECURITY.md',
		);
	});

	it('uses the live repository slug, since the un-hyphenated form 404s', () => {
		expect(securityTxt).not.toMatch(/vscarpenter\/gsd-taskmanager\b/);
	});

	describe('Expires', () => {
		const raw = field('Expires');
		const DAY_MS = 86_400_000;
		const daysOut = (): number =>
			(new Date(raw as string).getTime() - Date.now()) / DAY_MS;

		it('is present and parseable as an RFC 3339 timestamp', () => {
			expect(raw).toBeDefined();
			expect(raw).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
			expect(Number.isNaN(new Date(raw as string).getTime())).toBe(false);
		});

		it('is under a year out, as RFC 9116 section 2.5.5 recommends', () => {
			expect(daysOut()).toBeLessThan(365);
		});

		// This is the refresh alarm. A static export has no server to renew
		// security.txt, so CI is what notices the file is going stale.
		it('has more than 30 days left: bump Expires when this fails', () => {
			expect(daysOut()).toBeGreaterThan(30);
		});
	});
});

describe('scripts/fix-discovery-content-types.sh', () => {
	const script = readFileSync(
		resolve(__dirname, '../../scripts/fix-discovery-content-types.sh'),
		'utf-8',
	);

	it('stamps security.txt as text/plain with an explicit charset', () => {
		expect(script).toMatch(
			/fix_type "\.well-known\/security\.txt" "text\/plain; charset=utf-8"/,
		);
	});

	it('stamps both ARD manifest paths as application/json', () => {
		for (const key of ['ard.json', 'ai-catalog.json']) {
			expect(script).toContain(`fix_type ".well-known/${key}" "application/json"`);
		}
	});
});

describe('published agent skills match the MCP input schemas', () => {
	// The MCP tool schemas are strict objects, so an argument they do not
	// declare fails with "Invalid arguments". Skills must not teach one.
	const skillText = (name: string): string =>
		readFileSync(resolve(root, '.well-known/agent-skills', name, 'SKILL.md'), 'utf-8');

	for (const name of ['quick-capture', 'triage-inbox']) {
		it(`${name} uses dueDate, not dueAt`, () => {
			expect(skillText(name)).not.toMatch(/dueAt/);
		});
	}

	it('triage-inbox calls list_tasks with completed, no status or sort argument', () => {
		const text = skillText('triage-inbox');
		expect(text).not.toMatch(/status:\s*"open"/);
		expect(text).not.toMatch(/sort/i);
		expect(text).toMatch(/completed:\s*false/);
	});
});

describe('/.well-known/openapi/pocketbase.json Task schema', () => {
	type TaskSchema = { properties: Record<string, { type: string }> };
	const spec = readJson<{ components: { schemas: { Task: TaskSchema } } }>(
		'.well-known/openapi/pocketbase.json',
	);
	const props = spec.components.schemas.Task.properties;

	it('publishes the real PocketBase field names and types', () => {
		expect(props.description?.type).toBe('string');
		expect(props.completed?.type).toBe('boolean');
		expect(props.due_date?.type).toBe('string');
	});

	it('does not publish fields PocketBase does not have', () => {
		for (const stale of ['notes', 'status', 'due_at']) {
			expect(props[stale]).toBeUndefined();
		}
	});

	// Examples count too: PocketBase answers 400 to a filter on a field the
	// collection lacks, so an agent copying a stale example gets nothing.
	it('names no stale field anywhere, examples included', () => {
		const text = JSON.stringify(spec);
		for (const stale of ['notes', 'status', 'due_at']) {
			expect(text).not.toMatch(new RegExp(`\\b${stale}\\b`));
		}
	});

	// MCP tools take the client task id, not the PocketBase record id.
	it('publishes task_id beside the record id', () => {
		expect(props.task_id?.type).toBe('string');
	});
});
