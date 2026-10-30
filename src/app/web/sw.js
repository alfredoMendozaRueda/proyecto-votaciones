// Service worker de la versión web. Guarda la propia app para que abra al
// instante y sin conexión; las llamadas a Claude y a Gmail van siempre a la red.
// Vite rellena la versión y la lista de archivos al compilar (ver vite.config.js).
const CACHE = 'kitsune-' + /* VERSION */ '';
const PRECARGA = /* PRECARGA */ [];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECARGA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('kitsune-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // La página: primero la red (para recibir versiones nuevas), la copia si no hay conexión.
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          if (respuesta.ok) caches.open(CACHE).then((c) => c.put('./', copia));
          return respuesta;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }

  // Archivos con hash en el nombre: nunca cambian, la copia vale siempre.
  // ignoreVary: el servidor puede responder con "Vary: Origin" y los scripts
  // del módulo se piden con cabecera Origin, que la copia guardada no tiene.
  evento.respondWith(caches.match(request, { ignoreVary: true }).then((guardada) => guardada ?? fetch(request)));
});

// Tocar el aviso de correo nuevo abre (o trae al frente) la app en la bandeja.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).pathname.startsWith(new URL(self.registration.scope).pathname));
      if (abierta) {
        abierta.postMessage({ tipo: 'abrir-correo' });
        return abierta.focus();
      }
      return self.clients.openWindow('./?correo');
    }),
  );
});
