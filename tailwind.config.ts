import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0b1723",
          foreground: "#0f2132"
        },
        accent: {
          DEFAULT: "#2fd07e",
          muted: "#9ff6c4"
        },
        quadrant: {
          focus: "#ff6b6b",
          schedule: "#ffd166",
          delegate: "#4dabf7",
          eliminate: "#6c757d"
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
