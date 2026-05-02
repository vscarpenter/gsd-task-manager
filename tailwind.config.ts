const config = {
  darkMode: "class",
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
        status: {
          overdue: "rgb(var(--status-overdue) / <alpha-value>)",
          "overdue-muted": "rgb(var(--status-overdue-muted) / <alpha-value>)",
          blocked: "rgb(var(--status-blocked) / <alpha-value>)",
          "blocked-muted": "rgb(var(--status-blocked-muted) / <alpha-value>)",
          blocking: "rgb(var(--status-blocking) / <alpha-value>)",
          "blocking-muted": "rgb(var(--status-blocking-muted) / <alpha-value>)",
          success: "rgb(var(--status-success) / <alpha-value>)",
          "success-muted": "rgb(var(--status-success-muted) / <alpha-value>)"
        },
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
      fontSize: {
        "display": ["36px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading": ["22px", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "title": ["18px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        "body": ["15px", { lineHeight: "1.5" }],
        "caption": ["13px", { lineHeight: "1.5" }],
        "label": ["11px", { lineHeight: "1.45", letterSpacing: "0.04em" }]
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        serif: ["var(--font-instrument-serif)", "ui-serif", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(15, 33, 50, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
