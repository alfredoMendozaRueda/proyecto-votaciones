import { shell } from 'electron';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { leerSecreto, guardarSecreto, borrarSecreto } from './almacen.js';
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
const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
// gmail.modify: leer, marcar, archivar, mover a la papelera y enviar; nunca borrar para siempre.
const PERMISOS = 'https://www.googleapis.com/auth/gmail.modify';

const base64Url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export class Gmail {
  constructor(obtenerAjustes) {
    this.obtenerAjustes = obtenerAjustes;
    this.acceso = null;
    this.caduca = 0;
    this.vistos = null;
  }

  get conectado() {
    return Boolean(leerSecreto('googleRefresco'));
  }

  estado() {
    return {
      conectado: this.conectado,
      email: leerSecreto('googleEmail'),
      configurado: Boolean(this.obtenerAjustes().googleClientId && leerSecreto('googleSecreto')),
    };
  }

  guardarCliente(secreto) {
    if (secreto) guardarSecreto('googleSecreto', secreto.trim());
  }

  // OAuth para apps de escritorio: el navegador del sistema abre la pantalla
  // de Google y vuelve a un servidor local efímero (127.0.0.1). PKCE evita
  // que otro programa pueda canjear el código interceptado.
  async conectar() {
    const clientId = this.obtenerAjustes().googleClientId;
    const secreto = leerSecreto('googleSecreto');
    if (!clientId || !secreto) throw new Error('Falta el ID de cliente o el secreto de Google en Ajustes.');

    const verificador = base64Url(randomBytes(48));
    const reto = base64Url(createHash('sha256').update(verificador).digest());
    const estado = base64Url(randomBytes(16));

    const { codigo, redireccion } = await new Promise((resolver, rechazar) => {
      const servidor = createServer((peticion, respuesta) => {
        const url = new URL(peticion.url, 'http://127.0.0.1');
        if (url.pathname !== '/') {
          respuesta.writeHead(404).end();
          return;
        }
        const ok = url.searchParams.get('state') === estado && url.searchParams.get('code');
        respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        respuesta.end(
          `<!doctype html><meta charset="utf-8"><title>Kitsune</title><body style="font:16px system-ui;background:#0d0809;color:#f3e5e0;display:grid;place-items:center;height:100vh;margin:0"><p>${
            ok ? 'Cuenta conectada. Ya puedes volver a Kitsune.' : 'No se pudo conectar la cuenta. Vuelve a Kitsune e inténtalo de nuevo.'
          }</p></body>`,
        );
        clearTimeout(limite);
        servidor.close();
        if (ok) resolver({ codigo: url.searchParams.get('code'), redireccion: `http://127.0.0.1:${puerto}` });
        else rechazar(new Error(url.searchParams.get('error') || 'Google no devolvió un código válido.'));
      });
      let puerto;
      const limite = setTimeout(() => {
        servidor.close();
        rechazar(new Error('Se agotó el tiempo para iniciar sesión en Google.'));
      }, 5 * 60 * 1000);
      servidor.listen(0, '127.0.0.1', () => {
        puerto = servidor.address().port;
        const url = new URL(AUTORIZAR);
        url.search = new URLSearchParams({
          client_id: clientId,
          redirect_uri: `http://127.0.0.1:${puerto}`,
          response_type: 'code',
          scope: PERMISOS,
          code_challenge: reto,
          code_challenge_method: 'S256',
          state: estado,
          access_type: 'offline',
          prompt: 'consent',
        }).toString();
        shell.openExternal(url.toString());
      });
    });

    const tokens = await this.#pedirToken({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: redireccion,
      code_verifier: verificador,
    });
    if (!tokens.refresh_token) throw new Error('Google no devolvió un token de actualización.');
    guardarSecreto('googleRefresco', tokens.refresh_token);
    this.#recordarAcceso(tokens);
    const perfil = await this.#api('/profile');
    guardarSecreto('googleEmail', perfil.emailAddress);
    this.vistos = null;
    return this.estado();
  }

  desconectar() {
    const refresco = leerSecreto('googleRefresco');
    if (refresco) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresco)}`, { method: 'POST' }).catch(() => {});
    }
    borrarSecreto('googleRefresco');
    borrarSecreto('googleEmail');
    this.acceso = null;
    this.vistos = null;
    return this.estado();
  }

  async #pedirToken(campos) {
    const respuesta = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.obtenerAjustes().googleClientId,
        client_secret: leerSecreto('googleSecreto') ?? '',
        ...campos,
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error_description || datos.error || `Google respondió ${respuesta.status}.`);
    return datos;
  }

  #recordarAcceso(tokens) {
    this.acceso = tokens.access_token;
    this.caduca = Date.now() + (tokens.expires_in - 60) * 1000;
  }

  async #tokenAcceso() {
    if (this.acceso && Date.now() < this.caduca) return this.acceso;
    const refresco = leerSecreto('googleRefresco');
    if (!refresco) throw new Error('No hay ninguna cuenta de Gmail conectada.');
    this.#recordarAcceso(await this.#pedirToken({ grant_type: 'refresh_token', refresh_token: refresco }));
    return this.acceso;
  }

  async #api(ruta, opciones = {}, reintento = true) {
    const respuesta = await fetch(`${API}${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${await this.#tokenAcceso()}`,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (respuesta.status === 401 && reintento) {
      this.acceso = null;
      return this.#api(ruta, opciones, false);
    }
    const datos = respuesta.status === 204 ? {} : await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error?.message || `Gmail respondió ${respuesta.status}.`);
    return datos;
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
    const lista = await this.#api(`/messages?${parametros}`);
    const ids = (lista.messages ?? []).map((m) => m.id);

    // Metadatos en paralelo, de 8 en 8, para no saturar la cuota.
    const mensajes = [];
    for (let i = 0; i < ids.length; i += 8) {
      const lote = await Promise.all(
        ids.slice(i, i + 8).map((id) =>
          this.#api(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
        ),
      );
      mensajes.push(...lote.map((m) => this.#resumen(m)));
    }
    return { mensajes, siguiente: lista.nextPageToken ?? null };
  }

  async leer(id) {
    if (!/^[0-9a-zA-Z]+$/.test(id)) throw new Error('Identificador de correo no válido.');
    const mensaje = await this.#api(`/messages/${id}?format=full`);
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
    if (!/^[0-9a-zA-Z]+$/.test(id)) throw new Error('Identificador de correo no válido.');
    if (papelera) return this.#api(`/messages/${id}/trash`, { method: 'POST' });
    const agregar = [];
    const quitar = [];
    if (leido === true) quitar.push('UNREAD');
    if (leido === false) agregar.push('UNREAD');
    if (destacado === true) agregar.push('STARRED');
    if (destacado === false) quitar.push('STARRED');
    if (archivar) quitar.push('INBOX');
    return this.#api(`/messages/${id}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: agregar, removeLabelIds: quitar }),
    });
  }

  async enviar({ para, asunto, cuerpo, responderA = null }) {
    if (!validarDestinatarios(para)) throw new Error('Revisa las direcciones de "Para".');
    let original = null;
    if (responderA) original = await this.leer(responderA);
    const raw = construirMensaje({
      para,
      asunto: original ? asuntoRespuesta(original.asunto) : asunto,
      cuerpo,
      enRespuestaA: original?.idMensaje || null,
      referencias: original?.referencias || null,
    });
    return this.#api('/messages/send', {
      method: 'POST',
      body: JSON.stringify(original ? { raw, threadId: original.hiloId } : { raw }),
    });
  }

  // Devuelve los correos sin leer que no se habían visto en la comprobación anterior.
  async nuevos() {
    const { mensajes } = await this.listar({ filtro: 'no-leidos', consulta: 'newer_than:2d', maximo: 20 });
    const primeraVez = this.vistos === null;
    this.vistos ??= new Set();
    const nuevos = mensajes.filter((m) => !this.vistos.has(m.id));
    nuevos.forEach((m) => this.vistos.add(m.id));
    return primeraVez ? [] : nuevos;
  }
}
