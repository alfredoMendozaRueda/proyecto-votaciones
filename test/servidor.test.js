import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import servidor from '../servidor/src/indice.js';
import { revisar } from '../servidor/src/revision.js';
import { cifrar, firmaVapid, generarVapid } from '../servidor/src/push.js';
import { aBase64Url, deBase64Url, unir, utf8 } from '../servidor/src/base64.js';
import { desdeLocal, partesLocales, enSilencio } from '../servidor/src/tiempo.js';
import { normalizarAutomatizacion, coincideCorreo, PLANTILLAS, describirCuando } from '../src/compartido/automatizaciones.js';
import { ClienteServidor, paqueteRecordatorios } from '../src/compartido/servidor.js';
import { normalizarAjustes, aplicarCambios } from '../src/compartido/ajustes.js';
import {
  Sincronizador,
  coleccionLista,
  coleccionConversaciones,
  coleccionEmpleo,
  coleccionAjustes,
  coleccionClaves,
  codigoDe,
} from '../src/compartido/sincro.js';

// D1 sobre el SQLite de Node: la misma interfaz (prepare/bind/run/all/first/batch).
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../servidor/esquema.sql', import.meta.url), 'utf8'));
  const sentencia = (sql, params = []) => ({
    bind: (...p) => sentencia(sql, p),
    ejecutar: () => db.prepare(sql).run(...params),
    run: async () => (db.prepare(sql).run(...params), { success: true }),
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
    first: async () => {
      const r = db.prepare(sql).get(...params);
      return r ? { ...r } : null;
    },
  });
  return { prepare: (sql) => sentencia(sql), batch: async (lista) => lista.map((s) => s.ejecutar()) };
}

const entorno = () => ({
  DB: d1(),
  CLAVE_CIFRADO: aBase64Url(crypto.getRandomValues(new Uint8Array(32))),
  GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto',
});

// El navegador que recibe los avisos: descifra lo que le llega (RFC 8291).
async function navegador() {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const hkdf = async (sal, ikm, info, n) =>
    new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8),
    );
  return {
    suscripcion: { endpoint: 'https://push.ejemplo.com/envio/abc', keys: { p256dh: aBase64Url(publica), auth: aBase64Url(auth) } },
    async descifrar(cuerpo) {
      const sal = cuerpo.slice(0, 16);
      const largoClave = cuerpo[20];
      const publicaAS = cuerpo.slice(21, 21 + largoClave);
      const clave = await crypto.subtle.importKey('raw', publicaAS, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clave }, par.privateKey, 256));
      const ikm = await hkdf(auth, compartido, unir(utf8('WebPush: info\0'), publica, publicaAS), 32);
      const cek = await hkdf(sal, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
      const nonce = await hkdf(sal, ikm, utf8('Content-Encoding: nonce\0'), 12);
      const claro = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cuerpo.slice(21 + largoClave)),
      );
      assert.equal(claro.at(-1), 2);
      return new TextDecoder().decode(claro.slice(0, -1));
    },
  };
}

const b64 = (t) => Buffer.from(t).toString('base64url');

// Google, Groq y el servicio de push simulados. Devuelve lo que se ha pedido.
function internet({ correos = [], eventos = [], groq = null, email = 'yo@gmail.com' } = {}) {
  const llamadas = { push: [], calendario: [], gmail: [], token: [] };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const cuerpo = init.body;
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      const p = new URLSearchParams(cuerpo);
      llamadas.token.push(p.get('grant_type'));
      return Response.json(
        p.get('grant_type') === 'authorization_code'
          ? { access_token: 'acceso', refresh_token: 'permiso-secreto-de-google', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events' }
          : { access_token: 'acceso2', expires_in: 3600 },
      );
    }
    if (u.startsWith('https://oauth2.googleapis.com/revoke')) return new Response('');
    if (u.endsWith('/users/me/profile')) return Response.json({ emailAddress: email });
    if (u.includes('/gmail/v1/users/me/messages')) {
      llamadas.gmail.push({ url: u, metodo: init.method ?? 'GET', cuerpo: cuerpo && JSON.parse(cuerpo) });
      if (u.includes('/modify')) return Response.json({});
      const id = u.match(/messages\/([0-9a-z]+)/)?.[1];
      if (!id) return Response.json({ messages: correos.map((c) => ({ id: c.id })) });
      const c = correos.find((x) => x.id === id);
      return Response.json({
        id,
        threadId: id,
        labelIds: ['INBOX', 'UNREAD', ...(c.etiquetas ?? [])],
        internalDate: String(c.fecha),
        snippet: c.extracto ?? '',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'From', value: c.de },
            { name: 'Subject', value: c.asunto },
          ],
          body: { data: b64(c.texto ?? c.extracto ?? '') },
        },
      });
    }
    if (u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) {
      llamadas.calendario.push({ metodo: init.method ?? 'GET', cuerpo: cuerpo && JSON.parse(cuerpo) });
      if (init.method === 'POST') return Response.json({ id: 'nuevo', summary: 'x', start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date().toISOString() } });
      return Response.json({ items: eventos });
    }
    if (u.startsWith('https://api.groq.com/')) return Response.json({ choices: [{ message: { content: JSON.stringify(groq) } }] });
    if (u.startsWith('https://push.ejemplo.com/')) {
      llamadas.push.push({ cabeceras: init.headers, cuerpo: new Uint8Array(cuerpo) });
      return new Response(null, { status: 201 });
    }
    throw new Error(`Petición inesperada: ${u}`);
  };
  return llamadas;
}

const pedir = (env, ruta, { metodo = 'GET', token, cuerpo } = {}) =>
  servidor.fetch(
    new Request(`https://kitsune.ejemplo.workers.dev${ruta}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    }),
    env,
  );

// Vincula un dispositivo como lo haría la app y lo deja con push activado.
async function vincular(env, { email = 'yo@gmail.com', nombre = 'iPhone' } = {}) {
  internet({ email });
  const estado = aBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const entrar = await pedir(env, `/google/entrar?estado=${estado}&nombre=${nombre}&zona=Europe/Madrid`);
  assert.equal(entrar.status, 302);
  const google = new URL(entrar.headers.get('Location'));
  assert.equal(google.searchParams.get('state'), estado);
  assert.equal(google.searchParams.get('access_type'), 'offline');
  assert.equal(google.searchParams.get('redirect_uri'), 'https://kitsune.ejemplo.workers.dev/google/vuelta');
  const vuelta = await pedir(env, `/google/vuelta?state=${estado}&code=codigo`);
  const html = await vuelta.text();
  const recogido = await (await pedir(env, '/vincular/recoger', { metodo: 'POST', cuerpo: { estado } })).json();
  return { html, ...recogido };
}

test('Web Push: el navegador descifra el aviso y la firma VAPID es válida', async () => {
  const nav = await navegador();
  const cuerpo = await cifrar(nav.suscripcion, '{"titulo":"Hola"}');
  assert.equal(await nav.descifrar(cuerpo), '{"titulo":"Hola"}');
  const vapid = await generarVapid();
  const jwt = await firmaVapid('https://push.ejemplo.com', vapid, 'mailto:yo@gmail.com');
  const [cab, carga, firma] = jwt.split('.');
  const publica = await crypto.subtle.importKey('raw', deBase64Url(vapid.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publica, deBase64Url(firma), utf8(`${cab}.${carga}`)));
  assert.equal(JSON.parse(Buffer.from(carga, 'base64url')).aud, 'https://push.ejemplo.com');
});

test('vincular con Google: la primera cuenta es la dueña y otra no puede quedárselo', async () => {
  const env = entorno();
  const { html, token, email } = await vincular(env);
  assert.match(html, /Listo/);
  assert.equal(email, 'yo@gmail.com');
  const estado = await (await pedir(env, '/estado', { token })).json();
  assert.equal(estado.google, true);
  assert.equal(estado.zona, 'Europe/Madrid');
  assert.equal(estado.dispositivos.length, 1);
  // El permiso de Google se guarda cifrado.
  const guardado = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'google'").first();
  assert.doesNotMatch(guardado.valor, /permiso-secreto/);

  const intruso = await vincular(env, { email: 'otra@gmail.com' });
  assert.match(intruso.html, /otra cuenta/);
  assert.match(intruso.error, /yo@gmail.com/);
  assert.equal((await pedir(env, '/estado')).status, 401);
  assert.equal((await pedir(env, '/estado', { token: 'falso' })).status, 401);
});

test('código para otro dispositivo: cinco fallos lo anulan', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const { codigo } = await (await pedir(env, '/codigo', { metodo: 'POST', token })).json();
  assert.match(codigo, /^\d{6}$/);
  const otro = String((Number(codigo) + 1) % 1_000_000).padStart(6, '0');
  for (let i = 0; i < 5; i++) assert.equal((await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo: otro, nombre: 'PC' } })).status, 400);
  assert.equal((await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo, nombre: 'PC' } })).status, 400);
  const { codigo: nuevo } = await (await pedir(env, '/codigo', { metodo: 'POST', token })).json();
  const canje = await (await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo: nuevo, nombre: 'PC de casa' } })).json();
  assert.ok(canje.token);
  const estado = await (await pedir(env, '/estado', { token: canje.token })).json();
  assert.deepEqual(estado.dispositivos.map((d) => d.nombre), ['iPhone', 'PC de casa']);
});

test('recordatorios: la app los sincroniza y el servidor avisa una sola vez', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  const ahora = Date.now();
  await pedir(env, '/recordatorios', { metodo: 'PUT', token, cuerpo: { lista: [{ id: 'rabc1', texto: 'Llamar a Lucía', cuando: ahora + 30_000 }, { id: 'rabc2', texto: 'Luego', cuando: ahora + 3_600_000 }] } });
  const llamadas = internet();
  await revisar(env, ahora + 60_000);
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  assert.deepEqual(avisos.map((a) => a.titulo), ['Kitsune: Llamar a Lucía']);
  assert.match(llamadas.push[0].cabeceras.Authorization, /^vapid t=.+, k=.+/);
  await revisar(env, ahora + 120_000);
  assert.equal(llamadas.push.length, 1);
  // Volver a sincronizar no hace que se repita el ya avisado.
  await pedir(env, '/recordatorios', { metodo: 'PUT', token, cuerpo: { lista: [{ id: 'rabc1', texto: 'Llamar a Lucía', cuando: ahora + 30_000 }] } });
  await revisar(env, ahora + 180_000);
  assert.equal(llamadas.push.length, 1);
});

test('correo nuevo: automatización de reservas crea el evento y el resto avisa (sin promociones)', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  await pedir(env, '/groq', { metodo: 'PUT', token, cuerpo: { clave: 'gsk_abcdefghijklmnopqrstuvwxyz123456' } });
  const plantilla = PLANTILLAS.find((p) => p.id === 'reservas').automatizacion;
  assert.equal((await pedir(env, '/automatizaciones', { metodo: 'POST', token, cuerpo: plantilla })).status, 200);

  const ahora = Date.now();
  const viejo = { id: 'm0', de: 'Banco <banco@x.es>', asunto: 'Extracto', fecha: ahora - 3_600_000 };
  internet({ correos: [viejo] });
  await revisar(env, ahora);
  const llamadas = internet({
    correos: [
      viejo,
      { id: 'm1', de: 'Renfe <tickets@renfe.com>', asunto: 'Confirmación de tu billete', fecha: ahora, texto: 'Madrid - Valencia, 14 de noviembre a las 8:35' },
      { id: 'm2', de: 'Lucía Pérez <lucia@x.es>', asunto: 'Presupuesto cocina', fecha: ahora },
      { id: 'm3', de: 'Tienda <ofertas@x.es>', asunto: 'Rebajas', fecha: ahora, etiquetas: ['CATEGORY_PROMOTIONS'] },
    ],
    groq: { hay: true, titulo: 'Tren Madrid → Valencia', inicio: '2026-11-14T08:35', fin: '2026-11-14T10:21', lugar: 'Atocha' },
  });
  // Mañana a mediodía en Madrid: fuera de las horas de silencio, sea cuando sea que corra la prueba.
  const mediodia = desdeLocal(partesLocales(ahora + 86_400_000, 'Europe/Madrid').fecha, '12:00', 'Europe/Madrid');
  await revisar(env, mediodia);
  const creado = llamadas.calendario.find((c) => c.metodo === 'POST').cuerpo;
  assert.equal(creado.summary, 'Tren Madrid → Valencia');
  assert.deepEqual(creado.start, { dateTime: '2026-11-14T08:35:00', timeZone: 'Europe/Madrid' });
  assert.equal(creado.location, 'Atocha');
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  assert.deepEqual(avisos.map((a) => a.titulo), ['Kitsune: Confirmación de tu billete', 'Kitsune: Presupuesto cocina']);
  assert.match(avisos[0].cuerpo, /añadido a tu agenda/);
  const registro = await (await pedir(env, '/registro', { token })).json();
  assert.ok(registro.some((r) => /Reservas a la agenda/.test(r.texto)));
});

test('citas: un aviso 15 minutos antes, y otro de la automatización de media hora', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  await pedir(env, '/automatizaciones', { metodo: 'POST', token, cuerpo: PLANTILLAS.find((p) => p.id === 'cita30').automatizacion });
  const ahora = Date.now();
  const inicio = ahora + 10 * 60_000;
  const llamadas = internet({ eventos: [{ id: 'ev1', summary: 'Dentista', location: 'Calle Mayor 3', start: { dateTime: new Date(inicio).toISOString() }, end: { dateTime: new Date(inicio + 3_600_000).toISOString() } }] });
  await env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('correoBase', 'true')").run();
  await revisar(env, ahora);
  await revisar(env, ahora + 60_000);
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  assert.equal(avisos.length, 2);
  assert.ok(avisos.every((a) => /Dentista/.test(a.titulo)));
  assert.equal(avisos[0].titulo, 'Kitsune: Dentista');
  assert.match(avisos[0].cuerpo, /^a las \d\d:\d\d \(en 10 min\) · Calle Mayor 3$/);
});

test('horario: el resumen de la mañana llega a las 8 en la zona del usuario, una vez', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  await pedir(env, '/automatizaciones', {
    metodo: 'POST',
    token,
    cuerpo: { nombre: 'Resumen', cuando: { tipo: 'horario', hora: '08:00', dias: [1, 2, 3, 4, 5, 6, 7] }, hacer: { notificar: false, resumen: true } },
  });
  const hoy = partesLocales(Date.now(), 'Europe/Madrid').fecha;
  const ocho = desdeLocal(hoy, '08:00', 'Europe/Madrid');
  const llamadas = internet({ eventos: [{ id: 'e', summary: 'Dentista', start: { dateTime: new Date(ocho + 7_200_000).toISOString() }, end: { dateTime: new Date(ocho + 9_000_000).toISOString() } }] });
  await env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('correoBase', 'true')").run();
  await revisar(env, ocho - 60_000);
  assert.equal(llamadas.push.length, 0);
  await revisar(env, ocho + 60_000);
  await revisar(env, ocho + 120_000);
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  const resumen = avisos.filter((a) => a.etiqueta === 'resumen');
  assert.equal(resumen.length, 1);
  assert.equal(resumen[0].titulo, 'Kitsune: Buenos días, este es tu día');
  assert.match(resumen[0].cuerpo, /1 cita: 10:00 Dentista/);
});

test('automatizaciones: validación, coincidencias sin tildes y descripciones', () => {
  assert.throws(() => normalizarAutomatizacion({ cuando: { tipo: 'correo' }, hacer: { notificar: true } }), /de quién/);
  assert.throws(() => normalizarAutomatizacion({ cuando: { tipo: 'horario', hora: '25:00' }, hacer: { notificar: true } }), /08:30/);
  assert.throws(() => normalizarAutomatizacion({ cuando: { tipo: 'cita' }, hacer: { notificar: false } }), /al menos una/);
  const a = normalizarAutomatizacion({ cuando: { tipo: 'correo', asunto: 'Confirmacion, billete' }, hacer: { evento: true, resumen: true } });
  assert.equal(a.hacer.resumen, false);
  assert.equal(a.hacer.evento, true);
  assert.ok(coincideCorreo(a, { de: { nombre: 'Renfe' }, asunto: 'CONFIRMACIÓN de reserva' }));
  assert.ok(!coincideCorreo(a, { de: { nombre: 'Renfe' }, asunto: 'Promoción' }));
  assert.equal(describirCuando({ tipo: 'horario', hora: '08:00', dias: [1, 2, 3, 4, 5] }), 'A las 08:00, de lunes a viernes');
  for (const p of PLANTILLAS) assert.doesNotThrow(() => normalizarAutomatizacion(p.automatizacion));
  assert.ok(enSilencio(23 * 60 + 30, { activo: true, desde: '23:00', hasta: '08:00' }));
  assert.ok(!enSilencio(12 * 60, { activo: true, desde: '23:00', hasta: '08:00' }));
});

test('desvincular borra todo menos las claves VAPID', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const vapid = await (await pedir(env, '/vapid')).json();
  await pedir(env, '/desvincular', { metodo: 'POST', token });
  assert.equal((await pedir(env, '/estado', { token })).status, 401);
  assert.deepEqual(await (await pedir(env, '/vapid')).json(), vapid);
  const { results } = await env.DB.prepare('SELECT clave FROM ajustes').all();
  assert.deepEqual(results.map((r) => r.clave), ['vapid']);
});

test('voz: Aura-2 en español, MeloTTS si falla, y solo para dispositivos vinculados', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const llamadas = [];
  let auraFalla = false;
  env.AI = {
    async run(modelo, entrada) {
      llamadas.push({ modelo, entrada });
      if (modelo.includes('aura')) {
        if (auraFalla) throw new Error('cuota agotada');
        return new Response(new Uint8Array(400).fill(7)).body;
      }
      return { audio: btoa(String.fromCharCode(...new Uint8Array(300).fill(9))) };
    },
  };
  assert.equal((await (await pedir(env, '/estado', { token })).json()).voz, true);
  const r = await pedir(env, '/voz', { metodo: 'POST', token, cuerpo: { texto: 'Hola, soy Kitsune.', voz: 'nestor' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(r.headers.get('X-Voz-Motor'), 'aura');
  assert.equal((await r.arrayBuffer()).byteLength, 400);
  assert.deepEqual(llamadas[0], { modelo: '@cf/deepgram/aura-2-es', entrada: { text: 'Hola, soy Kitsune.', speaker: 'nestor', encoding: 'mp3' } });
  auraFalla = true;
  const r2 = await pedir(env, '/voz', { metodo: 'POST', token, cuerpo: { texto: 'Otra vez', voz: 'inventada' } });
  assert.equal(r2.headers.get('X-Voz-Motor'), 'melo');
  assert.equal((await r2.arrayBuffer()).byteLength, 300);
  assert.equal(llamadas.at(-2).entrada.speaker, 'diana');
  assert.equal((await pedir(env, '/voz', { metodo: 'POST', cuerpo: { texto: 'Hola' } })).status, 401);
  assert.equal((await pedir(env, '/voz', { metodo: 'POST', token, cuerpo: { texto: 'x'.repeat(700) } })).status, 400);
});

test('voz: trozos de frases enteras y sin markdown', async () => {
  const { trozosDeVoz, limpiarParaVoz } = await import('../src/compartido/voz.js');
  assert.equal(limpiarParaVoz('**Hola** 🦊, mira [esto](https://x.es) y `código`.'), 'Hola , mira esto y código.');
  const largo = 'Primera frase corta. ' + 'Esta es una frase de relleno bastante larga para probar. '.repeat(30);
  const trozos = trozosDeVoz(largo);
  assert.ok(trozos[0].length <= 160);
  assert.ok(trozos.every((t) => t.length <= 600));
  assert.ok(trozos.length > 3);
});

test('empleo: rutas de portales solo para dispositivos y sin direcciones internas', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  assert.equal((await pedir(env, '/empleo/buscar', { metodo: 'POST', cuerpo: { puestos: 'react' } })).status, 401);
  for (const url of ['http://ejemplo.es/oferta', 'https://127.0.0.1/x', 'https://localhost/x', 'https://[::1]/x', 'no es url']) {
    const r = await pedir(env, '/empleo/detalle', { metodo: 'POST', token, cuerpo: { url } });
    assert.equal(r.status, 400, url);
  }
});

test('dictado: Whisper en el servidor (audio en flujo) y en Groq, sin frases fantasma', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  let entrada = null;
  env.AI = { run: async (modelo, datos) => ((entrada = { modelo, datos }), { text: '  Recuérdame llamar a Lucía ' }) };
  const audio = new Uint8Array(2000).fill(3);
  const r = await servidor.fetch(new Request('https://kitsune.ejemplo.workers.dev/transcribir', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/mp4' }, body: audio }), env);
  assert.deepEqual(await r.json(), { texto: 'Recuérdame llamar a Lucía' });
  assert.equal(entrada.modelo, '@cf/openai/whisper-large-v3-turbo');
  assert.equal(entrada.datos.audio.contentType, 'audio/mp4');
  assert.equal(entrada.datos.language, 'es');
  const sinToken = await servidor.fetch(new Request('https://kitsune.ejemplo.workers.dev/transcribir', { method: 'POST', headers: { 'Content-Type': 'audio/mp4' }, body: audio }), env);
  assert.equal(sinToken.status, 401);
  const noAudio = await servidor.fetch(new Request('https://kitsune.ejemplo.workers.dev/transcribir', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' }, body: 'hola' }), env);
  assert.equal(noAudio.status, 400);

  const { transcribirGroq, limpiarTranscripcion } = await import('../src/compartido/dictado.js');
  let pedido = null;
  const texto = await transcribirGroq({
    apiKey: 'gsk_x',
    audio,
    tipo: 'audio/mp4',
    fetch: async (url, opciones) => ((pedido = { url, opciones }), new Response(JSON.stringify({ text: 'Hola, Kitsune' }))),
  });
  assert.equal(texto, 'Hola, Kitsune');
  assert.equal(pedido.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(pedido.opciones.body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(pedido.opciones.body.get('language'), 'es');
  assert.equal(pedido.opciones.body.get('file').name, 'dictado.m4a');
  assert.equal(limpiarTranscripcion('Subtítulos realizados por la comunidad de Amara.org'), '');
  await assert.rejects(transcribirGroq({ apiKey: 'x', audio, tipo: 'audio/webm', fetch: async () => new Response('{}', { status: 429 }) }), /gastado/);
});

test('alerta de empleo: a su hora busca, puntúa con Groq y avisa solo de lo nuevo que encaja', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  internet();
  await pedir(env, '/groq', { metodo: 'PUT', token, cuerpo: { clave: 'gsk_abcdefghijklmnopqrstuvwxyz123456' } });

  // Sin puesto no se puede activar; sin vincular, nada.
  assert.equal((await pedir(env, '/empleo/alerta')).status, 401);
  const sinPuesto = await pedir(env, '/empleo/alerta', { metodo: 'PUT', token, cuerpo: { activa: true, puestos: '' } });
  assert.equal(sinPuesto.status, 400);
  const perfil = { nombre: 'Lucía Prieto', titular: 'Frontend', habilidades: ['React'], idiomas: ['Español nativo'] };
  const guardada = await (
    await pedir(env, '/empleo/alerta', { metodo: 'PUT', token, cuerpo: { activa: true, puestos: 'frontend react', ubicacion: 'Madrid', hora: '09:00', minEncaje: 60, perfil } })
  ).json();
  assert.deepEqual({ ...guardada.alerta }, { activa: true, puestos: 'frontend react', ubicacion: 'Madrid', zonas: ['Madrid'], distancia: 0, modalidad: '', hora: '09:00', minEncaje: 60, preparar: 2, investigar: true, presupuesto: 1.5, conPerfil: true });
  const fila = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'empleoAlerta'").first();
  assert.doesNotMatch(fila.valor, /Lucía/, 'el perfil se guarda cifrado');

  // Portales y Groq simulados: dos ofertas; una encaja (80) y otra no pasa la puerta del idioma.
  const llamadas = internet();
  const base = globalThis.fetch;
  const pedidos = [];
  let ofertas = [
    { public_slug: 'brujula-frontend', title: 'Frontend React', company: 'Brújula', location: 'Madrid', url: 'https://freehire.me/jobs/brujula-frontend', description: 'React' },
    { public_slug: 'nube-aleman', title: 'Frontend (alemán C1)', company: 'Nube', location: 'Madrid', url: 'https://freehire.me/jobs/nube-aleman', description: 'Deutsch C1' },
  ];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://www.linkedin.com/')) return new Response('', { status: 200 });
    if (u.startsWith('https://freehire.me/')) return (pedidos.push(u), Response.json({ data: ofertas }));
    if (u.startsWith('https://api.groq.com/')) {
      const ids = [...JSON.parse(init.body).messages[1].content.matchAll(/<oferta id="([^"]+)">/g)].map((m) => m[1]);
      const evaluaciones = ids.map((id) =>
        id.includes('nube') ? { id, puerta: 'no', notaPuerta: 'Pide alemán C1', tecnica: 80, experiencia: 80, cultura: 80, carrera: 80 } : { id, puerta: 'pasa', tecnica: 80, experiencia: 80, cultura: 80, carrera: 80 },
      );
      return Response.json({ choices: [{ message: { content: JSON.stringify({ evaluaciones }) } }] });
    }
    return base(url, init);
  };

  const hoy = partesLocales(Date.now(), 'Europe/Madrid').fecha;
  const nueve = desdeLocal(hoy, '09:00', 'Europe/Madrid');
  await revisar(env, nueve - 60_000);
  assert.equal(pedidos.length, 0, 'antes de su hora no busca');
  await revisar(env, nueve + 60_000);
  await revisar(env, nueve + 120_000);
  assert.equal(pedidos.length, 1, 'una sola vez al día');
  assert.match(pedidos[0], /countries=es/);
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  const empleo = avisos.filter((a) => a.etiqueta === 'empleo');
  assert.equal(empleo.length, 1);
  assert.equal(empleo[0].titulo, 'Kitsune: oferta nueva: Frontend React');
  assert.match(empleo[0].cuerpo, /Brújula \(80\)/);
  assert.equal(empleo[0].url, './?empleo');

  const estado = await (await pedir(env, '/empleo/alerta', { token })).json();
  assert.equal(estado.groq, true);
  assert.equal(estado.alerta.perfil, undefined);
  assert.equal(estado.ultimas.evaluadas, true);
  assert.deepEqual(estado.ultimas.ofertas.map((o) => o.empresa), ['Brújula']);

  // Probar ahora: las ya vistas no vuelven; solo la nueva, y sin push.
  ofertas = [...ofertas, { public_slug: 'faro-react', title: 'React Developer', company: 'Faro', location: 'Madrid', url: 'https://freehire.me/jobs/faro-react', description: 'React' }];
  const antes = llamadas.push.length;
  const prueba = await (await pedir(env, '/empleo/alerta/probar', { metodo: 'POST', token })).json();
  assert.deepEqual(prueba.ultimas.ofertas.map((o) => o.empresa), ['Faro']);
  assert.equal(llamadas.push.length, antes);
});

// Un dispositivo con sus datos en memoria y el motor de sincronización real.
function dispositivoSimulado(env, token) {
  const d = {
    memoria: [],
    recordatorios: [],
    indice: [],
    convs: new Map(),
    empleo: null,
    ajustes: normalizarAjustes({}),
    secretos: new Map(),
    estado: null,
    cambios: [],
  };
  const cliente = new ClienteServidor({ url: 'https://kitsune.ejemplo.workers.dev', token, fetch: (u, init) => servidor.fetch(new Request(u, init), env) });
  d.sincro = new Sincronizador({
    cliente: async () => cliente,
    colecciones: {
      memoria: coleccionLista({ leer: async () => d.memoria, guardar: async (l) => (d.memoria = l) }),
      recordatorios: coleccionLista({ leer: async () => d.recordatorios, guardar: async (l) => (d.recordatorios = l) }),
      conversaciones: coleccionConversaciones({
        leerIndice: async () => d.indice,
        guardarIndice: async (l) => (d.indice = l),
        leer: async (id) => d.convs.get(id) ?? null,
        guardar: async (id, datos) => d.convs.set(id, datos),
        borrar: async (id) => d.convs.delete(id),
      }),
      empleo: coleccionEmpleo({ leer: async () => d.empleo, guardar: async (x) => (d.empleo = x) }),
      ajustes: coleccionAjustes({ leer: async () => d.ajustes, guardar: async (c) => (d.ajustes = aplicarCambios(d.ajustes, c)) }),
      claves: coleccionClaves({ leer: async (n) => d.secretos.get(n) ?? null, guardar: async (n, v) => d.secretos.set(n, v), borrar: async (n) => d.secretos.delete(n) }),
    },
    leerEstado: async () => d.estado,
    guardarEstado: async (e) => (d.estado = e && structuredClone(e)),
    leerLlave: async () => d.secretos.get('sincroLlave') ?? null,
    guardarLlave: async (l) => d.secretos.set('sincroLlave', l),
    borrarLlave: async () => d.secretos.delete('sincroLlave'),
    alCambiar: (c) => d.cambios.push(...c),
  });
  return d;
}

test('sincronización: iPhone y Windows comparten todo cifrado y solo con el código aprobado', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const { codigo } = await (await pedir(env, '/codigo', { metodo: 'POST', token })).json();
  const { token: tokenPc } = await (await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo, nombre: 'Windows (CASA)' } })).json();
  internet();
  const movil = dispositivoSimulado(env, token);
  const pc = dispositivoSimulado(env, tokenPc);

  // El iPhone ya tiene sus cosas.
  movil.memoria = [{ id: 'm1', texto: 'Mi hermana se llama Ana', creado: 1 }];
  movil.recordatorios = [{ id: 'r1abc', texto: 'Llamar al dentista', cuando: Date.now() + 3_600_000, avisado: false }];
  movil.indice = [{ id: 'c1', titulo: 'Viaje a Lisboa', resumen: '', mensajes: 2, creada: 1, actualizada: 10 }];
  movil.convs.set('c1', { historial: [{ role: 'user', content: 'Hola' }], visibles: [{ rol: 'usuario', texto: 'Hola' }] });
  movil.empleo = { cv: { texto: 'CV de Lucía' }, postulaciones: [{ id: 'p1', fecha: 5, estado: 'enviada' }] };
  movil.ajustes = aplicarCambios(movil.ajustes, { estilo: 'anime', personalidad: 'Tutéame', tamano: 'grande' });
  movil.secretos.set('claveGroq', 'gsk_secreta_de_prueba_1234567890');

  // Activa la sincronización: nada viaja en claro.
  await movil.sincro.activar();
  const filas = (await env.DB.prepare('SELECT id, datos FROM sincro').all()).results;
  assert.ok(filas.some((f) => f.id === 'claves/groq'));
  const todo = filas.map((f) => f.datos ?? '').join(' ');
  for (const secreto of ['gsk_secreta', 'Ana', 'Lisboa', 'Lucía', 'Tutéame']) assert.ok(!todo.includes(secreto), secreto);

  // El PC pide unirse; el código coincide en las dos pantallas; el móvil lo aprueba.
  pc.ajustes = aplicarCambios(pc.ajustes, { estilo: 'tinta', tamano: 'pequeno' });
  pc.memoria = [{ id: 'm2', texto: 'Trabajo en remoto los viernes', creado: 2 }];
  const { id, codigo: codigoPc } = await pc.sincro.solicitar();
  const esperando = pc.sincro.esperar();
  const resumen = await movil.sincro.resumen();
  assert.equal(resumen.solicitudes.length, 1);
  assert.equal(resumen.solicitudes[0].nombre, 'Windows (CASA)');
  assert.equal(await codigoDe(resumen.solicitudes[0].publica), codigoPc);
  // Un dispositivo no puede aprobarse a sí mismo.
  await assert.rejects(pc.sincro.aprobar(id, resumen.solicitudes[0].publica));
  await movil.sincro.aprobar(id, resumen.solicitudes[0].publica);
  assert.equal(await esperando, true);

  // El PC tiene lo del móvil; lo suyo propio se suma; lo de cada dispositivo no se toca.
  assert.equal(pc.secretos.get('claveGroq'), 'gsk_secreta_de_prueba_1234567890');
  assert.equal(pc.ajustes.estilo, 'anime');
  assert.equal(pc.ajustes.personalidad, 'Tutéame');
  assert.equal(pc.ajustes.tamano, 'pequeno');
  assert.deepEqual(pc.memoria.map((m) => m.id).sort(), ['m1', 'm2']);
  assert.equal(pc.convs.get('c1').visibles[0].texto, 'Hola');
  assert.equal(pc.empleo.cv.texto, 'CV de Lucía');
  assert.equal(pc.empleo.postulaciones[0].estado, 'enviada');
  assert.equal(pc.recordatorios[0].texto, 'Llamar al dentista');

  await movil.sincro.sincronizar();
  assert.deepEqual(movil.memoria.map((m) => m.id).sort(), ['m1', 'm2']);
  assert.ok(movil.cambios.includes('memoria'));

  // Cambios y borrados van y vuelven.
  pc.memoria = pc.memoria.filter((m) => m.id !== 'm1');
  pc.empleo = { ...pc.empleo, postulaciones: [{ ...pc.empleo.postulaciones[0], estado: 'entrevista' }] };
  pc.secretos.set('claveClaude', 'sk-ant-prueba');
  await pc.sincro.sincronizar();
  await movil.sincro.sincronizar();
  assert.deepEqual(movil.memoria.map((m) => m.id), ['m2']);
  assert.equal(movil.empleo.postulaciones[0].estado, 'entrevista');
  assert.equal(movil.secretos.get('claveClaude'), 'sk-ant-prueba');
  assert.equal(movil.empleo.cv.texto, 'CV de Lucía');

  // Si los dos cambian lo mismo, gana el último cambio.
  movil.ajustes = aplicarCambios(movil.ajustes, { estilo: 'kawaii' });
  await movil.sincro.sincronizar();
  pc.ajustes = aplicarCambios(pc.ajustes, { estilo: 'realista' });
  await new Promise((r) => setTimeout(r, 5));
  await pc.sincro.sincronizar();
  await movil.sincro.sincronizar();
  assert.equal(movil.ajustes.estilo, 'realista');
  assert.equal(pc.ajustes.estilo, 'realista');

  // Sin sincronizar, otro dispositivo no puede leer nada: hace falta la llave.
  assert.equal((await pedir(env, '/sincro/cambios')).status, 401);

  // Empezar de cero: el servidor lo olvida y los dispositivos se quedan con sus datos.
  await movil.sincro.borrarServidor();
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM sincro').first()).n, 0);
  await pc.sincro.sincronizar().catch(() => {});
  assert.equal(await pc.sincro.activaAqui(), false);
  assert.deepEqual(pc.memoria.map((m) => m.id), ['m2']);
});

test('recordatorios: un dispositivo no borra en el servidor los que creó otro', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const { codigo } = await (await pedir(env, '/codigo', { metodo: 'POST', token })).json();
  const { token: tokenPc } = await (await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo, nombre: 'PC' } })).json();
  const futuro = Date.now() + 3_600_000;
  const subir = (t, lista, enviados) => pedir(env, '/recordatorios', { metodo: 'PUT', token: t, cuerpo: paqueteRecordatorios(lista, enviados) });
  await subir(token, [{ id: 'rmovil1', texto: 'Del móvil', cuando: futuro }], []);
  await subir(tokenPc, [{ id: 'rpc0001', texto: 'Del PC', cuando: futuro }], []);
  const ids = async () => (await env.DB.prepare("SELECT id FROM recordatorios WHERE origen = 'app' ORDER BY id").all()).results.map((r) => r.id);
  assert.deepEqual(await ids(), ['rmovil1', 'rpc0001']);
  // El PC borra el suyo: el del móvil sigue.
  await subir(tokenPc, [], ['rpc0001']);
  assert.deepEqual(await ids(), ['rmovil1']);
});

test('servidor con OpenAI: guarda la clave cifrada y puntúa las alertas de empleo con GPT-6 Luna', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  internet();
  assert.equal((await pedir(env, '/openai', { metodo: 'PUT', token, cuerpo: { clave: 'gsk_no_es_de_openai_12345678901234' } })).status, 400);
  assert.equal((await pedir(env, '/openai', { metodo: 'PUT', token, cuerpo: { clave: 'sk-proj-abcdefghijklmnopqrstuvwxyz0123' } })).status, 200);
  const fila = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'openai'").first();
  assert.doesNotMatch(fila.valor, /abcdefghijklmnop/);
  assert.equal((await (await pedir(env, '/estado', { token })).json()).openai, true);

  await pedir(env, '/empleo/alerta', { metodo: 'PUT', token, cuerpo: { activa: true, puestos: 'frontend', ubicacion: 'Madrid', minEncaje: 60, perfil: { nombre: 'Lucía', habilidades: ['React'] } } });
  const base = globalThis.fetch;
  const ia = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://www.linkedin.com/')) return new Response('');
    if (u.startsWith('https://freehire.me/')) return Response.json({ data: [{ public_slug: 'faro', title: 'React Developer', company: 'Faro', location: 'Madrid', url: 'https://freehire.me/jobs/faro', description: 'React' }] });
    if (u.startsWith('https://api.openai.com/')) {
      const cuerpo = JSON.parse(init.body);
      ia.push({ url: u, cuerpo, auth: init.headers.Authorization });
      const id = cuerpo.input.match(/<oferta id="([^"]+)">/)[1];
      const texto = JSON.stringify({ evaluaciones: [{ id, puerta: 'pasa', tecnica: 90, experiencia: 80, cultura: 70, carrera: 80 }] });
      return Response.json({ status: 'completed', usage: { input_tokens: 2000, output_tokens: 300 }, output: [{ type: 'message', content: [{ type: 'output_text', text: texto, annotations: [] }] }] });
    }
    return base(url, init);
  };
  const { ultimas } = await (await pedir(env, '/empleo/alerta/probar', { metodo: 'POST', token })).json();
  assert.equal(ia.length, 1);
  assert.equal(ia[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(ia[0].auth, 'Bearer sk-proj-abcdefghijklmnopqrstuvwxyz0123');
  assert.equal(ia[0].cuerpo.model, 'gpt-6-luna');
  assert.deepEqual(ia[0].cuerpo.text, { format: { type: 'json_object' } });
  assert.equal(ultimas.evaluadas, true);
  assert.ok(ultimas.ofertas[0].encaje >= 80);
  // Lo que gasta el servidor se ve desde la app.
  const { meses } = await (await pedir(env, '/consumo', { token })).json();
  const mes = Object.values(meses)[0];
  assert.equal(mes.peticiones, 1);
  assert.equal(mes.entrada, 2000);
  assert.ok(mes.usd > 0 && mes.usd < 0.001);
});

test('sincronización: el gasto de cada dispositivo llega al otro sin pisarse', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const { codigo } = await (await pedir(env, '/codigo', { metodo: 'POST', token })).json();
  const { token: tokenPc } = await (await pedir(env, '/canjear', { metodo: 'POST', cuerpo: { codigo, nombre: 'PC' } })).json();
  internet();
  const { coleccionConsumo } = await import('../src/compartido/sincro.js');
  const { Consumo } = await import('../src/compartido/consumo.js');
  const crear = (t, nombre) => {
    const d = { datos: null, estado: null, llave: null };
    const almacen = { leer: async () => d.datos && structuredClone(d.datos), guardar: async (x) => (d.datos = structuredClone(x)) };
    d.consumo = new Consumo({ ...almacen, nombre });
    d.sincro = new Sincronizador({
      cliente: async () => new ClienteServidor({ url: 'https://kitsune.ejemplo.workers.dev', token: t, fetch: (u, init) => servidor.fetch(new Request(u, init), env) }),
      colecciones: { consumo: coleccionConsumo(almacen) },
      leerEstado: async () => d.estado,
      guardarEstado: async (e) => (d.estado = e && structuredClone(e)),
      leerLlave: async () => d.llave,
      guardarLlave: async (l) => (d.llave = l),
      borrarLlave: async () => (d.llave = null),
    });
    return d;
  };
  const movil = crear(token, 'iPhone');
  const pc = crear(tokenPc, 'PC');
  await movil.consumo.anotar('gpt-6-luna', { entrada: 1_000_000, cache: 0, salida: 0 });
  await pc.consumo.anotar('gpt-6-luna', { entrada: 2_000_000, cache: 0, salida: 0 });
  await movil.sincro.activar();
  await pc.sincro.solicitar();
  const esperando = pc.sincro.esperar();
  const [s] = (await movil.sincro.resumen()).solicitudes;
  await movil.sincro.aprobar(s.id, s.publica);
  await esperando;
  await movil.consumo.anotar('gpt-6-luna', { entrada: 1_000_000, cache: 0, salida: 0 });
  await movil.sincro.sincronizar();
  await pc.sincro.sincronizar();
  await movil.sincro.sincronizar();
  for (const d of [movil, pc]) {
    const r = await d.consumo.resumen();
    assert.equal(Math.round(r.total.usd * 100) / 100, 0.4, 'iPhone 0,20 $ + PC 0,20 $');
    assert.equal(r.dispositivos.length, 2);
  }
});

test('candidaturas de la mañana: tras la alerta prepara las mejores (una por minuto), avisa y respeta el gasto máximo', async () => {
  const env = entorno();
  const { token } = await vincular(env);
  const nav = await navegador();
  await pedir(env, '/suscripcion', { metodo: 'PUT', token, cuerpo: { suscripcion: nav.suscripcion } });
  internet();
  await pedir(env, '/openai', { metodo: 'PUT', token, cuerpo: { clave: 'sk-proj-abcdefghijklmnopqrstuvwxyz0123' } });
  const perfil = { nombre: 'Lucía Prieto', email: 'lucia@ejemplo.es', titular: 'Frontend', habilidades: ['React'], experiencia: [{ puesto: 'Frontend', empresa: 'Faro', logros: ['Migré a React'] }] };
  await pedir(env, '/empleo/alerta', { metodo: 'PUT', token, cuerpo: { activa: true, puestos: 'frontend', zonas: ['Valencia'], hora: '09:00', preparar: 2, investigar: false, presupuesto: 1, perfil } });

  const llamadas = internet();
  const base = globalThis.fetch;
  const pasos = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://www.linkedin.com/')) return new Response('');
    if (u.startsWith('https://freehire.me/')) {
      return Response.json({
        data: ['a', 'b', 'c'].map((x) => ({ public_slug: `o-${x}`, title: `Frontend ${x}`, company: `Empresa ${x}`, location: 'Valencia', url: `https://freehire.me/jobs/o-${x}`, description: 'React y TypeScript' })),
      });
    }
    if (u.startsWith('https://api.openai.com/')) {
      const cuerpo = JSON.parse(init.body);
      let texto;
      if (/evaluaciones/.test(cuerpo.instructions)) {
        const ids = [...cuerpo.input.matchAll(/<oferta id="([^"]+)">/g)].map((m) => m[1]);
        texto = JSON.stringify({ evaluaciones: ids.map((id, i) => ({ id, puerta: 'pasa', tecnica: 90 - i * 10, experiencia: 80, cultura: 70, carrera: 80 })) });
      } else {
        pasos.push(/revisor/.test(cuerpo.instructions) ? 'revisar' : 'redactar');
        texto = JSON.stringify({ idioma: 'es', cv: { nombre: 'Lucía Prieto', email: 'otro@x.es', titular: 'Frontend React', experiencia: [{ puesto: 'Frontend', empresa: 'Faro', logros: ['Migré a React'] }] }, carta: 'Hola, soy Lucía.', palabrasClave: ['React'], encaje: 85 });
      }
      return Response.json({ status: 'completed', usage: { input_tokens: 4000, output_tokens: 2000 }, output: [{ type: 'message', content: [{ type: 'output_text', text: texto, annotations: [] }] }] });
    }
    return base(url, init);
  };

  const hoy = partesLocales(Date.now(), 'Europe/Madrid').fecha;
  const nueve = desdeLocal(hoy, '09:00', 'Europe/Madrid');
  await revisar(env, nueve + 60_000); // alerta: puntúa 3 y deja 2 en cola
  assert.deepEqual(pasos, []);
  await revisar(env, nueve + 120_000); // primera candidatura
  assert.deepEqual(pasos, ['redactar', 'revisar'], 'sin investigar la empresa (está desactivado)');
  await revisar(env, nueve + 180_000); // segunda
  await revisar(env, nueve + 240_000); // cola vacía: nada más
  assert.equal(pasos.length, 4);

  const { preparadas } = await (await pedir(env, '/empleo/preparadas', { token })).json();
  assert.deepEqual(preparadas.map((p) => p.oferta.empresa), ['Empresa b', 'Empresa a']);
  assert.equal(preparadas[0].cv.email, 'lucia@ejemplo.es', 'el contacto siempre es el del CV original');
  assert.equal(preparadas[0].carta, 'Hola, soy Lucía.');
  const fila = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'empleoPreparadas'").first();
  assert.doesNotMatch(fila.valor, /Lucía/, 'guardadas cifradas');
  const avisos = await Promise.all(llamadas.push.map((p) => nav.descifrar(p.cuerpo).then(JSON.parse)));
  const listas = avisos.filter((a) => a.etiqueta === 'empleo-listas');
  assert.equal(listas.length, 1, 'un solo aviso al final de la tanda');
  assert.equal(listas[0].titulo, 'Kitsune: 2 candidaturas listas para revisar');

  await pedir(env, '/empleo/preparadas/recoger', { metodo: 'POST', token, cuerpo: { ids: [preparadas[0].id] } });
  assert.equal((await (await pedir(env, '/empleo/preparadas', { token })).json()).preparadas.length, 1);

  // Gasto máximo: con el mes ya en 1 $, la cola se vacía sin llamar a la IA.
  await env.DB.prepare("UPDATE ajustes SET valor = ? WHERE clave = 'consumoOpenAI'").bind(JSON.stringify({ [new Date(nueve).toISOString().slice(0, 7)]: { usd: 1.2, peticiones: 50 } })).run();
  await env.DB.prepare("INSERT OR REPLACE INTO ajustes (clave, valor) VALUES ('empleoCola', ?)").bind(JSON.stringify([{ id: 'x', puesto: 'Otra', descripcion: 'React' }])).run();
  await revisar(env, nueve + 300_000);
  assert.equal(pasos.length, 4, 'no ha gastado más');
  const registro = await (await pedir(env, '/registro', { token })).json();
  assert.ok(registro.some((r) => /límite 1 \$/.test(r.texto)));
});
