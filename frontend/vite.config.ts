import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",  // expose on all network interfaces so phone can connect
    port: 5173,
    proxy: {
      "/ws": {
        target: "http://localhost:8340",
        ws: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:8340",
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
