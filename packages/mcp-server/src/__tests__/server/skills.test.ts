import { isUtf8 } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGsdSkills } from '../../server/skills.js';
import { PROTOCOLS, connectClient, type ConnectedClient } from '../helpers/protocol-clients.js';

/**
 * GSD's workflow guidance, served as MCP skills beside the tools and prompts
 * (tasks/spec.md, "Move the MCP server to SDK v2", D6 and AC18 to AC22).
 */

// Lets one test point the SDK's real loader at a folder that doesn't exist, as
// an install without skills/ would. Every other test loads the real folder.
const loaderRedirect = vi.hoisted(() => ({ root: undefined as string | undefined }));

vi.mock('@modelcontextprotocol/server/ext/skills/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modelcontextprotocol/server/ext/skills/node')>();
  const loadSkills: typeof actual.loadSkills = (root, options) =>
    actual.loadSkills(loaderRedirect.root ?? root, options);
  return { ...actual, loadSkills };
});
const SKILLS_EXTENSION = 'io.modelcontextprotocol/skills';

// The spec's Skills table, in the URI order the catalog lists them.
const SKILL_NAMES = ['daily-plan', 'safe-cleanup', 'triage', 'weekly-review'];

// What each skill must teach, from the sources the spec's Skills table names:
// the tool descriptions, get_help, the six prompts, and the server instructions.
const REQUIRED_RULES: Record<string, Record<string, RegExp[]>> = {
  'daily-plan': {
    topThreeOwnership: [/get_top_three/, /only the user/i],
    picksBeforeSuggestions: [/picks/, /suggestions/],
    deadlines: [/get_upcoming_deadlines/, /overdue/i, /due today/i],
    focus: [/Do First/, /depend/i],
  },
  'safe-cleanup': {
    previewFirst: [/dryRun/, /preview/i],
    deleteOnlyWhatWasAsked: [/only what the user asked/i],
    permanence: [/permanent/i, /Trash/],
    // A client with form elicitation asks; one without it deletes at once (D4).
    someClientsConfirm: [/some clients/i, /confirm/i],
    notDeletedReplies: [/Not deleted:/, /declined/i, /changed/i],
    bulkLimits: [/\b50 tasks\b/, /\b10 deletes\b/],
    conflicts: [/conflict/i],
    dependencyCleanup: [/depend/i],
    tools: [/delete_task/, /bulk_update_tasks/],
  },
  triage: {
    quadrants: [/\burgent\b/, /\bimportant\b/, /Do First/, /Schedule/, /Delegate/, /Eliminate/],
    searchBeforeCreating: [/search_tasks/, /duplicate/i],
    tagFormat: [/lowercase/i, /leading #/],
    urls: [/URL/, /description/],
    dueDates: [/ISO 8601/],
    reminders: [/notifyBefore/, /notificationEnabled/],
    dependencies: [/dependencies/, /cycle/i],
  },
  'weekly-review': {
    metrics: [/get_productivity_metrics/, /streak/i],
    quadrants: [/get_quadrant_analysis/],
    tags: [/get_tag_analytics/, /completion rate/i],
    deadlines: [/get_upcoming_deadlines/],
    savedItems: [/Saved/],
  },
};

// No client is sure to ask before a delete (D4), as metadata.test.ts also checks
// of the server instructions.
const PROMISES_A_CLIENT_DIALOG = /expect the client|client will ask|always ask/i;

// Claude Code's skill scan limits (AC19).
const MAX_FILE_BYTES = 100 * 1024;
const MAX_SKILL_BYTES = 400 * 1024;

const SKILLS_ROOT = fileURLToPath(new URL('../../../skills/', import.meta.url));

interface SkillFile {
  path: string;
  skill: string;
  bytes: Buffer;
}

// Every file under skills/, as npm ships it and the catalog publishes it.
function shippedSkillFiles(): { entries: string[]; files: SkillFile[] } {
  const entries = readdirSync(SKILLS_ROOT, { recursive: true, encoding: 'utf8' });
  const files = entries
    .filter((path) => statSync(join(SKILLS_ROOT, path)).isFile())
    .map((path) => ({ path, skill: path.split(sep)[0], bytes: readFileSync(join(SKILLS_ROOT, path)) }));
  return { entries, files };
}

const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface PackResult {
  files: Array<{ path: string }>;
}

// What `npm publish` would upload. npm 10, which ships with Node 22, prints an
// array of results; newer releases key them by package name.
function packedPaths(): string[] {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed: PackResult[] | Record<string, PackResult> = JSON.parse(output);
  const [result] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return result.files.map(({ path }) => path);
}

function skillBody(name: string): string {
  const file = readFileSync(new URL(`../../../skills/${name}/SKILL.md`, import.meta.url), 'utf8');
  return file.replace(/^---\n[\s\S]*?\n---\n/, '');
}

describe.each(PROTOCOLS)('skills on %s', (protocol) => {
  let connected: ConnectedClient;

  beforeEach(async () => {
    connected = await connectClient(protocol);
  });

  afterEach(async () => {
    await connected.close();
  });

  it('should_list_exactly_four_skills_with_matching_frontmatter', async () => {
    const { skills } = await new SkillsClient(connected.client).list();

    const listed = skills.map(({ uri, frontmatter }) => ({
      uri,
      name: frontmatter.name,
      hasDescription: frontmatter.description.trim().length > 0,
    }));

    expect({
      declared: SKILLS_EXTENSION in (connected.client.getServerCapabilities()?.extensions ?? {}),
      listed,
    }).toEqual({
      declared: true,
      listed: SKILL_NAMES.map((name) => ({ uri: `skill://${name}/SKILL.md`, name, hasDescription: true })),
    });
  });

  it('should_serve_skill_files_matching_published_digests', async () => {
    const skillsClient = new SkillsClient(connected.client);
    const { skills } = await skillsClient.list();

    // A "dynamic" skill publishes no file list, so it adds nothing here and fails the match below.
    const files = skills.flatMap((skill) =>
      skill.resources === 'dynamic' ? [] : skill.resources.map(({ uri }) => ({ skill, uri }))
    );
    // read() fetches each file through resources/read and throws unless its
    // size, SHA-256 digest, and frontmatter match the listing.
    const readBack = await Promise.all(
      files.map(async ({ skill, uri }) => {
        const file = await skillsClient.read(skill, uri);
        return { uri: file.uri, verified: file.verified };
      })
    );

    expect(readBack).toEqual(SKILL_NAMES.map((name) => ({ uri: `skill://${name}/SKILL.md`, verified: true })));
  });
});

describe('skill guidance', () => {
  it('should_teach_each_skill_its_workflow_rules', () => {
    const uncovered = Object.fromEntries(
      SKILL_NAMES.map((name) => {
        const body = skillBody(name);
        const rules = REQUIRED_RULES[name];
        return [name, Object.keys(rules).filter((rule) => !rules[rule].every((pattern) => pattern.test(body)))];
      })
    );
    const promisingClientDialog = SKILL_NAMES.filter((name) => PROMISES_A_CLIENT_DIALOG.test(skillBody(name)));

    expect({ uncovered, promisingClientDialog }).toEqual({
      uncovered: Object.fromEntries(SKILL_NAMES.map((name) => [name, []])),
      promisingClientDialog: [],
    });
  });
});

describe('skill files', () => {
  it('should_keep_skills_within_claude_code_scan_limits', () => {
    const { entries, files } = shippedSkillFiles();
    const skillBytes = new Map<string, number>();
    for (const { skill, bytes } of files) skillBytes.set(skill, (skillBytes.get(skill) ?? 0) + bytes.length);

    expect({
      oversizedFiles: files.filter(({ bytes }) => bytes.length > MAX_FILE_BYTES).map(({ path }) => path),
      oversizedSkills: [...skillBytes].filter(([, total]) => total > MAX_SKILL_BYTES).map(([skill]) => skill),
      binaries: files.filter(({ bytes }) => bytes.includes(0) || !isUtf8(bytes)).map(({ path }) => path),
      distFolders: entries.filter((path) => path.split(sep).includes('dist')),
    }).toEqual({ oversizedFiles: [], oversizedSkills: [], binaries: [], distFolders: [] });
  });

  it('should_reference_only_registered_tools_in_skills', async () => {
    const connected = await connectClient('2026-07-28');
    try {
      const registered = new Set((await connected.client.listTools()).tools.map(({ name }) => name));
      // Tool names are snake_case, unlike the camelCase fields and kebab-case values skills also quote.
      const referenced = shippedSkillFiles().files.flatMap(({ skill, bytes }) =>
        [...bytes.toString('utf8').matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map(([, name]) => ({ skill, name }))
      );

      expect({
        unregistered: [...new Set(referenced.filter(({ name }) => !registered.has(name)).map(({ name }) => name))],
        skillsNamingNoTool: SKILL_NAMES.filter((name) => !referenced.some(({ skill }) => skill === name)),
      }).toEqual({ unregistered: [], skillsNamingNoTool: [] });
    } finally {
      await connected.close();
    }
  });

  it('should_ship_skill_files_in_the_npm_package', () => {
    const onDisk = shippedSkillFiles().files.map(({ path }) => `skills/${path.split(sep).join('/')}`);

    const packed = packedPaths().filter((path) => path.startsWith('skills/'));

    expect(packed.sort()).toEqual(onDisk.sort());
  });
});

describe('skills loader', () => {
  afterEach(() => {
    loaderRedirect.root = undefined;
    vi.restoreAllMocks();
  });

  it('should_serve_tools_when_skills_folder_is_missing', async () => {
    loaderRedirect.root = join(PACKAGE_ROOT, 'no-such-skills-folder');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // stdout carries JSON-RPC frames; one stray byte there corrupts the transport.
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const connected = await connectClient('2026-07-28');
    try {
      const { tools } = await connected.client.listTools();
      const { prompts } = await connected.client.listPrompts();

      expect({
        tools: tools.length,
        prompts: prompts.length,
        warned: stderr.mock.calls.some(([chunk]) => /"level":"WARN".*skill/i.test(String(chunk))),
        wroteStdout: stdout.mock.calls.length > 0,
      }).toEqual({ tools: 20, prompts: 6, warned: true, wroteStdout: false });
    } finally {
      await connected.close();
    }
  });

  it('should_resolve_skills_folder_from_module_location', async () => {
    // Claude Desktop starts the server from / or the home folder, never the package.
    const launchDir = mkdtempSync(join(tmpdir(), 'gsd-skills-cwd-'));
    const packageDir = process.cwd();
    process.chdir(launchDir);
    try {
      const catalog = await loadGsdSkills();

      expect(catalog?.entries.map(({ uri }) => uri)).toEqual(SKILL_NAMES.map((name) => `skill://${name}/SKILL.md`));
    } finally {
      process.chdir(packageDir);
      rmSync(launchDir, { recursive: true, force: true });
    }
  });
});
