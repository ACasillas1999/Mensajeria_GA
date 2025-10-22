import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  output: "server",
  integrations: [react(), tailwind()],
});
