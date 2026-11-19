/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#040d1a', 900: '#07172a', 850: '#0a1d33', 800: '#0e2540', 700: '#143353', 600: '#1d4670', 500: '#2a5d8f' },
        tech: { 300: '#7dffa0', 400: '#3df06c', 500: '#22d957', 600: '#16a341', 800: '#0d5a2c', 900: '#0a3d21' },
        alert: { 300: '#ff9a9a', 400: '#f87171', 500: '#ef5350', 700: '#8f2a36', 900: '#4a1826' },
        gold: { 300: '#ffe082', 400: '#ffd23f', 500: '#f5b800', 800: '#5c4a0c', 900: '#3a300c' },
        turq: { 300: '#7fe3f5', 400: '#3fd0ee', 500: '#22b8d9', 700: '#136b85' },
        sky2: { 400: '#4aa8ff', 500: '#2d8cf0', 900: '#0f2c57' },
      },
      fontFamily: { sans: ['"Segoe UI"', 'Inter', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'] },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)',
        glow: '0 0 0 2px #2bff5e, 0 0 18px rgba(43,255,94,.45)',
      },
    },
  },
  plugins: [],
};
