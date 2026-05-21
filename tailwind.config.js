/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', './src/fragments/**/*.html'],
  theme: {
    extend: {
      colors: {
        'surface-container': '#eaeff1',
        outline: '#737c7f',
        'surface-container-highest': '#dbe4e7',
        'on-surface': '#2b3437',
        'on-tertiary-fixed': '#22004f',
        'on-background': '#2b3437',
        'on-tertiary': '#fef7ff',
        'surface-container-low': '#f1f4f6',
        secondary: '#4f626b',
        'primary-dim': '#3a5663',
        'inverse-surface': '#0c0f10',
        'on-tertiary-container': '#3d1c71',
        'secondary-fixed': '#d1e6f0',
        'surface-bright': '#f8f9fa',
        'on-secondary-fixed': '#2f424a',
        'tertiary-dim': '#614296',
        'secondary-fixed-dim': '#c3d8e2',
        'error-container': '#fe8983',
        'on-error-container': '#752121',
        'surface-container-lowest': '#ffffff',
        primary: '#466270',
        'tertiary-fixed-dim': '#b493ed',
        surface: '#f8f9fa',
        'tertiary-container': '#c2a0fc',
        'surface-dim': '#d1dce0',
        'primary-fixed': '#c9e7f7',
        'inverse-primary': '#ceedfd',
        'on-primary-container': '#395663',
        'surface-container-high': '#e3e9ec',
        'primary-container': '#c9e7f7',
        'error-dim': '#4e0309',
        'on-secondary': '#f2faff',
        'surface-tint': '#466270',
        'on-secondary-container': '#41545d',
        'surface-variant': '#dbe4e7',
        background: '#f8f9fa',
        'on-primary-fixed-variant': '#435f6d',
        'on-primary': '#f0f9ff',
        'on-surface-variant': '#586064',
        'inverse-on-surface': '#9b9d9e',
        'primary-fixed-dim': '#bbd9e9',
        'on-tertiary-fixed-variant': '#46267a',
        'on-secondary-fixed-variant': '#4b5e67',
        'secondary-dim': '#43565f',
        'secondary-container': '#d1e6f0',
        tertiary: '#6d4ea3',
        error: '#9f403d',
        'on-error': '#fff7f6',
        'outline-variant': '#abb3b7',
        'on-primary-fixed': '#264350',
        'tertiary-fixed': '#c2a0fc'
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem'
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif']
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 4s ease-in-out infinite alternate',
        'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        glow: {
          '0%': { opacity: '0.3', transform: 'scale(1)' },
          '100%': { opacity: '0.6', transform: 'scale(1.1)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' }
        }
      }
    }
  },
  plugins: [forms, containerQueries]
}
