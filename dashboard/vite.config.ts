import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const apiPort = process.env.PORT ?? "3001";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 5173,
    // Open the dashboard in the browser on `npm run dev` (not in CI).
    open: !process.env.CI,
    proxy: { "/api": `http://localhost:${apiPort}` },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "web/index.html"),
        apiTester: resolve(__dirname, "web/api-tester.html"),
      },
    },
  },
});
