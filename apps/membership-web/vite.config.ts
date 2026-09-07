import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const internalApiProxy = {
  "/internal-api": {
    target: "http://127.0.0.1:4318",
    rewrite: (path: string) => path.replace(/^\/internal-api/u, "/api"),
  },
};

export default defineConfig({
  build: { sourcemap: "hidden" },
  plugins: [react()],
  server: {
    proxy: internalApiProxy,
  },
  preview: {
    proxy: internalApiProxy,
  },
});
