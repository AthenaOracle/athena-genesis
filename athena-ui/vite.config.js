// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Use "/" for deployment at https://yourname.github.io/
// (Change to '/athena-ui/' if you prefer https://yourname.github.io/athena-ui/)
export default defineConfig({
  base: "/",
  plugins: [react()],
});
