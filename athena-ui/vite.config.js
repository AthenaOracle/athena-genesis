// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";  // ← ADDED: Tailwind v4 Vite plugin

// Use "/" for deployment at https://yourname.github.io/
// (Change to '/athena-ui/' if you prefer https://yourname.github.io/athena-ui/)
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),  // ← ADDED: Enables Tailwind without PostCSS
  ],
});