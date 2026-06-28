/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@pos/tailwind-config')],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};
