/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E86C1',
          50:  '#EBF5FB',
          100: '#D6EAF8',
          200: '#AED6F1',
          300: '#85C1E9',
          400: '#5DADE2',
          500: '#2E86C1',
          600: '#2874A6',
          700: '#1F618D',
          800: '#154360',
          900: '#0D2B45',
        },
        secondary: {
          DEFAULT: '#1A1A2E',
          50:  '#F0F0F5',
          100: '#D5D5E8',
          200: '#ABABD1',
          300: '#8181BA',
          400: '#5757A3',
          500: '#1A1A2E',
          600: '#151528',
          700: '#101021',
          800: '#0B0B1A',
          900: '#060613',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.06)',
        modal: '0 20px 60px 0 rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
