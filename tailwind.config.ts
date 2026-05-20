import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#0c0c0f',      // near-black canvas
        panel:  '#161618',      // card background
        mint:   '#FFD600',      // GOLD — coins, YES, primary accent
        blue:   '#4A9EFF',      // electric blue — oracle, secondary
        amber:  '#FF8C00',      // orange — warnings
        danger: '#FF2D6B',      // hot pink — danger, NO
      },
      fontFamily: {
        sans:    ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bangers)', 'cursive'],
        mono:    ['var(--font-geist-mono)', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // Hard offset shadows — no blur, comic-book style
        'hard':         '4px 4px 0px 0px #000000',
        'hard-lg':      '6px 6px 0px 0px #000000',
        'hard-xl':      '8px 8px 0px 0px #000000',
        'hard-gold':    '4px 4px 0px 0px #FFD600',
        'hard-blue':    '4px 4px 0px 0px #4A9EFF',
        'hard-danger':  '4px 4px 0px 0px #FF2D6B',
        'hard-white':   '4px 4px 0px 0px rgba(255,255,255,0.18)',
        // Override the old soft-ring alias so existing references stay hard
        'soft-ring':    '4px 4px 0px 0px #000000',
      },
    }
  },
  plugins: []
}

export default config
