import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // GitHub-exact design tokens
        gh: {
          canvas:         "#FFFFFF",
          surface:        "#F6F8FA",
          inset:          "#F0F2F5",
          border:         "#D1D9E0",
          "border-muted": "#E6EDF3",
          fg:             "#1F2328",
          "fg-muted":     "#636C76",
          "fg-subtle":    "#818B98",
          accent:         "#0969DA",
          "accent-hover": "#0860CA",
          "accent-subtle":"#DDF4FF",
          "accent-muted": "#54AEFF",
          success:        "#1A7F37",
          "success-subtle":"#DAFBE1",
          danger:         "#CF222E",
          "danger-subtle":"#FFEBE9",
          warning:        "#9A6700",
          "warning-subtle":"#FFF8C5",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"SF Mono"',
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      boxShadow: {
        "gh-sm": "0 1px 3px rgba(27,31,36,0.12), 0 8px 24px rgba(66,74,83,0.12)",
        "gh-md": "0 3px 12px rgba(27,31,36,0.15), 0 12px 32px rgba(66,74,83,0.15)",
        "gh-inner": "inset 0 1px 2px rgba(31,35,40,0.075)",
      },
      borderRadius: {
        gh: "6px",
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
