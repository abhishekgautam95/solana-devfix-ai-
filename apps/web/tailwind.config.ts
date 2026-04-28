import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
