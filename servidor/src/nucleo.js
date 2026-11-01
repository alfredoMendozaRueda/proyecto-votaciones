// Lo que comparten las peticiones y la revisión de cada minuto: los datos
// (D1), el acceso a Google con el permiso guardado y el envío de avisos a
// todos los dispositivos vinculados.
import { rutaIA, normalizarModo } from '../../src/compartido/modos.js';
import { ClienteGmail } from '../../src/compartido/gmail.js';
import { sumarUso } from '../../src/compartido/consumo.js';
import { ClienteCalendario } from '../../src/compartido/calendario.js';
import { generarVapid, enviarPush } from './push.js';
import { cifrarTexto, descifrarTexto } from './cifrado.js';

export const AVISOS_POR_DEFECTO = {
  correo: true, // avisar de los correos nuevos
  soloPrincipal: true, // sin promociones, redes sociales ni foros
  correoCadaMin: 2,
  citas: 15, // minutos antes de cada cita (0 = no)
  silencio: { activo: true, desde: '23:00', hasta: '08:00' }, // sin avisos de correo de noche
};

export const PERMISOS_GOOGLE = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events';

export class ErrorGoogle extends Error {
  constructor(mensaje, caducado = false) {
    super(mensaje);
    this.caducado = caducado;
  }
}

export class Nucleo {
  constructor(env, ahora = Date.now()) {
    this.env = env;
    this.db = env.DB;
    this.ahora = ahora;
    this._ajustes = null;
    this._google = null;
  }

  // ---------- Ajustes (clave → JSON) ----------

  async ajustes() {
    if (!this._ajustes) {
      const { results } = await this.db.prepare('SELECT clave, valor FROM ajustes').all();
      this._ajustes = Object.fromEntries(results.map((r) => [r.clave, JSON.parse(r.valor)]));
    }
    return this._ajustes;
  }

  async poner(clave, valor) {
    (await this.ajustes())[clave] = valor;
    await this.db
      .prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
      .bind(clave, JSON.stringify(valor))
      .run();
  }

  async quitar(clave) {
    delete (await this.ajustes())[clave];
    await this.db.prepare('DELETE FROM ajustes WHERE clave = ?').bind(clave).run();
  }

  async vapid() {
    let vapid = (await this.ajustes()).vapid;
    if (!vapid) {
      vapid = await generarVapid();
      await this.poner('vapid', vapid);
    }
    return vapid;
  }

  async zona() {
    return (await this.ajustes()).zona ?? 'Europe/Madrid';
  }

  async avisos() {
    const guardados = (await this.ajustes()).avisos ?? {};
    return { ...AVISOS_POR_DEFECTO, ...guardados, silencio: { ...AVISOS_POR_DEFECTO.silencio, ...guardados.silencio } };
  }

  // ---------- Registro de actividad ----------

  async registrar(tipo, texto) {
    await this.db.prepare('INSERT INTO registro (cuando, tipo, texto) VALUES (?, ?, ?)').bind(this.ahora, tipo, String(texto).slice(0, 500)).run();
  }

  // ---------- Avisos ya dados (para no repetirlos) ----------

  async avisados(claves) {
    if (!claves.length) return new Set();
    const { results } = await this.db
      .prepare(`SELECT clave FROM avisados WHERE clave IN (${claves.map(() => '?').join(',')})`)
      .bind(...claves)
      .all();
    return new Set(results.map((r) => r.clave));
  }

  async marcar(claves) {
    if (!claves.length) return;
    await this.db.batch(claves.map((c) => this.db.prepare('INSERT OR IGNORE INTO avisados (clave, cuando) VALUES (?, ?)').bind(c, this.ahora)));
  }

  // ---------- Notificaciones push ----------

  async dispositivos() {
    const { results } = await this.db.prepare('SELECT id, nombre, suscripcion, creado, visto FROM dispositivos ORDER BY creado').all();
    return results;
  }

  // datos: { titulo, cuerpo, url, etiqueta }. Devuelve a cuántos dispositivos llegó.
  async notificar(datos, { soloDispositivo = null, excepto = null } = {}) {
    const vapid = await this.vapid();
    const contacto = `mailto:${(await this.ajustes()).dueno ?? 'kitsune@example.com'}`;
    let enviados = 0;
    for (const d of await this.dispositivos()) {
      if (!d.suscripcion || (soloDispositivo && d.id !== soloDispositivo) || d.id === excepto) continue;
      const resultado = await enviarPush(JSON.parse(d.suscripcion), datos, vapid, { contacto }).catch(() => 'error');
      if (resultado === 'caducada') await this.db.prepare('UPDATE dispositivos SET suscripcion = NULL WHERE id = ?').bind(d.id).run();
      if (resultado === 'ok') enviados++;
    }
    return enviados;
  }

  // ---------- Google ----------

  async guardarGoogle({ refresco, email }) {
    await this.poner('google', { refresco: await cifrarTexto(refresco, this.env.CLAVE_CIFRADO), email, caducado: false });
    await this.quitar('googleAcceso');
  }

  async tokenGoogle() {
    const a = await this.ajustes();
    if (!a.google) throw new ErrorGoogle('Sin cuenta de Google vinculada.');
    if (a.google.caducado) throw new ErrorGoogle('El permiso de Google ha caducado.', true);
    if (a.googleAcceso && a.googleAcceso.caduca > this.ahora + 60_000) return a.googleAcceso.acceso;
    const respuesta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        refresh_token: await descifrarTexto(a.google.refresco, this.env.CLAVE_CIFRADO),
        grant_type: 'refresh_token',
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      // invalid_grant: el usuario quitó el permiso o caducó; hay que volver a conectar.
      if (datos.error === 'invalid_grant') {
        await this.poner('google', { ...a.google, caducado: true });
        throw new ErrorGoogle('Google ha retirado el permiso de Kitsune.', true);
      }
      throw new ErrorGoogle(`Google: ${datos.error_description ?? datos.error ?? respuesta.status}`);
    }
    await this.poner('googleAcceso', { acceso: datos.access_token, caduca: this.ahora + Number(datos.expires_in) * 1000 });
    return datos.access_token;
  }

  async google() {
    if (!(await this.ajustes()).google) return null;
    if (!this._google) {
      const credenciales = { token: () => this.tokenGoogle(), invalidar: () => this.quitar('googleAcceso') };
      this._google = { gmail: new ClienteGmail(credenciales), calendario: new ClienteCalendario(credenciales) };
    }
    return this._google;
  }

  async claveGroq() {
    const cifrada = (await this.ajustes()).groq;
    return cifrada ? descifrarTexto(cifrada, this.env.CLAVE_CIFRADO) : null;
  }

  async claveOpenAI() {
    const cifrada = (await this.ajustes()).openai;
    return cifrada ? descifrarTexto(cifrada, this.env.CLAVE_CIFRADO) : null;
  }

  // Lo que gasta el servidor en OpenAI, por meses (lo ve la app en Ajustes).
  async anotarConsumo(usos) {
    const validos = usos.filter(([, uso]) => uso);
    if (!validos.length) return;
    let meses = (await this.ajustes()).consumoOpenAI ?? {};
    for (const [modelo, uso] of validos) meses = sumarUso(meses, modelo, uso, this.ahora);
    await this.poner('consumoOpenAI', meses);
  }

  // La IA que usa el servidor: OpenAI si está su clave; si no, Groq; si no, ninguna.
  // Las IA del servidor y el modo elegido en la app (Ahorro, Eficiente, Calidad; ver modos.js).
  async motoresIA() {
    const [groq, openai, ajustes] = await Promise.all([this.claveGroq().catch(() => null), this.claveOpenAI().catch(() => null), this.ajustes()]);
    return { modo: normalizarModo(ajustes.modoIA), groq, openai };
  }

  // La IA que toca para un tipo de tarea → { proveedor, clave } o null.
  async iaServidor(tipo = 'fondo') {
    const m = await this.motoresIA();
    const [proveedor] = rutaIA(m.modo, tipo, { groq: Boolean(m.groq), openai: Boolean(m.openai) });
    return proveedor ? { proveedor, clave: m[proveedor] } : null;
  }

  async automatizaciones() {
    const { results } = await this.db.prepare('SELECT datos FROM automatizaciones ORDER BY creada').all();
    return results.map((r) => JSON.parse(r.datos));
  }
}
