/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0c0f',
        card: '#111418',
        danger: '#ef4444',
        warning: '#f59e0b',
        safe: '#14b8a6',
        muted: '#94a3b8',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
