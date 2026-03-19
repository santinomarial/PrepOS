export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:        '#0a0a0f',
        surface:   '#111118',
        border:    '#1e1e2e',
        accent:    '#00ff88',
        'accent-dim': '#00cc6a',
        primary:   '#e8e8f0',
        secondary: '#6b6b80',
        danger:    '#ff4560',
        warning:   '#ffb800',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};
