import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/internal-api": {
        target: "http://127.0.0.1:4318",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/internal-api/, "/api"),
      },
    },
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
