import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#04050a",
        panel: "#0a0e1c",
        cyan: "#00e5ff",
        blue: "#2e6bff",
        violet: "#8a2bff",
        magenta: "#ff2ec4",
        dim: "#5b6480",
        warn: "#ff3b3b",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
