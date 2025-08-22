/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  corePlugins: { preflight: false }, // keep Bootstrap base styles
  plugins: [],
};
