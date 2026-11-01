// Servidor de Kitsune en Cloudflare Workers: lo que tiene que seguir
// funcionando con la app cerrada. Notificaciones push al móvil, recordatorios,
// avisos de correo y citas, y automatizaciones. Es de una sola persona: la
// primera cuenta de Google que lo vincula es la dueña (o la que diga
// DUENO_EMAIL), y cada dispositivo usa su propio token.
import { Nucleo, PERMISOS_GOOGLE, AVISOS_POR_DEFECTO } from './nucleo.js';
import { revisar, resumenDelDia } from './revision.js';
import { aleatorio, huella, cifrarTexto, descifrarTexto } from './cifrado.js';
import { partesLocales } from './tiempo.js';
import { normalizarAutomatizacion, MAX_AUTOMATIZACIONES } from '../../src/compartido/automatizaciones.js';
import { ClienteGmail } from '../../src/compartido/gmail.js';
import { aviso } from '../../src/compartido/notificaciones.js';
import { sintetizar, validarVoz } from './voz.js';
import { limpiarTranscripcion, MAX_AUDIO } from '../../src/compartido/dictado.js';
import { buscarEnPortales, detalleOferta } from '../../src/compartido/portales.js';
import { guardarAlerta, alertaPublica, alertaEmpleo } from './empleo.js';
import { rutaSincro } from './sincro.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const PENDIENTE_MIN = 15;
const CODIGO_MIN = 10;

class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pagina = (titulo, texto, estado = 200) =>
  new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Kitsune</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0909;color:#f2e8e0;font:17px/1.5 system-ui,sans-serif;text-align:center;padding:24px">` +
      `<main><div style="font-size:44px">狐</div><h1 style="font-weight:600;font-size:22px">${escapar(titulo)}</h1><p style="color:#bba69f;max-width:30em">${escapar(texto)}</p></main></body></html>`,
    { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

async function cuerpo(peticion) {
  try {
    return await peticion.json();
  } catch {
    throw new ErrorHttp(400, 'Petición no válida.');
  }
}

const zonaValida = (zona) => {
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone: zona });
    return typeof zona === 'string' && zona.length < 60;
  } catch {
    return false;
  }
};
const nombreDispositivo = (nombre) => String(nombre ?? '').trim().slice(0, 60) || 'Dispositivo';

async function dispositivo(n, peticion) {
  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new ErrorHttp(401, 'Falta el token del dispositivo.');
  const d = await n.db.prepare('SELECT id, nombre, suscripcion, visto FROM dispositivos WHERE token = ?').bind(await huella(token)).first();
  if (!d) throw new ErrorHttp(401, 'Este dispositivo ya no está vinculado.');
  if (n.ahora - d.visto > 3_600_000) await n.db.prepare('UPDATE dispositivos SET visto = ? WHERE id = ?').bind(n.ahora, d.id).run();
  return d;
}

async function nuevoDispositivo(n, nombre) {
  const token = aleatorio(32);
  const id = `d${aleatorio(9)}`;
  await n.db
    .prepare('INSERT INTO dispositivos (id, token, nombre, creado, visto) VALUES (?, ?, ?, ?, ?)')
    .bind(id, await huella(token), nombreDispositivo(nombre), n.ahora, n.ahora)
    .run();
  return { id, token };
}

// ---------- Vincular con Google ----------
// La app abre /google/entrar en el navegador con un «estado» secreto suyo,
// Google vuelve a /google/vuelta y la app recoge su token con ese estado.

async function entrarConGoogle(n, url) {
  const estado = url.searchParams.get('estado') ?? '';
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(estado)) return pagina('Enlace no válido', 'Vuelve a Kitsune y pulsa otra vez «Conectar».', 400);
  if (!n.env.GOOGLE_CLIENT_ID || !n.env.GOOGLE_CLIENT_SECRET) {
    return pagina('Falta configurar Google', 'Añade el ID y el secreto del cliente web de Google en el servidor (ver la guía).', 500);
  }
  const zona = url.searchParams.get('zona');
  await n.db
    .prepare('INSERT OR REPLACE INTO pendientes (estado, nombre, zona, caduca) VALUES (?, ?, ?, ?)')
    .bind(await huella(estado), nombreDispositivo(url.searchParams.get('nombre')), zonaValida(zona) ? zona : null, n.ahora + PENDIENTE_MIN * 60_000)
    .run();
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({
    client_id: n.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/google/vuelta`,
    response_type: 'code',
    scope: PERMISOS_GOOGLE,
    access_type: 'offline',
    // Siempre: así Google entrega un permiso duradero (refresh token).
    prompt: 'consent',
    state: estado,
  });
  return Response.redirect(google.toString(), 302);
}

async function vueltaDeGoogle(n, url) {
  const estado = url.searchParams.get('state') ?? '';
  const pendiente = /^[A-Za-z0-9_-]{32,64}$/.test(estado)
    ? await n.db.prepare('SELECT * FROM pendientes WHERE estado = ? AND caduca > ?').bind(await huella(estado), n.ahora).first()
    : null;
  if (!pendiente) return pagina('El enlace ha caducado', 'Vuelve a Kitsune y pulsa otra vez «Conectar».', 400);
  const fallar = async (mensaje) => {
    await n.db.prepare('UPDATE pendientes SET error = ? WHERE estado = ?').bind(mensaje, pendiente.estado).run();
    return pagina('No se ha podido conectar', `${mensaje} Vuelve a Kitsune.`, 400);
  };
  const codigo = url.searchParams.get('code');
  if (!codigo) return fallar('No diste permiso a Kitsune en Google.');

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo,
      client_id: n.env.GOOGLE_CLIENT_ID,
      client_secret: n.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/google/vuelta`,
      grant_type: 'authorization_code',
    }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.refresh_token) return fallar(`Google no ha dado el permiso (${datos.error_description ?? datos.error ?? respuesta.status}).`);
  const permisos = datos.scope ?? '';
  if (!PERMISOS_GOOGLE.split(' ').every((p) => permisos.includes(p))) return fallar('Hace falta aceptar los permisos de Gmail y de Calendar.');

  const gmail = new ClienteGmail({ token: async () => datos.access_token, invalidar: () => {} });
  const { emailAddress: email } = await gmail.perfil();
  const a = await n.ajustes();
  const dueno = (n.env.DUENO_EMAIL || a.dueno || '').toLowerCase();
  if (dueno && dueno !== email.toLowerCase()) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(datos.refresh_token)}`, { method: 'POST' }).catch(() => {});
    return fallar(`Este servidor de Kitsune es de otra cuenta (${dueno}).`);
  }
  if (!a.dueno) await n.poner('dueno', email);
  await n.guardarGoogle({ refresco: datos.refresh_token, email });
  if (pendiente.zona) await n.poner('zona', pendiente.zona);
  const { token } = await nuevoDispositivo(n, pendiente.nombre);
  await n.db.prepare('UPDATE pendientes SET token = ? WHERE estado = ?').bind(await cifrarTexto(token, n.env.CLAVE_CIFRADO), pendiente.estado).run();
  await n.registrar('vinculo', `${pendiente.nombre} vinculado con ${email}.`);
  return pagina('¡Listo!', 'Kitsune ya puede avisarte. Vuelve a la app: se conectará sola.');
}

async function recoger(n, peticion) {
  const { estado } = await cuerpo(peticion);
  if (typeof estado !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(estado)) throw new ErrorHttp(400, 'Estado no válido.');
  const p = await n.db.prepare('SELECT * FROM pendientes WHERE estado = ?').bind(await huella(estado)).first();
  if (!p || p.caduca < n.ahora) return json({ error: 'La conexión ha caducado. Vuelve a intentarlo.' });
  if (p.error) return json({ error: p.error });
  if (!p.token) return json({ pendiente: true });
  await n.db.prepare('DELETE FROM pendientes WHERE estado = ?').bind(p.estado).run();
  return json({ token: await descifrarTexto(p.token, n.env.CLAVE_CIFRADO), email: (await n.ajustes()).dueno });
}

// ---------- Vincular otro dispositivo con un código ----------

async function crearCodigo(n) {
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  await n.db.prepare('DELETE FROM codigos').run();
  await n.db.prepare('INSERT INTO codigos (codigo, caduca, intentos) VALUES (?, ?, 0)').bind(await huella(codigo), n.ahora + CODIGO_MIN * 60_000).run();
  return json({ codigo, caduca: n.ahora + CODIGO_MIN * 60_000 });
}

async function canjearCodigo(n, peticion) {
  const { codigo, nombre } = await cuerpo(peticion);
  const vigente = await n.db.prepare('SELECT * FROM codigos WHERE caduca > ?').bind(n.ahora).first();
  if (!vigente) throw new ErrorHttp(400, 'No hay ningún código vigente: crea uno nuevo en el otro dispositivo.');
  if (typeof codigo !== 'string' || (await huella(codigo.trim())) !== vigente.codigo) {
    // Cinco fallos y el código deja de valer: adivinarlo no sale a cuenta.
    if (vigente.intentos >= 4) await n.db.prepare('DELETE FROM codigos').run();
    else await n.db.prepare('UPDATE codigos SET intentos = intentos + 1').run();
    throw new ErrorHttp(400, 'Código incorrecto.');
  }
  await n.db.prepare('DELETE FROM codigos').run();
  const { token } = await nuevoDispositivo(n, nombre);
  await n.registrar('vinculo', `${nombreDispositivo(nombre)} vinculado con un código.`);
  return json({ token, email: (await n.ajustes()).dueno });
}

// ---------- Estado y ajustes ----------

async function estado(n, d) {
  const a = await n.ajustes();
  return json({
    email: a.dueno ?? null,
    google: Boolean(a.google && !a.google.caducado),
    googleCaducado: Boolean(a.google?.caducado),
    groq: Boolean(a.groq),
    openai: Boolean(a.openai),
    // Voz natural: hace falta la IA de Cloudflare (binding AI).
    voz: Boolean(n.env.AI),
    zona: await n.zona(),
    avisos: await n.avisos(),
    vapid: (await n.vapid()).publica,
    yo: d.id,
    dispositivos: (await n.dispositivos()).map((x) => ({ id: x.id, nombre: x.nombre, push: Boolean(x.suscripcion), visto: x.visto, yo: x.id === d.id })),
  });
}

function validarAvisos(entrada) {
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const s = entrada?.silencio ?? {};
  const limpio = {
    correo: entrada?.correo !== false,
    soloPrincipal: entrada?.soloPrincipal !== false,
    correoCadaMin: [1, 2, 5, 10, 15, 30].includes(entrada?.correoCadaMin) ? entrada.correoCadaMin : AVISOS_POR_DEFECTO.correoCadaMin,
    citas: [0, 5, 10, 15, 30, 60].includes(entrada?.citas) ? entrada.citas : AVISOS_POR_DEFECTO.citas,
    silencio: {
      activo: s.activo !== false,
      desde: hora.test(s.desde ?? '') ? s.desde : AVISOS_POR_DEFECTO.silencio.desde,
      hasta: hora.test(s.hasta ?? '') ? s.hasta : AVISOS_POR_DEFECTO.silencio.hasta,
    },
  };
  return limpio;
}

function validarSuscripcion(s) {
  if (s === null) return null;
  const ok =
    s &&
    typeof s.endpoint === 'string' &&
    /^https:\/\//.test(s.endpoint) &&
    s.endpoint.length < 1000 &&
    typeof s.keys?.p256dh === 'string' &&
    typeof s.keys?.auth === 'string';
  if (!ok) throw new ErrorHttp(400, 'Suscripción no válida.');
  return JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
}

// La app manda sus recordatorios pendientes; los que creó el servidor (por
// una automatización) se quedan. Con «borrados» (apps actuales) solo se quitan
// los que ese dispositivo dice haber borrado: así un dispositivo no borra los
// recordatorios que ha creado otro. Sin «borrados» (apps antiguas), la lista
// sustituye a todo lo anterior.
async function sincronizarRecordatorios(n, peticion) {
  const { lista, borrados } = await cuerpo(peticion);
  if (!Array.isArray(lista) || lista.length > 200) throw new ErrorHttp(400, 'Lista no válida.');
  const idValido = (id) => typeof id === 'string' && /^r[0-9a-z]{3,30}$/.test(id);
  const limpia = lista
    .filter((r) => r && idValido(r.id) && Number.isFinite(r.cuando) && typeof r.texto === 'string')
    .map((r) => ({ id: r.id, texto: r.texto.slice(0, 200), cuando: r.cuando }));
  const { results } = await n.db.prepare("SELECT id, avisado FROM recordatorios WHERE origen = 'app'").all();
  const avisados = new Set(results.filter((r) => r.avisado).map((r) => r.id));
  const insertar = (r) =>
    n.db
      .prepare(
        "INSERT INTO recordatorios (id, texto, cuando, avisado, origen) VALUES (?, ?, ?, ?, 'app') " +
          'ON CONFLICT(id) DO UPDATE SET texto = excluded.texto, avisado = excluded.avisado, cuando = excluded.cuando',
      )
      .bind(r.id, r.texto, r.cuando, avisados.has(r.id) || r.cuando < n.ahora - 60_000 ? 1 : 0);
  if (Array.isArray(borrados)) {
    const quitar = borrados.filter(idValido).slice(0, 500);
    await n.db.batch([
      ...quitar.map((id) => n.db.prepare("DELETE FROM recordatorios WHERE origen = 'app' AND id = ?").bind(id)),
      // Los ya avisados hace más de dos días sobran.
      n.db.prepare("DELETE FROM recordatorios WHERE origen = 'app' AND avisado = 1 AND cuando < ?").bind(n.ahora - 2 * 86_400_000),
      ...limpia.map(insertar),
    ]);
  } else {
    await n.db.batch([n.db.prepare("DELETE FROM recordatorios WHERE origen = 'app'"), ...limpia.map(insertar)]);
  }
  return json({ ok: true, total: limpia.length });
}

// ---------- Automatizaciones ----------

async function guardarAutomatizacion(n, peticion, id = null) {
  const datos = await cuerpo(peticion);
  let auto;
  try {
    auto = normalizarAutomatizacion(datos, id ?? undefined);
  } catch (error) {
    throw new ErrorHttp(400, error.message);
  }
  if (id) {
    const existe = await n.db.prepare('SELECT id FROM automatizaciones WHERE id = ?').bind(id).first();
    if (!existe) throw new ErrorHttp(404, 'No encuentro esa automatización.');
    await n.db.prepare('UPDATE automatizaciones SET datos = ? WHERE id = ?').bind(JSON.stringify(auto), id).run();
  } else {
    const { results } = await n.db.prepare('SELECT COUNT(*) AS total FROM automatizaciones').all();
    if ((results[0]?.total ?? 0) >= MAX_AUTOMATIZACIONES) throw new ErrorHttp(400, 'Hay demasiadas automatizaciones.');
    await n.db.prepare('INSERT INTO automatizaciones (id, datos, creada) VALUES (?, ?, ?)').bind(auto.id, JSON.stringify(auto), n.ahora).run();
  }
  return json(auto);
}

// ---------- Desvincular todo ----------

async function desvincular(n) {
  const a = await n.ajustes();
  if (a.google) {
    const refresco = await descifrarTexto(a.google.refresco, n.env.CLAVE_CIFRADO).catch(() => null);
    if (refresco) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresco)}`, { method: 'POST' }).catch(() => {});
  }
  await n.db.batch(
    ['dispositivos', 'recordatorios', 'automatizaciones', 'avisados', 'registro', 'pendientes', 'codigos', 'sincro', 'sincro_solicitudes'].map((t) => n.db.prepare(`DELETE FROM ${t}`)),
  );
  // Las claves VAPID se quedan: así los navegadores no tienen que volver a suscribirse con otra.
  await n.db.prepare("DELETE FROM ajustes WHERE clave <> 'vapid'").run();
  return json({ ok: true });
}

// ---------- Rutas ----------

async function atender(peticion, env) {
  if (peticion.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(peticion.url);
  const ruta = url.pathname.replace(/\/+$/, '') || '/';
  const n = new Nucleo(env);
  const m = peticion.method;

  if (m === 'GET' && ruta === '/') return pagina('Kitsune', 'Este es el servidor de avisos de Kitsune. No hay nada que ver aquí.');
  if (m === 'GET' && ruta === '/vapid') return json({ clave: (await n.vapid()).publica });
  if (m === 'GET' && ruta === '/google/entrar') return entrarConGoogle(n, url);
  if (m === 'GET' && ruta === '/google/vuelta') return vueltaDeGoogle(n, url);
  if (m === 'POST' && ruta === '/vincular/recoger') return recoger(n, peticion);
  if (m === 'POST' && ruta === '/canjear') return canjearCodigo(n, peticion);

  // Todo lo demás, solo para dispositivos vinculados.
  const d = await dispositivo(n, peticion);
  if (m === 'GET' && ruta === '/estado') return estado(n, d);
  if (m === 'POST' && ruta === '/codigo') return crearCodigo(n);
  if (m === 'PUT' && ruta === '/suscripcion') {
    const { suscripcion } = await cuerpo(peticion);
    await n.db.prepare('UPDATE dispositivos SET suscripcion = ? WHERE id = ?').bind(validarSuscripcion(suscripcion ?? null), d.id).run();
    return json({ ok: true });
  }
  if (m === 'POST' && ruta === '/probar') {
    const enviados = await n.notificar({ ...aviso('avisos activados', 'Así te avisaré aunque la app esté cerrada.'), url: './', etiqueta: 'prueba' }, { soloDispositivo: d.id });
    if (!enviados) throw new ErrorHttp(400, 'Este dispositivo no tiene las notificaciones activadas.');
    return json({ ok: true });
  }
  if (m === 'POST' && ruta === '/resumen') {
    const zona = await n.zona();
    const a = await n.ajustes();
    return json(await resumenDelDia(n, partesLocales(n.ahora, zona), zona, Boolean(a.google && !a.google.caducado)));
  }
  if (m === 'PUT' && ruta === '/recordatorios') return sincronizarRecordatorios(n, peticion);
  if (m === 'GET' && ruta === '/recordatorios') {
    const { results } = await n.db.prepare('SELECT id, texto, cuando, origen FROM recordatorios WHERE avisado = 0 ORDER BY cuando').all();
    return json(results);
  }
  if (m === 'DELETE' && ruta.startsWith('/recordatorios/')) {
    await n.db.prepare('DELETE FROM recordatorios WHERE id = ?').bind(decodeURIComponent(ruta.slice(15))).run();
    return json({ ok: true });
  }
  if (m === 'PUT' && ruta === '/avisos') {
    const avisos = validarAvisos((await cuerpo(peticion)).avisos);
    await n.poner('avisos', avisos);
    return json(avisos);
  }
  if (m === 'PUT' && ruta === '/zona') {
    const { zona } = await cuerpo(peticion);
    if (!zonaValida(zona)) throw new ErrorHttp(400, 'Zona horaria no válida.');
    await n.poner('zona', zona);
    return json({ ok: true });
  }
  if (m === 'PUT' && ruta === '/groq') {
    const { clave } = await cuerpo(peticion);
    if (clave === null) await n.quitar('groq');
    else if (typeof clave === 'string' && /^gsk_[A-Za-z0-9]{20,100}$/.test(clave.trim())) await n.poner('groq', await cifrarTexto(clave.trim(), env.CLAVE_CIFRADO));
    else throw new ErrorHttp(400, 'Esa no parece una clave de Groq (gsk_…).');
    return json({ ok: true });
  }
  if (m === 'PUT' && ruta === '/openai') {
    const { clave } = await cuerpo(peticion);
    if (clave === null) await n.quitar('openai');
    else if (typeof clave === 'string' && /^sk-[A-Za-z0-9_-]{20,300}$/.test(clave.trim())) await n.poner('openai', await cifrarTexto(clave.trim(), env.CLAVE_CIFRADO));
    else throw new ErrorHttp(400, 'Esa no parece una clave de OpenAI (sk-…).');
    return json({ ok: true });
  }
  if (m === 'GET' && ruta === '/consumo') return json({ meses: (await n.ajustes()).consumoOpenAI ?? {} });
  if (m === 'GET' && ruta === '/automatizaciones') return json(await n.automatizaciones());
  if (m === 'POST' && ruta === '/automatizaciones') return guardarAutomatizacion(n, peticion);
  if (ruta.startsWith('/automatizaciones/')) {
    const id = decodeURIComponent(ruta.slice(18));
    if (m === 'PUT') return guardarAutomatizacion(n, peticion, id);
    if (m === 'DELETE') {
      await n.db.prepare('DELETE FROM automatizaciones WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  if (m === 'GET' && ruta === '/registro') {
    const { results } = await n.db.prepare('SELECT cuando, tipo, texto FROM registro ORDER BY id DESC LIMIT 60').all();
    return json(results);
  }
  if (m === 'DELETE' && ruta.startsWith('/dispositivos/')) {
    await n.db.prepare('DELETE FROM dispositivos WHERE id = ?').bind(decodeURIComponent(ruta.slice(14))).run();
    return json({ ok: true });
  }
  if (m === 'POST' && ruta === '/desvincular') return desvincular(n);
  if (ruta === '/sincro' || ruta.startsWith('/sincro/')) {
    const respuesta = await rutaSincro(n, d, m, ruta, { json, ErrorHttp, cuerpo: () => cuerpo(peticion), url });
    if (respuesta) return respuesta;
  }
  // Empleo: los portales de ai-job-search (LinkedIn y freehire), que el
  // navegador no puede consultar directamente.
  if (m === 'POST' && ruta === '/empleo/buscar') {
    const d = await cuerpo(peticion);
    return json(
      await buscarEnPortales({
        puestos: String(d.puestos ?? '').slice(0, 300),
        ubicacion: String(d.ubicacion ?? '').slice(0, 150),
        modalidad: ['remoto', 'híbrido', 'presencial'].includes(d.modalidad) ? d.modalidad : '',
        dias: Math.min(60, Math.max(1, Number(d.dias) || 14)),
      }),
    );
  }
  if (m === 'GET' && ruta === '/empleo/alerta') {
    const a = await n.ajustes();
    return json({ alerta: alertaPublica(a.empleoAlerta), ultimas: a.empleoUltimas ?? null, groq: Boolean(await n.iaServidor()) });
  }
  if (m === 'PUT' && ruta === '/empleo/alerta') {
    try {
      return json({ alerta: await guardarAlerta(n, await cuerpo(peticion)) });
    } catch (error) {
      throw new ErrorHttp(400, error.message);
    }
  }
  if (m === 'POST' && ruta === '/empleo/alerta/probar') {
    return json({ ultimas: await alertaEmpleo(n, { avisar: false }) });
  }
  if (m === 'POST' && ruta === '/empleo/detalle') {
    const { url } = await cuerpo(peticion);
    let direccion;
    try {
      direccion = new URL(String(url ?? ''));
    } catch {
      throw new ErrorHttp(400, 'Dirección no válida.');
    }
    // Solo páginas públicas por https (nada de IPs ni nombres internos).
    if (direccion.protocol !== 'https:' || !/\.[a-z]{2,}$/i.test(direccion.hostname) || /^[\d.]+$|\[/.test(direccion.hostname)) {
      throw new ErrorHttp(400, 'Solo enlaces https de páginas públicas.');
    }
    const oferta = await detalleOferta(direccion.href);
    if (!oferta) throw new ErrorHttp(404, 'La oferta ya no existe.');
    return json(oferta);
  }
  if (m === 'POST' && ruta === '/transcribir') {
    if (!n.env.AI) throw new ErrorHttp(503, 'Este servidor no tiene activada la IA de Cloudflare.');
    const tipo = peticion.headers.get('Content-Type') ?? '';
    const largo = Number(peticion.headers.get('Content-Length') ?? 0);
    if (!/^audio\//.test(tipo) || !peticion.body) throw new ErrorHttp(400, 'Manda el audio grabado.');
    if (largo > MAX_AUDIO) throw new ErrorHttp(413, 'La grabación es demasiado larga.');
    const r = await n.env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: { body: peticion.body, contentType: tipo }, language: 'es', vad_filter: true });
    return json({ texto: limpiarTranscripcion(r?.text ?? '') });
  }
  if (m === 'POST' && ruta === '/voz') {
    if (!n.env.AI) throw new ErrorHttp(503, 'Este servidor no tiene activada la IA de Cloudflare.');
    const { texto, voz, error } = validarVoz(await cuerpo(peticion));
    if (error) throw new ErrorHttp(400, error);
    const { audio, motor } = await sintetizar(n.env.AI, texto, voz);
    return new Response(audio, {
      headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Voz-Motor': motor, 'Access-Control-Expose-Headers': 'X-Voz-Motor' },
    });
  }
  throw new ErrorHttp(404, 'No existe.');
}

export default {
  async fetch(peticion, env) {
    try {
      return await atender(peticion, env);
    } catch (error) {
      if (error instanceof ErrorHttp) return json({ error: error.message }, error.estado);
      return json({ error: error?.message || 'Error inesperado del servidor.' }, 500);
    }
  },
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(revisar(env, Date.now()));
  },
};
