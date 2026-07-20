/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
       colors: {
         // High-quality palette for visual excellence
         brand: {
           50: '#f0fdf4',
           100: '#dcfce7',
           200: '#bbf7d0',
           300: '#86efac',
           400: '#4ade80',
           500: '#22c55e', // Emerald
           600: '#16a34a',
           700: '#15803d',
           800: '#166534',
           900: '#14532d',
         },
         nomba: {
           50: '#FFFBEB',
           100: '#FEF3C7',
           200: '#FDE68A',
           300: '#FCD34D',
           400: '#FBBF24',
           500: '#FFC105', // Nomba Yellow
           600: '#F59E0B',
           700: '#D97706',
           800: '#B45309',
           900: '#92400E',
         },
         monnify: {
           50: '#E6FBFC',
           100: '#CCF7F9',
           200: '#99EFF3',
           300: '#5CE0E6',
           400: '#2CC9D1',
           500: '#02B7C2', // Monnify Teal
           600: '#009AA3',
           700: '#006E75',
           800: '#013D41',
           900: '#012A2E',
         },
         slate: {
           950: '#020617', // Very deep slate/black
         }
       },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}
