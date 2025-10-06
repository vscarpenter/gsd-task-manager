import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  safelist: [
    {
      pattern: /(bg|text)-quadrant-(focus|schedule|delegate|eliminate)(\/(10|15|20|25|30|40|50|60|70|80|90))?/
    },
    {
      pattern: /(bg|text)-accent(\/(10|20|30|40|50|60|70|80|90))?/
    }
  ],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "rgb(var(--background) / <alpha-value>)",
          muted: "rgb(var(--background-muted) / <alpha-value>)",
          accent: "rgb(var(--background-accent) / <alpha-value>)"
        },
        foreground: {
          DEFAULT: "rgb(var(--foreground) / <alpha-value>)",
          muted: "rgb(var(--foreground-muted) / <alpha-value>)"
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          muted: "rgb(var(--border-muted) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          muted: "rgb(var(--accent-muted) / <alpha-value>)"
        },
        quadrant: {
          focus: "rgb(var(--quadrant-focus) / <alpha-value>)",
          schedule: "rgb(var(--quadrant-schedule) / <alpha-value>)",
          delegate: "rgb(var(--quadrant-delegate) / <alpha-value>)",
          eliminate: "rgb(var(--quadrant-eliminate) / <alpha-value>)"
        },
        card: {
          DEFAULT: "rgb(var(--card-background) / <alpha-value>)",
          border: "rgb(var(--card-border) / <alpha-value>)"
        },
        overlay: "rgb(var(--overlay) / <alpha-value>)",
        // Legacy aliases for backward compatibility
        canvas: {
          DEFAULT: "rgb(var(--background) / <alpha-value>)",
          foreground: "rgb(var(--background-muted) / <alpha-value>)"
        },
        muted: {
          DEFAULT: "rgb(var(--foreground-muted) / <alpha-value>)",
          foreground: "rgb(var(--foreground-muted) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        mono: ["'JetBrains Mono'", "'SFMono-Regular'", "monospace"]
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(15, 33, 50, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
