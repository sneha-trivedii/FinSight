/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6fc',
          100: '#d9eaf9',
          200: '#b8daf3',
          300: '#87c2ec',
          400: '#50a3e2',
          500: '#1976D2', // Angel One blue primary
          600: '#1565C0',
          700: '#115299',
          800: '#10457d',
          900: '#133a68',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
