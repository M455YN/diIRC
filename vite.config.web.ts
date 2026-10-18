// Browser/PWA build: `npm run build:web` -> dist-web. Tauri imports are swapped for src/web shims,
// so the desktop/Android build (vite.config.ts) is untouched.
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const shim = (name: string, file: string) => ({
  find: new RegExp(`^${name.replace(/[/@-]/g, "\\$&")}$`),
  replacement: path.resolve(__dirname, "src/web/shims", file),
});

const pwa = (): Plugin => ({
  name: "luna-pwa",
  transformIndexHtml: () => [
    { tag: "link", attrs: { rel: "manifest", href: "/manifest.webmanifest" }, injectTo: "head" },
    { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }, injectTo: "head" },
    { tag: "meta", attrs: { name: "apple-mobile-web-app-capable", content: "yes" }, injectTo: "head" },
    { tag: "meta", attrs: { name: "mobile-web-app-capable", content: "yes" }, injectTo: "head" },
    { tag: "meta", attrs: { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }, injectTo: "head" },
    { tag: "meta", attrs: { name: "apple-mobile-web-app-title", content: "Luna IRC" }, injectTo: "head" },
    { tag: "meta", attrs: { name: "theme-color", content: "#313338" }, injectTo: "head" },
    {
      tag: "script",
      children: "if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))",
      injectTo: "body",
    },
  ],
  generateBundle() {
    for (const f of fs.readdirSync(path.resolve(__dirname, "web-pwa"))) {
      this.emitFile({ type: "asset", fileName: f, source: fs.readFileSync(path.resolve(__dirname, "web-pwa", f)) });
    }
  },
});

export default defineConfig({
  plugins: [react(), pwa()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      shim("@tauri-apps/api/core", "core.ts"),
      shim("@tauri-apps/api/event", "event.ts"),
      shim("@tauri-apps/api/window", "window.ts"),
      shim("@tauri-apps/api/webviewWindow", "webviewWindow.ts"),
      shim("@tauri-apps/api/app", "app.ts"),
      shim("@tauri-apps/plugin-os", "os.ts"),
      shim("@tauri-apps/plugin-clipboard-manager", "clipboard.ts"),
      shim("@tauri-apps/plugin-dialog", "dialog.ts"),
      shim("@tauri-apps/plugin-fs", "fs.ts"),
      shim("@tauri-apps/plugin-notification", "notification.ts"),
      shim("@tauri-apps/plugin-opener", "opener.ts"),
      shim("@tauri-apps/plugin-process", "process.ts"),
      shim("@tauri-apps/plugin-updater", "updater.ts"),
      shim("@tauri-apps/plugin-deep-link", "deep-link.ts"),
    ],
  },
  build: { outDir: "dist-web", emptyOutDir: true },
  server: { port: 1421, host: true },
});
