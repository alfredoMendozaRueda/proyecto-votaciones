import {
  analizarDireccion,
  asuntoRespuesta,
  construirMensaje,
  decodificarEntidades,
  extraerCuerpo,
  htmlATexto,
  obtenerCabecera,
  validarDestinatarios,
} from './mime.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const ID_VALIDO = /^[0-9a-zA-Z]+$/;

// Llamadas a la API de Gmail, iguales en Electron y en la web. Cómo se
// consigue el token (OAuth de escritorio o Google Identity Services) lo
// decide quien crea el cliente: token() devuelve uno válido e invalidar()
// lo descarta cuando Google responde 401.
export class ClienteGmail {
  constructor({ token, invalidar }) {
    this.token = token;
    this.invalidar = invalidar;
    this.vistos = null;
  }

  async api(ruta, opciones = {}, reintento = true) {
    const respuesta = await fetch(`${API}${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (respuesta.status === 401 && reintento) {
      this.invalidar();
      return this.api(ruta, opciones, false);
    }
    const datos = respuesta.status === 204 ? {} : await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error?.message || `Gmail respondió ${respuesta.status}.`);
    return datos;
  }

  perfil() {
    return this.api('/profile');
  }

  #resumen(mensaje) {
    const etiquetas = mensaje.labelIds ?? [];
    return {
      id: mensaje.id,
      hiloId: mensaje.threadId,
      de: analizarDireccion(obtenerCabecera(mensaje.payload, 'From')),
      asunto: obtenerCabecera(mensaje.payload, 'Subject') || '(sin asunto)',
      fecha: Number(mensaje.internalDate),
      extracto: decodificarEntidades(mensaje.snippet ?? ''),
      noLeido: etiquetas.includes('UNREAD'),
      destacado: etiquetas.includes('STARRED'),
      etiquetas,
    };
  }

  async listar({ filtro = 'recibidos', consulta = '', pagina = null, maximo = 25 } = {}) {
    const q = [
      { recibidos: 'in:inbox', 'no-leidos': 'in:inbox is:unread', destacados: 'is:starred', todos: '' }[filtro] ?? 'in:inbox',
      consulta,
    ]
      .filter(Boolean)
      .join(' ');
    const parametros = new URLSearchParams({ q, maxResults: String(Math.min(maximo, 50)) });
    if (pagina) parametros.set('pageToken', pagina);
    const lista = await this.api(`/messages?${parametros}`);
    const ids = (lista.messages ?? []).map((m) => m.id);

    // Metadatos en paralelo, de 8 en 8, para no saturar la cuota.
    const mensajes = [];
    for (let i = 0; i < ids.length; i += 8) {
      const lote = await Promise.all(
        ids
          .slice(i, i + 8)
          .map((id) => this.api(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)),
      );
      mensajes.push(...lote.map((m) => this.#resumen(m)));
    }
    return { mensajes, siguiente: lista.nextPageToken ?? null };
  }

  async leer(id) {
    if (!ID_VALIDO.test(id)) throw new Error('Identificador de correo no válido.');
    const mensaje = await this.api(`/messages/${id}?format=full`);
    const cuerpo = extraerCuerpo(mensaje.payload);
    return {
      ...this.#resumen(mensaje),
      para: obtenerCabecera(mensaje.payload, 'To'),
      cc: obtenerCabecera(mensaje.payload, 'Cc'),
      idMensaje: obtenerCabecera(mensaje.payload, 'Message-ID'),
      referencias: obtenerCabecera(mensaje.payload, 'References'),
      html: cuerpo.html,
      texto: cuerpo.texto || htmlATexto(cuerpo.html),
      adjuntos: cuerpo.adjuntos,
    };
  }

  async modificar(id, { leido, destacado, archivar, papelera } = {}) {
    if (!ID_VALIDO.test(id)) throw new Error('Identificador de correo no válido.');
    if (papelera) return this.api(`/messages/${id}/trash`, { method: 'POST' });
    const agregar = [];
    const quitar = [];
    if (leido === true) quitar.push('UNREAD');
    if (leido === false) agregar.push('UNREAD');
    if (destacado === true) agregar.push('STARRED');
    if (destacado === false) quitar.push('STARRED');
    if (archivar) quitar.push('INBOX');
    return this.api(`/messages/${id}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: agregar, removeLabelIds: quitar }),
    });
  }

  async enviar({ para, asunto, cuerpo, responderA = null, adjuntos = [] }) {
    if (!validarDestinatarios(para)) throw new Error('Revisa las direcciones de "Para".');
    const validos = (Array.isArray(adjuntos) ? adjuntos : []).filter((a) => a?.datos?.byteLength).slice(0, 5);
    if (validos.reduce((t, a) => t + a.datos.byteLength, 0) > 4 * 1024 * 1024) throw new Error('Los adjuntos pesan demasiado (máximo 4 MB).');
    const original = responderA ? await this.leer(responderA) : null;
    const raw = construirMensaje({
      para,
      asunto: original ? asuntoRespuesta(original.asunto) : asunto,
      cuerpo,
      adjuntos: validos.map((a) => ({ nombre: String(a.nombre ?? 'adjunto').slice(0, 120), tipo: String(a.tipo ?? 'application/octet-stream'), datos: new Uint8Array(a.datos) })),
      enRespuestaA: original?.idMensaje || null,
      referencias: original?.referencias || null,
    });
    return this.api('/messages/send', {
      method: 'POST',
      body: JSON.stringify(original ? { raw, threadId: original.hiloId } : { raw }),
    });
  }

  // Correos sin leer que no se habían visto en la comprobación anterior.
  async nuevos() {
    const { mensajes } = await this.listar({ filtro: 'no-leidos', consulta: 'newer_than:2d', maximo: 20 });
    const primeraVez = this.vistos === null;
    this.vistos ??= new Set();
    const nuevos = mensajes.filter((m) => !this.vistos.has(m.id));
    nuevos.forEach((m) => this.vistos.add(m.id));
    return primeraVez ? [] : nuevos;
  }

  olvidarVistos() {
    this.vistos = null;
  }
}
