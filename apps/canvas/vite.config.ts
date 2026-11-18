import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A relative base, so the bridge can serve the built canvas from any path (T17).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // React + Konva are ~550 kB before gzip (~170 kB after); fine for a local canvas.
  build: { chunkSizeWarningLimit: 800 },
});
