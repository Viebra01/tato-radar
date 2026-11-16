import { defineConfig } from "vite";
import { manifest } from "./src/manifest.ts";
export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "extension-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: JSON.stringify(manifest, null, 2),
        });
      },
    },
  ],
  build: {
    target: "chrome116",
    rollupOptions: {
      input: {
        dashboard: "index.html",
        popup: "popup.html",
        sidepanel: "sidepanel.html",
        demo: "demo.html",
        worker: "src/background/worker.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "worker" ? "worker.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
