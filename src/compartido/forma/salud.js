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
  if (!m || !esFecha(m[1])) return null;
  const [, fecha, h, mi, s = '0', z] = m;
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  const hora = `${h.padStart(2, '0')}:${mi}`;
  if (!z) return desdeLocal(fecha, hora, zona) + Number(s) * 1000;
  const desfase = z.toUpperCase() === 'Z' ? 'Z' : z.length === 3 ? `${z}:00` : z.includes(':') ? z : `${z.slice(0, 3)}:${z.slice(3)}`;
  const ms = Date.parse(`${fecha}T${hora}:${s.padStart(2, '0')}${desfase}`);
  return Number.isFinite(ms) ? ms : null;
}

// Valida lo que manda el Atajo. Todo o nada: con un solo error no se guarda nada.
// Devuelve { dias, pesaje, fuente, errores: [{ campo, motivo }] }.
export function validarSalud(cuerpo, { zona = 'Europe/Madrid', ahora = Date.now() } = {}) {
  const errores = [];
  const mal = (campo, motivo) => errores.push({ campo, motivo });
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    mal('', 'el cuerpo debe ser un objeto JSON con «dias» y/o «pesaje»');
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
      if (momento === null) mal('pesaje.fecha_hora', 'debe ser una fecha y hora ISO 8601, como 2026-11-20T08:12:00+01:00');
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
