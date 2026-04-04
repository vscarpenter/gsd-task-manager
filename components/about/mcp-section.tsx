import { ScrollReveal } from "@/components/about/scroll-reveal";

const exampleQueries = [
  '"What are my urgent tasks this week?"',
  '"Show me everything tagged #work."',
  '"Which quadrant has the most overdue items?"',
];

const claudeDesktopConfig = `{
  "mcpServers": {
    "gsd": {
      "command": "npx",
      "args": ["-y", "gsd-mcp-server"],
      "env": {
        "GSD_SYNC_URL": "https://gsd.vinny.dev/api",
        "ENCRYPTION_PASSPHRASE": "your-passphrase"
      }
    }
  }
}`;

export function McpSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Text column */}
          <ScrollReveal>
            <p className="text-xs uppercase tracking-widest text-accent mb-3">
              For power users
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
              Let Claude manage your tasks.
            </h2>
            <p className="text-foreground-muted leading-relaxed mb-6">
              GSD ships with an MCP server. Install it once, and your AI
              assistant can query, search, and analyze your tasks using plain
              English.
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
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              &rarr; View on npm: gsd-mcp-server
            </a>
          </ScrollReveal>

          {/* Code column */}
          <ScrollReveal className="mt-10 lg:mt-0" delay={200}>
            <p className="text-[10px] uppercase tracking-widest text-foreground-muted mb-2 font-medium">
              Claude Desktop Config
            </p>
            <div className="rounded-xl border border-border bg-background-muted p-4 sm:p-6 overflow-x-auto">
              <pre>
                <code className="text-sm font-mono leading-relaxed text-foreground-muted">
                  {claudeDesktopConfig}
                </code>
              </pre>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
