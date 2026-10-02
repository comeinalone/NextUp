// NextUp shared tokens (Tailwind v3). Same values as the manager UI.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182c2b", mute: "#657572", line: "#e2e9e6", paper: "#f5f7f5", surface: "#ffffff",
        brand: { DEFAULT: "#102d2a", hover: "#1b3b35", active: "#284a40", light: "#bde7c8", strong: "#bee9ca", icon: "#163d32" },
        focus: "#348679", eyebrow: "#52796b", field: "#63756a", control: "#d9e2da", rowline: "#edf0ec",
        inset: { DEFAULT: "#f7f9f6", line: "#e9eee8" },
        notice: { DEFAULT: "#eef3ed", line: "#dfe7df", text: "#617165", strong: "#375340" },
        normal: { DEFAULT: "#187652", soft: "#edf6ef" },
        busy: { DEFAULT: "#96610d", soft: "#fcf4e4" },
        critical: { DEFAULT: "#bd4149", soft: "#fceef0" },
        serving: { DEFAULT: "#4565a4", soft: "#edf2fc" },
        idle: { DEFAULT: "#647069", soft: "#edf0ed" },
        admissions: { DEFAULT: "#435cc8", soft: "#edf0fe" },
        fees: { DEFAULT: "#a16820", soft: "#faf1de" },
        certs: { DEFAULT: "#087c77", soft: "#e5f4f0" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
