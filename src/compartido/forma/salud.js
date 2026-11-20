// Apple Salud → Forma. Un Atajo del iPhone manda al servidor los pasos de cada
// día y el último pesaje de la báscula (Renpho, por Salud). El servidor lo valida
// con validarSalud, lo cifra con la llave pública del buzón (solo tus
// dispositivos tienen la privada) y lo guarda hasta que la app lo recoge.
// La app lo descifra, lo vuelve a validar y lo aplica con aplicarSalud.
import { esFecha, sumarDias } from './fechas.js';
import { partesLocales, desdeLocal } from '../horas.js';
import { id } from './datos.js';
import { revisarHitos, pesoDeReferencia } from './progreso.js';
import { kcalEjercicio, TIPOS_ENTRENO } from './calculos.js';
import { duracionSesion, kcalNetasCardio } from './entreno.js';

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

// Sueño en minutos desde lo que mande el Atajo: «7,3» (horas), «440» (minutos),
// «26400» (segundos), «7 h 20 min», «07:20». enHoras: el campo dice que son horas.
export const MAX_SUENO_MIN = 1440;
export function minutosSueno(v, { enHoras = false } = {}) {
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    let m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    m = /^(\d+(?:[.,]\d+)?)\s*h(?:oras?|rs?)?\.?\s*(?:y\s*)?(?:(\d{1,2})\s*(?:min(?:utos?)?|m)?\.?)?$/.exec(t);
    if (m) return Math.round(Number(m[1].replace(',', '.')) * 60 + Number(m[2] ?? 0));
    m = /^(\d+)\s*min(?:utos?)?\.?$/.exec(t);
    if (m) return Number(m[1]);
  }
  const n = numeroTolerante(v);
  if (!Number.isFinite(n)) return NaN;
  if (enHoras || n <= 24) return Math.round(n * 60);
  if (n <= MAX_SUENO_MIN) return Math.round(n);
  if (n <= 86_400) return Math.round(n / 60);
  return NaN;
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
// { pasos_hoy, pasos_ayer, peso_kg, grasa_pct, masa_magra_kg, fecha_peso, sueno_horas }.
// Lo vacío se ignora: sin peso no hay pesaje, pero los pasos se guardan igual.
// Acepta también los nombres que suele poner Siri («peso», «grasa_corporal»,
// «masa_magra»…), y avisa de lo que llega vacío o no reconoce.
const ALIAS = {
  pasos_hoy: ['pasos_hoy', 'pasoshoy', 'pasos_de_hoy', 'steps_today'],
  pasos_ayer: ['pasos_ayer', 'pasosayer', 'pasos_de_ayer', 'steps_yesterday'],
  peso_kg: ['peso_kg', 'pesokg', 'peso', 'peso_corporal', 'weight', 'weight_kg'],
  grasa_pct: ['grasa_pct', 'grasa', 'grasa_corporal', 'grasa_corporal_pct', 'porcentaje_grasa', 'porcentaje_de_grasa', 'porcentaje_grasa_corporal', 'porcentaje_de_grasa_corporal', 'body_fat', 'body_fat_pct'],
  masa_magra_kg: ['masa_magra_kg', 'masa_magra', 'magra', 'masa_corporal_magra', 'masa_corporal_magra_kg', 'lean_body_mass', 'lean_mass_kg'],
  fecha_peso: ['fecha_peso', 'fecha_pesaje', 'fecha_del_peso', 'fecha_hora', 'fecha_hora_peso', 'fecha'],
  // Lo que dormiste la última noche (cuenta para hoy).
  sueno: ['sueno', 'sueno_min', 'sueno_minutos', 'minutos_sueno', 'minutos_de_sueno', 'sueno_horas', 'horas_sueno', 'horas_de_sueno', 'horas_dormidas', 'dormido', 'analisis_del_sueno', 'sleep', 'sleep_minutes', 'sleep_hours'],
};
const CANONICA = new Map(Object.entries(ALIAS).flatMap(([k, lista]) => lista.map((a) => [a, k])));
const claveLimpia = (k) =>
  String(k)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
export const esPlano = (c) => Boolean(c) && typeof c === 'object' && !Array.isArray(c) && c.dias === undefined && c.pesaje === undefined && Object.keys(c).some((k) => CANONICA.has(claveLimpia(k)));

export function desdePlano(entrada, { zona = 'Europe/Madrid', ahora = Date.now() } = {}) {
  // Nombres de Siri → los nuestros (recordando cómo los mandaste, para los mensajes).
  const c = {};
  const nombre = {};
  const avisos = [];
  for (const [k, v] of Object.entries(entrada)) {
    if (k === 'fuente') continue;
    const canonica = CANONICA.get(claveLimpia(k));
    if (!canonica) avisos.push(`«${k}» no se reconoce: se ignora`);
    else if (!(canonica in c) || (vacio(c[canonica]) && !vacio(v))) {
      c[canonica] = v;
      nombre[canonica] = k;
    }
  }
  const llamado = (k) => nombre[k] ?? k;
  const hoy = partesLocales(ahora, zona).fecha;
  const dias = [];
  const origen = [];
  for (const [clave, fecha] of [
    ['pasos_ayer', sumarDias(hoy, -1)],
    ['pasos_hoy', hoy],
  ]) {
    if (vacio(c[clave])) {
      avisos.push(clave in c ? `«${llamado(clave)}» llegó vacío` : `no ha llegado «${clave}»`);
      continue;
    }
    dias.push({ fecha, pasos: c[clave] });
    origen.push(llamado(clave));
  }
  // Sueño: la noche que acaba hoy. «sueno_horas» → horas; si no, se deduce.
  if ('sueno' in c) {
    if (vacio(c.sueno)) avisos.push(`«${llamado('sueno')}» llegó vacío`);
    else {
      const hoyDia = dias.find((x) => x.fecha === hoy);
      const enHoras = /hora|hours/.test(claveLimpia(llamado('sueno')));
      if (hoyDia) hoyDia.sueno_min = { valor: c.sueno, enHoras };
      else {
        dias.push({ fecha: hoy, sueno_min: { valor: c.sueno, enHoras } });
        origen.push(llamado('sueno'));
      }
    }
  }
  const cuerpo = { fuente: entrada.fuente };
  if (dias.length) cuerpo.dias = dias;
  if (!vacio(c.peso_kg)) {
    cuerpo.pesaje = { fecha_hora: vacio(c.fecha_peso) ? undefined : c.fecha_peso, peso_kg: c.peso_kg };
    if (!vacio(c.grasa_pct)) cuerpo.pesaje.grasa_pct = c.grasa_pct;
    if (!vacio(c.masa_magra_kg)) cuerpo.pesaje.masa_magra_kg = c.masa_magra_kg;
  } else if ('peso_kg' in c) avisos.push(`«${llamado('peso_kg')}» llegó vacío: sin peso en las últimas 24 h no se guarda pesaje`);
  else if (!vacio(c.grasa_pct) || !vacio(c.masa_magra_kg)) avisos.push('falta el peso («peso_kg»): sin él no se guarda el pesaje');
  // Para que los errores digan el nombre del campo que mandaste.
  const CAMPO = { 'pesaje.fecha_hora': 'fecha_peso', 'pesaje.peso_kg': 'peso_kg', 'pesaje.grasa_pct': 'grasa_pct', 'pesaje.masa_magra_kg': 'masa_magra_kg' };
  const campo = (x) => (CAMPO[x] ? llamado(CAMPO[x]) : /\.sueno_min$/.test(x) ? llamado('sueno') : x.replace(/^dias\[(\d+)\]\.(pasos|fecha)$/, (_, i) => origen[Number(i)] ?? x));
  return { cuerpo, campo, avisos };
}

// Valida lo que manda el Atajo. Todo o nada: con un solo error no se guarda nada.
// Devuelve { dias, pesaje, fuente, errores: [{ campo, motivo }] }.
export function validarSalud(cuerpo, { zona = 'Europe/Madrid', ahora = Date.now() } = {}) {
  if (esPlano(cuerpo)) {
    const { cuerpo: completo, campo, avisos } = desdePlano(cuerpo, { zona, ahora });
    const v = validarSalud(completo, { zona, ahora });
    return { ...v, avisos, errores: v.errores.map((e) => ({ ...e, campo: campo(e.campo) })) };
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
        const hayPasos = !(d.pasos === undefined || d.pasos === null || d.pasos === '');
        // sueno_min: número (o texto) o { valor, enHoras } desde el formato plano.
        const crudoSueno = d.sueno_min && typeof d.sueno_min === 'object' ? d.sueno_min.valor : d.sueno_min;
        const haySueno = !(crudoSueno === undefined || crudoSueno === null || crudoSueno === '');
        if (!hayPasos && !haySueno) return mal(`${campo}.pasos`, 'falta el número de pasos (o el sueño)');
        const dia = { ...porFecha.get(fecha) };
        if (hayPasos) {
          const pasos = numeroTolerante(d.pasos, { entero: true });
          if (!Number.isFinite(pasos)) return mal(`${campo}.pasos`, 'debe ser un número');
          if (pasos < 0 || pasos > MAX_PASOS) return mal(`${campo}.pasos`, `debe estar entre 0 y ${miles(MAX_PASOS)}`);
          dia.pasos = Math.round(pasos);
        }
        if (haySueno) {
          const min = minutosSueno(crudoSueno, { enHoras: Boolean(d.sueno_min?.enHoras) });
          if (!Number.isFinite(min)) return mal(`${campo}.sueno_min`, 'debe ser una duración: horas («7,5»), minutos («450») o «7 h 30 min»');
          if (min < 30 || min > MAX_SUENO_MIN) return mal(`${campo}.sueno_min`, 'debe estar entre 30 minutos y 24 horas');
          dia.sueno = min;
        }
        porFecha.set(fecha, dia);
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
  if (!errores.length && !porFecha.size && !pesaje) mal('', 'no hay nada que guardar: manda «dias» con pasos (o sueño) o un «pesaje»');
  const dias = [...porFecha].map(([fecha, d]) => ({ fecha, ...d })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
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
    dias: Array.isArray(entrega?.dias) ? entrega.dias.map((d) => ({ fecha: d?.fecha, pasos: d?.pasos, sueno_min: d?.sueno })) : entrega?.dias,
    pesaje: entrega?.pesaje ? { fecha_hora: new Date(entrega.pesaje.momento).toISOString(), peso_kg: entrega.pesaje.kg, grasa_pct: entrega.pesaje.grasa, masa_magra_kg: entrega.pesaje.magra } : undefined,
  };
  const v = validarSalud(cuerpo, { zona, ahora: Math.max(ahora, Number(entrega?.recibido) || 0) });
  if (v.errores.length) return { datos, resultado: { pasos: 0, pesaje: 'no_valido', errores: v.errores } };
  const fuente = v.fuente;
  const dias = { ...datos.dias };
  for (const d of v.dias) {
    const dia = { agua: 0, suplementos: [], ...dias[d.fecha] };
    if (Number.isFinite(d.pasos)) Object.assign(dia, { pasos: d.pasos, pasosFuente: fuente });
    if (Number.isFinite(d.sueno)) Object.assign(dia, { sueno: d.sueno, suenoFuente: fuente });
    dias[d.fecha] = dia;
  }
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
  return { datos: nuevo, resultado: { pasos: v.dias.filter((d) => Number.isFinite(d.pasos)).length, sueno: v.dias.filter((d) => Number.isFinite(d.sueno)).length, pesaje: estadoPesaje, errores: [] } };
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

// ---------- Forma → Apple Salud ----------
// Si lo activas, cada comida que apuntas y cada entreno que terminas salen hacia
// tu servidor (sin cifrar: el Atajo no sabe descifrar) en cuanto se guardan; el
// Atajo los recoge (de noche, con su automatización) y los escribe en Salud.
// Si los corriges o borras antes de que el Atajo los recoja, se actualizan o se
// quitan; lo ya recogido no cambia. Se miran los últimos 7 días.
export const DIAS_EXPORTAR = 7;
const r1 = (n) => Math.round(n * 10) / 10;
const idSeguro = (x) => String(x).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
// Firma corta del contenido: si cambia, se vuelve a mandar (si aún no se recogió).
export function firma(objeto) {
  let h = 5381;
  for (const c of JSON.stringify(objeto)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
const enviados = (datos) => {
  const mapa = new Map();
  for (const x of datos.integracion?.subidos ?? []) {
    const [idItem, f = ''] = x.split('#');
    mapa.set(idItem, f);
  }
  return mapa;
};

function todosParaSalud(datos, { hoy, zona = datos.perfil?.zona ?? 'Europe/Madrid' }) {
  const desde = sumarDias(hoy, -DIAS_EXPORTAR);
  const items = [];
  // Cada comida apuntada, con su hora.
  for (const reg of datos.registros) {
    if (reg.fecha < desde || reg.fecha > hoy || !idSeguro(reg.id)) continue;
    const hora = `${String(Math.floor((reg.minuto ?? 720) / 60)).padStart(2, '0')}:${String((reg.minuto ?? 720) % 60).padStart(2, '0')}`;
    items.push({
      id: `comida:${idSeguro(reg.id)}`,
      tipo: 'comida',
      datos: {
        fecha: reg.fecha,
        fecha_hora: new Date(desdeLocal(reg.fecha, hora, zona)).toISOString(),
        nombre: String(reg.nombre ?? 'Comida').slice(0, 80),
        kcal: Math.round(reg.kcal ?? 0),
        proteina_g: r1(reg.proteina ?? 0),
        hidratos_g: r1(reg.hidratos ?? 0),
        grasa_g: r1(reg.grasa ?? 0),
        fibra_g: r1(reg.fibra ?? 0),
      },
    });
  }
  // Entrenos terminados (no el que está en marcha).
  const peso = pesoDeReferencia(datos, hoy) ?? datos.perfil?.peso ?? 75;
  for (const s of datos.sesiones) {
    if (s.fecha < desde || s.fecha > hoy || datos.activa?.id === s.id || !idSeguro(s.id)) continue;
    const cardio = s.cardio ?? [];
    const minCardio = cardio.reduce((t, c) => t + (c.minutos ?? 0), 0);
    const minutos = duracionSesion(s) ?? Math.max(minCardio, s.series.length ? 60 : 0);
    if (!minutos) continue;
    const inicio = s.inicio || desdeLocal(s.fecha, '18:00', zona);
    const met = TIPOS_ENTRENO.find((t) => t.id === 'pesas')?.met ?? 5;
    const kcal = kcalEjercicio(met, peso, Math.max(0, minutos - minCardio)) + cardio.reduce((t, c) => t + kcalNetasCardio(c, peso), 0);
    items.push({
      id: `entreno:${idSeguro(s.id)}`,
      tipo: 'entreno',
      datos: {
        nombre: s.nombre || 'Entreno',
        tipo: s.series.length ? 'fuerza' : 'cardio',
        inicio: new Date(inicio).toISOString(),
        fin: new Date(s.fin || inicio + minutos * 60_000).toISOString(),
        minutos,
        kcal: Math.round(kcal),
      },
    });
  }
  return items;
}

// Lo nuevo o cambiado desde el último envío, y lo enviado que ya no existe.
export function itemsParaSalud(datos, opciones) {
  const ya = enviados(datos);
  return todosParaSalud(datos, opciones)
    .filter((x) => ya.get(x.id) !== firma(x.datos))
    .slice(0, 200);
}

export function borradosParaSalud(datos, opciones) {
  const vivos = new Set(todosParaSalud(datos, opciones).map((x) => x.id));
  const ya = enviados(datos);
  const existe = (idItem) => {
    const [tipo, id] = idItem.split(':');
    return tipo === 'comida' ? datos.registros.some((r) => idSeguro(r.id) === id) : datos.sesiones.some((x) => idSeguro(x.id) === id);
  };
  // Solo lo que ya no existe (no lo que simplemente ha salido de los 7 días).
  return [...ya.keys()].filter((idItem) => !vivos.has(idItem) && !existe(idItem));
}

// Anota lo enviado (con su firma) y olvida lo borrado; se recuerdan los 600 últimos.
export function marcarSubidos(datos, items = [], borrados = []) {
  const ya = enviados(datos);
  for (const idItem of borrados) ya.delete(idItem);
  for (const x of items) {
    ya.delete(x.id);
    ya.set(x.id, x.datos ? firma(x.datos) : '');
  }
  const subidos = [...ya].map(([idItem, f]) => (f ? `${idItem}#${f}` : idItem)).slice(-600);
  return { ...datos, integracion: { ...datos.integracion, subidos } };
}

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
  let sueno = 0;
  for (const { ids, ...envio } of envios.values()) {
    const r = aplicarSalud(datos, envio, { ahora: ahora() });
    datos = r.datos;
    pasos += r.resultado.pasos;
    sueno += r.resultado.sueno ?? 0;
    if (r.resultado.pesaje === 'guardado') pesajes++;
    hechas.push(...ids);
  }
  if (hechas.length) {
    await guardar(datos);
    await cliente.saludRecogidas(hechas);
  }
  return { recogidas: hechas.length, pasos, pesajes, sueno, datos };
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
    // Forma → Apple Salud: sube lo nuevo (si está activado) y lo marca como enviado.
    async exportar({ hoy } = {}) {
      if (!(await vinculado())) return { enviados: 0, vinculado: false };
      let datos = await leer();
      if (!datos.integracion?.exportar) return { enviados: 0 };
      const items = itemsParaSalud(datos, { hoy });
      const borrados = borradosParaSalud(datos, { hoy });
      if (!items.length && !borrados.length) return { enviados: 0, borrados: 0 };
      const c = await cliente();
      let r = {};
      if (items.length) r = await c.saludSalida(items);
      if (borrados.length) await c.borrarSaludSalida(borrados);
      datos = marcarSubidos(await leer(), items, borrados);
      await guardar(datos);
      return { enviados: items.length, borrados: borrados.length, pendientes: r.pendientes ?? null, subidos: datos.integracion.subidos, datos };
    },
    async vaciarSalida() {
      if (!(await vinculado())) return { ok: true };
      return (await cliente()).vaciarSaludSalida();
    },
  };
}
