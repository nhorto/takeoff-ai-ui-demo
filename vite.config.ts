import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/pdfjs-dist")) {
            return "pdf";
          }
          if (id.includes("node_modules/fabric")) {
            return "annotation";
          }
          if (id.includes("node_modules/dockview-react")) {
            return "workbench";
          }
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/zustand")
          ) {
            return "vendor";
          }
        },
      },
    },
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
