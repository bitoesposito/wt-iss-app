import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    open: true,
    // Proxy verso l'API ISS per evitare problemi di CORS in sviluppo.
    // In produzione lo stesso path relativo `/api` è gestito dalla
    // Cloudflare Pages Function in `functions/api/[[path]].js`.
    proxy: {
      "/api": {
        target: "https://iss.cdnspace.ca",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
