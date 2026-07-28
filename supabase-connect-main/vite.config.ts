import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export function resolveManualChunk(id: string) {
  // Rollup's virtual CommonJS runtime is shared by React and chart dependencies.
  // Keeping it in a neutral chunk prevents react-vendor <-> charts-vendor cycles.
  if (id.includes("commonjsHelpers")) return "runtime-vendor";
  if (!id.includes("node_modules")) return;
  // Keep React bindings with React itself. Splitting react-i18next into
  // i18n-vendor caused production chunks to evaluate with React undefined.
  if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|react-i18next|use-sync-external-store)[\\/]/.test(id)) return "react-vendor";
  if (id.includes("clsx") || id.includes("tailwind-merge")) return "utils-vendor";
  if (id.includes("@react-pdf")) return "pdf-vendor";
  if (id.includes("jspdf")) return "jspdf-vendor";
  if (id.includes("html2canvas")) return "html2canvas-vendor";
  if (id.includes("xlsx")) return "xlsx-vendor";
  if (id.includes("recharts") || /[\\/]node_modules[\\/]d3-/.test(id)) return "charts-vendor";
  if (id.includes("qrcode.react")) return "qrcode-vendor";
  if (id.includes("react-qr-reader") || id.includes("@zxing")) return "scanner-vendor";
  if (id.includes("@supabase")) return "supabase-vendor";
  if (id.includes("@tanstack")) return "query-vendor";
  if (id.includes("i18next")) return "i18n-vendor";
  if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "ui-vendor";
  if (id.includes("framer-motion")) return "motion-vendor";
  if (id.includes("date-fns")) return "date-vendor";
  if (id.includes("lucide-react")) return "icons-vendor";
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/analytics-assistant": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react-router", "react-router-dom", "react-i18next"],
  },
}));
