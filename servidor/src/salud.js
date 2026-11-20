// Apple Salud → Forma. El Atajo del iPhone llama a POST /integraciones/salud con
// un token personal (forma_…) que solo vale para /integraciones/…. Lo recibido
// se valida, se cifra hacia la llave pública del buzón (la privada solo está en
// tus dispositivos) y espera en el buzón hasta que la app lo recoge.
// Los dispositivos vinculados gestionan los tokens y recogen el buzón en /salud/….
import { aleatorio, huella } from './cifrado.js';
import { deBase64Url, aBase64Url, utf8 } from './base64.js';
import { validarSalud, cifrarParaBuzon, LLAVE_PUBLICA_VALIDA } from '../../src/compartido/forma/salud.js';

export const LIMITE_POR_HORA = 60;
export const MAX_TOKENS = 10;
const PREFIJO = 'forma_';
const DIAS_VISTOS = 120;
const DIAS_BUZON = 60;

async function hmac(secreto, texto) {
  const clave = await crypto.subtle.importKey('raw', deBase64Url(secreto ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return aBase64Url(await crypto.subtle.sign('HMAC', clave, utf8(`salud|${texto}`)));
}

const tokenPublico = (t) => ({
  id: t.id,
  nombre: t.nombre,
  creado_en: t.creado_en,
  ultimo_uso_en: t.ultimo_uso_en ?? null,
  revocado: Boolean(t.revocado),
});

// ---------- El Atajo: POST /integraciones/salud ----------

export async function rutaIntegraciones(n, peticion, ruta, { json, ErrorHttp, cuerpo, CORS }) {
  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ErrorHttp(401, 'Falta el token: cabecera «Authorization: Bearer forma_…».');
  if (!token.startsWith(PREFIJO)) throw new ErrorHttp(401, 'Token no válido.');
  const fila = await n.db.prepare('SELECT * FROM token_integracion WHERE hash_token = ?').bind(await huella(token)).first();
  if (!fila) throw new ErrorHttp(401, 'Token no válido.');
  if (fila.revocado) throw new ErrorHttp(401, 'Este token está revocado. Genera otro en Forma → Perfil → Integraciones.');

  // Límite sencillo: 60 peticiones por hora (de reloj) y token.
  const hora = Math.floor(n.ahora / 3_600_000);
  const usadas = fila.ventana === hora ? fila.peticiones : 0;
  if (usadas >= LIMITE_POR_HORA) {
    const espera = Math.ceil(((hora + 1) * 3_600_000 - n.ahora) / 1000);
    return new Response(JSON.stringify({ error: `Demasiadas peticiones: como mucho ${LIMITE_POR_HORA} por hora.` }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(espera) },
    });
  }
  await n.db.prepare('UPDATE token_integracion SET ventana = ?, peticiones = ? WHERE id = ?').bind(hora, usadas + 1, fila.id).run();

  // Forma → Apple Salud: lo pendiente de escribir en Salud (se entrega una vez).
  if (ruta === '/integraciones/salud/salida') {
    if (peticion.method !== 'GET') throw new ErrorHttp(405, 'Usa GET.');
    const { results } = await n.db.prepare('SELECT id, tipo, datos FROM salud_salida WHERE entregado IS NULL ORDER BY creado LIMIT 200').all();
    if (results.length) await n.db.batch(results.map((r) => n.db.prepare('UPDATE salud_salida SET entregado = ? WHERE id = ?').bind(n.ahora, r.id)));
    await n.db.prepare('UPDATE token_integracion SET ultimo_uso_en = ? WHERE id = ?').bind(n.ahora, fila.id).run();
    const de = (tipo) => results.filter((r) => r.tipo === tipo).map((r) => JSON.parse(r.datos));
    return json({ comidas: de('comida'), entrenos: de('entreno'), total: results.length });
  }
  if (ruta !== '/integraciones/salud') throw new ErrorHttp(404, 'No existe.');
  if (peticion.method !== 'POST') throw new ErrorHttp(405, 'Usa POST.');

  const publica = (await n.ajustes()).saludPublica;
  if (!publica) throw new ErrorHttp(409, 'El buzón no está preparado: abre Forma en la app y vuelve a generar el token.');

  const zona = await n.zona();
  const v = validarSalud(await cuerpo(peticion), { zona, ahora: n.ahora });
  if (v.errores.length) {
    const [primero] = v.errores;
    return json({ ...(v.avisos?.length ? { avisos: v.avisos } : {}), error: `${primero.campo ? `${primero.campo}: ` : ''}${primero.motivo}`, campo: primero.campo, motivo: primero.motivo, errores: v.errores }, 400);
  }

  const sentencias = [];
  // Pasos y sueño: uno de cada por día (por separado, para que uno no pise al
  // otro). Si ese día aún no se ha recogido, se reemplaza.
  for (const dia of v.dias) {
    for (const [tipo, campo] of [
      ['pasos', 'pasos'],
      ['sueno', 'sueno'],
    ]) {
      if (!Number.isFinite(dia[campo])) continue;
      const sobre = JSON.stringify(await cifrarParaBuzon(publica, { fuente: v.fuente, dias: [{ fecha: dia.fecha, [campo]: dia[campo] }] }));
      sentencias.push(
        n.db
          .prepare('INSERT INTO buzon_salud (id, clave, recibido, sobre) VALUES (?, ?, ?, ?) ON CONFLICT(clave) DO UPDATE SET recibido = excluded.recibido, sobre = excluded.sobre')
          .bind(`s${aleatorio(9)}`, await hmac(n.env.CLAVE_CIFRADO, `${tipo}|${dia.fecha}`), n.ahora, sobre),
      );
    }
  }
  // Pesaje: si ya llegó uno igual (±1 minuto y mismo peso), no se guarda otra vez.
  let pesaje = 'no_enviado';
  if (v.pesaje) {
    const minuto = Math.floor(v.pesaje.momento / 60_000);
    const kg = v.pesaje.kg.toFixed(2);
    const claves = await Promise.all([minuto - 1, minuto, minuto + 1].map((m) => hmac(n.env.CLAVE_CIFRADO, `peso|${m}|${kg}`)));
    const visto = await n.db.prepare('SELECT clave FROM salud_vistos WHERE clave IN (?, ?, ?)').bind(...claves).first();
    if (visto) pesaje = 'duplicado';
    else {
      pesaje = 'guardado';
      const sobre = JSON.stringify(await cifrarParaBuzon(publica, { fuente: v.fuente, pesaje: v.pesaje }));
      sentencias.push(n.db.prepare('INSERT INTO buzon_salud (id, clave, recibido, sobre) VALUES (?, NULL, ?, ?)').bind(`s${aleatorio(9)}`, n.ahora, sobre));
      sentencias.push(n.db.prepare('INSERT OR IGNORE INTO salud_vistos (clave, cuando) VALUES (?, ?)').bind(claves[1], n.ahora));
    }
  }
  // Resumen del envío (para «Última sincronización» en la app), también cifrado.
  const resumen = JSON.stringify(await cifrarParaBuzon(publica, { tipo: 'resumen', fuente: v.fuente, dias: v.dias, pesaje: v.pesaje, resultado: pesaje }));
  sentencias.push(
    n.db
      .prepare('INSERT INTO buzon_salud (id, clave, recibido, sobre) VALUES (?, ?, ?, ?) ON CONFLICT(clave) DO UPDATE SET recibido = excluded.recibido, sobre = excluded.sobre')
      .bind(`s${aleatorio(9)}`, await hmac(n.env.CLAVE_CIFRADO, 'resumen'), n.ahora, resumen),
  );
  sentencias.push(n.db.prepare('UPDATE token_integracion SET ultimo_uso_en = ? WHERE id = ?').bind(n.ahora, fila.id));
  await n.db.batch(sentencias);
  // Avisos (claves que no se reconocen, campos vacíos): ayudan a arreglar el Atajo.
  const sueno = v.dias.some((d) => Number.isFinite(d.sueno));
  return json({ pasos_guardados: v.dias.filter((d) => Number.isFinite(d.pasos)).length, pesaje, ...(sueno ? { sueno: 'guardado' } : {}), ...(v.avisos?.length ? { avisos: v.avisos } : {}) });
}

// ---------- Los dispositivos: tokens y buzón ----------

export async function rutaSaludDispositivo(n, m, ruta, { json, ErrorHttp, cuerpo, peticion }) {
  if (m === 'GET' && ruta === '/salud/tokens') {
    const { results } = await n.db.prepare('SELECT * FROM token_integracion ORDER BY creado_en DESC').all();
    const pendientes = await n.db.prepare('SELECT COUNT(*) AS total, MAX(recibido) AS ultimo FROM buzon_salud').first();
    return json({ tokens: results.map(tokenPublico), llave: (await n.ajustes()).saludPublica ?? null, pendientes: pendientes?.total ?? 0 });
  }
  if (m === 'POST' && ruta === '/salud/tokens') {
    const d = await cuerpo(peticion);
    const nombre = String(d.nombre ?? '').trim().slice(0, 40) || 'Atajo iPhone';
    if (typeof d.publica !== 'string' || !LLAVE_PUBLICA_VALIDA.test(d.publica)) throw new ErrorHttp(400, 'Falta la llave pública del buzón.');
    const activos = await n.db.prepare('SELECT COUNT(*) AS total FROM token_integracion WHERE revocado = 0').first();
    if ((activos?.total ?? 0) >= MAX_TOKENS) throw new ErrorHttp(400, `Como mucho ${MAX_TOKENS} tokens activos: revoca alguno.`);
    await n.poner('saludPublica', d.publica);
    const token = `${PREFIJO}${aleatorio(32)}`;
    const fila = { id: `t${aleatorio(9)}`, nombre, creado_en: n.ahora, ultimo_uso_en: null, revocado: 0 };
    await n.db
      .prepare('INSERT INTO token_integracion (id, nombre, hash_token, creado_en, revocado) VALUES (?, ?, ?, ?, 0)')
      .bind(fila.id, fila.nombre, await huella(token), fila.creado_en)
      .run();
    await n.registrar('salud', `Token de integración creado: ${nombre}.`);
    // El token en claro solo sale aquí, una vez.
    return json({ token, ...tokenPublico(fila) });
  }
  if (m === 'DELETE' && ruta.startsWith('/salud/tokens/')) {
    const id = decodeURIComponent(ruta.slice('/salud/tokens/'.length));
    await n.db.prepare('UPDATE token_integracion SET revocado = 1 WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }
  if (m === 'GET' && ruta === '/salud/buzon') {
    const { results } = await n.db.prepare('SELECT id, recibido, sobre FROM buzon_salud ORDER BY recibido LIMIT 200').all();
    return json({ entregas: results.map((r) => ({ id: r.id, recibido: r.recibido, sobre: JSON.parse(r.sobre) })) });
  }
  if (m === 'POST' && ruta === '/salud/buzon/recoger') {
    const { ids } = await cuerpo(peticion);
    const lista = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && /^s[A-Za-z0-9_-]{6,20}$/.test(x)).slice(0, 200) : [];
    if (lista.length) await n.db.batch(lista.map((id) => n.db.prepare('DELETE FROM buzon_salud WHERE id = ?').bind(id)));
    return json({ ok: true, borradas: lista.length });
  }
  // Lo que la app quiere escribir en Apple Salud. Lo ya entregado no se toca;
  // lo pendiente se actualiza (por si corregiste algo antes de que llegara).
  if (m === 'POST' && ruta === '/salud/salida') {
    const { items } = await cuerpo(peticion);
    if (!Array.isArray(items) || items.length > 200) throw new ErrorHttp(400, 'Lista no válida.');
    const validos = items.filter(
      (x) => x && /^(comida|entreno):[A-Za-z0-9_-]{1,60}$/.test(x.id) && ['comida', 'entreno'].includes(x.tipo) && x.id.startsWith(`${x.tipo}:`) && x.datos && typeof x.datos === 'object' && JSON.stringify(x.datos).length <= 2000,
    );
    if (validos.length) {
      await n.db.batch(
        validos.map((x) =>
          n.db
            .prepare('INSERT INTO salud_salida (id, tipo, datos, creado, entregado) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET datos = excluded.datos WHERE salud_salida.entregado IS NULL')
            .bind(x.id, x.tipo, JSON.stringify(x.datos), n.ahora),
        ),
      );
    }
    const pendientes = await n.db.prepare('SELECT COUNT(*) AS total FROM salud_salida WHERE entregado IS NULL').first();
    return json({ ok: true, guardados: validos.length, pendientes: pendientes?.total ?? 0 });
  }
  // Lo que borraste en la app: se quita si el Atajo aún no lo había recogido.
  if (m === 'POST' && ruta === '/salud/salida/borrar') {
    const { ids } = await cuerpo(peticion);
    const lista = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && /^(comida|entreno):[A-Za-z0-9_-]{1,60}$/.test(x)).slice(0, 200) : [];
    if (lista.length) await n.db.batch(lista.map((idItem) => n.db.prepare('DELETE FROM salud_salida WHERE id = ? AND entregado IS NULL').bind(idItem)));
    return json({ ok: true, borrados: lista.length });
  }
  // Al desactivarlo en la app: se borra lo que no se haya entregado.
  if (m === 'DELETE' && ruta === '/salud/salida') {
    await n.db.prepare('DELETE FROM salud_salida WHERE entregado IS NULL').run();
    return json({ ok: true });
  }
  return null;
}

// Limpieza (una vez por hora, desde la revisión).
export const limpiezaSalud = (n, ahora) => [
  n.db.prepare('DELETE FROM salud_vistos WHERE cuando < ?').bind(ahora - DIAS_VISTOS * 86_400_000),
  n.db.prepare('DELETE FROM buzon_salud WHERE recibido < ?').bind(ahora - DIAS_BUZON * 86_400_000),
  n.db.prepare('DELETE FROM salud_salida WHERE creado < ?').bind(ahora - 30 * 86_400_000),
];
