import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: Electron carga dist/index.html desde el disco (file://).
  base: './',
  build: {
    // three.js ocupa ~500 kB minificado por sí solo; es el motor del personaje,
    // no un trozo que convenga partir.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        app: 'index.html',
        personaje: 'personaje.html',
      },
    },
  },
});
