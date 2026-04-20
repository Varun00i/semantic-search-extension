/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Vibrant purple as primary accent */
        accent: {
          DEFAULT: '#b794f6',       /* brighter violet */
          light: '#8b5cf6',         /* violet-500 for light mode */
          hover: '#d4bcfb',         /* lighter hover */
          muted: 'rgba(183, 148, 246, 0.18)',
          soft: '#e9d5ff',          /* violet-200 */
          glow: 'rgba(139, 92, 246, 0.35)',
        },
        /* Dark surfaces — deep rich purple-black */
        surface: {
          0: '#0f0e1a',   /* near-black purple */
          1: '#1a1830',   /* card background */
          2: '#252342',   /* raised surface */
          3: '#363358',   /* controls/fills */
          4: '#4a4670',   /* stronger fill */
          border: 'rgba(183, 148, 246, 0.1)',
        },
        /* Light surfaces — warm lavender */
        'surface-light': {
          0: '#f5f0ff',   /* main bg — soft lavender */
          1: '#ede5ff',   /* card bg */
          2: '#e2d6fb',   /* raised */
          3: '#d4c4f5',   /* controls */
          border: 'rgba(139, 92, 246, 0.12)',
        },
        /* System grays — brighter for dark mode */
        label: {
          primary: '#eeedf5',
          secondary: '#b8b5c8',
          tertiary: '#7a7694',
          'primary-light': '#1a1035',
          'secondary-light': '#6b5f8a',
          'tertiary-light': '#9d94b8',
        },
        /* Semantic colors — vivid */
        success: '#4ade80',    /* green-400 — brighter */
        warning: '#fbbf24',    /* amber-400 */
        danger: '#fb7185',     /* rose-400 */
      },
      borderRadius: {
        'apple': '12px',
        'apple-lg': '16px',
        'apple-xl': '22px',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04)',
        'apple': '0 2px 10px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
        'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
        'glow-sm': '0 0 12px rgba(139, 92, 246, 0.15)',
        'glow': '0 0 20px rgba(139, 92, 246, 0.2)',
        'glow-lg': '0 0 40px rgba(139, 92, 246, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in': 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
