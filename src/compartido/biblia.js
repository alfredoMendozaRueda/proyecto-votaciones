// Lectura bíblica: planes de lectura (listos o tuyos), las casillas de cada día
// («He leído», «He orado» y las que añadas), el tiempo, la racha, los avisos y
// el resumen del mes. La versión es la Reina-Valera 1960: tiene derechos, así que
// aquí no va su texto; cada lectura se abre en YouVersion con esa versión.
//
// Un plan es una lista de días con sus capítulos («JHN.3»). Si te atrasas, lo
// pendiente se reparte en los días que quedan, se corre la fecha final o se salta.
import { LIBROS_DATOS } from './biblia-libros.js';

// ---------- Libros y capítulos ----------

export const LIBROS = LIBROS_DATOS.map(([id, nombre, abrev, versos], i) => ({ id, nombre, abrev, versos, capitulos: versos.length, at: i < 39, orden: i }));
const POR_ID = new Map(LIBROS.map((l) => [l.id, l]));
export const libro = (id) => POR_ID.get(id) ?? null;
export const TOTAL_CAPITULOS = LIBROS.reduce((s, l) => s + l.capitulos, 0);

// Grupos para elegir libros de una vez.
export const GRUPOS = [
  { id: 'at', nombre: 'Antiguo Testamento', libros: LIBROS.filter((l) => l.at).map((l) => l.id) },
  { id: 'nt', nombre: 'Nuevo Testamento', libros: LIBROS.filter((l) => !l.at).map((l) => l.id) },
  { id: 'pentateuco', nombre: 'Pentateuco', libros: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'] },
  { id: 'historicos', nombre: 'Históricos', libros: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'] },
  { id: 'poeticos', nombre: 'Poéticos', libros: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'] },
  { id: 'profetas', nombre: 'Profetas', libros: LIBROS.slice(22, 39).map((l) => l.id) },
  { id: 'evangelios', nombre: 'Evangelios', libros: ['MAT', 'MRK', 'LUK', 'JHN'] },
  { id: 'pablo', nombre: 'Cartas de Pablo', libros: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'] },
  { id: 'generales', nombre: 'Cartas generales', libros: ['HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'] },
];

// «JHN.3» ↔ { libro: 'JHN', capitulo: 3 }.
const CAPITULO = /^([1-3]?[A-Z]{2,3})\.(\d{1,3})$/;
export function leerCapitulo(clave) {
  const m = CAPITULO.exec(String(clave ?? ''));
  const l = m && POR_ID.get(m[1]);
  const n = m ? Number(m[2]) : 0;
  return l && n >= 1 && n <= l.capitulos ? { libro: l.id, capitulo: n } : null;
}
export const capituloValido = (clave) => leerCapitulo(clave) !== null;
const peso = (clave) => {
  const c = leerCapitulo(clave);
  return c ? POR_ID.get(c.libro).versos[c.capitulo - 1] : 0;
};
export const versiculosDe = (caps) => caps.reduce((s, c) => s + peso(c), 0);

// Los capítulos de unos libros (en el orden dado), o de un tramo: ['GEN', 1, 11].
export function capitulosDe(...partes) {
  const salida = [];
  for (const p of partes) {
    const [id, desde, hasta] = Array.isArray(p) ? p : [p];
    const l = POR_ID.get(id);
    if (!l) throw new Error(`Libro desconocido: ${id}`);
    for (let c = desde ?? 1; c <= (hasta ?? desde ?? l.capitulos) && c <= l.capitulos; c++) salida.push(`${l.id}.${c}`);
  }
  return salida;
}

// ---------- Cómo se dice y dónde se abre ----------

// ['JHN.3', 'JHN.4', 'ACT.1'] → [{ libro: 'JHN', desde: 3, hasta: 4 }, { libro: 'ACT', desde: 1, hasta: 1 }].
export function tramos(caps) {
  const salida = [];
  for (const clave of caps) {
    const c = leerCapitulo(clave);
    if (!c) continue;
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.libro === c.libro && ultimo.hasta === c.capitulo - 1) ultimo.hasta = c.capitulo;
    else salida.push({ libro: c.libro, desde: c.capitulo, hasta: c.capitulo });
  }
  return salida;
}
// «Juan 3–4», «Abdías», «Génesis 50 – Éxodo 2» no: cada libro va aparte, «Génesis 50 · Éxodo 1–2».
export function nombreTramo(t, { corto = false } = {}) {
  const l = POR_ID.get(t.libro);
  const nombre = corto ? l.abrev : l.nombre;
  if (l.capitulos === 1) return nombre;
  if (t.desde === 1 && t.hasta === l.capitulos && l.capitulos > 1) return `${nombre} (entero)`;
  return t.desde === t.hasta ? `${nombre} ${t.desde}` : `${nombre} ${t.desde}–${t.hasta}`;
}
export const textoLectura = (caps, opciones) => tramos(caps).map((t) => nombreTramo(t, opciones)).join(' · ');

// Reina-Valera 1960 en YouVersion (abre la app si está instalada).
export const VERSION_YOUVERSION = 149;
export const enlaceCapitulo = (clave) => `https://www.bible.com/bible/${VERSION_YOUVERSION}/${clave}.RVR1960`;
export const enlaceTramo = (t) => enlaceCapitulo(`${t.libro}.${t.desde}`);
// «JHN.3.16» o «PRO.3.5-6».
export const enlaceCita = (cita) => `https://www.bible.com/bible/${VERSION_YOUVERSION}/${cita}.RVR1960`;
export function nombreCita(cita) {
  const [id, cap, versos] = String(cita).split('.');
  const l = POR_ID.get(id);
  if (!l) return cita;
  return `${l.nombre} ${l.capitulos === 1 ? '' : `${cap}:`}${(versos ?? '').replace('-', '–')}`.replace(/\s+:/, ' ');
}

// ---------- Repartir capítulos en días ----------

// Trozos seguidos y parecidos en peso: n grupos (o menos, si hay menos piezas).
// Cada grupo se cierra cuando añadir la siguiente pieza lo alejaría de la media de lo que falta.
export function agrupar(piezas, n, pesoDe) {
  if (n <= 0 || !piezas.length) return [];
  const grupos = Math.min(n, piezas.length);
  const salida = [];
  let i = 0;
  let restante = piezas.reduce((s, x) => s + pesoDe(x), 0);
  for (let g = 0; g < grupos; g++) {
    const quedan = grupos - g;
    const objetivo = restante / quedan;
    const grupo = [];
    let suma = 0;
    // Siempre al menos una pieza, y dejando al menos una para cada grupo que falta.
    while (i < piezas.length && piezas.length - i > quedan - 1) {
      const p = pesoDe(piezas[i]);
      if (grupo.length && Math.abs(suma + p - objetivo) > Math.abs(suma - objetivo)) break;
      grupo.push(piezas[i++]);
      suma += p;
    }
    if (quedan === 1) while (i < piezas.length) grupo.push(piezas[i++]);
    restante -= grupo.reduce((s, x) => s + pesoDe(x), 0);
    salida.push(grupo);
  }
  return salida;
}
// Capítulos en n días, parecidos en versículos.
export const repartir = (caps, n) => agrupar(caps.filter(capituloValido), n, peso);

// ---------- Fechas ----------

const dos = (n) => String(n).padStart(2, '0');
export const fechaISO = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
export function fechaValida(t) {
  const m = FECHA.exec(String(t ?? ''));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}
export function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  return fechaISO(new Date(a, m - 1, d + n));
}
// 1 = lunes … 7 = domingo.
export function diaSemana(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return ((new Date(a, m - 1, d).getDay() + 6) % 7) + 1;
}
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00`) - Date.parse(`${a}T12:00`)) / 86_400_000);
export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 7];

// Los días de lectura desde «desde»: n seguidos (o hasta «hasta», incluido).
export function diasDeLectura(desde, { n = Infinity, hasta = null, dias = TODOS_LOS_DIAS } = {}) {
  const salida = [];
  const validos = new Set(dias.length ? dias : TODOS_LOS_DIAS);
  for (let f = desde; salida.length < n && (!hasta || f <= hasta) && salida.length < 5000; f = sumarDias(f, 1)) if (validos.has(diaSemana(f))) salida.push(f);
  return salida;
}

// ---------- Planes listos ----------

// La cronología es aproximada (de los hechos, no de cuándo se escribió cada libro):
// Job tras Génesis 11, los Salmos con David, los profetas con sus reyes, las cartas dentro de Hechos.
const CRONOLOGICA = [
  ['GEN', 1, 11], 'JOB', ['GEN', 12, 50], 'EXO', 'LEV', 'NUM', 'DEU', ['PSA', 90, 90], 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1CH',
  ['PSA', 1, 89], ['PSA', 91, 150], ['1KI', 1, 11], ['2CH', 1, 9], 'PRO', 'SNG', 'ECC', ['1KI', 12, 22], ['2CH', 10, 20],
  ['2KI', 1, 13], 'JOL', 'JON', ['2KI', 14, 14], 'AMO', 'HOS', ['2CH', 21, 28], ['2KI', 15, 17], 'ISA', 'MIC', ['2KI', 18, 20],
  ['2CH', 29, 32], 'NAM', ['2KI', 21, 23], ['2CH', 33, 35], 'ZEP', 'HAB', 'JER', ['2KI', 24, 25], ['2CH', 36, 36], 'LAM', 'EZK',
  'OBA', 'DAN', ['EZR', 1, 6], 'HAG', 'ZEC', 'EST', ['EZR', 7, 10], 'NEH', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', ['ACT', 1, 14], 'JAS', 'GAL', ['ACT', 15, 18], '1TH', '2TH', ['ACT', 19, 19], '1CO', '2CO', 'ROM',
  ['ACT', 20, 28], 'EPH', 'PHP', 'COL', 'PHM', '1TI', 'TIT', '1PE', 'HEB', '2TI', '2PE', 'JUD', '1JN', '2JN', '3JN', 'REV',
];
const todos = (filtro = () => true) => LIBROS.filter(filtro).map((l) => l.id);

// Cada plan: una o varias «pistas» que se reparten a la vez (así, AT y NT cada día).
export const PLANTILLAS = [
  { id: 'anio-orden', nombre: 'La Biblia en un año', detalle: 'De Génesis a Apocalipsis, unos 3-4 capítulos al día.', dias: 365, pistas: () => [capitulosDe(...todos())] },
  { id: 'anio-mixta', nombre: 'La Biblia en un año (AT y NT cada día)', detalle: 'Cada día un trozo del Antiguo y otro del Nuevo Testamento.', dias: 365, pistas: () => [capitulosDe(...todos((l) => l.at)), capitulosDe(...todos((l) => !l.at))] },
  { id: 'anio-cronologica', nombre: 'La Biblia en un año (cronológica)', detalle: 'En el orden aproximado en que pasaron las cosas.', dias: 365, pistas: () => [capitulosDe(...CRONOLOGICA)] },
  { id: 'nt-90', nombre: 'El Nuevo Testamento en 90 días', detalle: 'Unos 3 capítulos al día.', dias: 90, pistas: () => [capitulosDe(...todos((l) => !l.at))] },
  { id: 'evangelios-40', nombre: 'Los cuatro Evangelios en 40 días', detalle: 'Mateo, Marcos, Lucas y Juan.', dias: 40, pistas: () => [capitulosDe('MAT', 'MRK', 'LUK', 'JHN')] },
  { id: 'salmos-proverbios', nombre: 'Salmos y Proverbios en un mes', detalle: 'Un capítulo de Proverbios y unos 5 Salmos al día.', dias: 31, pistas: () => [capitulosDe('PRO'), capitulosDe('PSA')] },
  // De grupo: ritmo fijo (3 capítulos justos al día) y aparte de tu lectura personal.
  { id: 'jovenes', nombre: 'Lectura Jóvenes', detalle: 'Con el grupo: 3 capítulos al día, de Génesis a Apocalipsis. Va aparte de tu lectura.', dias: Math.ceil(TOTAL_CAPITULOS / 3), porDia: 3, grupo: true, pistas: () => [capitulosDe(...todos())] },
];
export const ID_PLAN_JOVENES = 'pjovenes';
export const plantilla = (id) => PLANTILLAS.find((p) => p.id === id) ?? null;

// ---------- Datos ----------

const MAX_PLANES = 20;
const MAX_CASILLAS = 8;
const cadena = (t, max) => (typeof t === 'string' ? t.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const entero = (n, min, max) => (Number.isInteger(n) && n >= min && n <= max ? n : null);
export const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const listaDias = (d) => {
  const lista = [...new Set((Array.isArray(d) ? d : []).filter((x) => entero(x, 1, 7)))].sort();
  return lista.length ? lista : [...TODOS_LOS_DIAS];
};

function normalizarPlan(p) {
  if (!p || typeof p !== 'object') return null;
  const vistas = new Set();
  const lecturas = (Array.isArray(p.lecturas) ? p.lecturas : [])
    .filter((l) => l && fechaValida(l.fecha) && !vistas.has(l.fecha) && vistas.add(l.fecha))
    .map((l) => ({ fecha: l.fecha, caps: (Array.isArray(l.caps) ? l.caps : []).filter(capituloValido).slice(0, 200) }))
    .filter((l) => l.caps.length)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 2000);
  if (!lecturas.length) return null;
  const fechas = new Set(lecturas.map((l) => l.fecha));
  const hechas = {};
  for (const [f, cuando] of Object.entries(p.hechas && typeof p.hechas === 'object' ? p.hechas : {})) {
    // Cuándo la marcaste (el día, para saber qué leíste cada día).
    if (fechas.has(f) && fechaValida(cuando)) hechas[f] = cuando;
  }
  return {
    id: typeof p.id === 'string' && /^p[0-9a-z]{4,30}$/.test(p.id) ? p.id : nuevoId('p'),
    nombre: cadena(p.nombre, 80) || 'Mi plan',
    plantilla: typeof p.plantilla === 'string' && plantilla(p.plantilla) ? p.plantilla : '',
    dias: listaDias(p.dias),
    lecturas,
    hechas,
    saltadas: [...new Set((Array.isArray(p.saltadas) ? p.saltadas : []).filter((f) => fechas.has(f) && !hechas[f]))],
    archivado: p.archivado === true,
    creado: Number.isFinite(p.creado) ? p.creado : 0,
    // De grupo (Lectura Jóvenes): va aparte de tu lectura; porDia = capítulos fijos al día.
    grupo: p.grupo === true || p.plantilla === 'jovenes',
    porDia: entero(p.porDia, 1, 20) ?? (p.plantilla === 'jovenes' ? 3 : 0),
  };
}

function normalizarDia(d) {
  if (!d || typeof d !== 'object') return null;
  const extra = {};
  for (const [id, si] of Object.entries(d.extra && typeof d.extra === 'object' ? d.extra : {})) if (/^c[0-9a-z]{2,30}$/.test(id) && si === true) extra[id] = true;
  const preguntas =
    d.preguntas && typeof d.preguntas === 'object' && Array.isArray(d.preguntas.lista)
      ? { sobre: cadena(d.preguntas.sobre, 200), lista: d.preguntas.lista.map((q) => cadena(q, 300)).filter(Boolean).slice(0, 5) }
      : null;
  const salida = {
    leido: d.leido === true,
    orado: d.orado === true,
    extra,
    minLectura: entero(d.minLectura, 0, 24 * 60) ?? 0,
    minOracion: entero(d.minOracion, 0, 24 * 60) ?? 0,
    nota: cadena(d.nota, 2000),
    ...(preguntas?.lista.length ? { preguntas } : {}),
  };
  const vacio = !salida.leido && !salida.orado && !Object.keys(extra).length && !salida.minLectura && !salida.minOracion && !salida.nota && !salida.preguntas;
  return vacio ? null : salida;
}

export const AJUSTES_BIBLIA = { avisoManana: '08:00', avisoNoche: '21:30', avisos: true };

export function normalizarBiblia(d = {}) {
  const datos = d && typeof d === 'object' ? d : {};
  const dias = {};
  for (const [f, x] of Object.entries(datos.dias && typeof datos.dias === 'object' ? datos.dias : {})) {
    const n = fechaValida(f) && normalizarDia(x);
    if (n) dias[f] = n;
  }
  const casillas = (Array.isArray(datos.casillas) ? datos.casillas : [])
    .filter((c) => c && /^c[0-9a-z]{2,30}$/.test(c.id) && cadena(c.nombre, 40))
    .map((c) => ({ id: c.id, nombre: cadena(c.nombre, 40) }))
    .slice(0, MAX_CASILLAS);
  const a = datos.ajustes && typeof datos.ajustes === 'object' ? datos.ajustes : {};
  const agenda = datos.agenda && typeof datos.agenda.id === 'string' && datos.agenda.id.length <= 1024 ? { id: datos.agenda.id, hora: HORA.test(datos.agenda.hora) ? datos.agenda.hora : '', minutos: entero(datos.agenda.minutos, 5, 240) ?? 20, dias: listaDias(datos.agenda.dias) } : null;
  return {
    planes: (Array.isArray(datos.planes) ? datos.planes : []).map(normalizarPlan).filter(Boolean).slice(0, MAX_PLANES),
    dias,
    casillas,
    ajustes: {
      avisos: a.avisos !== false,
      avisoManana: HORA.test(a.avisoManana) ? a.avisoManana : a.avisoManana === '' ? '' : AJUSTES_BIBLIA.avisoManana,
      avisoNoche: HORA.test(a.avisoNoche) ? a.avisoNoche : a.avisoNoche === '' ? '' : AJUSTES_BIBLIA.avisoNoche,
      // Ya se te puso (una vez) el plan Lectura Jóvenes: si lo borras, no vuelve.
      ...(a.jovenes === true ? { jovenes: true } : {}),
    },
    agenda,
  };
}

// ---------- Crear planes ----------

// Las fechas de lectura del plan: n días desde «inicio», o hasta «fin».
function fechasDelPlan({ inicio, fin, dias, n }) {
  return fin ? diasDeLectura(inicio, { hasta: fin, dias }) : diasDeLectura(inicio, { n, dias });
}

// Varias pistas a la vez, cada una repartida en los mismos días.
function lecturasDe(pistas, fechas) {
  const porDia = fechas.map((fecha) => ({ fecha, caps: [] }));
  for (const pista of pistas) {
    const trozos = repartir(pista, fechas.length);
    // Si una pista tiene menos capítulos que días, se estira: un capítulo cada pocos días.
    const paso = fechas.length / trozos.length;
    trozos.forEach((caps, i) => porDia[Math.min(fechas.length - 1, Math.floor(i * paso))].caps.push(...caps));
  }
  return porDia.filter((d) => d.caps.length);
}

// Un plan listo: { plantilla, inicio, dias?, fin? }. Sin «fin», dura lo de la plantilla
// en días de lectura (con lunes a viernes, un año de lecturas tarda más).
export function crearPlanDePlantilla(datos, { plantilla: idPlantilla, inicio, dias, fin = null, nombre = '', desde = '', id = undefined }, ahora = Date.now()) {
  const p = plantilla(idPlantilla);
  if (!p) throw new Error('Ese plan no existe.');
  if (!fechaValida(inicio)) throw new Error('Pon una fecha de inicio válida.');
  if (fin && (!fechaValida(fin) || fin < inicio)) throw new Error('La fecha final tiene que ser después del inicio.');
  if (p.porDia) {
    // Ritmo fijo: tantos capítulos justos cada día de lectura, hasta acabar (sin fecha final).
    const lecturas = lecturasFijas(desdeCapitulo(p.pistas()[0], desde), inicio, listaDias(dias), p.porDia);
    return guardarPlan(datos, { id, nombre: nombre || p.nombre, plantilla: p.id, dias: listaDias(dias), lecturas, creado: ahora, grupo: p.grupo === true, porDia: p.porDia });
  }
  const fechas = fechasDelPlan({ inicio, fin, dias: listaDias(dias), n: p.dias });
  if (!fechas.length) throw new Error('Entre esas fechas no hay ningún día de lectura.');
  return guardarPlan(datos, { nombre: nombre || p.nombre, plantilla: p.id, dias: listaDias(dias), lecturas: lecturasDe(p.pistas(), fechas), creado: ahora });
}

// Capítulos justos por día (el último día, los que queden).
function lecturasFijas(caps, inicio, dias, porDia) {
  const fechas = diasDeLectura(inicio, { n: Math.ceil(caps.length / porDia), dias });
  return fechas.map((fecha, i) => ({ fecha, caps: caps.slice(i * porDia, (i + 1) * porDia) })).filter((l) => l.caps.length);
}
function desdeCapitulo(caps, desde) {
  if (!desde) return caps;
  const i = caps.indexOf(desde);
  if (i < 0) throw new Error('Ese capítulo no está en el plan.');
  return caps.slice(i);
}

// «El grupo va hoy por tal capítulo»: lo de antes de hoy se queda como está y desde
// hoy se sigue desde ese capítulo, al mismo ritmo (por si el grupo va por otro sitio).
export function recolocarPlan(datos, planId, capitulo, hoy = fechaISO()) {
  return cambiarPlan(datos, planId, (p) => {
    if (!p.porDia) throw new Error('Ese plan no va a ritmo fijo.');
    const orden = plantilla(p.plantilla)?.pistas()[0] ?? p.lecturas.flatMap((l) => l.caps);
    const antes = p.lecturas.filter((l) => l.fecha < hoy);
    const fechasAntes = new Set(antes.map((l) => l.fecha));
    return {
      ...p,
      lecturas: [...antes, ...lecturasFijas(desdeCapitulo(orden, capitulo), hoy, p.dias, p.porDia)],
      hechas: Object.fromEntries(Object.entries(p.hechas).filter(([f]) => fechasAntes.has(f))),
      saltadas: p.saltadas.filter((f) => fechasAntes.has(f)),
    };
  });
}

// El plan Lectura Jóvenes se pone solo una vez (empezando hoy). Devuelve los datos
// nuevos, o null si no hay nada que hacer. Si lo borras, no vuelve.
export function asegurarJovenes(datos, hoy = fechaISO(), ahora = Date.now()) {
  if (datos.ajustes.jovenes) return null;
  const conMarca = (d) => normalizarBiblia({ ...d, ajustes: { ...d.ajustes, jovenes: true } });
  if (datos.planes.some((p) => p.plantilla === 'jovenes')) return conMarca(datos);
  return conMarca(crearPlanDePlantilla(datos, { plantilla: 'jovenes', inicio: hoy, id: ID_PLAN_JOVENES }, ahora).datos);
}

// Tu plan: unos libros (en el orden de la Biblia, o el que digas) desde «inicio» hasta «fin».
export function crearPlanPropio(datos, { nombre = '', libros: ids, inicio, fin, dias, ordenBiblia = true }, ahora = Date.now()) {
  const elegidos = [...new Set((ids ?? []).filter((id) => POR_ID.has(id)))];
  if (!elegidos.length) throw new Error('Elige al menos un libro.');
  if (!fechaValida(inicio)) throw new Error('Pon una fecha de inicio válida.');
  if (!fechaValida(fin) || fin < inicio) throw new Error('La fecha final tiene que ser después del inicio.');
  const orden = ordenBiblia ? elegidos.sort((a, b) => POR_ID.get(a).orden - POR_ID.get(b).orden) : elegidos;
  const fechas = diasDeLectura(inicio, { hasta: fin, dias: listaDias(dias) });
  if (!fechas.length) throw new Error('Entre esas fechas no hay ningún día de lectura.');
  const caps = capitulosDe(...orden);
  return guardarPlan(datos, { nombre: nombre || nombreDeLibros(orden), dias: listaDias(dias), lecturas: lecturasDe([caps], fechas), creado: ahora });
}

// «Romanos», «Romanos y Hebreos», «Evangelios y Hechos», «Nuevo Testamento», «7 libros».
export function nombreDeLibros(ids) {
  let quedan = [...ids];
  const partes = [];
  // Los grupos enteros, por su nombre (primero los grandes).
  for (const g of [...GRUPOS].sort((a, b) => b.libros.length - a.libros.length)) {
    if (g.libros.length > 1 && g.libros.every((id) => quedan.includes(id))) {
      partes.push(g.nombre);
      quedan = quedan.filter((id) => !g.libros.includes(id));
    }
  }
  partes.push(...quedan.map((id) => POR_ID.get(id).nombre));
  if (partes.length > 3) return `${ids.length} libros`;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}
function guardarPlan(datos, p) {
  if (datos.planes.filter((x) => !x.archivado).length >= MAX_PLANES) throw new Error(`Puedes tener hasta ${MAX_PLANES} planes.`);
  // Sin id propio salvo el del plan de grupo, que es fijo (así dos dispositivos no lo duplican).
  const plan = normalizarPlan({ ...p, id: p.id === ID_PLAN_JOVENES && !datos.planes.some((x) => x.id === p.id) ? p.id : undefined });
  if (!plan) throw new Error('El plan ha quedado vacío.');
  return { datos: normalizarBiblia({ ...datos, planes: [...datos.planes, plan] }), plan };
}

// Lo que cuesta cada día (para enseñarlo antes de crear): capítulos y minutos aproximados.
// Se lee a unos 6 versículos por minuto, con calma (la Biblia en un año: unos 14 minutos al día).
export const minutosDe = (caps) => Math.max(1, Math.round(versiculosDe(caps) / 6));
export function vistaPrevia(lecturas) {
  if (!lecturas.length) return null;
  const minutos = lecturas.map((l) => minutosDe(l.caps));
  return { dias: lecturas.length, desde: lecturas[0].fecha, hasta: lecturas.at(-1).fecha, capitulos: lecturas.reduce((s, l) => s + l.caps.length, 0), minutosMedia: Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length) };
}
export function previaPlantilla({ plantilla: id, inicio, dias, fin = null }) {
  const p = plantilla(id);
  if (!p || !fechaValida(inicio)) return null;
  if (p.porDia) return vistaPrevia(lecturasFijas(p.pistas()[0], inicio, listaDias(dias), p.porDia));
  return vistaPrevia(lecturasDe(p.pistas(), fechasDelPlan({ inicio, fin, dias: listaDias(dias), n: p.dias })));
}
export function previaPropia({ libros: ids, inicio, fin, dias }) {
  const elegidos = (ids ?? []).filter((id) => POR_ID.has(id)).sort((a, b) => POR_ID.get(a).orden - POR_ID.get(b).orden);
  if (!elegidos.length || !fechaValida(inicio) || !fechaValida(fin) || fin < inicio) return null;
  return vistaPrevia(lecturasDe([capitulosDe(...elegidos)], diasDeLectura(inicio, { hasta: fin, dias: listaDias(dias) })));
}

export const borrarPlan = (datos, id) => normalizarBiblia({ ...datos, planes: datos.planes.filter((p) => p.id !== id) });
export const archivarPlan = (datos, id, si = true) => normalizarBiblia({ ...datos, planes: datos.planes.map((p) => (p.id === id ? { ...p, archivado: si } : p)) });
export const renombrarPlan = (datos, id, nombre) => normalizarBiblia({ ...datos, planes: datos.planes.map((p) => (p.id === id ? { ...p, nombre } : p)) });

// ---------- Marcar ----------

const cambiarPlan = (datos, id, f) => {
  const plan = datos.planes.find((p) => p.id === id);
  if (!plan) throw new Error('Ese plan ya no existe.');
  return normalizarBiblia({ ...datos, planes: datos.planes.map((p) => (p.id === id ? f(p) : p)) });
};
const cambiarDia = (datos, fecha, f) => {
  if (!fechaValida(fecha)) throw new Error('Fecha no válida.');
  const actual = datos.dias[fecha] ?? { leido: false, orado: false, extra: {}, minLectura: 0, minOracion: 0, nota: '' };
  return normalizarBiblia({ ...datos, dias: { ...datos.dias, [fecha]: f(actual) } });
};

// La lectura de un día del plan, hecha (el día que la marcas cuenta como «He leído»).
export function marcarLectura(datos, planId, fecha, si = true, hoy = fechaISO()) {
  let nuevos = cambiarPlan(datos, planId, (p) => {
    const hechas = { ...p.hechas };
    if (si) hechas[fecha] = hoy;
    else delete hechas[fecha];
    return { ...p, hechas, saltadas: p.saltadas.filter((f) => f !== fecha) };
  });
  // La lectura del grupo va aparte: no marca tu «He leído».
  if (si && !datos.planes.find((p) => p.id === planId)?.grupo) nuevos = cambiarDia(nuevos, hoy, (d) => ({ ...d, leido: true }));
  return nuevos;
}

const lecturasDe1Dia = (datos, fecha, grupo) =>
  datos.planes
    .filter((p) => !p.archivado && p.grupo === grupo)
    .flatMap((p) => p.lecturas.filter((l) => l.fecha === fecha).map((l) => ({ plan: p, lectura: l, hecha: Boolean(p.hechas[l.fecha]) })));
// Las lecturas de tus planes para un día (las que tocan ese día); las del grupo, aparte.
export const lecturasDelDia = (datos, fecha) => lecturasDe1Dia(datos, fecha, false);
export const lecturasDeGrupo = (datos, fecha) => lecturasDe1Dia(datos, fecha, true);
// Marca (o desmarca) lo que toca ese día con el grupo.
export function marcarGrupo(datos, fecha, si = true, hoy = fechaISO()) {
  let nuevos = datos;
  for (const { plan, lectura } of lecturasDeGrupo(datos, fecha)) nuevos = marcarLectura(nuevos, plan.id, lectura.fecha, si, hoy);
  return nuevos;
}
// Lo atrasado de un plan, dado por leído de una vez.
export function marcarAtrasadas(datos, planId, hoy = fechaISO()) {
  const plan = datos.planes.find((p) => p.id === planId);
  if (!plan) throw new Error('Ese plan ya no existe.');
  let nuevos = datos;
  for (const l of estadoPlan(plan, hoy).atrasadas) nuevos = marcarLectura(nuevos, planId, l.fecha, true, hoy);
  return nuevos;
}

// «He leído»: también marca las lecturas de ese día en tus planes (y las desmarca).
export function marcarLeido(datos, fecha, si = true) {
  let nuevos = cambiarDia(datos, fecha, (d) => ({ ...d, leido: si }));
  for (const { plan, lectura } of lecturasDelDia(datos, fecha)) {
    if (si && !plan.hechas[lectura.fecha]) nuevos = marcarLectura(nuevos, plan.id, lectura.fecha, true, fecha);
    if (!si && plan.hechas[lectura.fecha] === fecha) nuevos = marcarLectura(nuevos, plan.id, lectura.fecha, false, fecha);
  }
  return nuevos;
}
export const marcarOrado = (datos, fecha, si = true) => cambiarDia(datos, fecha, (d) => ({ ...d, orado: si }));
export function marcarCasilla(datos, fecha, id, si = true) {
  if (id === 'leido') return marcarLeido(datos, fecha, si);
  if (id === 'orado') return marcarOrado(datos, fecha, si);
  if (id === 'jovenes') return marcarGrupo(datos, fecha, si);
  if (!datos.casillas.some((c) => c.id === id)) throw new Error('Esa casilla ya no existe.');
  return cambiarDia(datos, fecha, (d) => {
    const extra = { ...d.extra };
    if (si) extra[id] = true;
    else delete extra[id];
    return { ...d, extra };
  });
}
// Tiempo: minutos que se suman (o se ponen) a la lectura o a la oración de un día.
export function sumarMinutos(datos, fecha, que, minutos) {
  const campo = que === 'oracion' ? 'minOracion' : 'minLectura';
  return cambiarDia(datos, fecha, (d) => ({ ...d, [campo]: Math.max(0, Math.min(24 * 60, Math.round((d[campo] ?? 0) + minutos))) }));
}
export const ponerNota = (datos, fecha, nota) => cambiarDia(datos, fecha, (d) => ({ ...d, nota }));
export const guardarPreguntas = (datos, fecha, sobre, lista) => cambiarDia(datos, fecha, (d) => ({ ...d, preguntas: { sobre, lista } }));

export function anadirCasilla(datos, nombre) {
  const limpio = cadena(nombre, 40);
  if (!limpio) throw new Error('Pon un nombre, por ejemplo «Ayuno» o «Devocional».');
  if (datos.casillas.length >= MAX_CASILLAS) throw new Error(`Puedes tener hasta ${MAX_CASILLAS} casillas propias.`);
  const casilla = { id: nuevoId('c'), nombre: limpio };
  return { datos: normalizarBiblia({ ...datos, casillas: [...datos.casillas, casilla] }), casilla };
}
export const quitarCasilla = (datos, id) => normalizarBiblia({ ...datos, casillas: datos.casillas.filter((c) => c.id !== id) });
export const ponerAjustes = (datos, cambios) => normalizarBiblia({ ...datos, ajustes: { ...datos.ajustes, ...cambios } });
export const ponerAgenda = (datos, agenda) => normalizarBiblia({ ...datos, agenda });

// ---------- Cómo va un plan y ponerse al día ----------

export function estadoPlan(plan, hoy = fechaISO()) {
  const saltadas = new Set(plan.saltadas);
  const total = plan.lecturas.reduce((s, l) => s + l.caps.length, 0);
  const leidos = plan.lecturas.filter((l) => plan.hechas[l.fecha]).reduce((s, l) => s + l.caps.length, 0);
  const atrasadas = plan.lecturas.filter((l) => l.fecha < hoy && !plan.hechas[l.fecha] && !saltadas.has(l.fecha));
  const deHoy = plan.lecturas.filter((l) => l.fecha === hoy);
  const siguiente = plan.lecturas.find((l) => l.fecha >= hoy && !plan.hechas[l.fecha]) ?? null;
  const pendientes = plan.lecturas.filter((l) => !plan.hechas[l.fecha] && !saltadas.has(l.fecha));
  return {
    total,
    leidos,
    parte: total ? leidos / total : 0,
    atrasadas,
    deHoy,
    siguiente,
    terminado: !pendientes.length,
    inicio: plan.lecturas[0].fecha,
    fin: plan.lecturas.at(-1).fecha,
    diasLeidos: Object.keys(plan.hechas).length,
    diasTotal: plan.lecturas.length,
  };
}

// Tres formas de ponerse al día (desde hoy):
//   repartir: lo pendiente (atrasado y lo que viene) se reparte en los días que quedan hasta el final.
//   mover:    cada lectura pendiente pasa al siguiente día de lectura desde hoy; el plan acaba más tarde.
//   saltar:   lo atrasado se da por saltado (no cuenta como leído) y sigues por lo de hoy.
export function ponerseAlDia(datos, planId, forma, hoy = fechaISO()) {
  return cambiarPlan(datos, planId, (p) => {
    const saltadas = new Set(p.saltadas);
    const fija = (l) => p.hechas[l.fecha] || saltadas.has(l.fecha);
    const pendientes = p.lecturas.filter((l) => !fija(l));
    if (forma === 'saltar') return { ...p, saltadas: [...saltadas, ...pendientes.filter((l) => l.fecha < hoy).map((l) => l.fecha)] };
    if (forma !== 'mover' && forma !== 'repartir') throw new Error('Forma de ponerse al día no válida.');
    // Lo hecho o saltado se queda donde está; lo pendiente se recoloca desde hoy, en los días libres.
    const fijas = p.lecturas.filter(fija);
    const ocupadas = new Set(fijas.map((l) => l.fecha));
    const fin = p.lecturas.at(-1).fecha;
    const libres = (n, hasta = null) => diasDeLectura(hoy, { n: n + ocupadas.size, hasta, dias: p.dias }).filter((f) => !ocupadas.has(f)).slice(0, n);
    let nuevas;
    const hueco = fin > hoy ? libres(Infinity, fin) : [];
    if (forma === 'repartir' && hueco.length) {
      // Se juntan días enteros (así un plan de AT y NT sigue trayendo de los dos), parecidos en lo que se lee.
      nuevas = agrupar(pendientes, hueco.length, (l) => versiculosDe(l.caps)).map((grupo, i) => ({ fecha: hueco[i], caps: grupo.flatMap((l) => l.caps) }));
    } else {
      // Mover (o repartir cuando ya no quedan días): cada lectura, al siguiente día libre.
      const fechas = libres(pendientes.length);
      nuevas = pendientes.map((l, i) => ({ fecha: fechas[i], caps: l.caps }));
    }
    return { ...p, lecturas: [...fijas, ...nuevas] };
  });
}

// ---------- Días, racha y resumen ----------

// Un día «cuenta» si hiciste algo: leer, orar o alguna de tus casillas.
export function diaHecho(datos, fecha) {
  const d = datos.dias[fecha];
  if (d && (d.leido || d.orado || Object.keys(d.extra).length)) return true;
  // Leer con el grupo también cuenta para la racha.
  return datos.planes.some((p) => p.grupo && Object.values(p.hechas).includes(fecha));
}
// Días seguidos hasta hoy (si hoy aún no, se cuenta hasta ayer: el día no ha acabado).
export function racha(datos, hoy = fechaISO()) {
  let f = diaHecho(datos, hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (diaHecho(datos, f) && n < 5000) {
    n++;
    f = sumarDias(f, -1);
  }
  return n;
}

// Desde cuándo usas el apartado: el inicio de tu primer plan, el día que lo creaste
// o el primer día que marcaste algo (lo que sea antes). null si aún nada.
export function empezaste(datos) {
  const candidatos = [
    ...datos.planes.map((p) => p.lecturas[0]?.fecha),
    ...datos.planes.filter((p) => p.creado).map((p) => fechaISO(new Date(p.creado))),
    ...Object.keys(datos.dias),
  ].filter(fechaValida);
  return candidatos.length ? candidatos.sort()[0] : null;
}

// Un mes («AAAA-MM») entero: qué hiciste cada día y los totales.
// Los días «que cuentan» van desde que empezaste hasta ayer; hoy, solo si ya lo
// marcaste (el día no ha acabado): quien empieza hoy no va «0 de 4».
export function resumenMes(datos, mes, hoy = fechaISO()) {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(a, m, 0).getDate();
  const fechas = Array.from({ length: total }, (_, i) => `${mes}-${dos(i + 1)}`);
  const inicio = empezaste(datos);
  const hasta = fechas.filter((f) => inicio && f >= inicio && (f < hoy || (f === hoy && diaHecho(datos, f))));
  const dia = (f) => datos.dias[f];
  const capsLeidos = datos.planes.flatMap((p) => p.lecturas.filter((l) => p.hechas[l.fecha]?.startsWith(mes)).flatMap((l) => l.caps));
  const extras = datos.casillas.map((c) => ({ ...c, dias: fechas.filter((f) => dia(f)?.extra[c.id]).length }));
  return {
    mes,
    dias: fechas.map((f) => ({
      fecha: f,
      leido: Boolean(dia(f)?.leido),
      orado: Boolean(dia(f)?.orado),
      extra: Object.keys(dia(f)?.extra ?? {}).length,
      hecho: diaHecho(datos, f),
      tocaba: lecturasDelDia(datos, f).length > 0,
      futuro: f > hoy,
      // Antes de empezar a usar el apartado (no cuenta).
      antes: !inicio || f < inicio,
    })),
    inicio,
    diasHechos: hasta.filter((f) => diaHecho(datos, f)).length,
    diasHastaHoy: hasta.length,
    diasLeidos: fechas.filter((f) => dia(f)?.leido).length,
    diasOrados: fechas.filter((f) => dia(f)?.orado).length,
    minLectura: fechas.reduce((s, f) => s + (dia(f)?.minLectura ?? 0), 0),
    minOracion: fechas.reduce((s, f) => s + (dia(f)?.minOracion ?? 0), 0),
    capitulos: capsLeidos.length,
    libros: [...new Set(capsLeidos.map((c) => leerCapitulo(c).libro))].map((id) => POR_ID.get(id).nombre),
    extras,
  };
}

// ---------- Versículo del día ----------
// Una cita conocida para cada día, con su tema; el texto se abre en YouVersion (RVR1960).
export const VERSICULOS = [
  ['JHN.3.16', 'El amor de Dios'], ['PSA.23.1', 'El Señor es mi pastor'], ['PRO.3.5-6', 'Confiar en Dios'], ['PHP.4.13', 'Fuerza en Cristo'],
  ['ROM.8.28', 'Todo ayuda a bien'], ['JER.29.11', 'Planes de bien'], ['ISA.41.10', 'No temas'], ['MAT.11.28', 'Descanso'],
  ['JOS.1.9', 'Esfuérzate y sé valiente'], ['PSA.46.1', 'Nuestro amparo'], ['PHP.4.6-7', 'La paz de Dios'], ['2TI.1.7', 'Espíritu de poder'],
  ['ROM.12.2', 'Renovar la mente'], ['GAL.5.22-23', 'El fruto del Espíritu'], ['HEB.11.1', 'La fe'], ['1CO.13.4-7', 'El amor'],
  ['EPH.2.8-9', 'Por gracia'], ['MAT.6.33', 'Buscar primero el reino'], ['PSA.119.105', 'Lámpara a mis pies'], ['ISA.40.31', 'Nuevas fuerzas'],
  ['LAM.3.22-23', 'Nuevas cada mañana'], ['ROM.5.8', 'Cristo murió por nosotros'], ['JHN.14.6', 'El camino'], ['MAT.5.16', 'Vuestra luz'],
  ['PSA.37.4', 'Deléitate en el Señor'], ['1PE.5.7', 'Echar la ansiedad'], ['JAS.1.5', 'Pedir sabiduría'], ['PSA.27.1', 'Mi luz y mi salvación'],
  ['ROM.8.38-39', 'Nada nos separará'], ['2CO.5.17', 'Nueva criatura'], ['MAT.28.19-20', 'Id y haced discípulos'], ['JHN.16.33', 'Yo he vencido'],
  ['PSA.91.1-2', 'Bajo su sombra'], ['ISA.26.3', 'Completa paz'], ['COL.3.23', 'De corazón'], ['1JN.1.9', 'Él perdona'],
  ['PSA.139.14', 'Formidables maravillas'], ['DEU.31.6', 'No te dejará'], ['MRK.11.24', 'Orar con fe'], ['PRO.16.3', 'Encomienda tus obras'],
  ['ROM.15.13', 'Esperanza'], ['JHN.15.5', 'La vid y los pámpanos'], ['PSA.34.8', 'Gustad y ved'], ['MIC.6.8', 'Lo que pide el Señor'],
  ['1TH.5.16-18', 'Gozo, oración y gratitud'], ['HEB.4.16', 'El trono de la gracia'], ['PSA.51.10', 'Un corazón limpio'], ['ISA.53.5', 'Por su llaga'],
  ['JHN.11.25', 'La resurrección y la vida'], ['ROM.10.9', 'Confesar y creer'], ['EPH.6.10-11', 'La armadura de Dios'], ['PSA.103.2', 'No olvides sus beneficios'],
  ['MAT.22.37-39', 'El gran mandamiento'], ['PRO.4.23', 'Guarda tu corazón'], ['ZEP.3.17', 'Se gozará sobre ti'], ['2CO.12.9', 'Mi gracia te basta'],
  ['PSA.121.1-2', 'Mi socorro'], ['JHN.8.12', 'La luz del mundo'], ['HEB.12.1-2', 'Correr con paciencia'], ['GAL.2.20', 'Cristo vive en mí'],
  ['MAT.7.7', 'Pedid y se os dará'], ['PSA.16.11', 'Plenitud de gozo'], ['ISA.43.2', 'Por las aguas'], ['ROM.6.23', 'La dádiva de Dios'],
  ['JHN.10.10', 'Vida en abundancia'], ['PHP.1.6', 'La buena obra'], ['PSA.62.1-2', 'Solo en Dios'], ['1PE.2.9', 'Linaje escogido'],
  ['EPH.3.20', 'Más abundantemente'], ['PSA.145.18', 'Cercano está'], ['JAS.4.8', 'Acercaos a Dios'], ['PRO.18.10', 'Torre fuerte'],
  ['MAT.6.34', 'No os afanéis por el mañana'], ['JHN.13.34-35', 'Amaos unos a otros'], ['ROM.12.12', 'Gozosos en la esperanza'], ['PSA.4.8', 'En paz me acostaré'],
  ['ISA.55.8-9', 'Mis caminos'], ['COL.3.12-13', 'Vestíos de misericordia'], ['1CO.10.13', 'La salida'], ['PSA.56.3', 'Cuando tengo miedo'],
  ['2CH.7.14', 'Si se humillare mi pueblo'], ['HAB.3.17-18', 'Aunque la higuera no florezca'], ['NUM.6.24-26', 'La bendición'], ['PSA.100.4-5', 'Con acción de gracias'],
  ['JHN.1.1', 'En el principio era el Verbo'], ['JHN.14.27', 'Mi paz os doy'], ['ROM.8.1', 'Ninguna condenación'], ['EPH.4.32', 'Perdonaos'],
  ['PSA.118.24', 'Este es el día'], ['PHP.4.19', 'Dios suplirá'], ['MAT.5.3-4', 'Bienaventurados'], ['1JN.4.18', 'El perfecto amor'],
  ['ISA.9.6', 'Un niño nos es nacido'], ['LUK.1.37', 'Nada hay imposible'], ['PSA.42.11', 'Espera en Dios'], ['HEB.13.5', 'No te desampararé'],
  ['PRO.27.17', 'El hierro con el hierro'], ['GAL.6.9', 'No nos cansemos'], ['PSA.19.14', 'Las palabras de mi boca'], ['JAS.1.2-3', 'Gozo en las pruebas'],
  ['REV.21.4', 'Enjugará toda lágrima'], ['1JN.4.19', 'Él nos amó primero'], ['ECC.3.1', 'Todo tiene su tiempo'], ['ACT.1.8', 'Recibiréis poder'],
];
export function versiculoDelDia(fecha = fechaISO()) {
  const [a] = fecha.split('-').map(Number);
  const n = diasEntre(`${a}-01-01`, fecha) + a * 7;
  const [cita, tema] = VERSICULOS[((n % VERSICULOS.length) + VERSICULOS.length) % VERSICULOS.length];
  return { cita, tema, nombre: nombreCita(cita), enlace: enlaceCita(cita) };
}

// ---------- Avisos (al móvil, desde el servidor) ----------
// Para los próximos días: por la mañana lo que toca leer; por la noche, lo que falta.
export function avisosBiblia(datos, ahora = Date.now(), dias = 14) {
  const { avisos, avisoManana, avisoNoche } = datos.ajustes;
  // Solo si usas el apartado (algún plan o algún día marcado).
  if (!avisos || (!avisoManana && !avisoNoche) || (!datos.planes.some((p) => !p.archivado) && !Object.keys(datos.dias).length)) return [];
  const hoy = fechaISO(new Date(ahora));
  const salida = [];
  const momento = (fecha, hora) => {
    const [a, m, d] = fecha.split('-').map(Number);
    const [h, mi] = hora.split(':').map(Number);
    return new Date(a, m - 1, d, h, mi).getTime();
  };
  const compacta = (f) => f.replaceAll('-', '');
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(hoy, i);
    const pendientes = lecturasDelDia(datos, fecha).filter((x) => !x.hecha);
    const delGrupo = lecturasDeGrupo(datos, fecha).filter((x) => !x.hecha);
    const lectura = [textoLectura(pendientes.flatMap((x) => x.lectura.caps)), ...delGrupo.map((x) => `${x.plan.nombre}: ${textoLectura(x.lectura.caps)}`)].filter(Boolean).join(' · ');
    pendientes.push(...delGrupo);
    const d = datos.dias[fecha];
    if (avisoManana && pendientes.length) {
      const cuando = momento(fecha, avisoManana);
      if (cuando > ahora) salida.push({ id: `b${compacta(fecha)}m`, cuando, texto: `Hoy toca leer ${lectura}`.slice(0, 200) });
    }
    // Por la noche: lo que falte de leer y, si no lo has marcado, orar.
    if (avisoNoche && (pendientes.length || !d?.orado)) {
      const cuando = momento(fecha, avisoNoche);
      const texto = pendientes.length ? `Te queda leer ${lectura}${d?.orado ? '' : ' y orar'}` : '¿Has orado hoy?';
      if (cuando > ahora) salida.push({ id: `b${compacta(fecha)}n`, cuando, texto: texto.slice(0, 200) });
    }
  }
  return salida.slice(0, 60);
}

// ---------- Para el chat ----------

export function resumenParaIA(datos, hoy = fechaISO()) {
  const deHoy = lecturasDelDia(datos, hoy);
  const d = datos.dias[hoy];
  const mes = resumenMes(datos, hoy.slice(0, 7), hoy);
  const v = versiculoDelDia(hoy);
  return {
    hoy,
    lectura_de_hoy: deHoy.length ? deHoy.map((x) => `${x.plan.nombre}: ${textoLectura(x.lectura.caps)}${x.hecha ? ' (hecha)' : ''}`) : 'hoy no toca nada en sus planes',
    lectura_del_grupo_hoy: lecturasDeGrupo(datos, hoy).map((x) => `${x.plan.nombre}: ${textoLectura(x.lectura.caps)}${x.hecha ? ' (hecha)' : ''}`),
    hecho_hoy: { leido: Boolean(d?.leido), orado: Boolean(d?.orado), ...Object.fromEntries(datos.casillas.map((c) => [c.nombre, Boolean(d?.extra[c.id])])) },
    minutos_hoy: d ? { lectura: d.minLectura, oracion: d.minOracion } : undefined,
    racha: racha(datos, hoy) === 1 ? '1 día seguido' : `${racha(datos, hoy)} días seguidos`,
    planes: datos.planes
      .filter((p) => !p.archivado)
      .map((p) => {
        const e = estadoPlan(p, hoy);
        return `${p.nombre}: ${Math.round(e.parte * 100)} % (${e.leidos} de ${e.total} capítulos), termina el ${e.fin}${e.atrasadas.length ? `, ${e.atrasadas.length} lecturas atrasadas` : ''}${e.terminado ? ', terminado' : ''}`;
      }),
    este_mes: `${mes.diasHechos} de ${mes.diasHastaHoy} días; leyó ${mes.diasLeidos} días (${mes.capitulos} capítulos), oró ${mes.diasOrados} días; ${mes.minLectura} min de lectura y ${mes.minOracion} de oración`,
    casillas_propias: datos.casillas.map((c) => c.nombre),
    versiculo_del_dia: `${v.nombre} (${v.tema})`,
    version: 'Reina-Valera 1960 (se lee en YouVersion)',
  };
}

// Leer o marcar desde el chat. que: 'leido' | 'orado' | nombre de una casilla propia.
export function crearAlmacenBiblia({ leer, guardar, alCambiar = () => {} }) {
  const cargar = async () => normalizarBiblia((await leer()) ?? {});
  const escribir = async (d) => {
    await guardar(normalizarBiblia(d));
    alCambiar();
  };
  return {
    leer: cargar,
    guardar: escribir,
    async marcar({ que = [], fecha, si = true, minutos_lectura: ml, minutos_oracion: mo } = {}, hoy = fechaISO()) {
      let datos = await cargar();
      const dia = fechaValida(fecha) ? fecha : hoy;
      const hecho = [];
      const ids = [];
      for (const q of que) {
        // «jovenes»: la lectura del grupo de ese día (va aparte de «leido»).
        if (q === 'jovenes') {
          if (!lecturasDeGrupo(datos, dia).length) throw new Error('Ese día no toca lectura con el grupo.');
          datos = marcarGrupo(datos, dia, si !== false, hoy);
          ids.push('jovenes');
          hecho.push(`Lectura Jóvenes (${textoLectura(lecturasDeGrupo(datos, dia).flatMap((x) => x.lectura.caps))})`);
          continue;
        }
        const id = q === 'leido' || q === 'orado' ? q : datos.casillas.find((c) => c.nombre.toLowerCase() === String(q).toLowerCase())?.id;
        if (!id) throw new Error(`No tienes una casilla «${q}».`);
        datos = marcarCasilla(datos, dia, id, si !== false);
        ids.push(id);
        hecho.push(id === 'leido' ? 'leído' : id === 'orado' ? 'orado' : datos.casillas.find((c) => c.id === id).nombre);
      }
      if (Number.isFinite(ml) && ml > 0) datos = sumarMinutos(datos, dia, 'lectura', ml);
      if (Number.isFinite(mo) && mo > 0) datos = sumarMinutos(datos, dia, 'oracion', mo);
      await escribir(datos);
      const lecturas = lecturasDelDia(datos, dia);
      return {
        fecha: dia,
        marcado: hecho,
        ids,
        si: si !== false,
        minutos_lectura: Number.isFinite(ml) && ml > 0 ? ml : undefined,
        minutos_oracion: Number.isFinite(mo) && mo > 0 ? mo : undefined,
        lectura: lecturas.length ? textoLectura(lecturas.flatMap((x) => x.lectura.caps)) : '',
        racha: racha(datos, hoy),
      };
    },
    resumen: async (hoy = fechaISO()) => resumenParaIA(await cargar(), hoy),
  };
}
