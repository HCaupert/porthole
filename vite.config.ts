import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const porthole = `http://127.0.0.1:${process.env.PORT ?? 5200}`;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), react()],
  server: {
    proxy: {
      "/api": porthole,
      "/llms.txt": porthole,
    },
  },
});
