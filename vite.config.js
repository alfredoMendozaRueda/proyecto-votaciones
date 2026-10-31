import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';

// Genera sw.js con la lista de archivos de esta compilación, para que la PWA
// funcione sin conexión desde la primera visita y se actualice sola.
function serviceWorker() {
  return {
    name: 'kitsune-service-worker',
    apply: 'build',
    generateBundle(_opciones, paquete) {
      const fijos = ['./', 'manifest.webmanifest', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/apple-touch-icon.png', 'iconos/favicon-32.png'];
      // El estudio del personaje no forma parte de la app instalada.
      const generados = Object.keys(paquete).filter((archivo) => archivo.startsWith('assets/') && !archivo.includes('personaje'));
      const precarga = [...fijos, ...generados.sort()];
      const version = createHash('sha256').update(precarga.join('\n')).digest('hex').slice(0, 10);
      const plantilla = readFileSync(new URL('./src/app/web/sw.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: plantilla.replace("/* VERSION */ ''", JSON.stringify(version)).replace('/* PRECARGA */ []', JSON.stringify(precarga, null, 2)),
      });
    },
  };
}

export default defineConfig({
  // Rutas relativas: Electron carga dist/index.html desde el disco (file://)
  // y la web puede publicarse en una subcarpeta (GitHub Pages).
  base: './',
  plugins: [serviceWorker()],
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
