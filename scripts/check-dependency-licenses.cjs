#!/usr/bin/env node

const { createHash } = require("node:crypto");
const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} = require("node:fs");
const { dirname, join, resolve } = require("node:path");

function parseArguments(argv) {
  const options = {
    policy: resolve("scripts/license-policy.json"),
    roots: [],
    sbom: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--policy" && value) {
      options.policy = resolve(value);
      index += 1;
    } else if (argument === "--root" && value) {
      options.roots.push(resolve(value));
      index += 1;
    } else if (argument === "--sbom" && value) {
      options.sbom = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (options.roots.length === 0) {
    options.roots.push(resolve("node_modules"));
    options.roots.push(resolve("packages/mcp-server/node_modules"));
  }
  return options;
}

function packageDirectories(nodeModulesPath) {
  if (!existsSync(nodeModulesPath)) return [];
  return readdirSync(nodeModulesPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const entryPath = join(nodeModulesPath, entry.name);
    if (!entry.name.startsWith("@")) return [entryPath];
    if (!entry.isDirectory()) return [];
    return readdirSync(entryPath, { withFileTypes: true })
      .filter((child) => !child.name.startsWith("."))
      .map((child) => join(entryPath, child.name));
  });
}

function licenseValue(packageJson) {
  if (typeof packageJson.license === "string") return packageJson.license.trim();
  if (packageJson.license && typeof packageJson.license.type === "string") {
    return packageJson.license.type.trim();
  }
  if (Array.isArray(packageJson.licenses)) {
    return packageJson.licenses
      .map((license) => typeof license === "string" ? license : license?.type)
      .filter(Boolean)
      .join(" OR ");
  }
  return "UNKNOWN";
}

function collectPackages(roots) {
  const packages = new Map();
  const visitedNodeModules = new Set();

  function visit(nodeModulesPath) {
    if (!existsSync(nodeModulesPath)) return;
    const realNodeModules = realpathSync(nodeModulesPath);
    if (visitedNodeModules.has(realNodeModules)) return;
    visitedNodeModules.add(realNodeModules);

    for (const packagePath of packageDirectories(nodeModulesPath)) {
      const manifestPath = join(packagePath, "package.json");
      if (!existsSync(manifestPath)) continue;
      const packageJson = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (!packageJson.name || !packageJson.version) continue;
      const component = {
        name: packageJson.name,
        version: packageJson.version,
        license: licenseValue(packageJson),
      };
      packages.set(`${component.name}@${component.version}`, component);
      visit(join(packagePath, "node_modules"));
    }
  }

  roots.forEach(visit);
  return [...packages.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
  );
}

function licenseTerms(expression) {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+(?:AND|OR)\s+/i)
    .map((term) => term.trim().replace(/\*$/, ""))
    .filter(Boolean);
}

function policyViolation(component, policy) {
  const key = `${component.name}@${component.version}`;
  const exception = policy.packageExceptions[key];
  if (exception?.license === component.license && exception.reason) return null;
  const rejected = licenseTerms(component.license).filter(
    (license) => !policy.allowedLicenses.includes(license),
  );
  return rejected.length === 0
    ? null
    : `${key}: ${component.license} (${rejected.join(", ")})`;
}

function purlFor(component) {
  const name = component.name.startsWith("@")
    ? `%40${component.name.slice(1)}`
    : component.name;
  return `pkg:npm/${name}@${component.version}`;
}

function createSbom(components) {
  const identity = createHash("sha256")
    .update(components.map((component) => `${component.name}@${component.version}`).join("\n"))
    .digest("hex")
    .slice(0, 32);
  const uuid = `${identity.slice(0, 8)}-${identity.slice(8, 12)}-${identity.slice(12, 16)}-${identity.slice(16, 20)}-${identity.slice(20)}`;
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${uuid}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "gsd-taskmanager",
        version: JSON.parse(readFileSync(resolve("package.json"), "utf8")).version,
      },
    },
    components: components.map((component) => ({
      type: "library",
      "bom-ref": purlFor(component),
      name: component.name,
      version: component.version,
      licenses: [{ license: { name: component.license } }],
      purl: purlFor(component),
    })),
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const policy = JSON.parse(readFileSync(options.policy, "utf8"));
  const components = collectPackages(options.roots);
  const violations = components
    .map((component) => policyViolation(component, policy))
    .filter(Boolean);

  if (violations.length > 0) {
    process.stderr.write(`Dependency license policy rejected ${violations.length} package(s):\n`);
    process.stderr.write(`${violations.map((violation) => `- ${violation}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  if (options.sbom) {
    mkdirSync(dirname(options.sbom), { recursive: true });
    writeFileSync(options.sbom, `${JSON.stringify(createSbom(components), null, 2)}\n`);
  }
  process.stdout.write(`License policy approved ${components.length} installed package versions.\n`);
}

main();
