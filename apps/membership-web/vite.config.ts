import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: { sourcemap: "hidden" },
  plugins: [react()],
  server: {
    proxy: {
      "/internal-api": {
        target: "http://127.0.0.1:4318",
        rewrite: (path) => path.replace(/^\/internal-api/u, "/api"),
      },
    },
  },
});
