import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Published site: https://USERNAME.github.io/personal-vault/
const pagesBase = "/personal-vault/";

export default defineConfig(({ command }) => ({
  // Production assets load from /personal-vault/. Dev stays relative so the local preview at / still works.
  base: command === "build" ? pagesBase : "./",
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
}));
