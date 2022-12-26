import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  define: {
    __DEV__: true,
    __PROFILE__: true,
    __UMD__: true,
    __EXPERIMENTAL__: true,
  },
  server: {
    port: 5000,
  },
  resolve: {
    alias: {
      react: path.posix.resolve("src/react/packages/react"),
      "react-dom": path.posix.resolve("src/react/packages/react-dom"),
      "react-reconciler": path.posix.resolve("src/react/packages/react-reconciler"),
      scheduler: path.posix.resolve("src/react/packages/scheduler"),
      shared: path.posix.resolve("src/react/packages/shared"),
      "react-dom-bindings": path.posix.resolve("src/react/packages/react-dom-bindings"),
    },
  },
  plugins: [react()],
  optimizeDeps: {
    force: true,
  },
});
