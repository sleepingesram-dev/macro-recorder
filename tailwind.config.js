/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Terraria-style tokens. Names are stable across themes; values are
        // the night-sky/panel palette. ──
        abyss: '#0B0D21', // night-sky app background
        surface: '#232A5C', // panel blue
        'surface-2': '#2C3572', // raised panel / inputs
        rune: '#0D0F26', // hard pixel borders
        'rune-2': '#4A55A0', // bevel highlight / hover borders
        gold: '#D8B356', // Terraria gold
        'gold-bright': '#FFD76E',
        'gold-dim': '#9B7F45',
        arcane: '#6B74C8', // secondary accent — mana-ish indigo
        'arcane-bright': '#9BA7F0',
        verdant: '#4E9E3D', // success green
        'verdant-bright': '#6ABE30',
        ember: '#C05F2C', // warning copper
        'ember-bright': '#E08850',
        blood: '#D43D3D', // danger / over-target (heart red)
        mana: '#5B8DD9', // water bar
        ink: '#F2F3FA', // text primary
        'ink-2': '#A9B0D6', // text secondary — bluish gray
        'ink-3': '#6A72A5', // text muted
        // ── validated chart palette (passes on #232A5C — see docs/DESIGN.md) ──
        'chart-gold': '#AC9225',
        'chart-arcane': '#926BBC',
        'chart-verdant': '#4E9E67',
        'chart-ember': '#C36A1E',
      },
      fontFamily: {
        display: ['"Press Start 2P"', 'monospace'],
        body: ['"Pixelify Sans"', 'system-ui', 'sans-serif'],
        mono: ['VT323', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'inset 2px 2px 0 0 rgba(255,255,255,0.07), inset -2px -2px 0 0 rgba(0,0,0,0.35), 0 4px 0 0 rgba(0,0,0,0.35)',
        glow: '0 0 16px -2px rgba(255,215,110,0.5)',
      },
    },
  },
  plugins: [],
};
