import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "apps/web/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
