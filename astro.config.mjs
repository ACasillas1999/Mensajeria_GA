// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  adapter: vercel(),         // ← clave
  output: 'server',          // ← necesario para /src/pages/api/*
  integrations: [react(), tailwind()],
  // La parte Vite de HMR/ngrok es solo para dev local; puedes dejarla o quitarla
  vite: {
    server: {
      host: true,
      allowedHosts: ['.ngrok-free.app'],
      hmr: { clientPort: 443 },
    }
  }



});

