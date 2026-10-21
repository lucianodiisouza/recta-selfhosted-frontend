import colors from 'tailwindcss/colors';

// Semantic tokens live as RGB channels in src/index.css (light and dark), copied from the iOS
// Palette.swift. `token('bg')` makes them usable with Tailwind's opacity modifier (bg-surface/50).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens (design rework F0.1). New code uses these, not raw scales.
        surface: {
          DEFAULT: token('bg'),
          elevated: token('bg-elevated'),
          sunken: token('bg-sunken'),
        },
        content: {
          DEFAULT: token('content'),
          secondary: token('content-secondary'),
          tertiary: token('content-tertiary'),
        },
        line: {
          DEFAULT: token('border'),
          subtle: token('separator'),
        },
        positive: { DEFAULT: token('positive'), soft: token('positive-soft') },
        negative: { DEFAULT: token('negative'), soft: token('negative-soft'), fill: token('negative-fill'), 'on-soft': token('negative-on-soft') },
        warning: token('warning'),
        info: token('info'),
        // Legacy scale, now the brand violet (F0.2): every primary-* class follows the iOS brand.
        primary: {
          50: '#F3F0FF',
          100: '#EEEAFE',
          200: '#DCD4FE',
          300: '#BDAEFF',
          400: '#8B72FF',
          500: '#6D4CFF',
          600: '#5B3DF5',
          700: '#4A2EE0',
          800: '#3A22B0',
          900: '#241E45',
        },
        // Equilíbrio brand (same tokens as the iOS/Android apps and store assets).
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          soft: token('brand-soft'),
          fill: token('brand-fill'),
          'fill-hover': token('brand-fill-hover'),
          'on-soft': token('brand-on-soft'),
          50: '#F2EFFF',
          100: '#E6E0FF',
          200: '#D5CCFF',
          300: '#B6A6FF',
          400: '#8F7BFF',
          500: '#735AFA',
          600: '#5B3DF5',
          700: '#4A2DDB',
          800: '#3A23AD',
          900: '#2B1B80',
        },
        // Legacy scale, now the iOS cool neutrals (F0.3): gray-50 is the app background,
        // gray-800/900 the dark card and background.
        gray: {
          50: '#F6F6FB',
          100: '#EDEDF4',
          200: '#E1E1EA',
          300: '#CFCFD9',
          400: '#A7A7B4',
          500: '#6B6B78',
          600: '#5B5B69',
          700: '#2C2C38',
          800: '#17171F',
          900: '#0D0D12',
          950: '#0A0A0E',
        },
        // State scales pinned to the iOS money/state colors (F0.6) on the shades the app uses
        // for text and icons; the rest keeps Tailwind's defaults.
        green: { ...colors.green, 50: '#E7F8F0', 400: '#3DDC84', 500: '#16A765', 600: '#0C7745', 700: '#0A6139' },
        red: { ...colors.red, 50: '#FDECEA', 400: '#FF5648', 500: '#EF3325', 600: '#DE1E11', 700: '#B8190E' },
        yellow: { ...colors.amber, 400: '#FDB022', 600: '#8F5305', 700: '#744304' },
        blue: { ...colors.blue, 400: '#53B1FD', 500: '#2E90FA', 600: '#1E87FA', 700: '#1570D6' },
        paper: '#F6F3EC',
        ink: {
          DEFAULT: '#15131F',
          soft: '#1F1C2E',
        },
        lime: '#C6F25B',
        purple: {
          ...colors.purple,
          light: '#e9d5ff',
          lighter: '#f3e8ff',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        // Titles and money, like the iOS `.rounded` design.
        rounded: ['ui-rounded', '"SF Pro Rounded"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontWeight: {
        // The old "fine line" look used font-light everywhere; the apps never go below regular.
        light: '400',
      },
      borderRadius: {
        // iOS Radius: sm 8, md 12, lg 16, xl 24.
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        // iOS Elevation.card / .floating.
        card: '0 6px 14px -4px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.03)',
        floating: '0 10px 22px -6px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.04)',
      },
      animation: {
        'bounce-soft': 'bounce-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'bounce-soft': {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-4px)',
          },
        },
      },
    },
  },
  plugins: [],
}
