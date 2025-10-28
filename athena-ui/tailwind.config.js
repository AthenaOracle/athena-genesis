/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        satoshi: ["Satoshi", "system-ui", "sans-serif"],
      },
      colors: {
        gold: {
          primary: "#facc15",
          accent: "#fbbf24",
        },
      },
      backdropBlur: {
        DEFAULT: '8px',
        sm: '4px',
        md: '12px',
        lg: '16px', // ✅ ensures backdrop-blur-lg works
        xl: '24px',
      },
    },
  },
  plugins: [],
};
