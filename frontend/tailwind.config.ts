import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        noir: '#07070a',
        panel: '#0d0e13',
        'panel-2': '#12141b',
        'panel-3': '#171a22',
        line: '#23262f',
        'line-soft': '#1a1d25',
        gold: '#c9a35f',
        'gold-bright': '#e5c88b',
        'gold-dim': '#8a6f3d',
        ink: '#e9e6df',
        'ink-dim': '#9a978f',
        'ink-faint': '#6a6862',
        good: '#6bb39a',
        warn: '#d9a441',
        bad: '#c9605a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        disp: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: '9.5px',
        sm: '12px',
        base: '13.5px',
        lg: '14px',
        xl: '16px',
        '2xl': '26px',
        '3xl': '40px',
      },
      letterSpacing: {
        tight: '-0.01em',
        normal: '0em',
        wide: '0.05em',
        wider: '0.1em',
        widest: '0.2em',
      },
    },
  },
  plugins: [],
}
export default config
