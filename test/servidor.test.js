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
