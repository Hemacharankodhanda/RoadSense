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
        civic: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36abf6',
          500: '#0c8ee9',
          600: '#0270c7',
          700: '#0359a1',
          800: '#074c84',
          900: '#0b3f6f',
          950: '#072849',
        },
        status: {
          reported: '#ef4444',
          verified: '#f97316',
          in_progress: '#f59e0b',
          repaired: '#10b981',
          rejected: '#64748b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
