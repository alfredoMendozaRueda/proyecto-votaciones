// Resumen semanal de Forma: cómo ha ido la semana (lunes a domingo) en peso,
// composición, nutrición, entreno y actividad; ritmo de pérdida con semáforo,
// proyección hacia los hitos y el objetivo, y un texto corto con 1–2
// recomendaciones. Los números salen siempre de aquí; la IA, si la hay, solo
// redacta el texto a partir de estas métricas.
// Cada semana cerrada se guarda como una foto (datos.resumenes, id = su lunes)
// para que el historial no cambie si luego tocas registros antiguos, salvo que
// pulses «Regenerar». Son funciones puras: se prueban en test/forma-semanas.test.js.
import { sumarDias, lunesDe, diasEntre, esFecha } from './fechas.js';
import { pesosPorDia, mediasSemanales, serieComposicion, mejorMarca, revisarHitos } from './progreso.js';
import { objetivoDelDia, planActual } from './diario.js';
import { calcularPlan } from './calculos.js';
import { volumenSerie, asesorDescarga } from './entreno.js';
import { ejercicio } from './datos.js';
import { desdeLocal, partesLocales } from '../horas.js';

export const VERSION_RESUMEN = 1;
export const MIN_PESAJES_RITMO = 4;
export const MIN_DIAS_NUTRICION = 5;
const r = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const enSemana = (fecha, lunes) => fecha >= lunes && fecha <= sumarDias(lunes, 6);
const pierde = (perfil) => ['perder', 'recomposicion'].includes(perfil?.objetivo);

// ---------- Cuándo se genera ----------

// Momento (ms) en que se genera el resumen de la semana que empieza en «lunes»:
// el día y la hora de Ajustes (por defecto, el domingo a las 23:30), en tu zona.
// 1–6 = lunes…sábado de la semana siguiente; 7 = el propio domingo.
export function momentoGeneracion(lunes, ajustes = {}, zona = 'Europe/Madrid') {
  const dia = Number.isInteger(ajustes.resumenDia) ? ajustes.resumenDia : 7;
  const fecha = sumarDias(lunes, dia === 7 ? 6 : 6 + dia);
  return desdeLocal(fecha, ajustes.resumenHora ?? '23:30', zona);
}

const zonaDe = (datos) => datos.perfil?.zona ?? 'Europe/Madrid';
export const hoyEnZona = (datos, ahora = Date.now()) => partesLocales(ahora, zonaDe(datos)).fecha;

// ¿Hay algo apuntado esa semana?
function hayDatos(datos, lunes) {
  return (
    datos.registros.some((x) => enSemana(x.fecha, lunes)) ||
    datos.pesos.some((x) => enSemana(x.fecha, lunes)) ||
    datos.sesiones.some((x) => enSemana(x.fecha, lunes))
  );
}

// Semanas cerradas sin resumen guardado (de la más antigua a la más reciente):
// las de las últimas «hasta» semanas con algún dato y cuya hora ya ha pasado.
export function semanasPendientes(datos, ahora = Date.now(), { hasta = 8 } = {}) {
  if (!datos.perfil) return [];
  const hechas = new Set(datos.resumenes.map((x) => x.id));
  const salida = [];
  let lunes = sumarDias(lunesDe(hoyEnZona(datos, ahora)), -7 * hasta);
  for (let i = 0; i <= hasta; i++, lunes = sumarDias(lunes, 7)) {
    if (hechas.has(lunes) || momentoGeneracion(lunes, datos.ajustes, zonaDe(datos)) > ahora) continue;
    if (hayDatos(datos, lunes)) salida.push(lunes);
  }
  return salida;
}

// ---------- Peso ----------

function semaforo(datos, pct, pctAnterior, n) {
  if (n < MIN_PESAJES_RITMO || pct === null) return { estado: 'gris', texto: 'Datos insuficientes: hacen falta al menos 4 pesajes en la semana.' };
  const objetivo = datos.perfil?.objetivo;
  if (pierde(datos.perfil)) {
    const baja = -pct;
    if (baja > 1.25) return { estado: 'rojo', texto: 'Demasiado rápido: más del 1,25 % a la semana, con riesgo de perder músculo.' };
    if (baja >= 0.5 && baja <= 1) return { estado: 'verde', texto: 'Ritmo ideal: entre el 0,5 % y el 1 % a la semana.' };
    if (baja < 0.25 && pctAnterior !== null && -pctAnterior < 0.25) return { estado: 'amarillo', texto: 'Lento: menos del 0,25 % a la semana dos semanas seguidas.' };
    if (baja < 0.5) return { estado: 'neutro', texto: 'Algo por debajo del ritmo ideal (0,5–1 % a la semana).' };
    return { estado: 'neutro', texto: 'Algo por encima del ritmo ideal (0,5–1 % a la semana).' };
  }
  if (objetivo === 'volumen') {
    if (pct > 0.75) return { estado: 'rojo', texto: 'Subes demasiado rápido: más del 0,75 % a la semana suele ser grasa.' };
    if (pct >= 0.1 && pct <= 0.5) return { estado: 'verde', texto: 'Ritmo ideal para ganar músculo: 0,1–0,5 % a la semana.' };
    if (pct < 0.1 && pctAnterior !== null && pctAnterior < 0.1) return { estado: 'amarillo', texto: 'Lento: casi sin subir dos semanas seguidas.' };
    return { estado: 'neutro', texto: 'Algo fuera del ritmo ideal (0,1–0,5 % a la semana).' };
  }
  if (Math.abs(pct) <= 0.25) return { estado: 'verde', texto: 'Estable: es lo que buscas para mantener.' };
  return { estado: 'neutro', texto: 'Se mueve más de lo habitual para mantener.' };
}

function bloquePeso(datos, lunes) {
  const semanas = new Map(mediasSemanales(datos).map((s) => [s.lunes, s]));
  const esta = semanas.get(lunes);
  const antes = semanas.get(sumarDias(lunes, -7));
  const antesDeAntes = semanas.get(sumarDias(lunes, -14));
  const dias = pesosPorDia(datos).filter((p) => enSemana(p.fecha, lunes));
  const cambioKg = esta && antes ? r(esta.media - antes.media, 2) : null;
  const cambioPct = esta && antes ? r(((esta.media - antes.media) / antes.media) * 100, 2) : null;
  const pctAnterior = antes && antesDeAntes && antes.n >= MIN_PESAJES_RITMO ? ((antes.media - antesDeAntes.media) / antesDeAntes.media) * 100 : null;
  const ritmo = semaforo(datos, cambioPct, pctAnterior, esta?.n ?? 0);
  const comp = serieComposicion(datos);
  const compDe = (l) => comp.filter((c) => enSemana(c.fecha, l));
  const mediaDe = (lista, k) => r(media(lista.map((c) => c[k]).filter(Number.isFinite)), k === 'grasa' ? 1 : 2);
  const grasa = mediaDe(compDe(lunes), 'grasa');
  const magra = mediaDe(compDe(lunes), 'magra');
  const grasaAntes = mediaDe(compDe(sumarDias(lunes, -7)), 'grasa');
  const magraAntes = mediaDe(compDe(sumarDias(lunes, -7)), 'magra');
  return {
    media: esta?.media ?? null,
    n: esta?.n ?? 0,
    mediaAnterior: antes?.media ?? null,
    cambioKg,
    cambioPct,
    // Ritmo: solo con al menos 4 pesajes (si no, «datos insuficientes»).
    ritmo: { ...ritmo, kgSemana: ritmo.estado === 'gris' ? null : cambioKg, pctSemana: ritmo.estado === 'gris' ? null : cambioPct },
    dias: dias.map((p) => ({ fecha: p.fecha, kg: p.kg })),
    grasa: grasa === null ? null : { media: grasa, cambio: grasaAntes === null ? null : r(grasa - grasaAntes, 1) },
    magra: magra === null ? null : { media: magra, cambio: magraAntes === null ? null : r(magra - magraAntes, 2) },
  };
}

// ---------- Nutrición ----------

const MACROS = ['kcal', 'proteina', 'hidratos', 'grasa', 'fibra'];

function bloqueNutricion(datos, lunes) {
  const domingo = sumarDias(lunes, 6);
  const despues = sumarDias(domingo, 1);
  const porDia = new Map();
  const porMomento = new Map();
  for (const reg of datos.registros) {
    if (!enSemana(reg.fecha, lunes)) continue;
    const t = porDia.get(reg.fecha) ?? Object.fromEntries(MACROS.map((k) => [k, 0]));
    for (const k of MACROS) t[k] += reg[k] ?? 0;
    porDia.set(reg.fecha, t);
    const m = porMomento.get(reg.momento) ?? { kcal: 0, proteina: 0 };
    m.kcal += reg.kcal ?? 0;
    m.proteina += reg.proteina ?? 0;
    porMomento.set(reg.momento, m);
  }
  const dias = porDia.size;
  const objetivos = new Map();
  for (const f of porDia.keys()) {
    const o = objetivoDelDia(datos, f, planActual(datos, f), despues);
    if (o) objetivos.set(f, o);
  }
  const conObjetivo = [...porDia.keys()].filter((f) => objetivos.has(f));
  const par = (k, d = 0) => ({
    media: r(media([...porDia.values()].map((t) => t[k])), d),
    objetivo: r(media(conObjetivo.map((f) => objetivos.get(f)[k]).filter(Number.isFinite)), d),
  });
  const adherencia = conObjetivo.filter((f) => Math.abs(porDia.get(f).kcal - objetivos.get(f).kcal) <= objetivos.get(f).kcal * 0.1).length;
  const diasProteina = conObjetivo.filter((f) => porDia.get(f).proteina >= objetivos.get(f).proteina - 2).length;
  let maximo = null;
  for (const [fecha, t] of porDia) if (!maximo || t.kcal > maximo.kcal) maximo = { fecha, kcal: Math.round(t.kcal), nota: datos.dias[fecha]?.nota ?? null };
  // Proteína por comida principal (las que suman al menos el 15 % de las kcal):
  // de ahí sale «te falta proteína en las cenas».
  const kcalTotal = [...porMomento.values()].reduce((s, m) => s + m.kcal, 0);
  const momentos = [...porMomento]
    .filter(([, m]) => kcalTotal && m.kcal >= kcalTotal * 0.15)
    .map(([id, m]) => ({ id, nombre: datos.momentos.find((x) => x.id === id)?.nombre ?? 'Otros', proteina: r(m.proteina / Math.max(1, dias), 1), densidad: r((m.proteina / Math.max(1, m.kcal)) * 100, 1) }))
    .sort((a, b) => a.densidad - b.densidad);
  return {
    dias,
    completo: dias >= MIN_DIAS_NUTRICION,
    kcal: par('kcal'),
    adherencia: { dias: adherencia, de: conObjetivo.length },
    proteina: { ...par('proteina'), dias: diasProteina },
    hidratos: par('hidratos'),
    grasa: par('grasa'),
    fibra: par('fibra'),
    maximo,
    momentoMenosProteina: momentos.length > 1 ? momentos[0] : null,
  };
}

// ---------- Entreno y actividad ----------

export function sesionesPlanificadas(datos) {
  const dias = datos.ajustes?.diasEntrenoSemana ?? [];
  return dias.length ? dias.length : (datos.perfil?.diasEntreno ?? 0);
}

function volumenPorGrupo(datos, lunes) {
  const grupos = new Map();
  for (const s of datos.sesiones) {
    if (!enSemana(s.fecha, lunes)) continue;
    for (const x of s.series) {
      const e = ejercicio(datos, x.ejercicioId);
      const v = volumenSerie(x, e);
      if (v) grupos.set(e.grupo, (grupos.get(e.grupo) ?? 0) + v);
    }
  }
  return grupos;
}

function bloqueEntreno(datos, lunes) {
  const domingo = sumarDias(lunes, 6);
  const sesiones = datos.sesiones.filter((s) => enSemana(s.fecha, lunes)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const porId = new Map(datos.ejercicios.map((e) => [e.id, e]));
  const volumenDe = (s) => Math.round(s.series.reduce((t, x) => t + volumenSerie(x, porId.get(x.ejercicioId)), 0));
  const estos = volumenPorGrupo(datos, lunes);
  const antes = volumenPorGrupo(datos, sumarDias(lunes, -7));
  const grupos = [...new Set([...estos.keys(), ...antes.keys()])]
    .map((g) => ({ grupo: g, volumen: Math.round(estos.get(g) ?? 0), anterior: Math.round(antes.get(g) ?? 0) }))
    .filter((g) => g.volumen || g.anterior)
    .sort((a, b) => b.volumen - a.volumen);
  const records = [];
  const ids = new Set(sesiones.flatMap((s) => s.series.map((x) => x.ejercicioId)));
  for (const eid of ids) {
    const esta = mejorMarca(datos, eid, domingo, lunes);
    const previa = mejorMarca(datos, eid, sumarDias(lunes, -1));
    // Récord = 1RM estimado mejor que el de antes (un ejercicio nuevo no cuenta).
    if (esta && previa && esta.e1rm > previa.e1rm + 0.01) records.push({ ejercicioId: eid, nombre: ejercicio(datos, eid).nombre, kg: esta.kg, reps: esta.reps, e1rm: r(esta.e1rm, 1), anterior: previa ? r(previa.e1rm, 1) : null });
  }
  const pasos = [];
  for (let i = 0; i < 7; i++) {
    const p = datos.dias[sumarDias(lunes, i)]?.pasos;
    if (Number.isFinite(p)) pasos.push(p);
  }
  const descarga = asesorDescarga(datos, sumarDias(domingo, 1));
  const volumen = sesiones.reduce((t, s) => t + volumenDe(s), 0);
  return {
    hechas: sesiones.length,
    planificadas: sesionesPlanificadas(datos),
    sesiones: sesiones.map((s) => ({ id: s.id, fecha: s.fecha, nombre: s.nombre || 'Entreno', volumen: volumenDe(s) })),
    volumen,
    volumenAnterior: [...antes.values()].reduce((a, b) => a + Math.round(b), 0),
    grupos,
    records: records.sort((a, b) => b.e1rm - a.e1rm),
    cardioMin: Math.round(sesiones.flatMap((s) => s.cardio ?? []).reduce((t, c) => t + (c.minutos ?? 0), 0)),
    pasos: pasos.length ? { media: Math.round(media(pasos)), dias: pasos.length } : null,
    descarga: descarga ? { texto: descarga.texto, propuesta: descarga.propuesta } : null,
  };
}

// ---------- Proyección ----------

// Recta de mínimos cuadrados: x en días, y en kg.
export function regresion(puntos) {
  const n = puntos.length;
  if (n < 2) return null;
  const mx = media(puntos.map((p) => p.x));
  const my = media(puntos.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (!den) return null;
  const pendiente = num / den;
  return { pendiente, ordenada: my - pendiente * mx };
}

// Con los pesos de las últimas 3 semanas (al menos 10): ¿cuándo llegarías?
export function proyeccion(datos, domingo, objetivos) {
  const desde = sumarDias(domingo, -20);
  const pesos = pesosPorDia(datos).filter((p) => p.fecha >= desde && p.fecha <= domingo);
  if (pesos.length < 10) return null;
  const recta = regresion(pesos.map((p) => ({ x: diasEntre(desde, p.fecha), y: p.kg })));
  if (!recta) return null;
  const xFin = diasEntre(desde, domingo);
  const hoyRecta = recta.ordenada + recta.pendiente * xFin;
  const fechaPara = (valor) => {
    if (!Number.isFinite(valor) || Math.abs(recta.pendiente) < 1e-6) return null;
    const dias = (valor - hoyRecta) / recta.pendiente;
    if (!(dias > 0) || dias > 730) return null;
    return sumarDias(domingo, Math.ceil(dias));
  };
  return { kgSemana: r(recta.pendiente * 7, 2), ...Object.fromEntries(Object.entries(objetivos).map(([k, v]) => [k, Number.isFinite(v) ? { valor: v, fecha: fechaPara(v) } : null])) };
}

// ---------- Hitos ----------

// Hitos de peso en tu orden (o, si no lo has tocado, de más cerca a más lejos).
export function hitosDePeso(datos) {
  const baja = !datos.perfil || datos.perfil.pesoObjetivo === undefined || datos.perfil.pesoObjetivo < (pesosPorDia(datos)[0]?.kg ?? datos.perfil.peso);
  return datos.hitos
    .filter((h) => h.tipo === 'peso')
    .map((h, i) => ({ h, i }))
    .sort((a, b) => (a.h.orden ?? 1000 + a.i) - (b.h.orden ?? 1000 + b.i) || (baja ? b.h.valor - a.h.valor : a.h.valor - b.h.valor))
    .map(({ h }) => h);
}

export const proximoHito = (datos) => hitosDePeso(datos).find((h) => !h.cumplido) ?? null;
export const pesoInicial = (datos) => pesosPorDia(datos)[0]?.kg ?? datos.perfil?.peso ?? null;

// Hitos sugeridos: cada 2 kg desde tu peso actual hasta el objetivo (76, 74, 72, 70…).
export function hitosRedondos(datos, actual) {
  const objetivo = datos.perfil?.pesoObjetivo;
  if (!Number.isFinite(actual) || !Number.isFinite(objetivo) || Math.abs(actual - objetivo) < 1) return [];
  const baja = objetivo < actual;
  const yaHay = new Set(datos.hitos.filter((h) => h.tipo === 'peso').map((h) => h.valor));
  const salida = [];
  let v = baja ? Math.floor((actual - 0.5) / 2) * 2 : Math.ceil((actual + 0.5) / 2) * 2;
  while (baja ? v > objetivo : v < objetivo) {
    salida.push(v);
    v += baja ? -2 : 2;
  }
  salida.push(Math.round(objetivo * 10) / 10);
  return [...new Set(salida)].filter((x) => !yaHay.has(x)).slice(0, 8);
}

function bloqueHitos(datos, lunes, mediaSemana, proy) {
  const conseguidos = hitosDePeso(datos)
    .filter((h) => h.semana === lunes)
    .map((h) => ({ id: h.id, valor: h.valor, recompensa: h.recompensa ?? '' }));
  const proximo = proximoHito(datos);
  const inicial = pesoInicial(datos);
  let p = null;
  if (proximo) {
    const actual = mediaSemana ?? null;
    const total = inicial !== null ? inicial - proximo.valor : null;
    p = {
      id: proximo.id,
      valor: proximo.valor,
      recompensa: proximo.recompensa ?? '',
      faltan: actual === null ? null : r(actual - proximo.valor, 2),
      progreso: actual === null || !total ? null : Math.max(0, Math.min(1, r((inicial - actual) / total, 3))),
      fecha: proy?.hito?.fecha ?? null,
    };
  }
  return { conseguidos, proximo: p, inicial };
}

// ---------- Ajuste automático del objetivo ----------
// Si el ritmo real se sale del ideal, el resumen propone mover las kcal:
// · perder grasa: lento dos semanas (amarillo) → −120 kcal; demasiado rápido (rojo) → +150.
// · ganar músculo: demasiado rápido → −150; lento dos semanas → +120.
// Solo con datos fiables (≥ 4 pesajes y ≥ 5 días apuntados) y si has cumplido
// el objetivo de kcal al menos 4 días (si no, el problema no son las kcal). Tras
// un ajuste se esperan 2 semanas a que el peso responda, y nunca baja del basal.
export const AJUSTES_PROPUESTOS = { bajar: -120, subir: 150, bajarVolumen: -150, subirVolumen: 120 };
export const ESPERA_AJUSTE_DIAS = 14;
export const MAX_AJUSTE = 800;

export function propuestaAjuste(datos, m) {
  const p = datos.perfil;
  if (!p || Number.isFinite(datos.bloqueados?.kcal)) return null;
  const estado = m.peso.ritmo.estado;
  if (!['amarillo', 'rojo'].includes(estado) || m.peso.n < MIN_PESAJES_RITMO || !m.nutricion.completo) return null;
  if (m.nutricion.adherencia.dias < 4) return null;
  const ultimo = datos.historialKcal?.at(-1);
  if (ultimo && ultimo.fecha > sumarDias(m.domingo, -ESPERA_AJUSTE_DIAS)) return null;
  let delta = null;
  let motivo = '';
  if (pierde(p)) {
    delta = estado === 'amarillo' ? AJUSTES_PROPUESTOS.bajar : AJUSTES_PROPUESTOS.subir;
    motivo = estado === 'amarillo' ? 'Llevas dos semanas bajando menos del 0,25 % a la semana pese a cumplir el objetivo.' : 'Bajas más del 1,25 % a la semana: conviene ir algo más despacio para no perder músculo.';
  } else if (p.objetivo === 'volumen') {
    delta = estado === 'rojo' ? AJUSTES_PROPUESTOS.bajarVolumen : AJUSTES_PROPUESTOS.subirVolumen;
    motivo = estado === 'rojo' ? 'Subes más del 0,75 % a la semana: probablemente sea más grasa que músculo.' : 'Llevas dos semanas casi sin subir pese a cumplir el objetivo.';
  } else return null;
  const actual = Number.isFinite(p.ajusteKcal) ? p.ajusteKcal : 0;
  const nuevo = Math.max(-MAX_AJUSTE, Math.min(MAX_AJUSTE, actual + delta));
  if (nuevo === actual) return null;
  // Nunca por debajo del metabolismo basal.
  const plan = calcularPlan({ ...p, ajusteKcal: nuevo }, { bloqueados: datos.bloqueados, hoy: sumarDias(m.domingo, 1) });
  if (delta < 0 && Math.min(plan.entreno.kcal, plan.descanso.kcal) < plan.basal) return null;
  return { delta: nuevo - actual, motivo, texto: `${motivo} Te propongo ${nuevo - actual > 0 ? 'subir' : 'bajar'} ${Math.abs(nuevo - actual)} kcal al día tu objetivo.` };
}

// Aplicar / descartar la propuesta de una semana, y quitar el ajuste acumulado.
export function aplicarPropuesta(datos, lunes, hoy) {
  const r = datos.resumenes.find((x) => x.id === lunes);
  const prop = r?.datos?.propuesta;
  if (!prop || r.decision) return datos;
  const actual = Number.isFinite(datos.perfil.ajusteKcal) ? datos.perfil.ajusteKcal : 0;
  const ajusteKcal = Math.max(-MAX_AJUSTE, Math.min(MAX_AJUSTE, actual + prop.delta));
  return {
    ...datos,
    perfil: { ...datos.perfil, ajusteKcal },
    historialKcal: [...(datos.historialKcal ?? []), { fecha: hoy, delta: prop.delta, motivo: prop.motivo, semana: lunes }],
    resumenes: datos.resumenes.map((x) => (x.id === lunes ? { ...x, decision: 'aplicada' } : x)),
  };
}

export const descartarPropuesta = (datos, lunes) => ({ ...datos, resumenes: datos.resumenes.map((x) => (x.id === lunes ? { ...x, decision: 'descartada' } : x)) });

export function quitarAjuste(datos, hoy) {
  const actual = datos.perfil?.ajusteKcal;
  if (!Number.isFinite(actual) || !actual) return datos;
  const { ajusteKcal: _fuera, ...perfil } = datos.perfil;
  return { ...datos, perfil, historialKcal: [...(datos.historialKcal ?? []), { fecha: hoy, delta: -actual, motivo: 'Quitaste el ajuste automático.' }] };
}

// ---------- Texto por reglas ----------

const es = (n, d = 1) => (Number.isFinite(n) ? n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '—');
const conSigno = (n, d = 1) => (Number.isFinite(n) ? `${n > 0 ? '+' : n < 0 ? '−' : ''}${es(Math.abs(n), d)}` : '—');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// 1–2 recomendaciones concretas, por orden de importancia.
export function recomendaciones(m) {
  const salida = [];
  const { peso, nutricion: n, entreno: e } = m;
  if (m.propuesta) salida.push(m.propuesta.texto);
  if (peso.ritmo.estado === 'rojo' && !m.propuesta) salida.push('El ritmo es más rápido de lo recomendado: sube unas 100–150 kcal al día (mejor en hidratos alrededor del entreno) para proteger el músculo.');
  if (n.dias && n.proteina.dias < Math.ceil(n.dias / 2)) {
    salida.push(
      n.momentoMenosProteina
        ? `Te falta proteína: solo llegaste ${plural(n.proteina.dias, 'día', 'días')} de ${n.dias}. Refuerza ${n.momentoMenosProteina.nombre.toLowerCase()} (yogur proteico, huevos, pechuga o claras).`
        : `Te falta proteína: solo llegaste ${plural(n.proteina.dias, 'día', 'días')} de ${n.dias}. Añade una ración en la comida donde menos llevas.`,
    );
  }
  if (peso.ritmo.estado === 'amarillo' && !m.propuesta) salida.push('Llevas dos semanas casi sin bajar: quita unas 100–150 kcal al día o suma unos 2.000 pasos diarios.');
  if (e.descarga) salida.push(e.descarga.propuesta);
  if (e.planificadas && e.hechas < e.planificadas) salida.push(`Te ${e.planificadas - e.hechas === 1 ? 'faltó 1 sesión' : `faltaron ${e.planificadas - e.hechas} sesiones`}: si una semana se complica, prioriza los ejercicios principales.`);
  if (!n.completo) salida.push('Apunta al menos 5 días de comidas para que el resumen sea fiable.');
  if (peso.ritmo.estado === 'gris') salida.push('Pésate al menos 4 días por semana (por la mañana, en ayunas) para poder calcular el ritmo.');
  if (n.completo && n.adherencia.de && n.adherencia.dias < Math.ceil(n.adherencia.de / 2)) salida.push('Más de la mitad de los días te alejaste más de un 10 % del objetivo de kcal: planifica la comida más difícil del día con antelación.');
  if (!salida.length) salida.push('Sigue así: mismo plan la semana que viene.');
  return salida.slice(0, 2);
}

export function textoReglas(m) {
  const { peso, nutricion: n, entreno: e, hitos } = m;
  const frases = [];
  if (peso.media !== null) {
    frases.push(
      `Media de peso de ${es(peso.media, 2)} kg` +
        (peso.cambioKg !== null ? ` (${conSigno(peso.cambioKg, 2)} kg, ${conSigno(peso.cambioPct, 2)} % frente a la semana anterior)` : '') +
        (peso.ritmo.estado === 'verde' ? ', a un ritmo ideal.' : peso.ritmo.estado === 'rojo' ? ', bajando demasiado rápido.' : peso.ritmo.estado === 'amarillo' ? ', con un ritmo lento.' : '.'),
    );
  } else frases.push('Esta semana no hay pesajes.');
  if (n.dias) {
    frases.push(`Apuntaste ${n.dias} de 7 días, con ${es(n.kcal.media, 0)} kcal de media (objetivo ${es(n.kcal.objetivo, 0)}) y la proteína cumplida ${plural(n.proteina.dias, 'día', 'días')}.`);
  } else frases.push('No apuntaste comidas.');
  frases.push(`Entrenaste ${e.hechas}${e.planificadas ? ` de ${e.planificadas}` : ''} ${e.hechas === 1 ? 'vez' : 'veces'}${e.records.length ? `, con ${plural(e.records.length, 'récord', 'récords')}` : ''}.`);
  if (hitos.conseguidos.length) frases.push(`¡Hito conseguido: ${hitos.conseguidos.map((h) => `${es(h.valor)} kg${h.recompensa ? ` → ${h.recompensa}` : ''}`).join(', ')}!`);
  return `${frases.join(' ')} ${recomendaciones(m).join(' ')}`.trim();
}

// ---------- Todo junto ----------

// Métricas de una semana. «parcial»: la semana en curso (vista previa).
export function metricasSemana(datos, lunes, { parcial = false } = {}) {
  const domingo = sumarDias(lunes, 6);
  const peso = bloquePeso(datos, lunes);
  const nutricion = bloqueNutricion(datos, lunes);
  const entreno = bloqueEntreno(datos, lunes);
  const siguiente = proximoHito(datos);
  const proy = proyeccion(datos, domingo, { hito: siguiente?.valor, objetivo: datos.perfil?.pesoObjetivo });
  const hitos = bloqueHitos(datos, lunes, peso.media, proy);
  const estado = nutricion.completo && peso.n >= MIN_PESAJES_RITMO ? 'completo' : 'datos_incompletos';
  const m = { version: VERSION_RESUMEN, lunes, domingo, parcial, objetivo: datos.perfil?.objetivo ?? null, peso, nutricion, entreno, proyeccion: proy, hitos, estado };
  // La propuesta de ajuste solo en semanas cerradas.
  m.propuesta = parcial ? null : propuestaAjuste(datos, m);
  return m;
}

// Genera (o regenera) la foto de una semana cerrada: desbloquea los hitos que
// consiga su media, calcula las métricas y guarda el resumen. Idempotente: una
// por semana; regenerar la sobrescribe.
export function generarResumen(datos, lunes, { ahora = Date.now(), texto = null, origen = 'reglas' } = {}) {
  if (!esFecha(lunes)) throw new Error('Semana no válida.');
  const { datos: conHitos } = revisarHitos(datos, sumarDias(lunes, 7));
  const m = metricasSemana(conHitos, lunes);
  const anterior = conHitos.resumenes.find((x) => x.id === lunes);
  if (anterior?.decision) m.propuesta = anterior.datos?.propuesta ?? null;
  // Si ya decidiste sobre la propuesta de esa semana, regenerar no lo deshace.
  const resumen = {
    id: lunes,
    ...(anterior?.decision ? { decision: anterior.decision } : {}),
    generado: ahora,
    texto: (texto && String(texto).trim()) || textoReglas(m),
    origen: texto ? origen : 'reglas',
    estado: m.estado,
    datos: m,
  };
  const resumenes = [...conHitos.resumenes.filter((x) => x.id !== lunes), resumen].sort((a, b) => (a.id < b.id ? -1 : 1));
  return { datos: { ...conHitos, resumenes }, resumen };
}

// Lo que se le pasa a la IA: solo las métricas ya calculadas (nada de registros).
export function peticionResumenIA(m) {
  const n = m.nutricion;
  const e = m.entreno;
  const datosIA = {
    objetivo: m.objetivo,
    peso: { media_kg: m.peso.media, pesajes: m.peso.n, cambio_kg: m.peso.cambioKg, cambio_pct: m.peso.cambioPct, ritmo: m.peso.ritmo.estado, grasa_pct: m.peso.grasa?.media ?? null, masa_magra_kg: m.peso.magra?.media ?? null },
    nutricion: {
      dias_apuntados: n.dias,
      kcal_media: n.kcal.media,
      kcal_objetivo: n.kcal.objetivo,
      dias_en_objetivo_kcal: n.adherencia.dias,
      proteina_media_g: n.proteina.media,
      proteina_objetivo_g: n.proteina.objetivo,
      dias_proteina_cumplida: n.proteina.dias,
      comida_con_menos_proteina: n.momentoMenosProteina?.nombre ?? null,
      dia_con_mas_kcal: n.maximo ? { kcal: n.maximo.kcal, nota: n.maximo.nota } : null,
    },
    entreno: { sesiones: e.hechas, planificadas: e.planificadas, records: e.records.map((x) => x.nombre), minutos_cardio: e.cardioMin, pasos_media: e.pasos?.media ?? null, descarga_recomendada: Boolean(e.descarga) },
    hitos: { conseguidos: m.hitos.conseguidos.map((h) => ({ kg: h.valor, recompensa: h.recompensa })), proximo: m.hitos.proximo ? { kg: m.hitos.proximo.valor, faltan_kg: m.hitos.proximo.faltan, fecha_estimada: m.hitos.proximo.fecha } : null },
    ajuste_propuesto_kcal: m.propuesta?.delta ?? null,
    recomendaciones_sugeridas: recomendaciones(m),
  };
  return {
    sistema:
      'Eres el asistente de Forma, una app de dieta y gimnasio. Escribe en español de España, tuteando, un único párrafo corto (3 a 5 frases) que resuma la semana del usuario y termine con 1 o 2 recomendaciones concretas y accionables. ' +
      'Usa solo los datos que te doy: no inventes cifras ni hagas cálculos nuevos. Sin saludos, sin listas, sin markdown, sin emojis. Si hay un hito conseguido, felicítalo en una frase.',
    usuario: `Métricas de la semana del ${m.lunes} al ${m.domingo}:\n${JSON.stringify(datosIA)}`,
    max: 600,
    etiqueta: 'forma-resumen',
  };
}

// Limpia lo que devuelve la IA (un párrafo, sin markdown).
export function leerTextoIA(texto) {
  const t = String(texto ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length >= 40 ? t.slice(0, 1500) : null;
}
