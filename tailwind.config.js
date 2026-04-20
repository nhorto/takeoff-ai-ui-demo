import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./apps/web/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07111f",
          900: "#0c1728",
          850: "#122036",
          800: "#172742",
        },
        signal: {
          cyan: "#4dd6ff",
          teal: "#3ce0c5",
          gold: "#ffbf57",
          coral: "#ff8d6a",
        },
      },
      boxShadow: {
        glow: "0 16px 40px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
