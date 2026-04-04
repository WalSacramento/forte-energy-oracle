import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base":   "var(--bg-base)",
        "bg-panel":  "var(--bg-panel)",
        "bg-border": "var(--bg-border)",
        "cyan":      "var(--cyan)",
        "cyan-dim":  "var(--cyan-dim)",
        "amber":     "var(--amber)",
        "amber-dim": "var(--amber-dim)",
        "emerald":   "var(--emerald)",
        "red":       "var(--red)",
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        mono:    ["var(--font-jetbrains)", "monospace"],
        data:    ["var(--font-space)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "scanline":   "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
