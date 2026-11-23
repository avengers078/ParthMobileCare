/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#194D9C', // Primary mobile brand blue anchor
          600: '#143e7e', // Primary hover
          700: '#123A78', // Active / deep
          800: '#0d2854',
          900: '#0a1e3e',
          950: '#061325', // Deep brand dark mode surface
        },
        navy: {
          bg: '#070D1B',
          sidebar: '#0D1729',
          header: '#0D1729',
          card: '#0F192C',
          elevated: '#17243A',
          hover: '#1C2A42',
          subtle: '#142D50',
          border: '#24344D',
          'border-selected': '#194D9C',
          text: {
            primary: '#E8EEF8',
            secondary: '#94A3B8',
            muted: '#71839D',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        dropdown: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};
