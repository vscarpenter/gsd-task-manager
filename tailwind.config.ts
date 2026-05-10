const withAlpha = (value: string) =>
  `color-mix(in srgb, ${value} calc(<alpha-value> * 100%), transparent)`;

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
          DEFAULT: withAlpha("var(--ivory)"),
          muted: withAlpha("var(--gray-100)"),
          accent: withAlpha("var(--oat)")
        },
        foreground: {
          DEFAULT: withAlpha("var(--slate)"),
          muted: withAlpha("var(--gray-500)")
        },
        border: {
          DEFAULT: withAlpha("var(--gray-300)"),
          muted: withAlpha("var(--gray-100)")
        },
        accent: {
          DEFAULT: withAlpha("var(--accent)"),
          hover: withAlpha("var(--accent-d)"),
          muted: withAlpha("var(--accent-tint)")
        },
        quadrant: {
          focus: withAlpha("var(--quadrant-focus)"),
          schedule: withAlpha("var(--quadrant-schedule)"),
          delegate: withAlpha("var(--quadrant-delegate)"),
          eliminate: withAlpha("var(--quadrant-eliminate)")
        },
        card: {
          DEFAULT: withAlpha("var(--paper)"),
          border: withAlpha("var(--gray-300)")
        },
        overlay: "rgb(0 0 0 / <alpha-value>)",
        status: {
          overdue: withAlpha("var(--status-overdue)"),
          "overdue-muted": withAlpha("var(--status-overdue-muted)"),
          blocked: withAlpha("var(--status-blocked)"),
          "blocked-muted": withAlpha("var(--status-blocked-muted)"),
          blocking: withAlpha("var(--status-blocking)"),
          "blocking-muted": withAlpha("var(--status-blocking-muted)"),
          success: withAlpha("var(--status-success)"),
          "success-muted": withAlpha("var(--status-success-muted)")
        },
        // Legacy aliases for backward compatibility
        canvas: {
          DEFAULT: withAlpha("var(--ivory)"),
          foreground: withAlpha("var(--gray-100)")
        },
        muted: {
          DEFAULT: withAlpha("var(--gray-500)"),
          foreground: withAlpha("var(--gray-500)")
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
        sans: ["var(--sans)"],
        mono: ["var(--mono)"],
        serif: ["var(--serif)"]
      },
      boxShadow: {
        card: "var(--shadow-md)"
      },
      borderWidth: {
        DEFAULT: "1.5px"
      }
    }
  },
  plugins: []
};

export default config;
