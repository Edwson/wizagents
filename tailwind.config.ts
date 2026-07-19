import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("--bg"), bg2: c("--bg2"), panel: c("--panel"), panel2: c("--panel2"), panel3: c("--panel3"),
        border: c("--border"), borderlight: c("--borderlight"),
        text: c("--text"), muted: c("--muted"), faint: c("--faint"),
        fg: c("--text"), accent: c("--purple"), accentdim: c("--purpledim"), // aliases used across newer components
        amber: c("--amber"), amberdim: c("--amberdim"),
        purple: c("--purple"), purpledim: c("--purpledim"),
        green: c("--green"), rust: c("--rust"), ink: c("--ink"),
        violet: c("--violet"), cyan: c("--cyan"), pink: c("--pink"), blue: c("--blue"),
        glow: c("--glow"), glassborder: c("--glassborder"), glass: c("--glass"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'Space Grotesk'", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 1px 2px rgb(var(--shadow) / var(--shadowA))",
        glowlg: "0 6px 20px rgb(var(--shadow) / calc(var(--shadowA) + 0.04))",
      },
      keyframes: {
        blink: { "0%,45%": { opacity: "1" }, "50%,95%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        fadein: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeup: { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scalein: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        blink: "blink 1.1s step-end infinite",
        pulsedot: "pulse 1.6s ease-in-out infinite",
        fadein: "fadein 0.3s ease both",
        fadeup: "fadeup 0.6s cubic-bezier(0.2,0.8,0.2,1) both",
        scalein: "scalein 0.5s cubic-bezier(0.2,0.8,0.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
