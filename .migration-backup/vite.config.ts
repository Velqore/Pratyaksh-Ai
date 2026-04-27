import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Custom plugin to mount Express server in dev mode
function expressPlugin() {
  return {
    name: "express-plugin",
    configureServer: async (server: any) => {
      // Dynamically import to avoid bundling issues
      const { createServer } = await import("./server/index");
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
