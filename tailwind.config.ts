import type { Config } from "tailwindcss";

const config: Config = {
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
        canvas: {
          DEFAULT: "#ffffff",
          foreground: "#f8f9fa"
        },
        foreground: {
          DEFAULT: "#0f172a",
          muted: "#64748b"
        },
        accent: {
          DEFAULT: "#6366f1",
          muted: "#a5b4fc"
        },
        muted: {
          DEFAULT: "#64748b",
          foreground: "#64748b"
        },
        quadrant: {
          focus: "#dbeafe",      // light blue pastel
          schedule: "#fef9c3",   // light yellow pastel
          delegate: "#d1fae5",   // light green pastel
          eliminate: "#f3e8ff"   // light purple pastel
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
