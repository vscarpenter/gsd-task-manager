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
      mcpServers: Record<string, { command: string; env: Record<string, string> }>;
    };
  };

  it('uses the server card command', () => {
    const server = Object.values(renderedConfig().mcpServers)[0]!;
    expect(server.command).toBe(transport.install.command);
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
});
