import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        background: '#0a0d14',
        cyber: {
          dark: '#0a0d14',
          card: '#121824',
          subtle: '#182030',
          border: '#1f293d',
          highlight: '#26334d',
        },
        neon: {
          cyan: '#00f2fe',
          blue: '#38bdf8',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#10b981',
          emerald: '#34d399',
          yellow: '#f59e0b',
        },
        felt: {
          green: '#059669',
          darkgreen: '#064e3b',
          blue: '#2563eb',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 242, 254, 0.25)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.25)',
        'neon-emerald': '0 0 20px rgba(16, 185, 129, 0.25)',
        'neon-rose': '0 0 20px rgba(244, 63, 94, 0.25)',
        'cyber-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
export default config

