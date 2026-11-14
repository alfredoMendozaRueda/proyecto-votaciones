// Entrenamientos: lo que hiciste la última vez, cuándo subir peso, el asesor de
// descarga (Deload Advisor), la gráfica de cada ejercicio y el cardio.
import { epley } from './calculos.js';
import { lunesDe, sumarDias, fechaISO } from './fechas.js';

const r = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const efectivas = (s, eid) => s.series.filter((x) => x.ejercicioId === eid && !x.calentamiento && x.reps > 0);

export const MET_CARDIO = { suave: 4, media: 7, intensa: 10 };
export const kcalCardio = (minutos, intensidad, peso) => Math.round((MET_CARDIO[intensidad] ?? 7) * peso * (minutos / 60));

// La última sesión anterior con ese ejercicio: sus series efectivas.
export function ultimaVez(datos, ejercicioId, antesDe = '9999-12-31', excluir = null) {
  const sesiones = datos.sesiones.filter((s) => s.id !== excluir && s.fecha <= antesDe && efectivas(s, ejercicioId).length).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.inicio ?? 0) - (a.inicio ?? 0)));
  const s = sesiones[0];
  return s ? { fecha: s.fecha, series: efectivas(s, ejercicioId).map((x) => ({ kg: x.kg, reps: x.reps, rir: x.rir, fallo: x.fallo })) } : null;
}

export const textoSeries = (series) => series.map((x) => `${r(x.kg, 2)}×${x.reps}`).join(' · ');

// Sube peso si en la última sesión hiciste el máximo del rango en todas las series efectivas.
export function sugerenciaSubida(datos, ejercicioId, repMax, { antesDe, excluir, paso } = {}) {
  const u = ultimaVez(datos, ejercicioId, antesDe, excluir);
  if (!u || !u.series.length || !repMax) return null;
  if (!u.series.every((x) => x.reps >= repMax)) return null;
  const peso = Math.max(...u.series.map((x) => x.kg));
  const subida = paso ?? (peso >= 40 ? 2.5 : 1);
  return { desde: peso, a: r(peso + subida, 2), texto: `La última vez hiciste ${repMax} o más en todas las series. Prueba con ${r(peso + subida, 2)} kg.` };
}

// Mejor 1RM estimado de cada semana (lunes) para un ejercicio.
export function semanasEjercicio(datos, ejercicioId) {
  const mapa = new Map();
  for (const s of datos.sesiones) {
    for (const x of efectivas(s, ejercicioId)) {
      const sem = lunesDe(s.fecha);
      const e = epley(x.kg, x.reps);
      const v = mapa.get(sem) ?? { semana: sem, e1rm: 0, kg: 0, volumen: 0 };
      v.e1rm = Math.max(v.e1rm, e);
      v.kg = Math.max(v.kg, x.kg);
      v.volumen += x.kg * x.reps;
      mapa.set(sem, v);
    }
  }
  return [...mapa.values()].sort((a, b) => (a.semana < b.semana ? -1 : 1)).map((v) => ({ ...v, e1rm: r(v.e1rm, 1) }));
}

// Puntos para la gráfica: cada sesión, el mejor peso y el 1RM estimado.
export function historialEjercicio(datos, ejercicioId) {
  return datos.sesiones
    .filter((s) => efectivas(s, ejercicioId).length)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((s) => {
      const series = efectivas(s, ejercicioId);
      return { fecha: s.fecha, kg: Math.max(...series.map((x) => x.kg)), e1rm: r(Math.max(...series.map((x) => epley(x.kg, x.reps))), 1), series: series.length };
    });
}

// Volumen total (kg × reps de series efectivas) por semana.
export function volumenSemanal(datos) {
  const mapa = new Map();
  for (const s of datos.sesiones) {
    const v = s.series.filter((x) => !x.calentamiento).reduce((t, x) => t + x.kg * x.reps, 0);
    if (!v) continue;
    const sem = lunesDe(s.fecha);
    mapa.set(sem, (mapa.get(sem) ?? 0) + v);
  }
  return [...mapa].sort(([a], [b]) => (a < b ? -1 : 1)).map(([semana, volumen]) => ({ semana, volumen }));
}

// ---------- Deload Advisor ----------
// 1) El 1RM estimado baja más de un 5 % en 2 o más ejercicios principales durante
//    2 semanas seguidas (frente a su mejor semana anterior).
// 2) 6 semanas seguidas subiendo la carga (volumen) sin descarga.
export function asesorDescarga(datos, hoy = fechaISO()) {
  const semanaHoy = lunesDe(hoy);
  // Solo semanas cerradas, y no si ya descartaste o hiciste una descarga hace poco.
  if (datos.descargaDescartada && datos.descargaDescartada >= sumarDias(hoy, -7)) return null;
  const ultimaDescarga = datos.descargas.at(-1);
  if (ultimaDescarga && ultimaDescarga >= sumarDias(semanaHoy, -14)) return null;
  const principales = datos.ejercicios.filter((e) => e.principal);
  const bajan = [];
  for (const e of principales) {
    const semanas = semanasEjercicio(datos, e.id).filter((s) => s.semana < semanaHoy && (!ultimaDescarga || s.semana > ultimaDescarga));
    if (semanas.length < 3) continue;
    const [penultima, ultima] = semanas.slice(-2);
    const referencia = Math.max(...semanas.slice(0, -2).map((s) => s.e1rm));
    if (penultima.e1rm < referencia * 0.95 && ultima.e1rm < referencia * 0.95) bajan.push({ ejercicio: e, de: referencia, a: ultima.e1rm });
  }
  if (bajan.length >= 2) {
    return {
      motivo: 'fuerza',
      ejercicios: bajan,
      texto: `Tu fuerza estimada ha bajado más de un 5 % dos semanas seguidas en ${bajan.map((b) => b.ejercicio.nombre.toLowerCase()).join(' y ')}. Suele ser fatiga acumulada.`,
      propuesta: 'Haz una semana de descarga: mismos ejercicios y pesos, pero un 40–50 % menos de series.',
    };
  }
  const volumen = volumenSemanal(datos).filter((s) => s.semana < semanaHoy && (!ultimaDescarga || s.semana > ultimaDescarga));
  let seguidas = 0;
  for (let i = volumen.length - 1; i > 0; i--) {
    // Semanas consecutivas en el calendario, cada una con más carga que la anterior.
    if (sumarDias(volumen[i - 1].semana, 7) !== volumen[i].semana || volumen[i].volumen <= volumen[i - 1].volumen) break;
    seguidas++;
  }
  if (seguidas >= 6) {
    return {
      motivo: 'acumulado',
      semanas: seguidas,
      texto: `Llevas ${seguidas} semanas seguidas subiendo la carga sin descansar.`,
      propuesta: 'Una semana de descarga ahora ayuda a seguir progresando: baja un 40–50 % las series.',
    };
  }
  return null;
}

// Aviso: la fuerza baja 2 semanas seguidas estando en déficit.
export function avisoFuerzaEnDeficit(datos, hoy = fechaISO()) {
  const p = datos.perfil;
  if (!p || !['perder', 'recomposicion'].includes(p.objetivo)) return null;
  const semanaHoy = lunesDe(hoy);
  const bajan = [];
  for (const e of datos.ejercicios.filter((x) => x.principal)) {
    const s = semanasEjercicio(datos, e.id).filter((x) => x.semana < semanaHoy);
    if (s.length < 3) continue;
    const [a, b, c] = s.slice(-3);
    if (b.e1rm < a.e1rm && c.e1rm < b.e1rm) bajan.push(e.nombre.toLowerCase());
  }
  if (!bajan.length) return null;
  return { id: `fuerza-${semanaHoy}`, texto: `Tu fuerza baja dos semanas seguidas en ${bajan.join(' y ')} mientras estás en déficit. Revisa la proteína y el descanso, o suaviza el déficit.` };
}

// Ejercicios de la sesión, en orden de aparición.
export function ejerciciosDeSesion(sesion) {
  const vistos = [];
  for (const x of sesion.series) if (!vistos.includes(x.ejercicioId)) vistos.push(x.ejercicioId);
  return vistos;
}

export const duracionSesion = (s) => (s.inicio && s.fin && s.fin > s.inicio ? Math.round((s.fin - s.inicio) / 60000) : null);
