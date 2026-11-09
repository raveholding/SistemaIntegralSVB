import type { Config } from "tailwindcss";

/**
 * Sistema visual SVB · Dark Mode ejecutivo
 * - Superficies en escala "ink" (casi negro azulado) con tarjetas sutilmente elevadas.
 * - Estados brillantes: ok (verde), warn (ámbar), crit (rojo), info (cian).
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090D",
          900: "#0B0E14",
          850: "#10141C",
          800: "#151A24",
          700: "#1E2533",
          600: "#2A3344",
          500: "#3A455A",
        },
        fg: {
          DEFAULT: "#E6EAF2",
          muted: "#9AA4B6",
          subtle: "#6B768A",
        },
        brand: { DEFAULT: "#7C8CFF", 600: "#5B6BF0" },
        ok:   { DEFAULT: "#22E39B", dim: "#0E3B2C" },
        warn: { DEFAULT: "#FFC53D", dim: "#3D3011" },
        crit: { DEFAULT: "#FF4D6A", dim: "#3F1520" },
        info: { DEFAULT: "#38BDF8", dim: "#0E2E40" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 12px 0 currentColor",
      },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: { "pulse-dot": "pulseDot 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
