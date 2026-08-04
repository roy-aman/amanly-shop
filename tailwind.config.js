/** @type {import('tailwindcss').Config} */

/**
 * Colour roles resolve to CSS variables declared in `src/index.css` — `:root`
 * for the Amanly storefront (light), `.dark` for the admin console.
 *
 * The `<alpha-value>` placeholder is load-bearing: Tailwind substitutes the
 * opacity modifier into it, which is what keeps `bg-ink-900/70`, `ring-gold-400/70`
 * and every other slash-opacity utility working. A bare `rgb(var(--x))` would
 * compile but silently ignore the modifier.
 */
const role = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Brand ─────────────────────────────────────────────────────────
           `brand` is the bright decorative gold (#D4AF37 on light). It is
           1.9:1 on white, so it may ONLY be used for rules, marks, tints and
           borders — never for text and never as a fill behind text.
           `brand-ink` is the darkened gold that is safe to set type in.      */
        brand: {
          DEFAULT: role('brand'),
          ink: role('brand-ink'),
        },

        /* The legacy `gold` ramp. On light it resolves to a deep antique gold
           so that every inherited `text-gold-300` / `ring-gold-400` in the
           not-yet-redesigned pages stays legible instead of washing out. */
        gold: {
          DEFAULT: role('gold-400'),
          50: '#fbf6e9',
          100: '#f6ebc9',
          200: role('gold-200'),
          300: role('gold-300'),
          400: role('gold-400'),
          500: role('gold-500'),
          600: '#a3741f',
          700: '#7d581b',
          800: '#5c411a',
          900: '#3d2c14',
        },

        /* Surfaces. Role per step is unchanged from the original system:
           950 background · 900 card · 850 input · 800 hover · 700/600 border. */
        ink: {
          950: role('ink-950'),
          900: role('ink-900'),
          850: role('ink-850'),
          800: role('ink-800'),
          700: role('ink-700'),
          600: role('ink-600'),
          500: role('ink-500'),
        },

        /* Text. Overrides Tailwind's stock `slate` on purpose — the app already
           speaks this vocabulary in ~470 places and every step keeps its role
           (100 heading · 200 body · 300 label · 400 muted · 500 caption). */
        slate: {
          50: role('slate-50'),
          100: role('slate-100'),
          200: role('slate-200'),
          300: role('slate-300'),
          400: role('slate-400'),
          500: role('slate-500'),
          600: role('slate-600'),
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        /* Semantic status. Only the shades used as text/icons are theme-aware;
           the `-500` steps are static because they appear exclusively at low
           alpha as tints and borders, which read on either palette. */
        success: {
          DEFAULT: '#10b981',
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
          300: role('success-300'), 400: role('success-400'),
          500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        warning: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          300: role('warning-300'), 400: role('warning-400'),
          500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        danger: {
          DEFAULT: '#f43f5e',
          50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3',
          300: role('danger-300'), 400: role('danger-400'),
          500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
        },
        info: {
          DEFAULT: '#0ea5e9',
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd',
          300: role('info-300'), 400: role('info-400'),
          500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49',
        },

        /* Role-named aliases for new code. Deliberately a SMALL set — the
           codebase already speaks ink/slate fluently and a second full
           vocabulary would be churn. (No `text-body` alias: it would collide
           with the `text-body` font-size token.) */
        canvas: role('ink-950'),
        surface: role('ink-850'),
        line: {
          DEFAULT: role('ink-700'),
          strong: role('ink-600'),
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Archivo: a tight grotesk that holds up in uppercase at display sizes.
        // Replaces Playfair Display — a serif reads heritage/luxury-boutique,
        // not modern menswear.
        display: ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
      },

      /* ── Type scale ────────────────────────────────────────────────────
         Same token names as before (so nothing breaks), retuned for an
         editorial voice: tighter tracking, shorter leading on headings, and
         a fluid `display` so the hero scales with the viewport instead of
         sitting at a fixed dashboard size. */
      fontSize: {
        display: ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['clamp(1.75rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.65', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        // Wider tracking than before — the eyebrow is now a real editorial
        // device (section kickers, category labels), not just a small label.
        overline: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '600' }],
      },

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
        emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      /* Theme-aware elevation. On white, the dark theme's heavy 35–45% black
         shadows read as dirt, so light gets a tight two-layer shadow instead;
         the values live in CSS variables and flip with the palette. */
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
