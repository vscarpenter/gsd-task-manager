"use client";

import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { renderMermaid, THEMES, type RenderOptions } from "beautiful-mermaid";

interface MermaidDiagramProps {
  /** Mermaid diagram source code */
  code: string;
  /** Optional title for the diagram */
  title?: string;
  /** Optional description */
  description?: string;
  /** Custom theme name from THEMES or "auto" to follow app theme */
  theme?: keyof typeof THEMES | "auto";
  /** Additional CSS class names */
  className?: string;
}

/** Theme mappings for light/dark modes */
const LIGHT_THEME: RenderOptions = {
  bg: "#ffffff",
  fg: "#27272a",
  line: "#71717a",
  accent: "#3b82f6",
  muted: "#a1a1aa",
  surface: "#f4f4f5",
  border: "#e4e4e7",
  font: "Inter, system-ui, sans-serif",
  padding: 32,
  transparent: true,
};

const DARK_THEME: RenderOptions = {
  bg: "#18181b",
  fg: "#fafafa",
  line: "#a1a1aa",
  accent: "#60a5fa",
  muted: "#71717a",
  surface: "#27272a",
  border: "#3f3f46",
  font: "Inter, system-ui, sans-serif",
  padding: 32,
  transparent: true,
};

function sanitizeSvg(raw: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return "";

    doc.querySelectorAll("script, foreignObject").forEach((node) => node.remove());

    doc.querySelectorAll("*").forEach((node) => {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();

        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          continue;
        }

        if ((name === "href" || name === "xlink:href") && value.toLowerCase().startsWith("javascript:")) {
          node.removeAttribute(attr.name);
          continue;
        }

        if (name === "style" && /expression|javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      }
    });

    return svg.outerHTML;
  } catch {
    return "";
  }
}

/**
 * Renders a Mermaid diagram using beautiful-mermaid library
 * Supports automatic theme switching based on app theme
 */
export function MermaidDiagram({
  code,
  title,
  description,
  theme = "auto",
  className = "",
}: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const renderOptions = useMemo<RenderOptions>(() => {
    if (theme !== "auto" && THEMES[theme]) {
      return { ...THEMES[theme], transparent: true, padding: 32 };
    }
    return resolvedTheme === "dark" ? DARK_THEME : LIGHT_THEME;
  }, [theme, resolvedTheme]);

  useEffect(() => {
    let mounted = true;

    async function render() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await renderMermaid(code.trim(), renderOptions);
        if (mounted) {
          const sanitized = sanitizeSvg(result);
          if (!sanitized) {
            throw new Error("Rendered diagram was blocked by sanitizer");
          }
          setSvg(sanitized);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    render();

    return () => {
      mounted = false;
    };
  }, [code, renderOptions]);

  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      {(title || description) && (
        <div className="border-b border-border px-4 py-3">
          {title && (
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto p-4">
        {isLoading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            <p className="font-medium">Failed to render diagram</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
          </div>
        )}

        {!isLoading && !error && svg && (
          <div
            className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
}
