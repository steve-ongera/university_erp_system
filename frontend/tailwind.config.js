/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.{html,php,js}",
    "./views/**/*.{html,php}",
    "./src/**/*.{html,php,js}",
    "./*.html",
    "./*.php"
  ],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Sora', 'Inter', 'sans-serif'],
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}