import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#8C1D40",
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
          DEFAULT: "#FFC627",
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
    },
  },
  plugins: [],
};

export default config;
