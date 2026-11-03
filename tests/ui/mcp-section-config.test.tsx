import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { McpSection } from '@/components/about/mcp-section';

vi.mock('@/components/about/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

type ServerCard = {
  transports: Array<{
    install: { command: string };
    env: Record<string, { required?: boolean }>;
  }>;
};

describe('McpSection config snippet', () => {
  const card = JSON.parse(
    readFileSync(resolve(__dirname, '../../public/.well-known/mcp/server-card.json'), 'utf-8'),
  ) as ServerCard;
  const transport = card.transports[0]!;

  const renderedConfig = () => {
    const { container } = render(<McpSection />);
    const code = container.querySelector('pre code')?.textContent ?? '';
    return JSON.parse(code) as {
      mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
    };
  };

  // The sample mirrors what `gsd-mcp-server --setup` writes: the `gsd-tasks`
  // key, Node as the command, and the installed package's entrypoint as the arg.
  it('matches the shape the setup wizard writes', () => {
    const { mcpServers } = renderedConfig();
    expect(Object.keys(mcpServers)).toEqual(['gsd-tasks']);
    const server = mcpServers['gsd-tasks']!;
    expect(server.command).toMatch(/node$/);
    expect(server.args).toHaveLength(1);
    expect(server.args[0]).toMatch(new RegExp(`/${transport.install.command}/dist/index\\.js$`));
  });

  it('sets exactly the env vars the server card requires', () => {
    const server = Object.values(renderedConfig().mcpServers)[0]!;
    const required = Object.entries(transport.env)
      .filter(([, spec]) => spec.required)
      .map(([key]) => key)
      .sort();
    expect(Object.keys(server.env).sort()).toEqual(required);
  });

  it('points readers to the setup wizard', () => {
    const { container } = render(<McpSection />);
    expect(container.textContent).toContain('gsd-mcp-server --setup');
  });

  it('pins the install and says setup asks for a pasted token that expires', () => {
    const { container } = render(<McpSection />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/npm install --global gsd-mcp-server@\d+\.\d+\.\d+/);
    expect(text).toContain('paste the token from Settings › Cloud Sync › Copy auth token');
    expect(text).toContain('expires within 30 days');
    expect(text).not.toMatch(/signs you in/i);
  });
});
