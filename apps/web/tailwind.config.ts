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
        warm: {
          50: '#faf7f2',
          100: '#f4ede4',
          200: '#e7ded3',
          300: '#d5c7b8',
          400: '#ba9e88',
          500: '#9e7e65',
          600: '#7d614c',
          700: '#5c4535',
          800: '#3c2c22',
          900: '#231a14',
          950: '#14100e',
        },
        peach: {
          50: '#fff7f2',
          100: '#feede3',
          200: '#fdd9c7',
          300: '#f9bfa3',
          400: '#f39d78',
          500: '#ea7c50',
          600: '#d75d31',
          700: '#b24422',
          800: '#8e371f',
          900: '#75301d',
        },
        terracotta: {
          DEFAULT: '#d97752',
          hover: '#ea8863',
          active: '#c36440',
          muted: '#b2684b',
        },
        brand: {
          50: '#fff7f2',
          100: '#feede3',
          200: '#fdd9c7',
          300: '#f9bfa3',
          400: '#f39d78',
          500: '#ea7c50',
          600: '#d75d31',
          700: '#b24422',
          800: '#8e371f',
          900: '#75301d',
          primary: '#d97752',
          accent: '#f3a261',
          emerald: '#34d399',
          amber: '#fbbf24',
          rose: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
