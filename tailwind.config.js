/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Royal gold brand palette (carried over from the original design system).
        gold: {
          DEFAULT: '#e0b040',
          50: '#fbf6e9',
          100: '#f6ebc9',
          200: '#eed593',
          300: '#e6bf5d',
          400: '#e0b040',
          500: '#c8952b',
          600: '#a3741f',
          700: '#7d581b',
          800: '#5c411a',
          900: '#3d2c14',
        },
        // Dark, near-neutral surfaces (HSL 225 hue) matching the premium dark theme.
        ink: {
          950: '#0c0e14',
          900: '#12141c',
          850: '#171a24',
          800: '#1d212d',
          700: '#262b3a',
          600: '#333a4d',
          500: '#4a5268',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(224, 176, 64, 0.10)',
        card: '0 4px 12px rgba(0, 0, 0, 0.35)',
        lift: '0 8px 30px rgba(0, 0, 0, 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
