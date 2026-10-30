import { shell } from 'electron';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { leerSecreto, guardarSecreto, borrarSecreto } from './almacen.js';
import { ClienteGmail } from '../src/compartido/gmail.js';
import { ClienteCalendario, PERMISO_CALENDARIO } from '../src/compartido/calendario.js';

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
// gmail.modify: leer, marcar, archivar, mover a la papelera y enviar; nunca borrar para siempre.
// calendar.events: ver y crear eventos (no toca la configuración de los calendarios).
const PERMISO_GMAIL = 'https://www.googleapis.com/auth/gmail.modify';
const PERMISOS = `${PERMISO_GMAIL} ${PERMISO_CALENDARIO}`;

const base64Url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Gmail en la app de escritorio: OAuth con el navegador del sistema y un
// token de actualización guardado cifrado. Las llamadas a la API son las
// mismas que en la web (ClienteGmail).
export class Gmail {
  constructor(obtenerAjustes) {
    this.obtenerAjustes = obtenerAjustes;
    this.acceso = null;
    this.caduca = 0;
    const credenciales = {
      token: () => this.#tokenAcceso(),
      invalidar: () => {
        this.acceso = null;
      },
    };
    this.cliente = new ClienteGmail(credenciales);
    this.calendario = new ClienteCalendario(credenciales);
  }

  // Quien conectó antes de que Kitsune usara el calendario tiene que volver a conectar.
  get conCalendario() {
    return this.conectado && (leerSecreto('googleAlcances') ?? '').includes(PERMISO_CALENDARIO);
  }

  get conectado() {
    return Boolean(leerSecreto('googleRefresco'));
  }

  estado() {
    return {
      conectado: this.conectado,
      email: leerSecreto('googleEmail'),
      configurado: Boolean(this.obtenerAjustes().googleClientId && leerSecreto('googleSecreto')),
      calendario: this.conCalendario,
    };
  }

  guardarCliente(secreto) {
    if (secreto) guardarSecreto('googleSecreto', secreto.trim());
  }

  // El navegador del sistema abre la pantalla de Google y vuelve a un
  // servidor local efímero (127.0.0.1). PKCE evita que otro programa pueda
  // canjear el código interceptado.
  async conectar() {
    const clientId = this.obtenerAjustes().googleClientId;
    const secreto = leerSecreto('googleSecreto');
    if (!clientId || !secreto) throw new Error('Falta el ID de cliente o el secreto de Google en Ajustes.');

    const verificador = base64Url(randomBytes(48));
    const reto = base64Url(createHash('sha256').update(verificador).digest());
    const estado = base64Url(randomBytes(16));

    const { codigo, redireccion } = await new Promise((resolver, rechazar) => {
      let puerto;
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
    guardarSecreto('googleAlcances', tokens.scope ?? '');
    this.#recordarAcceso(tokens);
    const perfil = await this.cliente.perfil();
    guardarSecreto('googleEmail', perfil.emailAddress);
    this.cliente.olvidarVistos();
    return this.estado();
  }

  desconectar() {
    const refresco = leerSecreto('googleRefresco');
    if (refresco) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresco)}`, { method: 'POST' }).catch(() => {});
    }
    borrarSecreto('googleRefresco');
    borrarSecreto('googleEmail');
    borrarSecreto('googleAlcances');
    this.acceso = null;
    this.cliente.olvidarVistos();
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

  listar(opciones) {
    return this.cliente.listar(opciones);
  }

  leer(id) {
    return this.cliente.leer(id);
  }

  modificar(id, cambios) {
    return this.cliente.modificar(id, cambios);
  }

  enviar(datos) {
    return this.cliente.enviar(datos);
  }

  nuevos() {
    return this.cliente.nuevos();
  }
}
