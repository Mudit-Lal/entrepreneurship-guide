import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-family)", "system-ui", "sans-serif"],
      },
      colors: {
        maroon: {
          DEFAULT: "var(--color-maroon)",
          50: "#F9E8ED",
          100: "#F3D1DB",
          200: "#E7A3B7",
          300: "#DB7593",
          400: "#CF476F",
          500: "#8C1D40",
          600: "#701733",
          700: "#541126",
          800: "#380C1A",
          900: "#1C060D",
        },
        gold: {
          DEFAULT: "var(--color-gold)",
          50: "#FFF8E5",
          100: "#FFF1CC",
          200: "#FFE399",
          300: "#FFD566",
          400: "#FFC733",
          500: "#FFC627",
          600: "#E6B223",
          700: "#CC9E1F",
          800: "#B38A1B",
          900: "#997617",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
