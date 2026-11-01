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

  // La app: primero la red (para recibir versiones nuevas), la copia si no hay conexión.
  // Otras páginas (la de privacidad) van directas a la red y no pisan la copia de la app.
  if (request.mode === 'navigate') {
    const raiz = new URL('./', self.registration.scope).pathname;
    if (url.pathname !== raiz && url.pathname !== `${raiz}index.html`) return;
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

// Avisos del servidor de Kitsune (push): llegan aunque la app esté cerrada.
// En iPhone cada push tiene que mostrar una notificación, así que siempre se muestra.
self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data?.json() ?? {};
  } catch {
    datos = { cuerpo: evento.data?.text() ?? '' };
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'Kitsune', {
      body: datos.cuerpo || '',
      icon: 'iconos/icono-192.png',
      badge: 'iconos/icono-192.png',
      tag: datos.etiqueta || undefined,
      data: { url: datos.url || './' },
    }),
  );
});

// Si el navegador cambia la suscripción, la app la renovará al abrirse
// (Ajustes → Avisos en el móvil); aquí no hay token con el que avisar al servidor.

// Tocar un aviso abre (o trae al frente) la app en el apartado que toca.
const DESTINOS = { '?correo': 'correo', '?agenda': 'agenda', '?recordatorios': 'recordatorios', '?ajustes': 'ajustes', '?empleo': 'empleo', '?sincro': 'ajustes:sincro' };
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url ?? './?correo';
  const vista = DESTINOS[new URL(destino, self.registration.scope).search] ?? null;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).pathname.startsWith(new URL(self.registration.scope).pathname));
      if (abierta) {
        abierta.postMessage(vista ? { tipo: 'abrir-vista', vista } : { tipo: 'abrir-app' });
        return abierta.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
