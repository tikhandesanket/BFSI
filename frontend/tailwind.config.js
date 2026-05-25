/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand → warm mustard / gold (drives accents, active states, CTAs)
        brand: {
          50: "#fbf6e8",
          100: "#f6ecc8",
          200: "#ecd897",
          300: "#e0c067",
          400: "#d4a53c",
          500: "#c69228",
          600: "#a87a21",
          700: "#85601b",
          800: "#5e4313",
          900: "#3a2a0c",
        },
        // Inky navy used for the app card and surfaces
        ink: {
          50: "#f1f5f9",
          100: "#e2e8f0",
          200: "#cbd5e1",
          300: "#94a3b8",
          400: "#64748b",
          500: "#475569",
          600: "#334155",
          700: "#252a3a",
          750: "#1f2433",
          800: "#181d2a",
          850: "#141927",
          900: "#10141f",
          950: "#0a0d16",
        },
        // Page backdrop (gold/mustard cream)
        cream: {
          50: "#fbf3da",
          100: "#f4e6b3",
          200: "#ecd486",
          300: "#d9b35a",
          400: "#c8a14b",
          500: "#b88e3f",
        },
        // Categorical palette for charts / dots
        pie: {
          green: "#7ec96b",
          blue: "#5aa7e6",
          gold: "#e2b34a",
          red: "#e36a5c",
          violet: "#a98be6",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(212, 165, 60, 0.30)",
        "glow-lg": "0 0 60px rgba(212, 165, 60, 0.40)",
        card: "0 10px 40px -10px rgba(0,0,0,0.55)",
        soft: "0 6px 24px -8px rgba(0,0,0,0.35)",
        frame: "0 30px 80px -20px rgba(0,0,0,0.55), 0 10px 30px -15px rgba(0,0,0,0.45)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,165,60,0.45)" },
          "50%": { boxShadow: "0 0 0 14px rgba(212,165,60,0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        slideIn: "slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        pulseGlow: "pulseGlow 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
