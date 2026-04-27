import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: { content: "src/content.ts" },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        inlineDynamicImports: true,
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
