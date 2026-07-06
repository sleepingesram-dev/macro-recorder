/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── RPG-minimal brand tokens (UI chrome) ──
        abyss: '#0D0B0E', // app background — near black, warm undertone
        surface: '#1A1720', // cards
        'surface-2': '#211D2A', // raised cards / inputs
        rune: '#2A2535', // borders
        'rune-2': '#3A3348', // hover borders
        gold: '#C9A84C', // primary accent — parchment & candlelight
        'gold-bright': '#E3C56B',
        'gold-dim': '#8A7434',
        arcane: '#6B4F8A', // secondary accent — muted purple
        'arcane-bright': '#9B7FC0',
        verdant: '#4A7C59', // success
        'verdant-bright': '#6FA983',
        ember: '#C4622D', // warning
        'ember-bright': '#E08350',
        blood: '#A63A3A', // danger / over-limit
        ink: '#E8E4DE', // text primary — warm off-white
        'ink-2': '#8A8278', // text secondary
        'ink-3': '#575047', // text muted
        // ── validated chart palette (dark surface, CVD-safe; see docs/DESIGN.md) ──
        'chart-gold': '#AC9225',
        'chart-arcane': '#926BBC',
        'chart-verdant': '#4E9E67',
        'chart-ember': '#C36A1E',
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 24px -6px rgba(201,168,76,0.35)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: { shimmer: 'shimmer 2.5s linear infinite' },
    },
  },
  plugins: [],
};
