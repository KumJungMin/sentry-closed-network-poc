import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: { sourcemap: "hidden" },
  plugins: [react()],
});
