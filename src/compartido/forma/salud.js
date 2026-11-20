// Apple Salud → Forma. Un Atajo del iPhone manda al servidor los pasos de cada
// día y el último pesaje de la báscula (Renpho, por Salud). El servidor lo valida
// con validarSalud, lo cifra con la llave pública del buzón (solo tus
// dispositivos tienen la privada) y lo guarda hasta que la app lo recoge.
// La app lo descifra, lo vuelve a validar y lo aplica con aplicarSalud.
import { esFecha, sumarDias } from './fechas.js';
import { partesLocales, desdeLocal } from '../horas.js';
import { id } from './datos.js';
import { revisarHitos } from './progreso.js';

export const FUENTE_SALUD = 'apple_salud';
export const MAX_PASOS = 100_000;
export const MAX_DIAS = 31;
export const RANGO_PESO = [30, 300];
export const RANGO_GRASA = [3, 60];
export const RANGO_MAGRA = [10, 200];
// Dos pesajes son el mismo si se separan menos de un minuto y pesan igual.
export const MARGEN_DUPLICADO_MS = 60_000;

const miles = (n) => n.toLocaleString('es-ES');

// Número de JSON o texto: «77,55», «77.55», «77,55 kg», «22,9 %», «11.234» (pasos).
// entero: los puntos o comas de miles se quitan («11.234» → 11234).
export function numeroTolerante(v, { entero = false } = {}) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const t = v.replace(/[\s  ]/g, '');
  const m = /^([-+]?[\d.,]+)[a-z%]*$/i.exec(t);
  if (!m) return NaN;
  let s = m[1];
  if (entero && /^[-+]?\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // El último separador es el decimal; el otro, de miles.
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma >= 0) {
    if (s.indexOf(',') !== coma) return NaN;
    s = s.replace(',', '.');
  } else if (punto >= 0 && s.indexOf('.') !== punto) {
    return NaN;
  }
  return s === '' || s === '.' ? NaN : Number(s);
}

// «2026-11-20T08:12:00+01:00», «2026-11-20T07:12:00Z», «2026-11-20 08:12»…
// Sin zona, se entiende en la del usuario. Devuelve milisegundos o null.
export function momentoDe(texto, zona) {
  if (typeof texto !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(texto.trim());
  if (!m) return momentoEspanol(texto, zona);
  if (!esFecha(m[1])) return null;
  const [, fecha, h, mi, s = '0', z] = m;
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  const hora = `${h.padStart(2, '0')}:${mi}`;
  if (!z) return desdeLocal(fecha, hora, zona) + Number(s) * 1000;
  const desfase = z.toUpperCase() === 'Z' ? 'Z' : z.length === 3 ? `${z}:00` : z.includes(':') ? z : `${z.slice(0, 3)}:${z.slice(3)}`;
  const ms = Date.parse(`${fecha}T${hora}:${s.padStart(2, '0')}${desfase}`);
  return Number.isFinite(ms) ? ms : null;
}

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const dos = (n) => String(n).padStart(2, '0');

// Las fechas como las escribe un iPhone en español si no se formatean:
// «20/11/2026, 8:12», «20 nov 2026, 8:12», «20 de noviembre de 2026 a las 8:12:05», «… 8:12 p. m.».
function momentoEspanol(texto, zona) {
  const t = texto.trim().toLowerCase().replace(/[\s\u00a0\u202f]+/g, ' ');
  const hora = String.raw`,?\s*(?:a las\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?`;
  let d;
  let mes;
  let a;
  let resto;
  let m = new RegExp(String.raw`^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})${hora}$`).exec(t);
  if (m) [, d, mes, a, ...resto] = m;
  else {
    m = new RegExp(String.raw`^(\d{1,2})(?: de)? ([a-záéíóú]{3,10})\.?(?: de)? (\d{4})${hora}$`).exec(t);
    if (!m) return null;
    [, d, mes, a, ...resto] = m;
    mes = MESES[mes.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3)];
    if (!mes) return null;
  }
  let [h, mi, sg = '0', ampm] = resto;
  h = Number(h);
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm.startsWith('p') ? 12 : 0);
  }
  const anio = a.length === 2 ? 2000 + Number(a) : Number(a);
  const fecha = `${anio}-${dos(mes)}-${dos(d)}`;
  if (!esFecha(fecha) || h > 23 || Number(mi) > 59 || Number(sg) > 59) return null;
  return desdeLocal(fecha, `${dos(h)}:${mi}`, zona) + Number(sg) * 1000;
}

// Formato plano, más fácil de montar en Atajos (sin listas ni fechas de los días):
// { pasos_hoy, pasos_ayer, peso_kg, grasa_pct, masa_magra_kg, fecha_peso }.
// Lo vacío se ignora: sin peso no hay pesaje, pero los pasos se guardan igual.
const PLANOS = ['pasos_hoy', 'pasos_ayer', 'peso_kg', 'grasa_pct', 'masa_magra_kg', 'fecha_peso'];
const CAMPO_PLANO = { 'pesaje.fecha_hora': 'fecha_peso', 'pesaje.peso_kg': 'peso_kg', 'pesaje.grasa_pct': 'grasa_pct', 'pesaje.masa_magra_kg': 'masa_magra_kg' };
const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
export const esPlano = (c) => Boolean(c) && typeof c === 'object' && !Array.isArray(c) && c.dias === undefined && c.pesaje === undefined && PLANOS.some((k) => k in c);

export function desdePlano(c, { zona = 'Europe/Madrid', ahora = Date.now() } = {}) {
  const hoy = partesLocales(ahora, zona).fecha;
  const dias = [];
  const origen = [];
  for (const [clave, fecha] of [
    ['pasos_ayer', sumarDias(hoy, -1)],
    ['pasos_hoy', hoy],
  ]) {
    if (vacio(c[clave])) continue;
    dias.push({ fecha, pasos: c[clave] });
    origen.push(clave);
  }
  const cuerpo = { fuente: c.fuente };
  if (dias.length) cuerpo.dias = dias;
  if (!vacio(c.peso_kg)) {
    cuerpo.pesaje = { fecha_hora: vacio(c.fecha_peso) ? undefined : c.fecha_peso, peso_kg: c.peso_kg };
    if (!vacio(c.grasa_pct)) cuerpo.pesaje.grasa_pct = c.grasa_pct;
    if (!vacio(c.masa_magra_kg)) cuerpo.pesaje.masa_magra_kg = c.masa_magra_kg;
  }
  // Para que los errores digan el nombre del campo que mandaste.
  const campo = (x) => CAMPO_PLANO[x] ?? x.replace(/^dias\[(\d+)\]\.(pasos|fecha)$/, (_, i) => origen[Number(i)] ?? x);
  return { cuerpo, campo };
}

// Valida lo que manda el Atajo. Todo o nada: con un solo error no se guarda nada.
// Devuelve { dias, pesaje, fuente, errores: [{ campo, motivo }] }.
export function validarSalud(cuerpo, { zona = 'Europe/Madrid', ahora = Date.now() } = {}) {
  if (esPlano(cuerpo)) {
    const { cuerpo: completo, campo } = desdePlano(cuerpo, { zona, ahora });
    const v = validarSalud(completo, { zona, ahora });
    return { ...v, errores: v.errores.map((e) => ({ ...e, campo: campo(e.campo) })) };
  }
  const errores = [];
  const mal = (campo, motivo) => errores.push({ campo, motivo });
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    mal('', 'el cuerpo debe ser un objeto JSON con «dias» y/o «pesaje» (o con pasos_hoy, pasos_ayer, peso_kg…)');
    return { dias: [], pesaje: null, fuente: FUENTE_SALUD, errores };
  }
  const fuente = typeof cuerpo.fuente === 'string' && /^[a-z0-9_]{1,30}$/.test(cuerpo.fuente) ? cuerpo.fuente : FUENTE_SALUD;
  const hoy = partesLocales(ahora, zona).fecha;

  // Pasos: el total de cada día (si un día llega dos veces, vale el último).
  const porFecha = new Map();
  if (cuerpo.dias !== undefined && cuerpo.dias !== null) {
    if (!Array.isArray(cuerpo.dias)) mal('dias', 'debe ser una lista de { fecha, pasos }');
    else if (cuerpo.dias.length > MAX_DIAS) mal('dias', `como mucho ${MAX_DIAS} días por envío`);
    else {
      cuerpo.dias.forEach((d, i) => {
        const campo = `dias[${i}]`;
        if (!d || typeof d !== 'object') return mal(campo, 'debe ser un objeto { fecha, pasos }');
        // «2026-11-19» (o con hora detrás, que se ignora).
        const crudo = typeof d.fecha === 'string' ? d.fecha.trim() : '';
        const fecha = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(crudo) ? crudo.slice(0, 10) : '';
        if (!esFecha(fecha)) return mal(`${campo}.fecha`, 'debe ser una fecha real con formato aaaa-mm-dd');
        if (fecha > hoy) return mal(`${campo}.fecha`, `es una fecha futura (hoy es ${hoy})`);
        if (d.pasos === undefined || d.pasos === null || d.pasos === '') return mal(`${campo}.pasos`, 'falta el número de pasos');
        const pasos = numeroTolerante(d.pasos, { entero: true });
        if (!Number.isFinite(pasos)) return mal(`${campo}.pasos`, 'debe ser un número');
        if (pasos < 0 || pasos > MAX_PASOS) return mal(`${campo}.pasos`, `debe estar entre 0 y ${miles(MAX_PASOS)}`);
        porFecha.set(fecha, Math.round(pasos));
      });
    }
  }

  let pesaje = null;
  const p = cuerpo.pesaje;
  if (p !== undefined && p !== null) {
    if (typeof p !== 'object' || Array.isArray(p)) mal('pesaje', 'debe ser un objeto { fecha_hora, peso_kg, … }');
    else {
      const momento = momentoDe(p.fecha_hora, zona);
      if (p.fecha_hora === undefined || p.fecha_hora === null || p.fecha_hora === '') mal('pesaje.fecha_hora', 'falta la fecha y hora del pesaje');
      else if (momento === null) mal('pesaje.fecha_hora', 'debe ser una fecha y hora ISO 8601, como 2026-11-20T08:12:00+01:00');
      else if (momento > ahora + 5 * 60_000) mal('pesaje.fecha_hora', 'es una hora futura');
      const kg = numeroTolerante(p.peso_kg);
      if (p.peso_kg === undefined || p.peso_kg === null || p.peso_kg === '') mal('pesaje.peso_kg', 'falta el peso');
      else if (!Number.isFinite(kg)) mal('pesaje.peso_kg', 'debe ser un número');
      else if (kg < RANGO_PESO[0] || kg > RANGO_PESO[1]) mal('pesaje.peso_kg', `debe estar entre ${RANGO_PESO[0]} y ${RANGO_PESO[1]} kg`);
      let grasa;
      if (p.grasa_pct !== undefined && p.grasa_pct !== null && p.grasa_pct !== '') {
        grasa = numeroTolerante(p.grasa_pct);
        // HealthKit da el porcentaje como fracción (0,229 = 22,9 %).
        if (Number.isFinite(grasa) && grasa > 0 && grasa <= 1) grasa *= 100;
        if (!Number.isFinite(grasa)) mal('pesaje.grasa_pct', 'debe ser un número');
        else if (grasa < RANGO_GRASA[0] || grasa > RANGO_GRASA[1]) mal('pesaje.grasa_pct', `debe estar entre ${RANGO_GRASA[0]} y ${RANGO_GRASA[1]} %`);
      }
      let magra;
      if (p.masa_magra_kg !== undefined && p.masa_magra_kg !== null && p.masa_magra_kg !== '') {
        magra = numeroTolerante(p.masa_magra_kg);
        if (!Number.isFinite(magra)) mal('pesaje.masa_magra_kg', 'debe ser un número');
        else if (magra < RANGO_MAGRA[0] || magra > RANGO_MAGRA[1]) mal('pesaje.masa_magra_kg', `debe estar entre ${RANGO_MAGRA[0]} y ${RANGO_MAGRA[1]} kg`);
        else if (Number.isFinite(kg) && magra >= kg) mal('pesaje.masa_magra_kg', 'no puede ser mayor que el peso');
      }
      if (momento !== null && Number.isFinite(kg)) {
        const local = partesLocales(momento, zona);
        pesaje = {
          momento,
          fecha: local.fecha,
          hora: local.hora,
          kg: Math.round(kg * 100) / 100,
          ...(Number.isFinite(grasa) ? { grasa: Math.round(grasa * 10) / 10 } : {}),
          ...(Number.isFinite(magra) ? { magra: Math.round(magra * 100) / 100 } : {}),
        };
      }
    }
  }
  if (!errores.length && !porFecha.size && !pesaje) mal('', 'no hay nada que guardar: manda «dias» con pasos o un «pesaje»');
  const dias = [...porFecha].map(([fecha, pasos]) => ({ fecha, pasos })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return { dias, pesaje: errores.length ? null : pesaje, fuente, errores };
}

export const mismoPesaje = (a, b) =>
  Number.isFinite(a?.momento) && Number.isFinite(b?.momento) && Math.abs(a.momento - b.momento) <= MARGEN_DUPLICADO_MS && Math.abs(a.kg - b.kg) < 0.005;

// Aplica una entrega del buzón a los datos de Forma (ya descifrada).
// entrega: { recibido, fuente, dias: [{ fecha, pasos }], pesaje }.
// Pasos: reemplazan el total del día. Pesaje: se ignora si ya está (±1 min, mismo peso).
export function aplicarSalud(datos, entrega, { zona = datos.perfil?.zona ?? 'Europe/Madrid', ahora = Date.now() } = {}) {
  // Se vuelve a validar aquí: la app no se fía de lo que guarda el servidor.
  const cuerpo = {
    fuente: entrega?.fuente,
    dias: entrega?.dias,
    pesaje: entrega?.pesaje ? { fecha_hora: new Date(entrega.pesaje.momento).toISOString(), peso_kg: entrega.pesaje.kg, grasa_pct: entrega.pesaje.grasa, masa_magra_kg: entrega.pesaje.magra } : undefined,
  };
  const v = validarSalud(cuerpo, { zona, ahora: Math.max(ahora, Number(entrega?.recibido) || 0) });
  if (v.errores.length) return { datos, resultado: { pasos: 0, pesaje: 'no_valido', errores: v.errores } };
  const fuente = v.fuente;
  const dias = { ...datos.dias };
  for (const d of v.dias) dias[d.fecha] = { agua: 0, suplementos: [], ...dias[d.fecha], pasos: d.pasos, pasosFuente: fuente };
  let pesos = datos.pesos;
  let estadoPesaje = 'no_enviado';
  if (v.pesaje) {
    if (pesos.some((x) => mismoPesaje(x, v.pesaje))) estadoPesaje = 'duplicado';
    else {
      pesos = [...pesos, { id: id('w'), ...v.pesaje, fuente }];
      estadoPesaje = 'guardado';
    }
  }
  let nuevo = { ...datos, dias, pesos };
  if (estadoPesaje === 'guardado') nuevo = revisarHitos(nuevo, partesLocales(ahora, zona).fecha).datos;
  return { datos: nuevo, resultado: { pasos: v.dias.length, pesaje: estadoPesaje, errores: [] } };
}

// «Última sincronización»: lo que mandó el Atajo en su último envío (aunque el
// pesaje fuera repetido). Solo se cambia por uno más reciente.
export function anotarUltima(datos, resumen, { ahora = Date.now() } = {}) {
  const recibido = Number(resumen?.recibido);
  if (!Number.isFinite(recibido) || recibido <= (datos.integracion?.ultima?.recibido ?? 0)) return datos;
  const ultima = {
    recibido,
    aplicado: ahora,
    fuente: resumen.fuente ?? FUENTE_SALUD,
    dias: Array.isArray(resumen.dias) ? resumen.dias : [],
    pesaje: resumen.pesaje ?? null,
    resultado: resumen.resultado ?? (resumen.pesaje ? 'guardado' : 'no_enviado'),
  };
  return { ...datos, integracion: { ...datos.integracion, ultima } };
}

// Pasos del día que llegaron de Salud (o null).
export function pasosSincronizados(datos, fecha) {
  const d = datos.dias?.[fecha];
  return Number.isFinite(d?.pasos) ? { pasos: d.pasos, fuente: d.pasosFuente ?? FUENTE_SALUD } : null;
}

// Media de pasos sincronizados de los 7 días anteriores (sin hoy, que va a medias).
export function mediaPasos(datos, hoy, dias = 7) {
  const v = [];
  for (let i = 1; i <= dias; i++) {
    const s = pasosSincronizados(datos, sumarDias(hoy, -i));
    if (s) v.push(s.pasos);
  }
  return v.length >= 3 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

export const NOMBRE_FUENTE = { apple_salud: 'Apple Salud' };
export const nombreFuente = (f) => NOMBRE_FUENTE[f] ?? (f ? String(f).replace(/_/g, ' ') : 'Manual');

// ---------- Buzón cifrado ----------
// El servidor cifra cada entrega con ECDH P-256 (una llave efímera por entrega)
// + HKDF-SHA256 + AES-GCM hacia la llave pública del buzón. La privada vive en
// los datos de Forma, que solo están en tus dispositivos (y viajan cifrados).

const INFO_BUZON = new TextEncoder().encode('kitsune-forma-salud-v1');
const b64 = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = (t) => {
  const n = String(t).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(n + '='.repeat((4 - (n.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
export const LLAVE_PUBLICA_VALIDA = /^[A-Za-z0-9_-]{86,88}$/;

async function claveSimetrica(privada, publica, uso) {
  const compartido = await crypto.subtle.deriveBits({ name: 'ECDH', public: publica }, privada, 256);
  const base = await crypto.subtle.importKey('raw', compartido, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO_BUZON }, base, { name: 'AES-GCM', length: 256 }, false, [uso]);
}

// Par nuevo: la pública (65 bytes, base64url) va al servidor; la privada (JWK), a tus datos.
export async function crearLlaveBuzon() {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { publica: b64(await crypto.subtle.exportKey('raw', par.publicKey)), privada: await crypto.subtle.exportKey('jwk', par.privateKey) };
}

export async function cifrarParaBuzon(publicaB64, objeto) {
  const publica = await crypto.subtle.importKey('raw', deB64(publicaB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const efimera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clave = await claveSimetrica(efimera.privateKey, publica, 'encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(objeto)));
  return { e: b64(await crypto.subtle.exportKey('raw', efimera.publicKey)), iv: b64(iv), datos: b64(datos) };
}

export async function descifrarDelBuzon(privadaJwk, sobre) {
  const privada = await crypto.subtle.importKey('jwk', privadaJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const efimera = await crypto.subtle.importKey('raw', deB64(sobre.e), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const clave = await claveSimetrica(privada, efimera, 'decrypt');
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(sobre.iv) }, clave, deB64(sobre.datos));
  return JSON.parse(new TextDecoder().decode(claro));
}

// ---------- Recoger el buzón (web y Windows) ----------
// cliente: ClienteServidor vinculado. leer/guardar: los datos de Forma.
// Lo que no se puede descifrar aquí (otra llave) se deja para otro dispositivo.
export async function recogerBuzonSalud({ cliente, leer, guardar, ahora = () => Date.now() }) {
  const { entregas = [] } = await cliente.saludBuzon();
  if (!entregas.length) return { recogidas: 0, pasos: 0, pesajes: 0 };
  const inicial = await leer();
  let datos = inicial;
  const privada = datos.integracion?.privada;
  if (!privada) return { recogidas: 0, pasos: 0, pesajes: 0, sinLlave: true };
  // Lo de un mismo envío del Atajo (misma hora de llegada) se aplica junto: así
  // «lo último que llegó» enseña el envío entero (pasos y pesaje).
  const envios = new Map();
  const hechas = [];
  for (const e of [...entregas].sort((a, b) => a.recibido - b.recibido)) {
    let contenido;
    try {
      contenido = await descifrarDelBuzon(privada, e.sobre);
    } catch {
      continue; // de otra llave: lo recogerá otro dispositivo
    }
    if (contenido.tipo === 'resumen') {
      datos = anotarUltima(datos, { ...contenido, recibido: e.recibido }, { ahora: ahora() });
      hechas.push(e.id);
      continue;
    }
    const envio = envios.get(e.recibido) ?? { recibido: e.recibido, fuente: contenido.fuente, dias: [], pesaje: null, ids: [] };
    envio.dias.push(...(Array.isArray(contenido.dias) ? contenido.dias : []));
    if (contenido.pesaje) envio.pesaje = contenido.pesaje;
    envio.ids.push(e.id);
    envios.set(e.recibido, envio);
  }
  let pasos = 0;
  let pesajes = 0;
  for (const { ids, ...envio } of envios.values()) {
    const r = aplicarSalud(datos, envio, { ahora: ahora() });
    datos = r.datos;
    pasos += r.resultado.pasos;
    if (r.resultado.pesaje === 'guardado') pesajes++;
    hechas.push(...ids);
  }
  if (hechas.length) {
    await guardar(datos);
    await cliente.saludRecogidas(hechas);
  }
  return { recogidas: hechas.length, pasos, pesajes, datos };
}

// ---------- API para la pantalla (igual en la web y en Windows) ----------
// cliente(): ClienteServidor con el token del dispositivo. leer/guardar: Forma.
export function crearApiSalud({ cliente, vinculado, leer, guardar }) {
  // La llave del buzón: se crea la primera vez y viaja (cifrada) con tus datos.
  async function llavePublica() {
    const datos = await leer();
    if (datos.integracion?.publica && datos.integracion?.privada) return datos.integracion.publica;
    const par = await crearLlaveBuzon();
    await guardar({ ...datos, integracion: { ...datos.integracion, ...par } });
    return par.publica;
  }
  return {
    async estado() {
      if (!(await vinculado())) return { vinculado: false };
      const c = await cliente();
      const r = await c.saludTokens();
      const propia = (await leer()).integracion?.publica ?? null;
      return { vinculado: true, url: c.urlSalud(), tokens: r.tokens ?? [], pendientes: r.pendientes ?? 0, llaveDistinta: Boolean(r.llave && propia && r.llave !== propia) };
    },
    async crearToken(nombre) {
      const c = await cliente();
      return c.crearTokenSalud(nombre, await llavePublica());
    },
    async revocar(idToken) {
      return (await cliente()).revocarTokenSalud(idToken);
    },
    async recoger() {
      if (!(await vinculado())) return { recogidas: 0, pasos: 0, pesajes: 0, vinculado: false };
      return recogerBuzonSalud({ cliente: await cliente(), leer, guardar });
    },
  };
}
