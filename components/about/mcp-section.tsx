import { ScrollReveal } from "@/components/about/scroll-reveal";
import { TerminalBlock } from "@/components/about/terminal-block";

const exampleQueries = [
  '"What are my urgent tasks this week?"',
  '"Show me everything tagged #work."',
  '"Which quadrant has the most overdue items?"',
  '"Mark the budget review as done."',
];

/** The shape `gsd-mcp-server --setup` writes (packages/mcp-server/src/cli/setup-wizard.ts). */
const claudeDesktopConfig = `{
  "mcpServers": {
    "gsd-tasks": {
      "command": "/path/to/node",
      "args": ["/path/to/node_modules/gsd-mcp-server/dist/index.js"],
      "env": {
        "GSD_POCKETBASE_URL": "https://api.vinny.io",
        "GSD_AUTH_TOKEN": "<your-auth-token>"
      }
    }
  }
}`;

const intro =
  "GSD ships with an MCP server. Install it once, and your AI assistant can find, add, change, complete, and delete your tasks in plain English. It works on the copy of your tasks that cloud sync stores, so turn on sync first. Everything it reads about a task, including descriptions, tags, subtasks, and due dates, goes to your AI assistant's provider.";

const setupHint = (
  <>
    Install an exact release with{" "}
    <code>npm install --global gsd-mcp-server@1.4.1</code>, then run{" "}
    <code>gsd-mcp-server --setup</code>. Setup asks you to paste the token from
    Settings › Cloud Sync › Copy auth token. It then writes a config like the one
    below, with the full paths to Node and the server, for you to add to Claude
    Desktop. The token expires within 30 days. When it does, copy a new one and
    run setup again.
  </>
);

export function McpSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Text column */}
          <ScrollReveal>
            <p className="kicker text-accent mb-3">
              For power users
            </p>
            <h2 className="text-h2 font-semibold tracking-tight text-foreground sm:text-h1 mb-4">
              Let Claude manage your tasks.
            </h2>
            <p className="max-w-[55ch] text-foreground-muted leading-relaxed mb-6">
              {intro} {setupHint}
            </p>
            <ul className="text-sm text-foreground-muted/80 italic space-y-2 mb-6">
              {exampleQueries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
            <a
              href="https://www.npmjs.com/package/gsd-mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm text-accent hover:text-accent-hover transition-colors"
            >
              &rarr; View on npm: gsd-mcp-server
            </a>
          </ScrollReveal>

          {/* Code column */}
          <ScrollReveal className="mt-10 lg:mt-0" delay={200}>
            <TerminalBlock
              label="Claude Desktop config"
              code={claudeDesktopConfig}
            />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
