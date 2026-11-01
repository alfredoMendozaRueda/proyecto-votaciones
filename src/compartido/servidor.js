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

  recordatorios(lista, borrados) {
    return this.pedir('/recordatorios', { metodo: 'PUT', cuerpo: { lista, ...(borrados ? { borrados } : {}) } });
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

  openai(clave) {
    return this.pedir('/openai', { metodo: 'PUT', cuerpo: { clave } });
  }

  // Lo gastado en OpenAI por el propio servidor (alertas, automatizaciones).
  consumo() {
    return this.pedir('/consumo');
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

  // Empleo: ofertas de los portales (LinkedIn, freehire) y oferta completa.
  empleoBuscar(datos) {
    return this.pedir('/empleo/buscar', { metodo: 'POST', cuerpo: datos });
  }

  async empleoModalidad(ids) {
    return (await this.pedir('/empleo/modalidad', { metodo: 'POST', cuerpo: { ids } })).fichas ?? [];
  }

  empleoAlerta() {
    return this.pedir('/empleo/alerta');
  }

  guardarEmpleoAlerta(datos) {
    return this.pedir('/empleo/alerta', { metodo: 'PUT', cuerpo: datos });
  }

  empleoPreparadas() {
    return this.pedir('/empleo/preparadas');
  }

  recogerEmpleoPreparadas(ids) {
    return this.pedir('/empleo/preparadas/recoger', { metodo: 'POST', cuerpo: { ids } });
  }

  probarEmpleoAlerta() {
    return this.pedir('/empleo/alerta/probar', { metodo: 'POST' });
  }

  // Registro de la IA: qué recibe y devuelve cada llamada.
  registrarIA(entradas) {
    return this.pedir('/ia/registro', { metodo: 'POST', cuerpo: { entradas } });
  }

  registroIA({ sobre = '', limite = 40 } = {}) {
    return this.pedir(`/ia/registro?limite=${encodeURIComponent(limite)}${sobre ? `&sobre=${encodeURIComponent(sobre)}` : ''}`);
  }

  borrarRegistroIA() {
    return this.pedir('/ia/registro', { metodo: 'DELETE' });
  }

  activarRegistroIA(activo) {
    return this.pedir('/ia/registro', { metodo: 'PUT', cuerpo: { activo: Boolean(activo) } });
  }

  // Busca ya (también entre lo visto) y prepara las mejores: { ultimas, enCola, preparando, ia }.
  empleoAhora(datos) {
    return this.pedir('/empleo/alerta/ahora', { metodo: 'POST', cuerpo: datos });
  }

  empleoDetalle(url) {
    return this.pedir('/empleo/detalle', { metodo: 'POST', cuerpo: { url } });
  }

  // Sincronización entre dispositivos (datos cifrados de extremo a extremo).
  sincroEstado() {
    return this.pedir('/sincro');
  }

  sincroActivar(comprobante) {
    return this.pedir('/sincro/activar', { metodo: 'POST', cuerpo: { comprobante } });
  }

  sincroSolicitar(publica) {
    return this.pedir('/sincro/solicitudes', { metodo: 'POST', cuerpo: { publica } });
  }

  sincroSolicitud(id) {
    return this.pedir(`/sincro/solicitudes/${encodeURIComponent(id)}`);
  }

  sincroAprobar(id, sobre) {
    return this.pedir(`/sincro/solicitudes/${encodeURIComponent(id)}/aprobar`, { metodo: 'POST', cuerpo: { sobre } });
  }

  sincroRechazar(id) {
    return this.pedir(`/sincro/solicitudes/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
  }

  sincroCambios(desde) {
    return this.pedir(`/sincro/cambios?desde=${Number(desde) || 0}`);
  }

  sincroSubir(cambios) {
    return this.pedir('/sincro/cambios', { metodo: 'POST', cuerpo: { cambios } });
  }

  sincroBorrar() {
    return this.pedir('/sincro/borrar', { metodo: 'POST' });
  }

  // Dictado: el audio grabado → texto (Whisper en Workers AI).
  async transcribir(audio, tipo) {
    let respuesta;
    try {
      respuesta = await this.fetch(`${this.url}/transcribir`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': tipo || 'audio/webm' }, body: audio });
    } catch {
      throw new ErrorServidor('No hay conexión con el servidor de avisos.');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new ErrorServidor(datos.error || `El servidor respondió ${respuesta.status}.`, { desvinculado: respuesta.status === 401 });
    return datos.texto ?? '';
  }

  // Audio MP3 de un trozo de texto con la voz natural del servidor.
  async voz(texto, voz) {
    let respuesta;
    try {
      respuesta = await this.fetch(`${this.url}/voz`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, voz }),
      });
    } catch {
      throw new ErrorServidor('No hay conexión con el servidor de avisos.');
    }
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      throw new ErrorServidor(datos.error || `El servidor respondió ${respuesta.status}.`, { desvinculado: respuesta.status === 401 });
    }
    return new Uint8Array(await respuesta.arrayBuffer());
  }
}

// Lo que la app manda al servidor: solo los recordatorios pendientes.
export const recordatoriosParaServidor = (lista) =>
  lista.filter((r) => !r.avisado && r.cuando > Date.now() - 60_000).map(({ id, texto, cuando }) => ({ id, texto, cuando }));

// Lo que se manda de los recordatorios: los pendientes y los que este
// dispositivo mandó antes y ya no están (borrados o avisados aquí).
export function paqueteRecordatorios(lista, enviados = []) {
  const pendientes = recordatoriosParaServidor(lista);
  const ids = new Set(pendientes.map((r) => r.id));
  return { lista: pendientes, borrados: [...new Set(enviados)].filter((id) => !ids.has(id)) };
}
