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
        // ── Semantic status/feedback colors ────────────────────────────
        // Values intentionally mirror Tailwind's default palettes already used
        // in-app (StatusBadge/Badge/forms), so adopting these tokens is a
        // visually identical, additive migration. Badge recipe on dark:
        //   bg-{c}-500/15  text-{c}-300  border-{c}-500/30
        // DEFAULT (=500) is the solid/fill shade for buttons and accents.
        success: {
          DEFAULT: '#10b981', // emerald-500
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
          500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        warning: {
          DEFAULT: '#f59e0b', // amber-500
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
          500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        danger: {
          DEFAULT: '#f43f5e', // rose-500
          50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
          500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
        },
        info: {
          DEFAULT: '#0ea5e9', // sky-500
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
          500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      // ── Semantic typography scale ────────────────────────────────────
      // New named keys only (no override of Tailwind's xs/sm/base/lg/xl…),
      // so existing text-* utilities are untouched. Each token bakes in
      // line-height + letter-spacing + weight. `display`/`h*` pair well with
      // font-display (Playfair); body/caption/overline use font-sans (Inter).
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        h2: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        overline: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      // ── Z-index layers ───────────────────────────────────────────────
      // Named tokens for the app's stacking order (formalizes the existing
      // ad-hoc z-10/30/40/50/90/100 values). Use these, not magic numbers.
      zIndex: {
        base: '0',
        raised: '10',
        sticky: '30',
        header: '40',
        drawer: '50',
        overlay: '60',
        modal: '90',
        popover: '95',
        toast: '100',
        tooltip: '110',
      },
      transitionTimingFunction: {
        // Decelerated "emphasized" easing used by the fade-in animation;
        // the house curve for entrances (drawers, modals, reveals).
        emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
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
