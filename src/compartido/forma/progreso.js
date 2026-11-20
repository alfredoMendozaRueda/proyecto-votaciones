// Peso, medidas, progreso, hitos, resumen semanal y TDEE adaptativo.
import { sumarDias, diasEntre, lunesDe, fechaISO } from './fechas.js';
import { KCAL_POR_KG_GRASA, epley } from './calculos.js';
import { esEfectiva, carga } from './entreno.js';

const r = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Orden de los pesajes de un día por la hora (los que no la tienen, al final).
const porHora = (a, b) => (a.momento ?? Infinity) - (b.momento ?? Infinity) || String(a.hora ?? '99').localeCompare(String(b.hora ?? '99'));

// El peso que cuenta para un día. Si lo apuntaste a mano, ese (el último).
// Si viene de la báscula: el primer pesaje antes de las 12:00 y, si no hay,
// el primero del día. Los demás se guardan pero son secundarios.
export function pesoDelDia(lista) {
  if (!lista?.length) return null;
  const manuales = lista.filter((p) => !p.fuente);
  if (manuales.length) return manuales.at(-1);
  const ordenados = [...lista].sort(porHora);
  return ordenados.find((p) => p.hora && p.hora < '12:00') ?? ordenados[0];
}

// Pesajes agrupados por día: { fecha → [pesajes] }.
export function pesajesPorFecha(datos) {
  const mapa = new Map();
  for (const p of datos.pesos) mapa.set(p.fecha, [...(mapa.get(p.fecha) ?? []), p]);
  return mapa;
}

// Un peso por día (el que cuenta, ver pesoDelDia), ordenado.
export function pesosPorDia(datos) {
  return [...pesajesPorFecha(datos)]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, lista]) => {
      const p = pesoDelDia(lista);
      return { fecha, kg: p.kg, ...(p.fuente ? { fuente: p.fuente } : {}) };
    });
}

// % de grasa y masa magra de la báscula, uno por día (del pesaje que cuenta o,
// si ese no los trae, del primero que sí).
export function serieComposicion(datos) {
  return [...pesajesPorFecha(datos)]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, lista]) => {
      const principal = pesoDelDia(lista);
      const conDatos = [principal, ...[...lista].sort(porHora)].find((p) => Number.isFinite(p.grasa) || Number.isFinite(p.magra));
      return conDatos ? { fecha, grasa: conDatos.grasa ?? null, magra: conDatos.magra ?? null } : null;
    })
    .filter(Boolean);
}

// Media de los últimos 7 días naturales que acaban en «fecha», ignorando los días sin dato.
export function media7(pesos, fecha) {
  const desde = sumarDias(fecha, -6);
  const valores = pesos.filter((p) => p.fecha >= desde && p.fecha <= fecha).map((p) => p.kg);
  return valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : null;
}

// La media móvil de cada día con peso.
export function serieMedia(datos) {
  const pesos = pesosPorDia(datos);
  return pesos.map((p) => ({ ...p, media: r(media7(pesos, p.fecha), 2) }));
}

// El peso que vale para las cuentas: la media de 7 días más reciente (o el último).
export function pesoDeReferencia(datos, hoy = fechaISO()) {
  const pesos = pesosPorDia(datos).filter((p) => p.fecha <= hoy);
  if (!pesos.length) return null;
  const ultimo = pesos.at(-1);
  // Si el último peso es de hace más de 3 semanas, la media no dice mucho: vale el último.
  return diasEntre(ultimo.fecha, hoy) > 21 ? ultimo.kg : media7(pesos, ultimo.fecha);
}

// Ritmo real (kg por semana) de las últimas «semanas» semanas con la media de 7 días.
export function ritmoReal(datos, hoy = fechaISO(), semanas = 2) {
  const pesos = pesosPorDia(datos).filter((p) => p.fecha <= hoy);
  if (pesos.length < 4) return null;
  const fin = pesos.at(-1).fecha;
  const inicio = sumarDias(fin, -7 * semanas);
  if (pesos[0].fecha > inicio) return null;
  const a = media7(pesos, inicio);
  const b = media7(pesos, fin);
  if (a === null || b === null) return null;
  return r(((b - a) / (7 * semanas)) * 7, 2);
}

// Avisos de progreso: bajar demasiado rápido (más del 1 % a la semana desde la
// tercera semana) o estancarse 3 semanas.
export function avisosProgreso(datos, hoy = fechaISO()) {
  const avisos = [];
  const p = datos.perfil;
  if (!p) return avisos;
  const pesos = pesosPorDia(datos);
  if (pesos.length < 4) return avisos;
  const desdeInicio = diasEntre(pesos[0].fecha, hoy);
  const ritmo = ritmoReal(datos, hoy, 1);
  const ref = pesoDeReferencia(datos, hoy);
  if (desdeInicio >= 14 && ritmo !== null && ref && ritmo < -0.01 * ref) {
    avisos.push({ id: `rapido-${lunesDe(hoy)}`, tipo: 'rapido', texto: `Estás bajando ${Math.abs(ritmo).toFixed(1)} kg a la semana, más del 1 % de tu peso. A ese ritmo se pierde músculo: sube un poco las kcal.` });
  }
  const tres = ritmoReal(datos, hoy, 3);
  if (tres !== null && Math.abs(tres) < 0.07 && (p.objetivo === 'perder' || p.objetivo === 'volumen')) {
    avisos.push({ id: `estancado-${lunesDe(hoy)}`, tipo: 'estancado', texto: `Tu media de peso apenas se ha movido en 3 semanas. ${p.objetivo === 'perder' ? 'Baja unas 100–150 kcal o suma pasos.' : 'Sube unas 100–150 kcal.'}` });
  }
  return avisos;
}

// ---------- Medidas ----------
export function serieMedida(datos, tipo) {
  const mapa = new Map();
  for (const m of datos.medidas) if (m.tipo === tipo) mapa.set(m.fecha, m.cm);
  return [...mapa].sort(([a], [b]) => (a < b ? -1 : 1)).map(([fecha, cm]) => ({ fecha, cm }));
}

export const ultimaMedida = (datos, tipo) => serieMedida(datos, tipo).at(-1) ?? null;

// ---------- Fuerza ----------
// El mejor 1RM estimado de un ejercicio (solo series efectivas), hasta una fecha.
export function mejorMarca(datos, ejercicioId, hasta = '9999-12-31', desde = '0000-01-01') {
  let mejor = null;
  for (const s of datos.sesiones) {
    if (s.fecha > hasta || s.fecha < desde) continue;
    for (const x of s.series) {
      if (x.ejercicioId !== ejercicioId || !esEfectiva(x)) continue;
      const e = epley(carga(x), x.reps);
      if (!mejor || e > mejor.e1rm) mejor = { e1rm: e, kg: carga(x), reps: x.reps, fecha: s.fecha };
    }
  }
  return mejor;
}

export const mejorPeso = (datos, ejercicioId, hasta = '9999-12-31') =>
  Math.max(0, ...datos.sesiones.filter((s) => s.fecha <= hasta).flatMap((s) => s.series.filter((x) => x.ejercicioId === ejercicioId && esEfectiva(x)).map(carga)));

// ---------- Hitos ----------
export function estadoHito(datos, hito, hoy = fechaISO()) {
  let actual = null;
  if (hito.tipo === 'peso') {
    const pesos = pesosPorDia(datos).filter((p) => p.fecha <= hoy);
    // Se cumple con la media de 7 días, no con un día suelto.
    actual = pesos.length ? media7(pesos, pesos.at(-1).fecha) : null;
  } else if (hito.tipo === 'medida') actual = ultimaMedida(datos, hito.medida)?.cm ?? null;
  else if (hito.tipo === 'fuerza') actual = mejorPeso(datos, hito.ejercicioId) || null;
  const cumple = actual !== null && (hito.comparador === '>' ? actual >= hito.valor : actual < hito.valor);
  return { actual: actual === null ? null : r(actual, 1), cumple };
}

// Hitos que se acaban de cumplir: se marcan con la fecha de hoy.
export function revisarHitos(datos, hoy = fechaISO()) {
  const nuevos = [];
  const hitos = datos.hitos.map((h) => {
    if (h.cumplido) return h;
    const { cumple } = estadoHito(datos, h, hoy);
    if (!cumple) return h;
    const hecho = { ...h, cumplido: hoy };
    nuevos.push(hecho);
    return hecho;
  });
  return { datos: nuevos.length ? { ...datos, hitos } : datos, nuevos };
}

// Hitos automáticos de peso cada ~2,5 % del peso inicial hasta el objetivo.
export function hitosSugeridos(datos) {
  const p = datos.perfil;
  if (!p || !Number.isFinite(p.pesoObjetivo)) return [];
  const inicial = pesosPorDia(datos)[0]?.kg ?? p.peso;
  const baja = p.pesoObjetivo < inicial;
  const paso = inicial * 0.025;
  const salida = [];
  for (let i = 1; i < 20; i++) {
    const valor = r(baja ? inicial - paso * i : inicial + paso * i, 1);
    if (baja ? valor <= p.pesoObjetivo : valor >= p.pesoObjetivo) break;
    salida.push(valor);
  }
  salida.push(p.pesoObjetivo);
  const yaHay = new Set(datos.hitos.filter((h) => h.tipo === 'peso').map((h) => h.valor));
  return salida.filter((v) => !yaHay.has(v)).map((valor) => ({ tipo: 'peso', comparador: baja ? '<' : '>', valor }));
}

// ---------- Resumen semanal ----------
// Semana de lunes a domingo. kcalObjetivo(fecha) y proteinaObjetivo(fecha): del plan.
export function resumenSemanal(datos, lunes, { objetivo }) {
  const domingo = sumarDias(lunes, 6);
  const porDia = new Map();
  for (const reg of datos.registros) {
    if (reg.fecha < lunes || reg.fecha > domingo) continue;
    const t = porDia.get(reg.fecha) ?? { kcal: 0, proteina: 0 };
    t.kcal += reg.kcal ?? 0;
    t.proteina += reg.proteina ?? 0;
    porDia.set(reg.fecha, t);
  }
  let kcalOk = 0;
  let protOk = 0;
  for (const [fecha, t] of porDia) {
    const o = objetivo(fecha);
    if (!o) continue;
    if (Math.abs(t.kcal - o.kcal) <= o.kcal * 0.1) kcalOk++;
    if (t.proteina >= o.proteina * 0.9) protOk++;
  }
  const dias = porDia.size;
  const pesos = pesosPorDia(datos);
  const antes = media7(pesos, sumarDias(lunes, -1));
  const ahora = media7(pesos, domingo);
  const records = [];
  const ejercicios = new Set(datos.sesiones.filter((s) => s.fecha >= lunes && s.fecha <= domingo).flatMap((s) => s.series.filter((x) => !x.calentamiento).map((x) => x.ejercicioId)));
  for (const eid of ejercicios) {
    const esta = mejorMarca(datos, eid, domingo, lunes);
    const previa = mejorMarca(datos, eid, sumarDias(lunes, -1));
    if (esta && (!previa || esta.e1rm > previa.e1rm + 0.01)) records.push({ ejercicioId: eid, ...esta, anterior: previa?.e1rm ?? null });
  }
  const entrenos = datos.sesiones.filter((s) => s.fecha >= lunes && s.fecha <= domingo).length;
  return {
    lunes,
    domingo,
    diasRegistrados: dias,
    cumplimientoKcal: dias ? Math.round((kcalOk / dias) * 100) : null,
    cumplimientoProteina: dias ? Math.round((protOk / dias) * 100) : null,
    mediaAntes: antes === null ? null : r(antes, 2),
    mediaAhora: ahora === null ? null : r(ahora, 2),
    cambio: antes !== null && ahora !== null ? r(ahora - antes, 2) : null,
    records,
    entrenos,
  };
}

// ---------- TDEE adaptativo ----------
// Con 2–3 semanas de datos: kcal medias apuntadas frente a la tendencia real del
// peso → tu mantenimiento real. Solo si has apuntado al menos el 80 % de los días.
export function tdeeAdaptativo(datos, hoy = fechaISO(), { dias = 21, minimo = 14 } = {}) {
  const pesos = pesosPorDia(datos).filter((p) => p.fecha <= hoy);
  if (pesos.length < 6) return null;
  const fin = hoy;
  const ventana = Math.min(dias, diasEntre(pesos[0].fecha, fin));
  if (ventana < minimo) return null;
  const inicio = sumarDias(fin, -ventana);
  const kcalPorDia = new Map();
  for (const reg of datos.registros) if (reg.fecha > inicio && reg.fecha <= fin) kcalPorDia.set(reg.fecha, (kcalPorDia.get(reg.fecha) ?? 0) + (reg.kcal ?? 0));
  const registrados = [...kcalPorDia.values()].filter((k) => k > 300);
  if (registrados.length < ventana * 0.8) return null;
  const kcalMedia = registrados.reduce((s, k) => s + k, 0) / registrados.length;
  const a = media7(pesos, sumarDias(inicio, 6));
  const b = media7(pesos, fin);
  if (a === null || b === null) return null;
  const cambioDiario = (b - a) / (ventana - 6);
  const mantenimiento = Math.round((kcalMedia - cambioDiario * KCAL_POR_KG_GRASA) / 10) * 10;
  return { mantenimiento, kcalMedia: Math.round(kcalMedia), kgSemana: r(cambioDiario * 7, 2), dias: ventana };
}
