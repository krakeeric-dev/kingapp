import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effdf4",
          100: "#d9fbe6",
          200: "#b7f4cf",
          600: "#159447",
          700: "#0F6B44",
          800: "#0b5837",
          900: "#083f2a",
          950: "#062819"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 91, 48, 0.12)",
        executive: "0 24px 80px rgba(15, 35, 24, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
