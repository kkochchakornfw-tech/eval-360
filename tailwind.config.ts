import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Larger type scale: the app is used on desktop browsers too, 14px was too small
    fontSize: {
      xs: ["0.8125rem", { lineHeight: "1.25rem" }],
      sm: ["0.9375rem", { lineHeight: "1.5rem" }],
      base: ["1rem", { lineHeight: "1.65rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.5rem", { lineHeight: "2rem" }],
      "2xl": ["1.875rem", { lineHeight: "2.375rem" }],
      "3xl": ["2.25rem", { lineHeight: "2.75rem" }],
      "4xl": ["2.75rem", { lineHeight: "3.25rem" }],
      "6xl": ["4.25rem", { lineHeight: "1" }],
    },
    extend: {
      colors: {
        bg: "#F3F6FD",
        line: "#E1E8F6",
        ink: "#0F172A",
        muted: "#64748B",
        accent: { DEFAULT: "#2F5BFF", dark: "#1E40D8", soft: "#EAF0FF" },
        danger: "#C2410C",
        // neutral scale used across components -> cool slate
        stone: {
          50: "#F8FAFF",
          100: "#EEF2FB",
          200: "#E1E8F6",
          300: "#CBD5E6",
          400: "#94A3B8",
          500: "#64748B",
        },
      },
      boxShadow: {
        glass: "0 10px 40px -12px rgba(37, 70, 200, 0.18), 0 2px 6px rgba(37, 70, 200, 0.05)",
        glow: "0 8px 22px -6px rgba(47, 91, 255, 0.55)",
      },
      fontFamily: { sans: ["var(--font-plex)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
