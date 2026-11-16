// Importar entrenamientos: ejercicios (biblioteca), rutinas y sesiones con sus
// series y su cardio. Lo usa importar.js (mismo flujo y misma transacción que
// los alimentos). Las referencias a ejercicios se resuelven con el
// emparejamiento de emparejar.js y nunca se crea uno en silencio.
import { id, GRUPOS, EQUIPOS, TIPOS_SERIE, TIPOS_CARDIO, grupoDesdeTexto } from './datos.js';
import { emparejarEjercicio, normalizarNombre, limpiarAlias, conAlias, sinTildes } from './emparejar.js';
import { esFecha, diasEntre, sumarDias, fechaCorta } from './fechas.js';
import { ultimaVez, volumenSerie, volumenSesion, carga, esEfectiva, kcalDeCardio } from './entreno.js';
import { mejorMarca, mejorPeso, pesoDeReferencia } from './progreso.js';
import { epley } from './calculos.js';

export const LIMITES_ENTRENO = { ejercicios: 300, rutinas: 50, sesiones: 200, diasAvisoAntigua: 30, minutosAvisoLarga: 240 };
const LB_A_KG = 0.4536;
const ID_EQUIPOS = EQUIPOS.map(([k]) => k);
const ID_CARDIO = TIPOS_CARDIO.map(([k]) => k);
const GRUPOS_JSON = 'pecho, espalda, hombro, biceps, triceps, antebrazo, pierna, gluteo, abdomen, cardio u otro';

// ---------- Utilidades de validación ----------

const cadena = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const corto = (t, n = 28) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const hay = (v) => v !== undefined && v !== null && v !== '';

// Número (también «17,5» en texto). undefined si falta; NaN si no vale.
function numero(v) {
  if (!hay(v)) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return NaN;
}

// Comprueba un número: obligatorio o no, entero o no, y su rango.
function comprobar(v, { min, max, entero = false, obligatorio = false }, mal, campo) {
  const n = numero(v);
  if (n === undefined) {
    if (obligatorio) mal(campo, 'es obligatorio');
    return undefined;
  }
  if (Number.isNaN(n)) return mal(campo, 'debe ser un número'), undefined;
  if (entero && !Number.isInteger(n)) return mal(campo, 'debe ser un número entero'), undefined;
  if (n < min || n > max) return mal(campo, `debe estar entre ${min} y ${max}`), undefined;
  return n;
}

const equipoDesdeTexto = (t) => {
  const k = sinTildes(t).trim().replace(/[\s-]+/g, '_');
  return ID_EQUIPOS.includes(k) ? k : null;
};
const letra = (v) => (typeof v === 'string' && /^[A-Za-z]$/.test(v.trim()) ? v.trim().toUpperCase() : undefined);
const redondea025 = (kg) => Math.round(kg * 4) / 4;

// ---------- Validación de cada sección ----------

// Ejercicio para la biblioteca → { valor, errores, avisos }.
export function validarEjercicio(e, i = 0) {
  const errores = [];
  const avisos = [];
  const nombre = cadena(e?.nombre);
  const donde = `Ejercicio ${i + 1}${nombre ? ` («${corto(nombre)}»)` : ''}`;
  const mal = (campo, mensaje) => errores.push({ donde, campo, mensaje });
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { valor: null, errores: [{ donde: `Ejercicio ${i + 1}`, mensaje: 'tiene que ser un objeto { … }' }], avisos };
  if (!nombre) mal('nombre', 'es obligatorio');
  else if (nombre.length > 80) mal('nombre', 'es demasiado largo (máximo 80 caracteres)');
  let grupo = 'Otro';
  if (hay(e.grupo)) {
    grupo = grupoDesdeTexto(e.grupo);
    if (!grupo) mal('grupo', `«${cadena(e.grupo)}» no vale: usa ${GRUPOS_JSON}`);
  }
  const secundarios = [];
  if (hay(e.grupos_secundarios)) {
    if (!Array.isArray(e.grupos_secundarios)) mal('grupos_secundarios', 'tiene que ser una lista');
    else
      for (const g of e.grupos_secundarios) {
        const x = grupoDesdeTexto(g);
        if (!x) mal('grupos_secundarios', `«${cadena(g)}» no vale: usa ${GRUPOS_JSON}`);
        else if (x !== grupo && !secundarios.includes(x)) secundarios.push(x);
      }
  }
  let equipo = 'otro';
  if (hay(e.equipo)) {
    equipo = equipoDesdeTexto(e.equipo);
    if (!equipo) mal('equipo', `«${cadena(e.equipo)}» no vale: usa barra, mancuerna, polea, maquina, peso_corporal u otro`);
  }
  for (const k of ['principal', 'unilateral']) if (hay(e[k]) && typeof e[k] !== 'boolean') mal(k, 'tiene que ser true o false');
  if (hay(e.alias) && !Array.isArray(e.alias)) mal('alias', 'tiene que ser una lista de textos');
  const idApp = cadena(e.id).slice(0, 80);
  return {
    valor: errores.length ? null : { nombre, ...(idApp ? { id: idApp } : {}), grupo, secundarios, equipo, principal: e.principal === true, unilateral: e.unilateral === true, alias: limpiarAlias(e.alias, nombre) },
    errores,
    avisos,
  };
}

// Referencia a un ejercicio: «ejercicio» (nombre) o «ejercicio_id».
function referencia(x, mal) {
  const nombre = cadena(x?.ejercicio);
  const idApp = cadena(x?.ejercicio_id).slice(0, 80);
  if (!nombre && !idApp) mal('ejercicio', 'falta «ejercicio» (el nombre) o «ejercicio_id»');
  return { nombre, ...(idApp ? { id: idApp } : {}) };
}

// Rutina → { valor, errores, avisos }.
export function validarRutina(r, i = 0) {
  const errores = [];
  const avisos = [];
  const nombre = cadena(r?.nombre);
  const donde = `Rutina ${i + 1}${nombre ? ` («${corto(nombre)}»)` : ''}`;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { valor: null, errores: [{ donde: `Rutina ${i + 1}`, mensaje: 'tiene que ser un objeto { … }' }], avisos };
  const mal = (campo, mensaje, d = donde) => errores.push({ donde: d, campo, mensaje });
  if (!nombre) mal('nombre', 'es obligatorio');
  else if (nombre.length > 80) mal('nombre', 'es demasiado largo (máximo 80 caracteres)');
  const ejercicios = [];
  if (!Array.isArray(r.ejercicios) || !r.ejercicios.length) mal('ejercicios', 'hace falta al menos un ejercicio');
  else
    r.ejercicios.forEach((x, j) => {
      const dj = `${donde} › ejercicio ${j + 1}${x?.ejercicio ? ` («${corto(cadena(x.ejercicio), 22)}»)` : ''}`;
      const m = (campo, mensaje) => mal(campo, mensaje, dj);
      const ref = referencia(x, m);
      const series = comprobar(x?.series, { min: 1, max: 10, entero: true, obligatorio: true }, m, 'series');
      const repMin = comprobar(x?.reps_min, { min: 1, max: 100, entero: true }, m, 'reps_min');
      const repMax = comprobar(x?.reps_max, { min: 1, max: 100, entero: true }, m, 'reps_max');
      if (repMin !== undefined && repMax !== undefined && repMin > repMax) m('reps_min', `(${repMin}) no puede ser mayor que reps_max (${repMax})`);
      const descanso = comprobar(x?.descanso_s, { min: 0, max: 900, entero: true }, m, 'descanso_s');
      if (hay(x?.superserie) && !letra(x.superserie)) m('superserie', 'tiene que ser una letra (A, B…)');
      ejercicios.push({ ref, series, repMin: repMin ?? repMax ?? 8, repMax: repMax ?? repMin ?? 12, ...(descanso !== undefined ? { descanso } : {}), ...(letra(x?.superserie) ? { superserie: letra(x.superserie) } : {}), ...(cadena(x?.notas) ? { notas: cadena(x.notas).slice(0, 300) } : {}) });
    });
  const idApp = cadena(r.id).slice(0, 60);
  return { valor: errores.length ? null : { nombre, ...(idApp ? { id: idApp } : {}), ejercicios }, errores, avisos };
}

// Una serie → { valor } (o errores en `mal`).
function validarSerie(x, mal, avisar) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return mal('', 'tiene que ser un objeto { … }'), null;
  const tipo = hay(x.tipo) ? sinTildes(x.tipo).trim() : 'efectiva';
  if (!TIPOS_SERIE.includes(tipo)) mal('tipo', `«${cadena(x.tipo)}» no vale: usa calentamiento, efectiva o dropset (para «al fallo», "fallo": true)`);
  const segundos = comprobar(x.duracion_s, { min: 1, max: 600, entero: true }, mal, 'duracion_s');
  let kg = comprobar(x.peso_kg, { min: 0, max: 500 }, mal, 'peso_kg');
  if (kg === undefined && hay(x.peso_lb)) {
    const lb = comprobar(x.peso_lb, { min: 0, max: 1100 }, mal, 'peso_lb');
    if (lb !== undefined) kg = redondea025(lb * LB_A_KG);
  }
  if (kg === undefined && segundos === undefined && !hay(x.peso_kg) && !hay(x.peso_lb)) mal('peso_kg', 'es obligatorio (o peso_lb, o duracion_s en isométricos)');
  const lastre = comprobar(x.lastre_kg, { min: 0, max: 200 }, mal, 'lastre_kg');
  const reps = comprobar(x.reps, { min: 1, max: 100, entero: true }, mal, 'reps');
  if (reps === undefined && segundos === undefined && !hay(x.reps)) mal('reps', 'es obligatorio (o duracion_s en isométricos)');
  if (reps > 50) avisar('reps', `${reps} repeticiones en una serie: ¿seguro?`);
  const rir = comprobar(x.rir, { min: 0, max: 5, entero: true }, mal, 'rir');
  if (hay(x.fallo) && typeof x.fallo !== 'boolean') mal('fallo', 'tiene que ser true o false');
  const fallo = x.fallo === true;
  const descanso = comprobar(x.descanso_s, { min: 0, max: 900, entero: true }, mal, 'descanso_s');
  const v = { tipo: TIPOS_SERIE.includes(tipo) ? tipo : 'efectiva', kg: kg ?? 0, reps: reps ?? 0, fallo };
  if (lastre) v.lastre = lastre;
  if (segundos !== undefined) v.segundos = segundos;
  if (fallo) v.rir = 0;
  else if (rir !== undefined) v.rir = rir;
  if (descanso !== undefined) v.descanso = descanso;
  if (cadena(x.notas)) v.notas = cadena(x.notas).slice(0, 300);
  return v;
}

function validarCardio(c, mal) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return mal('', 'tiene que ser un objeto { … }'), null;
  const tipo = sinTildes(cadena(c.tipo));
  if (!tipo) mal('tipo', 'es obligatorio');
  else if (!ID_CARDIO.includes(tipo)) mal('tipo', `«${cadena(c.tipo)}» no vale: usa cinta, andar, correr, bici, eliptica, remo, escaladora u otro`);
  const minutos = comprobar(c.duracion_min, { min: 1, max: 300, entero: true, obligatorio: true }, mal, 'duracion_min');
  const velocidad = comprobar(c.velocidad_kmh, { min: 0.5, max: 30 }, mal, 'velocidad_kmh');
  const inclinacion = comprobar(c.inclinacion_pct, { min: 0, max: 30 }, mal, 'inclinacion_pct');
  const distancia = comprobar(c.distancia_km, { min: 0, max: 100 }, mal, 'distancia_km');
  const fc = comprobar(c.fc_media, { min: 40, max: 220, entero: true }, mal, 'fc_media');
  const kcal = comprobar(c.kcal, { min: 0, max: 3000, entero: true }, mal, 'kcal');
  const intensidad = hay(c.intensidad) ? sinTildes(c.intensidad) : 'media';
  if (!['baja', 'media', 'alta'].includes(intensidad)) mal('intensidad', 'usa baja, media o alta');
  const v = { tipo: ID_CARDIO.includes(tipo) ? tipo : 'otro', minutos: minutos ?? 0, intensidad: ['baja', 'media', 'alta'].includes(intensidad) ? intensidad : 'media' };
  for (const [k, x] of Object.entries({ velocidad, inclinacion, distancia, fc, kcal })) if (x !== undefined) v[k] = x;
  return v;
}

// Sesión → { valor, errores, avisos }. Errores y avisos dicen sesión, ejercicio y serie.
export function validarSesion(s, i = 0, { hoy }) {
  const errores = [];
  const avisos = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return { valor: null, errores: [{ donde: `Sesión ${i + 1}`, mensaje: 'tiene que ser un objeto { … }' }], avisos };
  let fecha = hoy;
  const fechaTexto = cadena(s.fecha);
  const donde = `Sesión ${i + 1}${esFecha(fechaTexto) ? ` (${fechaCorta(fechaTexto)})` : ''}`;
  const mal = (campo, mensaje, d = donde, extra = {}) => errores.push({ donde: d, campo, mensaje, ...extra });
  const avisar = (campo, mensaje, d = donde) => avisos.push({ donde: d, campo, mensaje });
  if (fechaTexto) {
    fecha = fechaTexto;
    if (!esFecha(fecha)) mal('fecha', `«${fecha}» no es una fecha válida: usa AAAA-MM-DD`);
    else if (diasEntre(fecha, hoy) < 0) mal('fecha', 'es del futuro');
    else if (diasEntre(fecha, hoy) > 366) mal('fecha', 'es de hace más de un año');
    else if (diasEntre(fecha, hoy) > LIMITES_ENTRENO.diasAvisoAntigua) avisar('fecha', `es de hace ${diasEntre(fecha, hoy)} días`);
  }
  let hora;
  if (hay(s.hora_inicio)) {
    hora = cadena(s.hora_inicio);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) mal('hora_inicio', `«${hora}» no es una hora HH:mm`);
  }
  const duracion = comprobar(s.duracion_min, { min: 1, max: 300, entero: true }, mal, 'duracion_min');
  if (duracion > LIMITES_ENTRENO.minutosAvisoLarga) avisar('duracion_min', `${duracion} minutos: más de 4 horas`);
  const ejercicios = [];
  if (hay(s.ejercicios) && !Array.isArray(s.ejercicios)) mal('ejercicios', 'tiene que ser una lista');
  (Array.isArray(s.ejercicios) ? s.ejercicios : []).forEach((x, j) => {
    const nombre = cadena(x?.ejercicio) || cadena(x?.ejercicio_id);
    const dj = `${donde} › ${nombre ? `«${corto(nombre, 26)}»` : `ejercicio ${j + 1}`}`;
    const ref = referencia(x, (campo, mensaje) => mal(campo, mensaje, dj, { ej: j }));
    const series = [];
    if (!Array.isArray(x?.series) || !x.series.length) mal('series', 'hace falta al menos una serie', dj, { ej: j });
    else
      x.series.forEach((y, k) => {
        const dk = `${dj} › serie ${k + 1}`;
        const v = validarSerie(
          y,
          (campo, mensaje) => mal(campo, mensaje, dk, { ej: j, serie: k }),
          (campo, mensaje) => avisar(campo, mensaje, dk),
        );
        if (v) series.push(v);
      });
    if (hay(x?.superserie) && !letra(x.superserie)) mal('superserie', 'tiene que ser una letra (A, B…)', dj, { ej: j });
    ejercicios.push({ ref, series, ...(cadena(x?.notas) ? { notas: cadena(x.notas).slice(0, 500) } : {}), ...(letra(x?.superserie) ? { superserie: letra(x.superserie) } : {}) });
  });
  const cardio = [];
  if (hay(s.cardio) && !Array.isArray(s.cardio)) mal('cardio', 'tiene que ser una lista');
  (Array.isArray(s.cardio) ? s.cardio : []).forEach((c, k) => {
    const v = validarCardio(c, (campo, mensaje) => mal(campo, mensaje, `${donde} › cardio ${k + 1}`));
    if (v) cardio.push(v);
  });
  if (!ejercicios.length && !cardio.length) mal('', 'hace falta al menos «ejercicios» o «cardio»');
  const rutina = { nombre: cadena(s.rutina).slice(0, 80), ...(cadena(s.rutina_id) ? { id: cadena(s.rutina_id).slice(0, 60) } : {}) };
  return {
    valor: errores.length ? null : { fecha, ...(hora ? { hora } : {}), ...(duracion ? { duracion } : {}), rutina: rutina.nombre || rutina.id ? rutina : null, notas: cadena(s.notas).slice(0, 2000), ejercicios, cardio },
    errores,
    avisos,
  };
}

// ---------- Plan (vista previa) ----------

// Clave de una referencia: por id si lo trae, si no por nombre normalizado.
export const claveRef = (ref) => (ref.id ? `id:${ref.id}` : `n:${normalizarNombre(ref.nombre)}`);

// Prepara la parte de entrenos del plan a partir de las fuentes (el JSON tal cual,
// que es lo que se edita en la vista previa y se vuelve a validar al confirmar).
export function prepararEntreno(datos, obj, { hoy }) {
  const ejercicios = (obj.ejercicios ?? []).map((fuente, i) => {
    const v = validarEjercicio(fuente, i).valor;
    let e = v ? emparejarEjercicio(datos.ejercicios, v) : { nivel: null, sugerencias: [], avisos: [] };
    // Si su nombre no está, quizá alguno de sus alias sí.
    for (const al of v?.alias ?? []) {
      if (e.existente) break;
      const x = emparejarEjercicio(datos.ejercicios, { nombre: al });
      if (x.existente) e = { ...x, nivel: 'alias' };
    }
    const sugerencias = (e.sugerencias ?? []).filter((s) => s.similitud >= 0.5).map((s) => ({ id: s.ejercicio.id, nombre: s.ejercicio.nombre, similitud: Math.round(s.similitud * 100) / 100 }));
    return { clave: `e${i}`, indice: i, incluir: true, fuente, nivel: e.nivel, existenteId: e.existente?.id ?? null, sugerencias, decision: e.existente ? 'usar' : 'crear', avisoId: e.avisos?.[0] ?? null };
  });
  const rutinas = (obj.rutinas ?? []).map((fuente, i) => {
    const v = validarRutina(fuente, i).valor;
    const existente = v ? datos.rutinas.find((r) => (v.id && r.id === v.id) || normalizarNombre(r.nombre) === normalizarNombre(v.nombre)) : null;
    return { clave: `q${i}`, indice: i, incluir: true, fuente, existenteId: existente?.id ?? null, decision: existente ? 'actualizar' : 'crear' };
  });
  const sesiones = (obj.sesiones ?? []).map((fuente, i) => ({ clave: `s${i}`, indice: i, incluir: true, fuente, duplicadoId: null, decision: 'crear', rutinaResolucion: null }));
  const plan = { ejercicios, rutinas, sesiones, resoluciones: {} };
  // Sesiones que parecen ya importadas: desmarcadas por defecto.
  const r = resolverEntreno(datos, plan, { hoy });
  for (const s of r.sesiones) {
    const p = sesiones.find((x) => x.clave === s.clave);
    // Si la vuelves a marcar, por defecto se fusiona (así no se duplican series).
    if (s.duplicado) Object.assign(p, { duplicadoId: s.duplicado.id, incluir: false, decision: 'fusionar' });
  }
  return plan;
}

// ---------- Resolver ----------

// Resuelve el plan contra tus datos: valida cada fuente otra vez, decide a qué
// ejercicio va cada referencia y calcula lo que se ve en la vista previa.
export function resolverEntreno(datos, plan, { hoy }) {
  const errores = [];
  const avisos = [];
  const visibles = datos.ejercicios.filter((e) => !e.oculto);
  // 1) Ejercicios definidos en el JSON.
  const defs = [];
  const defPor = new Map(); // clave de nombre/alias/id → def
  for (const x of plan.ejercicios ?? []) {
    const i = x.indice;
    const v = validarEjercicio(x.fuente, i);
    if (!x.incluir) continue;
    errores.push(...v.errores.map((e) => ({ ...e, clave: x.clave })));
    if (!v.valor) continue;
    let existente = null;
    if (x.decision !== 'crear') {
      existente = visibles.find((e) => e.id === x.existenteId);
      if (!existente) {
        errores.push({ clave: x.clave, donde: `Ejercicio ${i + 1} («${corto(v.valor.nombre)}»)`, mensaje: 'el ejercicio que ya tenías ya no existe; elige «crear nuevo»' });
        continue;
      }
    }
    const def = { clave: x.clave, decision: x.decision, valor: v.valor, existente };
    const claves = [v.valor.id && `id:${v.valor.id}`, `n:${normalizarNombre(v.valor.nombre)}`, ...v.valor.alias.map((a) => `n:${normalizarNombre(a)}`)].filter(Boolean);
    if (claves.some((k) => defPor.get(k) && defPor.get(k) !== def)) {
      errores.push({ clave: x.clave, donde: `Ejercicio ${i + 1} («${corto(v.valor.nombre)}»)`, mensaje: 'está repetido en la importación' });
      continue;
    }
    for (const k of claves) defPor.set(k, def);
    defs.push(def);
  }
  // 2) Cada referencia (rutinas y sesiones) → a qué ejercicio va.
  const refs = new Map(); // claveRef → { ref, destino, avisos, sugerencias }
  const resolverRef = (ref) => {
    const k = claveRef(ref);
    if (refs.has(k)) return refs.get(k);
    let r = null;
    const avisoRef = [];
    if (ref.id) {
      if (defPor.has(`id:${ref.id}`)) r = { tipo: 'def', def: defPor.get(`id:${ref.id}`) };
      else {
        const e = visibles.find((x) => x.id === ref.id);
        if (e) r = { tipo: 'tuyo', ejercicio: e };
        else if (!datos.ejercicios.some((x) => x.id === ref.id)) avisoRef.push(`el ejercicio_id «${ref.id}» no existe; lo busco por nombre`);
      }
    }
    if (!r && ref.nombre) {
      const n = `n:${normalizarNombre(ref.nombre)}`;
      if (defPor.has(n)) r = { tipo: 'def', def: defPor.get(n) };
    }
    let sugerencias = [];
    if (!r && ref.nombre) {
      const e = emparejarEjercicio(datos.ejercicios, { nombre: ref.nombre });
      if (e.existente) r = { tipo: 'tuyo', ejercicio: e.existente, nivel: e.nivel };
      else sugerencias = e.sugerencias.map((s) => ({ id: s.ejercicio.id, nombre: s.ejercicio.nombre, similitud: Math.round(s.similitud * 100) / 100 }));
    }
    if (!r) {
      // Lo que elegiste en la vista previa: asociarlo a uno tuyo o crearlo.
      const elegido = plan.resoluciones?.[k];
      if (elegido?.tipo === 'asociar') {
        const e = visibles.find((x) => x.id === elegido.ejercicioId);
        if (e) r = { tipo: 'tuyo', ejercicio: e, asociado: true };
      } else if (elegido?.tipo === 'crear') {
        const grupo = GRUPOS.includes(elegido.grupo) ? elegido.grupo : 'Otro';
        r = { tipo: 'nuevo', grupo, equipo: ID_EQUIPOS.includes(elegido.equipo) ? elegido.equipo : 'otro' };
      }
    }
    const out = { clave: k, ref, destino: r, avisos: avisoRef, sugerencias };
    refs.set(k, out);
    return out;
  };
  // Datos de un ejercicio de destino (para unilateral, nombre e historial).
  const ejDe = (r) => (r?.tipo === 'tuyo' ? r.ejercicio : r?.tipo === 'def' ? (r.def.decision === 'crear' ? { ...r.def.valor, id: null } : { ...r.def.existente, ...(r.def.decision === 'actualizar' ? r.def.valor : {}), id: r.def.existente.id }) : r?.tipo === 'nuevo' ? { nombre: '', unilateral: false, id: null } : null);

  // 3) Rutinas.
  const rutinas = [];
  const rutinaPor = new Map();
  for (const x of plan.rutinas ?? []) {
    if (!x.incluir) continue;
    const v = validarRutina(x.fuente, x.indice);
    errores.push(...v.errores.map((e) => ({ ...e, clave: x.clave })));
    if (!v.valor) continue;
    const existente = x.decision === 'actualizar' ? datos.rutinas.find((r) => r.id === x.existenteId) : null;
    if (x.decision === 'actualizar' && !existente) {
      errores.push({ clave: x.clave, donde: `Rutina ${x.indice + 1}`, mensaje: 'la rutina que ibas a actualizar ya no existe; elige «crear otra»' });
      continue;
    }
    const ejercicios = v.valor.ejercicios.map((e) => ({ ...e, destino: resolverRef(e.ref).destino }));
    const rut = { clave: x.clave, decision: x.decision, valor: v.valor, existente, ejercicios };
    rutinas.push(rut);
    for (const k of [v.valor.id && `id:${v.valor.id}`, `n:${normalizarNombre(v.valor.nombre)}`].filter(Boolean)) rutinaPor.set(k, rut);
  }

  // 4) Sesiones.
  const sesiones = [];
  const vistas = [];
  for (const x of plan.sesiones ?? []) {
    const v = validarSesion(x.fuente, x.indice, { hoy });
    if (!x.incluir) {
      sesiones.push({ clave: x.clave, incluir: false, valor: v.valor, duplicado: x.duplicadoId ? datos.sesiones.find((s) => s.id === x.duplicadoId) ?? null : null });
      continue;
    }
    errores.push(...v.errores.map((e) => ({ ...e, clave: x.clave })));
    avisos.push(...v.avisos.map((e) => ({ ...e, clave: x.clave })));
    if (!v.valor) continue;
    const s = v.valor;
    const ejercicios = s.ejercicios.map((e) => ({ ...e, destino: resolverRef(e.ref).destino }));
    // Rutina: del JSON, tuya o por resolver (crearla con estos ejercicios o ninguna).
    let rutina = null;
    if (s.rutina) {
      const k = [s.rutina.id && `id:${s.rutina.id}`, s.rutina.nombre && `n:${normalizarNombre(s.rutina.nombre)}`].filter(Boolean);
      const delJSON = k.map((y) => rutinaPor.get(y)).find(Boolean);
      const tuya = datos.rutinas.find((r) => (s.rutina.id && r.id === s.rutina.id) || (s.rutina.nombre && normalizarNombre(r.nombre) === normalizarNombre(s.rutina.nombre)));
      if (delJSON) rutina = { tipo: 'json', rutina: delJSON };
      else if (tuya) rutina = { tipo: 'tuya', rutina: tuya };
      else if (x.rutinaResolucion === 'crear') rutina = { tipo: 'crear', nombre: s.rutina.nombre || 'Rutina importada' };
      else if (x.rutinaResolucion === 'ninguna') rutina = { tipo: 'ninguna' };
      else rutina = { tipo: 'pendiente', nombre: s.rutina.nombre || s.rutina.id };
    }
    // ¿Ya la tenías? Mismo día y misma rutina, o al menos la mitad de los ejercicios.
    const ids = ejercicios.map((e) => ejDe(e.destino)?.id).filter(Boolean);
    const duplicado =
      datos.sesiones.find((d) => {
        if (d.fecha !== s.fecha) return false;
        const rid = rutina?.tipo === 'tuya' ? rutina.rutina.id : rutina?.tipo === 'json' ? rutina.rutina.existente?.id : null;
        if (rid && d.rutinaId === rid) return true;
        // Al menos la mitad de los ejercicios importados ya estaban en esa sesión.
        const nuevos = new Set(ids);
        const suyos = new Set(d.series.map((y) => y.ejercicioId));
        return nuevos.size > 0 && [...nuevos].filter((y) => suyos.has(y)).length / nuevos.size >= 0.5;
      }) ?? null;
    if (duplicado && !['fusionar', 'sustituir', 'crear'].includes(x.decision)) errores.push({ clave: x.clave, donde: `Sesión ${x.indice + 1}`, mensaje: 'elige fusionar, sustituir o crear otra' });
    // Dos sesiones del propio JSON el mismo día con los mismos ejercicios.
    const firma = `${s.fecha}|${[...new Set(ids)].sort().join(',')}`;
    if (ids.length && vistas.includes(firma)) avisos.push({ clave: x.clave, donde: `Sesión ${x.indice + 1}`, mensaje: 'el JSON trae otra sesión el mismo día con los mismos ejercicios' });
    vistas.push(firma);
    sesiones.push({ clave: x.clave, incluir: true, valor: s, ejercicios, rutina, duplicado, decision: x.decision });
  }

  // 5) Lo que queda por resolver (cuenta en el botón «Importar»).
  const pendientes = [...refs.values()].filter((r) => !r.destino);
  for (const r of refs.values()) for (const a of r.avisos) avisos.push({ clave: `ref:${r.clave}`, donde: `«${r.ref.nombre || r.ref.id}»`, mensaje: a });
  const rutinasPendientes = sesiones.filter((s) => s.incluir && s.rutina?.tipo === 'pendiente');
  return { errores, avisos, defs, refs: [...refs.values()], pendientes, rutinas, sesiones, rutinasPendientes, ejDe };
}

// ---------- Vista previa: última vez, récords, volumen ----------

// Para cada ejercicio de una sesión resuelta: lo que hiciste la última vez,
// si hay récord, y el volumen de la sesión frente a la última de la misma rutina.
export function detallesSesion(datos, resuelto, sesion) {
  const antes = sumarDias(sesion.valor.fecha, -1);
  const avisos = [];
  const ejercicios = sesion.ejercicios.map((e) => {
    const ej = resuelto.ejDe(e.destino);
    const eid = ej?.id ?? null;
    const efectivas = e.series.filter(esEfectiva);
    const ultima = eid ? ultimaVez(datos, eid, antes) : null;
    let record = null;
    if (eid && efectivas.length) {
      const previa = mejorMarca(datos, eid, antes);
      const pesoPrevio = mejorPeso(datos, eid, antes);
      const mejor1rm = Math.max(...efectivas.map((x) => epley(carga(x), x.reps)));
      const mejorCarga = Math.max(...efectivas.map(carga));
      if (previa && (mejor1rm > previa.e1rm + 0.01 || mejorCarga > pesoPrevio)) record = { peso: mejorCarga > pesoPrevio, e1rm: mejor1rm > previa.e1rm + 0.01, valor1rm: Math.round(mejor1rm * 10) / 10, previo1rm: previa.e1rm };
    }
    // Peso muy distinto del habitual (la media de las efectivas de la última vez).
    if (ultima?.series.length) {
      const habitual = ultima.series.reduce((t, x) => t + carga(x), 0) / ultima.series.length;
      if (habitual > 0)
        e.series.forEach((x, k) => {
          if (!esEfectiva(x) || !carga(x)) return;
          if (carga(x) > habitual * 2 || carga(x) < habitual / 2) avisos.push({ ej: sesion.ejercicios.indexOf(e), serie: k, mensaje: `${ej?.nombre ?? 'ejercicio'} › serie ${k + 1}: ${carga(x)} kg es ${carga(x) > habitual ? 'más del doble' : 'menos de la mitad'} de lo habitual (${Math.round(habitual * 10) / 10} kg)` });
        });
    }
    return { eid, nombre: ej?.nombre || e.ref.nombre, ultima, record, volumen: Math.round(e.series.reduce((t, x) => t + volumenSerie(x, ej), 0)) };
  });
  const volumen = ejercicios.reduce((t, e) => t + e.volumen, 0);
  // Comparación con la última sesión de la misma rutina (si es tuya o se actualiza).
  const rid = sesion.rutina?.tipo === 'tuya' ? sesion.rutina.rutina.id : sesion.rutina?.tipo === 'json' ? sesion.rutina.rutina.existente?.id : null;
  const anterior = rid ? datos.sesiones.filter((s) => s.rutinaId === rid && s.fecha <= sesion.valor.fecha && s.id !== sesion.duplicado?.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] : null;
  const peso = pesoDeReferencia(datos, sesion.valor.fecha) ?? datos.perfil?.peso ?? 75;
  const cardio = sesion.valor.cardio.map((c) => ({ ...c, kcal: c.kcal ?? kcalDeCardio(c, peso), estimadas: c.kcal === undefined }));
  return { ejercicios, volumen, anterior: anterior ? { fecha: anterior.fecha, volumen: volumenSesion(datos, anterior) } : null, avisos, cardio };
}

// ---------- Aplicar ----------

const inicioDe = (fecha, hora) => new Date(`${fecha}T${hora}:00`).getTime();

// Aplica la parte de entrenos sobre `datos` (ya con los alimentos aplicados).
export function aplicarEntreno(datos, resuelto, { ahora = Date.now() } = {}) {
  let ejercicios = [...datos.ejercicios];
  let rutinasLista = [...datos.rutinas];
  let sesionesLista = [...datos.sesiones];
  const resumen = { ejerciciosCreados: 0, ejerciciosActualizados: 0, alias: 0, rutinasCreadas: 0, rutinasActualizadas: 0, sesiones: 0, sesionesFusionadas: 0, series: 0, fechasEntreno: [] };
  const guardarEj = (e) => {
    ejercicios = ejercicios.some((x) => x.id === e.id) ? ejercicios.map((x) => (x.id === e.id ? e : x)) : [...ejercicios, e];
    return e;
  };
  const anadirAlias = (eid, ...nombres) => {
    const actual = ejercicios.find((x) => x.id === eid);
    const nuevo = conAlias(actual, ...nombres);
    if (nuevo.alias.length > actual.alias.length) resumen.alias += nuevo.alias.length - actual.alias.length;
    return guardarEj(nuevo);
  };
  // 1) Ejercicios del JSON.
  for (const d of resuelto.defs) {
    const v = d.valor;
    if (d.decision === 'crear') {
      d.final = guardarEj({ id: id('x'), nombre: v.nombre, grupo: v.grupo, secundarios: v.secundarios, equipo: v.equipo, unilateral: v.unilateral, principal: v.principal, alias: v.alias, oculto: false, propio: true, origen: 'importado' });
      resumen.ejerciciosCreados++;
    } else {
      if (d.decision === 'actualizar') {
        guardarEj({ ...ejercicios.find((x) => x.id === d.existente.id), grupo: v.grupo, secundarios: v.secundarios, equipo: v.equipo, unilateral: v.unilateral, principal: v.principal });
        resumen.ejerciciosActualizados++;
      }
      const nombres = [v.nombre, ...v.alias].filter((n) => normalizarNombre(n) !== normalizarNombre(d.existente.nombre));
      d.final = nombres.length ? anadirAlias(d.existente.id, ...nombres) : ejercicios.find((x) => x.id === d.existente.id);
    }
  }
  // 2) Referencias que resolviste a mano: asociar (el nombre pasa a alias) o crear.
  const finalDe = new Map();
  for (const r of resuelto.refs) {
    const dest = r.destino;
    if (dest?.tipo === 'nuevo') {
      finalDe.set(r.clave, guardarEj({ id: id('x'), nombre: r.ref.nombre || r.ref.id, grupo: dest.grupo, secundarios: [], equipo: dest.equipo, unilateral: false, principal: false, alias: [], oculto: false, propio: true, origen: 'importado' }));
      resumen.ejerciciosCreados++;
    } else if (dest?.tipo === 'tuyo') {
      const otro = r.ref.nombre && normalizarNombre(r.ref.nombre) !== normalizarNombre(dest.ejercicio.nombre);
      finalDe.set(r.clave, otro && dest.asociado ? anadirAlias(dest.ejercicio.id, r.ref.nombre) : dest.ejercicio);
    } else if (dest?.tipo === 'def') finalDe.set(r.clave, dest.def.final);
  }
  const eidDe = (destino, ref) => finalDe.get(claveRef(ref))?.id ?? (destino?.tipo === 'def' ? destino.def.final.id : destino?.ejercicio?.id);
  // 3) Rutinas.
  const rutinaFinal = new Map();
  for (const r of resuelto.rutinas) {
    const lista = r.ejercicios.map(({ ref, destino, ...e }) => ({ ejercicioId: eidDe(destino, ref), ...e }));
    if (r.decision === 'actualizar') {
      // Se queda tu nombre (el del JSON solo coincide al normalizarlo).
      const nueva = { ...r.existente, ejercicios: lista };
      rutinasLista = rutinasLista.map((x) => (x.id === nueva.id ? nueva : x));
      rutinaFinal.set(r.clave, nueva);
      resumen.rutinasActualizadas++;
    } else {
      const nueva = { id: id('q'), nombre: r.valor.nombre, ejercicios: lista, origen: 'importado' };
      rutinasLista.push(nueva);
      rutinaFinal.set(r.clave, nueva);
      resumen.rutinasCreadas++;
    }
  }
  // 4) Sesiones.
  const peso = (fecha) => pesoDeReferencia(datos, fecha) ?? datos.perfil?.peso ?? 75;
  resuelto.sesiones.forEach((s, n) => {
    if (!s.incluir) return;
    const v = s.valor;
    const series = [];
    const meta = [];
    for (const e of s.ejercicios) {
      const eid = eidDe(e.destino, e.ref);
      if (!meta.some((m) => m.ejercicioId === eid)) meta.push({ ejercicioId: eid, ...(e.notas ? { notas: e.notas } : {}), ...(e.superserie ? { superserie: e.superserie } : {}) });
      for (const x of e.series) series.push({ id: id('k'), ejercicioId: eid, ...x, calentamiento: x.tipo === 'calentamiento', hecha: true });
    }
    const cardio = v.cardio.map((c) => ({ id: id('c'), ...c, kcal: c.kcal ?? kcalDeCardio(c, peso(v.fecha)) }));
    let rutinaId;
    let nombre = 'Entreno importado';
    if (s.rutina?.tipo === 'json') ({ id: rutinaId, nombre } = rutinaFinal.get(s.rutina.rutina.clave));
    else if (s.rutina?.tipo === 'tuya') ({ id: rutinaId, nombre } = s.rutina.rutina);
    else if (s.rutina?.tipo === 'crear') {
      // Rutina hecha con esta sesión: tantas series como efectivas, y su rango de reps.
      const ejs = meta.map((m) => {
        const ef = series.filter((x) => x.ejercicioId === m.ejercicioId && x.tipo === 'efectiva' && x.reps > 0);
        const reps = ef.map((x) => x.reps);
        return { ejercicioId: m.ejercicioId, series: Math.max(1, Math.min(10, ef.length || 3)), repMin: reps.length ? Math.min(...reps) : 8, repMax: reps.length ? Math.max(...reps) : 12 };
      });
      const nueva = { id: id('q'), nombre: s.rutina.nombre, ejercicios: ejs, origen: 'importado' };
      rutinasLista.push(nueva);
      resumen.rutinasCreadas++;
      ({ id: rutinaId, nombre } = nueva);
    }
    const inicio = v.hora ? inicioDe(v.fecha, v.hora) : v.duracion ? inicioDe(v.fecha, '18:00') : undefined;
    const nueva = { id: id('s'), fecha: v.fecha, ...(rutinaId ? { rutinaId } : {}), nombre, ...(inicio ? { inicio } : {}), ...(inicio && v.duracion ? { fin: inicio + v.duracion * 60000 } : {}), notas: v.notas, ejercicios: meta, series, cardio, origen: 'importado' };
    if (s.duplicado && s.decision === 'sustituir') {
      sesionesLista = sesionesLista.map((x) => (x.id === s.duplicado.id ? { ...nueva, id: s.duplicado.id } : x));
    } else if (s.duplicado && s.decision === 'fusionar') {
      // Se añaden los ejercicios y las series que no estaban (repetida: mismo ejercicio, orden, tipo, peso y reps).
      const d = sesionesLista.find((x) => x.id === s.duplicado.id);
      const orden = (lista, x) => lista.filter((y) => y.ejercicioId === x.ejercicioId).indexOf(x);
      const repetida = (x) => d.series.some((y) => y.ejercicioId === x.ejercicioId && orden(d.series, y) === orden(series, x) && (y.tipo ?? (y.calentamiento ? 'calentamiento' : 'efectiva')) === x.tipo && y.kg === x.kg && y.reps === x.reps);
      const nuevasSeries = series.filter((x) => !repetida(x));
      const metaD = [...(d.ejercicios ?? [])];
      for (const m of meta) if (!metaD.some((y) => y.ejercicioId === m.ejercicioId)) metaD.push(m);
      const cardioD = [...d.cardio, ...cardio.filter((c) => !d.cardio.some((y) => y.tipo === c.tipo && y.minutos === c.minutos))];
      const fusion = { ...d, ejercicios: metaD, series: [...d.series, ...nuevasSeries], cardio: cardioD, notas: [d.notas, v.notas].filter(Boolean).filter((t, k, a) => a.indexOf(t) === k).join('\n') };
      sesionesLista = sesionesLista.map((x) => (x.id === d.id ? fusion : x));
      resumen.sesionesFusionadas++;
      resumen.series += nuevasSeries.length;
      resumen.fechasEntreno.push(v.fecha);
      return;
    } else sesionesLista.push({ ...nueva, creado: ahora + n });
    resumen.sesiones++;
    resumen.series += series.length;
    resumen.fechasEntreno.push(v.fecha);
  });
  resumen.fechasEntreno = [...new Set(resumen.fechasEntreno)].sort();
  return { datos: { ...datos, ejercicios, rutinas: rutinasLista, sesiones: sesionesLista }, resumen };
}
