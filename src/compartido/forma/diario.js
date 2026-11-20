// El diario de comidas: totales del día, objetivo según sea día de entreno o de
// descanso, sugerencias de comidas habituales (Quick Meals), «Qué puedo comer»
// sin IA y los avisos del día.
import { calcularPlan, kcalPasos, pasosDe } from './calculos.js';
import { sumarDias, diasEntre, minutosDe, fechaISO } from './fechas.js';
import { NUTRIENTES } from './datos.js';
import { pesoDeReferencia } from './progreso.js';
import { kcalNetasCardio } from './entreno.js';

const MACROS = ['kcal', 'proteina', 'hidratos', 'grasa', 'fibra'];
const redondea = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Lo que aporta un alimento en esa cantidad de gramos.
export function nutrientesDe(alimento, gramos) {
  const f = gramos / 100;
  const salida = {};
  for (const k of NUTRIENTES) if (Number.isFinite(alimento.por100?.[k])) salida[k] = redondea(alimento.por100[k] * f, k === 'kcal' ? 0 : 1);
  return salida;
}

export const registrosDelDia = (datos, fecha) => datos.registros.filter((r) => r.fecha === fecha);

export function totales(registros) {
  const t = Object.fromEntries(MACROS.map((k) => [k, 0]));
  for (const r of registros) for (const k of MACROS) t[k] += r[k] ?? 0;
  for (const k of MACROS) t[k] = redondea(t[k], k === 'kcal' ? 0 : 1);
  return t;
}

// ¿Ese día es de entreno? Lo marcas tú o se deduce si hay un entreno apuntado.
export function esDiaEntreno(datos, fecha) {
  const marcado = datos.dias[fecha]?.entreno;
  if (typeof marcado === 'boolean') return marcado;
  return datos.sesiones.some((s) => s.fecha === fecha && (s.series.some((x) => !x.calentamiento) || s.cardio.length));
}

// Perfil con el peso de ahora (media de 7 días) para que el plan siga tus cambios.
export function perfilActual(datos, hoy = fechaISO()) {
  if (!datos.perfil) return null;
  const ref = pesoDeReferencia(datos, hoy);
  return ref ? { ...datos.perfil, peso: Math.round(ref * 2) / 2 } : datos.perfil;
}

export function planActual(datos, hoy = fechaISO()) {
  const perfil = perfilActual(datos, hoy);
  return perfil ? calcularPlan(perfil, { bloqueados: datos.bloqueados, hoy }) : null;
}

// Lo que el cardio apuntado ese día suma al gasto: sus kcal netas menos la media
// diaria que tu plan ya incluye por el «cardio a la semana» del perfil (para no
// contarlo dos veces).
export function cardioExtraDelDia(datos, fecha) {
  const cardio = datos.sesiones.filter((s) => s.fecha === fecha).flatMap((s) => s.cardio ?? []);
  if (!cardio.length || !datos.perfil) return 0;
  const peso = pesoDeReferencia(datos, fecha) ?? datos.perfil.peso ?? 75;
  const netas = cardio.reduce((t, c) => t + kcalNetasCardio(c, peso), 0);
  const incluido = 6 * peso * ((datos.perfil.cardioSemana ?? 0) / 7 / 60);
  return Math.max(0, Math.round(netas - incluido));
}

// Pasos de Apple Salud: si ese día llegaron, cuentan los reales en vez de los
// del perfil (la diferencia en kcal). Hoy el día va a medias: solo suma cuando
// ya pasas de lo habitual, nunca resta.
export function pasosExtraDelDia(datos, fecha, hoy = fechaISO()) {
  const dia = datos.dias?.[fecha];
  if (!Number.isFinite(dia?.pasos) || !datos.perfil) return { kcal: 0, pasos: null, fuente: null };
  const peso = pesoDeReferencia(datos, fecha) ?? datos.perfil.peso ?? 75;
  const kcal = Math.round(kcalPasos(dia.pasos, peso) - kcalPasos(pasosDe(datos.perfil), peso));
  return { kcal: fecha >= hoy ? Math.max(0, kcal) : kcal, pasos: dia.pasos, fuente: dia.pasosFuente ?? 'apple_salud' };
}

export function objetivoDelDia(datos, fecha, plan = planActual(datos, fecha), hoy = fechaISO()) {
  if (!plan) return null;
  const entreno = esDiaEntreno(datos, fecha);
  const base = entreno ? plan.entreno : plan.descanso;
  const cardioExtra = cardioExtraDelDia(datos, fecha);
  const pasos = pasosExtraDelDia(datos, fecha, hoy);
  const extra = cardioExtra + pasos.kcal;
  const info = { entreno, cardioExtra, pasosExtra: pasos.kcal, pasos: pasos.pasos, pasosFuente: pasos.fuente };
  // Las kcal de más (o de menos) van a hidratos (el combustible de la actividad).
  if (extra) return { ...base, kcal: base.kcal + extra, hidratos: Math.max(0, Math.round((base.hidratos ?? 0) + extra / 4)), ...info };
  return { ...base, ...info };
}

export function resumenDia(datos, fecha) {
  const registros = registrosDelDia(datos, fecha);
  const comido = totales(registros);
  const objetivo = objetivoDelDia(datos, fecha);
  const quedan = objetivo ? Object.fromEntries(MACROS.map((k) => [k, redondea((objetivo[k] ?? 0) - comido[k], k === 'kcal' ? 0 : 1)])) : null;
  const dia = datos.dias[fecha] ?? { agua: 0, suplementos: [] };
  return { fecha, registros, comido, objetivo, quedan, agua: dia.agua ?? 0, suplementos: dia.suplementos ?? [] };
}

// El momento que toca a esta hora (el más cercano por delante o el último que pasó).
export function momentoPorHora(momentos, minuto) {
  if (!momentos.length) return 'comida';
  let elegido = momentos[0];
  let mejor = Infinity;
  for (const m of momentos) {
    const d = Math.abs(minutosDe(m.hora) - minuto);
    if (d < mejor) {
      mejor = d;
      elegido = m;
    }
  }
  return elegido.id;
}

// ---------- Quick Meals ----------
// Una «comida» es lo que apuntaste en un mismo momento de un día. Se sugiere
// repetirla si la has registrado 3 o más veces en los últimos 14 días a una
// hora parecida (± 1,5 h) y hoy aún no la has apuntado en ese momento.
const VENTANA_DIAS = 14;
const MIN_VECES = 3;
const MARGEN_MIN = 90;

const firmaItem = (r) => r.alimentoId ?? r.nombre.toLowerCase();
const firmaComida = (items) => [...new Set(items.map(firmaItem))].sort().join('+');

export function comidasHabituales(datos, hoy, minutoAhora) {
  const desde = sumarDias(hoy, -VENTANA_DIAS);
  const grupos = new Map();
  for (const r of datos.registros) {
    if (r.fecha < desde || r.fecha >= hoy || r.libre) continue;
    const k = `${r.fecha}|${r.momento}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  const porFirma = new Map();
  for (const items of grupos.values()) {
    const firma = firmaComida(items);
    const minuto = Math.round(items.reduce((s, r) => s + r.minuto, 0) / items.length);
    if (!porFirma.has(firma)) porFirma.set(firma, []);
    porFirma.get(firma).push({ items, minuto, fecha: items[0].fecha, momento: items[0].momento });
  }
  const hoyFirmas = new Set();
  const deHoy = new Map();
  for (const r of datos.registros.filter((x) => x.fecha === hoy)) {
    if (!deHoy.has(r.momento)) deHoy.set(r.momento, []);
    deHoy.get(r.momento).push(r);
  }
  for (const items of deHoy.values()) for (const it of items) hoyFirmas.add(firmaItem(it));
  const sugerencias = [];
  for (const [firma, veces] of porFirma) {
    if (datos.descartadas.includes(firma)) continue;
    const cerca = veces.filter((v) => Math.abs(v.minuto - minutoAhora) <= MARGEN_MIN);
    const dias = new Set(cerca.map((v) => v.fecha));
    if (dias.size < MIN_VECES) continue;
    // Si ya está apuntada hoy (todos sus alimentos), no se sugiere.
    if (firma.split('+').every((f) => hoyFirmas.has(f))) continue;
    const ultima = cerca.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
    const t = totales(ultima.items);
    sugerencias.push({ firma, veces: dias.size, momento: ultima.momento, items: ultima.items, nombre: nombreComida(ultima.items), kcal: t.kcal, proteina: t.proteina });
  }
  return sugerencias.sort((a, b) => b.veces - a.veces).slice(0, 3);
}

export function nombreComida(items) {
  const nombres = items.map((r) => r.nombre.toLowerCase());
  if (nombres.length === 1) return items[0].nombre;
  const texto = `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  return texto[0].toUpperCase() + texto.slice(1);
}

// ---------- «Qué puedo comer» sin IA ----------
// Combina tus alimentos frecuentes para cubrir lo que falta del día: primero la
// proteína, sin pasarse de kcal ni de grasa. Devuelve hasta 3 opciones.
const MIN_KCAL_UTILES = 80;

function cantidadPara(alimento, quedan, proteinaObjetivo) {
  const p = alimento.por100;
  const max = Math.min(alimento.racion * 3, 500);
  let g;
  if ((p.proteina ?? 0) >= 5 && proteinaObjetivo > 0) g = (proteinaObjetivo / p.proteina) * 100;
  else g = alimento.racion;
  // Sin pasarse de kcal ni de grasa (con un 5 % de margen).
  if (p.kcal > 0) g = Math.min(g, ((quedan.kcal * 1.05) / p.kcal) * 100);
  if ((p.grasa ?? 0) > 0 && quedan.grasa > 0) g = Math.min(g, ((Math.max(quedan.grasa, 0) * 1.1 + 2) / p.grasa) * 100);
  g = Math.min(g, max);
  return Math.max(0, Math.round(g / 10) * 10);
}

function puntuar(total, quedan) {
  const prot = quedan.proteina > 0 ? Math.min(1, total.proteina / quedan.proteina) : 1;
  const kcal = quedan.kcal > 0 ? 1 - Math.min(1, Math.abs(quedan.kcal - total.kcal) / quedan.kcal) : 0;
  const pasaGrasa = total.grasa > Math.max(quedan.grasa, 0) * 1.1 + 3 ? 0.4 : 0;
  const pasaKcal = total.kcal > quedan.kcal * 1.08 ? 0.6 : 0;
  return prot * 0.6 + kcal * 0.4 - pasaGrasa - pasaKcal;
}

export function quePuedoComer(datos, quedan, { maximo = 3 } = {}) {
  if (!quedan || quedan.kcal < MIN_KCAL_UTILES) return [];
  const candidatos = datos.alimentos
    .filter((a) => a.por100?.kcal > 0 && Number.isFinite(a.por100.proteina))
    .sort((a, b) => b.veces + (b.favorito ? 5 : 0) - (a.veces + (a.favorito ? 5 : 0)))
    .slice(0, 25);
  if (!candidatos.length) return [];
  const opciones = [];
  const proteicos = candidatos.filter((a) => (a.por100.proteina * 4) / a.por100.kcal >= 0.3);
  const otros = candidatos.filter((a) => !proteicos.includes(a));
  const anadir = (items) => {
    const lista = items.filter((x) => x.gramos >= 10);
    if (!lista.length) return;
    const total = totales(lista);
    opciones.push({ items: lista, total, puntos: puntuar(total, quedan) });
  };
  for (const a of proteicos) {
    const g = cantidadPara(a, quedan, quedan.proteina);
    const item = { alimento: a, gramos: g, nombre: a.nombre, ...nutrientesDe(a, g) };
    anadir([item]);
    // Con un acompañamiento que rellene las kcal que sobran.
    for (const b of otros.slice(0, 8)) {
      const resto = { kcal: quedan.kcal - item.kcal, proteina: 0, grasa: quedan.grasa - (item.grasa ?? 0) };
      if (resto.kcal < MIN_KCAL_UTILES) continue;
      const gb = cantidadPara(b, resto, 0);
      anadir([item, { alimento: b, gramos: gb, nombre: b.nombre, ...nutrientesDe(b, gb) }]);
    }
  }
  if (!proteicos.length) for (const b of otros) anadir([{ alimento: b, gramos: cantidadPara(b, quedan, 0), nombre: b.nombre, ...nutrientesDe(b, cantidadPara(b, quedan, 0)) }]);
  const vistas = new Set();
  return opciones
    .sort((a, b) => b.puntos - a.puntos)
    .filter((o) => {
      const k = o.items.map((x) => x.alimento.id).join('+');
      if (vistas.has(k) || vistas.has(o.items[0].alimento.id)) return false;
      vistas.add(k);
      vistas.add(o.items[0].alimento.id);
      return true;
    })
    .slice(0, maximo);
}

// ---------- Avisos del día ----------
export function avisosDelDia(datos, resumen, ahora = new Date()) {
  const avisos = [];
  const { objetivo, comido, quedan, fecha } = resumen;
  if (!objetivo || fecha !== fechaISO(ahora)) return avisos;
  const minuto = minutosDe(ahora);
  const hora = minutosDe(datos.ajustes.avisoProteina) ?? 18 * 60;
  if (minuto >= hora && comido.proteina < objetivo.proteina * 0.5) {
    avisos.push({ id: `proteina-${fecha}`, tipo: 'proteina', texto: `Vas por ${Math.round(comido.proteina)} g de proteína de ${objetivo.proteina}. Te quedan ${Math.round(quedan.proteina)} g para hoy.` });
  }
  if (comido.grasa > objetivo.grasa * 1.1 + 3) avisos.push({ id: `grasa-${fecha}`, tipo: 'grasa', texto: `Te has pasado de grasa: ${Math.round(comido.grasa)} g de ${objetivo.grasa}.` });
  if (comido.kcal > objetivo.kcal * 1.15) avisos.push({ id: `kcal-${fecha}`, tipo: 'kcal', texto: `Llevas ${Math.round(comido.kcal - objetivo.kcal)} kcal por encima del objetivo.` });
  return avisos;
}

// Días seguidos con algo apuntado (hasta hoy o ayer).
export function rachaDiario(datos, hoy = fechaISO()) {
  const dias = new Set(datos.registros.map((r) => r.fecha));
  let f = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (dias.has(f) && n < 2000) {
    n++;
    f = sumarDias(f, -1);
  }
  return n;
}

export const diasConRegistro = (datos, desde, hasta) => new Set(datos.registros.filter((r) => r.fecha >= desde && r.fecha <= hasta).map((r) => r.fecha)).size;
export { diasEntre };
