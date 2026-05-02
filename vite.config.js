import path from "node:path";
import { defineConfig } from "vite";

const SIGNAL_SERVER_URL = process.env.SIGNAL_SERVER_URL ?? "http://127.0.0.1:8787";
const SIGNAL_SERVER_WS_URL = process.env.SIGNAL_SERVER_WS_URL ?? "ws://127.0.0.1:8787";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve("index.html"),
        mobile: path.resolve("mobile.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: SIGNAL_SERVER_URL,
        changeOrigin: true,
      },
      "/signal": {
        target: SIGNAL_SERVER_WS_URL,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
  },
});
