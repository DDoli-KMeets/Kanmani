import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Consumer app dev server — fixed port so it matches the API's CORS_ORIGINS
// allowlist (apps/api/src/main.ts / .env.example) without extra config.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
