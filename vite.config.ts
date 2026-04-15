import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
