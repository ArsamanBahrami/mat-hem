/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0f7f4',
          100: '#dcede5',
          200: '#bbdacc',
          300: '#8ec1ad',
          400: '#5ea388',
          500: '#3d8769',
          600: '#2d6a4f',
          700: '#265a43',
          800: '#214937',
          900: '#1c3d2f',
        },
        sand: {
          50:  '#faf8f5',
          100: '#f5f0e8',
          200: '#ebe0d0',
          300: '#dcc8ae',
          400: '#c9aa87',
          500: '#b8916a',
          600: '#a67c57',
          700: '#8a6348',
          800: '#70503c',
          900: '#5c4233',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
    },
  },
  plugins: [],
}
