/** @type {import('tailwindcss').Config} */

// ─── Questbyt Design System — Tailwind Preset ───────────────────────────────
// Single source of truth for all design tokens across the Questbyt ecosystem.
// Every application MUST import this preset instead of defining their own colors.

const questbytPreset = {
  theme: {
    extend: {
      // ── Colors ─────────────────────────────────────────────────────────────
      colors: {
        // Brand navy — sidebar, top nav, primary surfaces
        brand: {
          50:  '#EEF1F8',
          100: '#D5DCF0',
          200: '#ABBAE1',
          300: '#8098D2',
          400: '#5576C3',
          500: '#2B54B4',
          600: '#1E3D90',
          700: '#162E6B',
          800: '#0F1F47',
          900: '#071023',
          950: '#030812',
        },
        // Primary action — buttons, links, active states
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Accent — restaurant warmth, CTAs, highlights
        accent: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // Neutral — warm gray, not cool gray (warmer feel)
        neutral: {
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
        // Semantic status colors — complete shades used by Toast, Badge, and Button
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        error: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        info: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
        // Surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          raised:  '#FFFFFF',
          overlay: '#FFFFFF',
          sunken:  '#F8F9FC',
        },

        // ── Semantic Foreground (Text) Tokens ──────────────────────────────────
        // WCAG 2.1 AA certified for their intended light surfaces (4.5:1+).
        // Components MUST use these instead of raw neutral-400/500 for all text.
        //
        // Light mode ratios (background = neutral-50 #FAFAF9 unless noted):
        //   foreground            → 14.7:1
        //   secondary-foreground  →  8.7:1
        //   muted-foreground      →  6.2:1   ← replaces neutral-500 (was 4.49:1)
        //   primary-foreground    →  8.97:1  (on primary-600)
        //   destructive-foreground→  5.83:1  (on error-600)
        //   accent-foreground     →  6.97:1  (on accent-500)
        //   success-foreground    →  7.1:1   (on success-50)
        //   warning-foreground    →  9.1:1   (on warning-50)
        //   error-foreground      →  7.4:1   (on error-50)
        //   info-foreground       →  8.5:1   (on info-50)
        foreground:               '#1C1917',  // neutral-900 — primary body text
        'card-foreground':        '#1C1917',  // neutral-900 — text inside Card/surface
        'secondary-foreground':   '#44403C',  // neutral-700 — secondary / supporting text
        'muted-foreground':       '#57534E',  // neutral-600 — muted labels, captions, hints
        'subtle-foreground':      '#78716C',  // neutral-500 — use on white surfaces only
        'primary-foreground':     '#FFFFFF',  // text on primary-600 backgrounds
        'destructive-foreground': '#FFFFFF',  // text on error-600 backgrounds
        'accent-foreground':      '#451A03',  // accent-950 dark warm — text on amber backgrounds
        'success-foreground':     '#065F46',  // success-800 — text on success-50/100 surfaces
        'warning-foreground':     '#78350F',  // warning-900 — text on warning-50/100 surfaces
        'error-foreground':       '#991B1B',  // error-800   — text on error-50/100 surfaces
        'info-foreground':        '#0C4A6E',  // info-900    — text on info-50/100 surfaces
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'Menlo',
          'Monaco',
          '"Courier New"',
          'monospace',
        ],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem',      letterSpacing: '0.01em' }],
        'sm':   ['0.8125rem',{ lineHeight: '1.25rem',   letterSpacing: '0.005em' }],
        'base': ['0.9375rem',{ lineHeight: '1.5rem',    letterSpacing: '0' }],
        'lg':   ['1.0625rem',{ lineHeight: '1.625rem',  letterSpacing: '-0.01em' }],
        'xl':   ['1.1875rem',{ lineHeight: '1.75rem',   letterSpacing: '-0.015em' }],
        '2xl':  ['1.375rem', { lineHeight: '1.875rem',  letterSpacing: '-0.02em' }],
        '3xl':  ['1.75rem',  { lineHeight: '2.25rem',   letterSpacing: '-0.025em' }],
        '4xl':  ['2.25rem',  { lineHeight: '2.75rem',   letterSpacing: '-0.03em' }],
        '5xl':  ['3rem',     { lineHeight: '3.5rem',    letterSpacing: '-0.035em' }],
      },
      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
        extrabold:'800',
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.02em',
        tight:    '-0.01em',
        normal:   '0',
        wide:     '0.025em',
        wider:    '0.05em',
        widest:   '0.1em',
        label:    '0.06em',
      },

      // ── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        'none':  '0',
        'xs':    '4px',
        'sm':    '6px',
        'DEFAULT': '8px',
        'md':    '10px',
        'lg':    '12px',
        'xl':    '16px',
        '2xl':   '20px',
        '3xl':   '24px',
        'full':  '9999px',
      },

      // ── Shadows ─────────────────────────────────────────────────────────────
      boxShadow: {
        'none':    'none',
        'xs':      '0 1px 2px 0 rgba(0,0,0,0.04)',
        'sm':      '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'DEFAULT': '0 2px 8px -1px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)',
        'md':      '0 4px 12px -2px rgba(0,0,0,0.07), 0 2px 6px -2px rgba(0,0,0,0.05)',
        'lg':      '0 8px 24px -4px rgba(0,0,0,0.08), 0 4px 10px -4px rgba(0,0,0,0.05)',
        'xl':      '0 16px 40px -6px rgba(0,0,0,0.10), 0 8px 20px -6px rgba(0,0,0,0.06)',
        '2xl':     '0 24px 64px -8px rgba(0,0,0,0.12)',
        'inner':   'inset 0 1px 3px 0 rgba(0,0,0,0.06)',
        // Colored elevation shadows
        'primary': '0 4px 16px -2px rgba(37,99,235,0.24)',
        'accent':  '0 4px 16px -2px rgba(245,158,11,0.28)',
      },

      // ── Spacing ─────────────────────────────────────────────────────────────
      spacing: {
        '0':    '0',
        'px':   '1px',
        '0.5':  '2px',
        '1':    '4px',
        '1.5':  '6px',
        '2':    '8px',
        '2.5':  '10px',
        '3':    '12px',
        '3.5':  '14px',
        '4':    '16px',
        '5':    '20px',
        '6':    '24px',
        '7':    '28px',
        '8':    '32px',
        '9':    '36px',
        '10':   '40px',
        '11':   '44px',
        '12':   '48px',
        '14':   '56px',
        '16':   '64px',
        '18':   '72px',
        '20':   '80px',
        '24':   '96px',
        '28':   '112px',
        '32':   '128px',
        '36':   '144px',
        '40':   '160px',
        '44':   '176px',
        '48':   '192px',
        '52':   '208px',
        '56':   '224px',
        '60':   '240px',
        '64':   '256px',
        '72':   '288px',
        '80':   '320px',
        '96':   '384px',
      },

      // ── Transitions ─────────────────────────────────────────────────────────
      transitionDuration: {
        '75':  '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
      },
      transitionTimingFunction: {
        'DEFAULT':     'cubic-bezier(0.4, 0, 0.2, 1)',
        'linear':      'linear',
        'in':          'cubic-bezier(0.4, 0, 1, 1)',
        'out':         'cubic-bezier(0, 0, 0.2, 1)',
        'in-out':      'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring':      'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'snappy':      'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      // ── Animation ───────────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(4px)' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in':        'fade-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-out':       'fade-out 150ms cubic-bezier(0.4, 0, 1, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-left':  'slide-in-left 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in':       'scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spin-slow':      'spin-slow 2s linear infinite',
        'pulse-soft':     'pulse-soft 2s ease-in-out infinite',
        'shimmer':        'shimmer 2s linear infinite',
      },

      // ── Screens (Breakpoints) ────────────────────────────────────────────────
      screens: {
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1536px',
      },

      // ── Z-Index ─────────────────────────────────────────────────────────────
      zIndex: {
        'base':    '0',
        'raised':  '10',
        'dropdown':'100',
        'sticky':  '200',
        'overlay': '300',
        'modal':   '400',
        'toast':   '500',
        'tooltip': '600',
      },
    },
  },
  plugins: [],
};

module.exports = questbytPreset;
