/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070d19',
          900: '#0b1120',
          800: '#131d32',
          700: '#1a2744',
          600: '#233559',
        },
        brand: {
          saffron: '#ff9933',
          white: '#ffffff',
          green: '#138808',
          ashoka: '#38bdf8',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-primary': '0 0 25px rgba(99, 102, 241, 0.35)',
        'glow-danger': '0 0 25px rgba(244, 63, 94, 0.35)',
        'glow-success': '0 0 25px rgba(16, 185, 129, 0.35)',
      }
    },
  },
  plugins: [],
}
