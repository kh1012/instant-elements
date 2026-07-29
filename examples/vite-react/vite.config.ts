import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // instant.config.ts 의 importAlias 와 반드시 일치해야 한다.
      "@/elements": fileURLToPath(new URL("./src/elements", import.meta.url)),
    },
  },
});
