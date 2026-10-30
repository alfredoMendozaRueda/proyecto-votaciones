import { defineConfig } from 'vite';

export default defineConfig({
  // three.js ocupa ~500 kB minificado por sí solo; es el motor del personaje,
  // no un trozo que convenga partir.
  build: { chunkSizeWarningLimit: 700 },
});
