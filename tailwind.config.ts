import type { Config } from "tailwindcss";

// Palette inspired by Keith Haring-style artwork: bold primaries with
// heavy black outlines against a warm cream ground.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Page + surfaces
          bg: "#F6EBCB",         // warm cream ground
          surface: "#FFFBEE",    // paper / card
          surfaceAlt: "#F4E1D2", // soft peach panel
          border: "#1B1B24",     // bold Haring-black outline
          borderSoft: "#CFC6E2", // dusty lavender divider

          // Ink / text
          ink: "#1B1B24",        // near-black
          inkMuted: "#4A4A5C",
          inkSoft: "#7A7488",

          // Primary / accent (hot pink figure)
          accent: "#E94E77",
          accentHover: "#C73762",

          // Semantic
          success: "#2E8B87",    // teal figure
          danger: "#D14A3C",     // orange-red

          // Extra Haring pops
          pink: "#E94E77",
          softPink: "#E8AEB5",   // TV set
          orange: "#E89B56",     // peach figure
          teal: "#58AEA9",       // cyan figure
          deepTeal: "#2E8B87",
          lavender: "#B8B9D6",   // background figures
          cream: "#F6EBCB",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
