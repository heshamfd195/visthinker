import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A relative base, so the bridge can serve the built canvas from any path (T17).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // React + Konva + the UI kit (Radix, lucide) are ~960 kB before gzip (~300 kB after); fine for
  // a canvas served from this computer. Split it if it's ever served over the network.
  build: { chunkSizeWarningLimit: 1_100 },
});
