/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080f1e",
        surface: "#0f1f35",
        "surface-2": "#162840",
        "surface-3": "#1e3450",
        border: "#1e3a5f",
        primary: "#38bdf8",
        "primary-dark": "#0ea5e9",
        safe: "#22c55e",
        warning: "#f59e0b",
        critical: "#ef4444",
        fall: "#dc2626",
        inactive: "#64748b",
        smoke: "#a855f7",
        accent: "#818cf8",
      },
      backgroundImage: {
        "gradient-safe": "linear-gradient(135deg, #14532d22, #22c55e11)",
        "gradient-danger": "linear-gradient(135deg, #7f1d1d22, #ef444411)",
        "gradient-warning": "linear-gradient(135deg, #78350f22, #f59e0b11)",
        "gradient-fall": "linear-gradient(135deg, #7f1d1d44, #dc262633)",
        "gradient-primary": "linear-gradient(135deg, #0c4a6e22, #38bdf811)",
        "gradient-surface": "linear-gradient(180deg, #0f1f35, #080f1e)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "glow-safe": "0 0 20px rgba(34, 197, 94, 0.2)",
        "glow-critical": "0 0 20px rgba(239, 68, 68, 0.3)",
        "glow-fall": "0 0 30px rgba(220, 38, 38, 0.4)",
        "glow-primary": "0 0 20px rgba(56, 189, 248, 0.2)",
        "card": "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.6)",
      },
      animation: {
        "flash": "flash 1s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "shimmer": "shimmer 1.5s infinite",
        "slide-down": "slideDown 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "bounce-subtle": "bounceSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        flash: {
          "0%, 100%": { opacity: "1", backgroundColor: "rgba(220,38,38,0.15)" },
          "50%": { opacity: "0.7", backgroundColor: "rgba(220,38,38,0.35)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(220,38,38,0.2)" },
          "50%": { boxShadow: "0 0 30px rgba(220,38,38,0.6)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        slideDown: {
          from: { transform: "translateY(-16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
    },
  },
  plugins: [],
};
