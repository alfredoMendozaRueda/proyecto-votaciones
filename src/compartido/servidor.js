// Cliente del servidor de avisos de Kitsune (servidor/): lo usan la web y
// Electron para vincularse, activar las notificaciones push, sincronizar los
// recordatorios y gestionar las automatizaciones.

export const URL_VALIDA = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;

export class ErrorServidor extends Error {
  constructor(mensaje, { desvinculado = false } = {}) {
    super(mensaje);
    this.desvinculado = desvinculado;
  }
}

export class ClienteServidor {
  constructor({ url, token = null, fetch: f = (...a) => fetch(...a) }) {
    this.url = String(url ?? '').replace(/\/+$/, '');
    this.token = token;
    this.fetch = f;
  }

  async pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
    let respuesta;
    try {
      respuesta = await this.fetch(`${this.url}${ruta}`, {
        method: metodo,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw new ErrorServidor('No hay conexión con el servidor de avisos.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 401) throw new ErrorServidor(datos.error || 'Este dispositivo ya no está vinculado.', { desvinculado: true });
    if (!respuesta.ok) throw new ErrorServidor(datos.error || `El servidor respondió ${respuesta.status}.`);
    return datos;
  }

  // Página que abre el navegador para dar permiso a Google desde el servidor.
  urlEntrar({ estado, nombre, zona }) {
    return `${this.url}/google/entrar?${new URLSearchParams({ estado, nombre, zona })}`;
  }

  recoger(estado) {
    return this.pedir('/vincular/recoger', { metodo: 'POST', cuerpo: { estado } });
  }

  canjear(codigo, nombre) {
    return this.pedir('/canjear', { metodo: 'POST', cuerpo: { codigo, nombre } });
  }

  estado() {
    return this.pedir('/estado');
  }

  crearCodigo() {
    return this.pedir('/codigo', { metodo: 'POST' });
  }

  suscripcion(suscripcion) {
    return this.pedir('/suscripcion', { metodo: 'PUT', cuerpo: { suscripcion } });
  }

  probar() {
    return this.pedir('/probar', { metodo: 'POST' });
  }

  resumen() {
    return this.pedir('/resumen', { metodo: 'POST' });
  }

  recordatorios(lista) {
    return this.pedir('/recordatorios', { metodo: 'PUT', cuerpo: { lista } });
  }

  avisos(avisos) {
    return this.pedir('/avisos', { metodo: 'PUT', cuerpo: { avisos } });
  }

  zona(zona) {
    return this.pedir('/zona', { metodo: 'PUT', cuerpo: { zona } });
  }

  groq(clave) {
    return this.pedir('/groq', { metodo: 'PUT', cuerpo: { clave } });
  }

  automatizaciones() {
    return this.pedir('/automatizaciones');
  }

  crearAutomatizacion(datos) {
    return this.pedir('/automatizaciones', { metodo: 'POST', cuerpo: datos });
  }

  actualizarAutomatizacion(id, datos) {
    return this.pedir(`/automatizaciones/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos });
  }

  borrarAutomatizacion(id) {
    return this.pedir(`/automatizaciones/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
  }

  registro() {
    return this.pedir('/registro');
  }

  quitarDispositivo(id) {
    return this.pedir(`/dispositivos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
  }

  desvincular() {
    return this.pedir('/desvincular', { metodo: 'POST' });
  }
}

// Lo que la app manda al servidor: solo los recordatorios pendientes.
export const recordatoriosParaServidor = (lista) =>
  lista.filter((r) => !r.avisado && r.cuando > Date.now() - 60_000).map(({ id, texto, cuando }) => ({ id, texto, cuando }));
