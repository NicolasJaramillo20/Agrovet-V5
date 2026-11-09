/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#f0f6f0', 100: '#dcebdd', 500: '#45825a', 600: '#286541', 700: '#1d5032', 900: '#193b28' },
        ink: '#23332b',
      },
    },
  },
  plugins: [],
}
