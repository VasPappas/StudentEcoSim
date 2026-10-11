import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Relative asset paths let the same build run from any folder, including the
// project page that GitHub Pages serves at /<repository>/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    include: ["engine/**/*.test.ts", "app/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
