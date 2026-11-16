// Datos de Forma: un solo objeto con tu perfil, comidas, alimentos, pesos,
// medidas, hitos y entrenos. Las listas llevan id para sincronizarse una a una
// entre el iPhone y Windows (ver coleccionForma en sincro.js).
import { esFecha } from './fechas.js';
import { limpiarAlias, sinTildes as sinTildesE } from './emparejar.js';

export const id = (prefijo = '') => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const MOMENTOS_POR_DEFECTO = [
  { id: 'desayuno', nombre: 'Desayuno', hora: '08:00' },
  { id: 'almuerzo', nombre: 'Almuerzo', hora: '11:30' },
  { id: 'comida', nombre: 'Comida', hora: '14:30' },
  { id: 'merienda', nombre: 'Merienda', hora: '18:00' },
  { id: 'cena', nombre: 'Cena', hora: '21:30' },
];

export const MEDIDAS_POR_DEFECTO = ['Cintura', 'Pecho', 'Brazo', 'Cadera', 'Muslo'];

export const GRUPOS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Antebrazo', 'Cuádriceps', 'Femoral', 'Glúteo', 'Gemelo', 'Pierna', 'Core', 'Cardio', 'Otro'];

export const EQUIPOS = [
  ['barra', 'Barra'],
  ['mancuerna', 'Mancuerna'],
  ['polea', 'Polea'],
  ['maquina', 'Máquina'],
  ['peso_corporal', 'Peso corporal'],
  ['otro', 'Otro'],
];
const ID_EQUIPOS = EQUIPOS.map(([k]) => k);

// Un grupo escrito como sea («espalda», «Bíceps», «abdomen», «piernas») → el de la app, o null.
const SINONIMOS_GRUPO = { abdomen: 'Core', abdominales: 'Core', abs: 'Core', core: 'Core', piernas: 'Pierna', pierna: 'Pierna', cuadriceps: 'Cuádriceps', gluteos: 'Glúteo', gemelos: 'Gemelo', hombros: 'Hombro', antebrazos: 'Antebrazo', isquios: 'Femoral', isquiotibiales: 'Femoral', femorales: 'Femoral' };
export function grupoDesdeTexto(t) {
  const k = sinTildesE(t).trim();
  if (!k) return null;
  return SINONIMOS_GRUPO[k] ?? GRUPOS.find((g) => sinTildesE(g) === k) ?? null;
}

// [nombre, grupo, principal, equipo, unilateral, secundarios]
const BIBLIOTECA = [
  ['Press banca', 'Pecho', true],
  ['Press inclinado con mancuernas', 'Pecho'],
  ['Aperturas en polea', 'Pecho'],
  ['Fondos en paralelas', 'Pecho'],
  ['Flexiones', 'Pecho'],
  ['Dominadas', 'Espalda', true],
  ['Remo con barra', 'Espalda', true],
  ['Jalón al pecho', 'Espalda'],
  ['Remo en polea baja', 'Espalda'],
  ['Remo con mancuerna', 'Espalda'],
  ['Pullover en polea', 'Espalda'],
  ['Press militar', 'Hombro', true],
  ['Press de hombro con mancuernas', 'Hombro'],
  ['Elevaciones laterales', 'Hombro'],
  ['Pájaros', 'Hombro'],
  ['Face pull', 'Hombro'],
  ['Curl con barra', 'Bíceps'],
  ['Curl con mancuernas', 'Bíceps'],
  ['Curl martillo', 'Bíceps'],
  ['Curl en banco Scott', 'Bíceps'],
  ['Extensión de tríceps en polea', 'Tríceps'],
  ['Press francés', 'Tríceps'],
  ['Press banca agarre cerrado', 'Tríceps'],
  ['Sentadilla', 'Cuádriceps', true],
  ['Prensa', 'Cuádriceps'],
  ['Sentadilla búlgara', 'Cuádriceps'],
  ['Extensión de cuádriceps', 'Cuádriceps'],
  ['Zancadas', 'Cuádriceps'],
  ['Peso muerto', 'Femoral', true],
  ['Peso muerto rumano', 'Femoral'],
  ['Curl femoral', 'Femoral'],
  ['Hip thrust', 'Glúteo'],
  ['Patada de glúteo en polea', 'Glúteo'],
  ['Elevación de gemelos de pie', 'Gemelo'],
  ['Elevación de gemelos sentado', 'Gemelo'],
  ['Plancha', 'Core'],
  ['Rueda abdominal', 'Core'],
  ['Elevación de piernas colgado', 'Core'],
  ['Crunch en polea', 'Core'],
];

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const idEjercicio = (nombre) => `x-${sinAcentos(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

// Equipo, si es unilateral (el peso es por lado) y grupos secundarios de cada uno.
const DETALLES = {
  'Press banca': ['barra', false, ['Tríceps', 'Hombro']],
  'Press inclinado con mancuernas': ['mancuerna', false, ['Hombro', 'Tríceps']],
  'Aperturas en polea': ['polea'],
  'Fondos en paralelas': ['peso_corporal', false, ['Tríceps', 'Hombro']],
  Flexiones: ['peso_corporal', false, ['Tríceps']],
  Dominadas: ['peso_corporal', false, ['Bíceps']],
  'Remo con barra': ['barra', false, ['Bíceps']],
  'Jalón al pecho': ['polea', false, ['Bíceps']],
  'Remo en polea baja': ['polea', false, ['Bíceps']],
  'Remo con mancuerna': ['mancuerna', true, ['Bíceps']],
  'Pullover en polea': ['polea'],
  'Press militar': ['barra', false, ['Tríceps']],
  'Press de hombro con mancuernas': ['mancuerna', false, ['Tríceps']],
  'Elevaciones laterales': ['mancuerna'],
  Pájaros: ['mancuerna', false, ['Espalda']],
  'Face pull': ['polea', false, ['Espalda']],
  'Curl con barra': ['barra', false, ['Antebrazo']],
  'Curl con mancuernas': ['mancuerna'],
  'Curl martillo': ['mancuerna', false, ['Antebrazo']],
  'Curl en banco Scott': ['barra'],
  'Extensión de tríceps en polea': ['polea'],
  'Press francés': ['barra'],
  'Press banca agarre cerrado': ['barra', false, ['Pecho']],
  Sentadilla: ['barra', false, ['Glúteo']],
  Prensa: ['maquina', false, ['Glúteo']],
  'Sentadilla búlgara': ['mancuerna', true, ['Glúteo']],
  'Extensión de cuádriceps': ['maquina'],
  Zancadas: ['mancuerna', true, ['Glúteo']],
  'Peso muerto': ['barra', false, ['Glúteo', 'Espalda']],
  'Peso muerto rumano': ['barra', false, ['Glúteo']],
  'Curl femoral': ['maquina'],
  'Hip thrust': ['barra', false, ['Femoral']],
  'Patada de glúteo en polea': ['polea', true],
  'Elevación de gemelos de pie': ['maquina'],
  'Elevación de gemelos sentado': ['maquina'],
  Plancha: ['peso_corporal'],
  'Rueda abdominal': ['otro'],
  'Elevación de piernas colgado': ['peso_corporal'],
  'Crunch en polea': ['polea'],
};

export const EJERCICIOS_POR_DEFECTO = BIBLIOTECA.map(([nombre, grupo, principal = false]) => {
  const [equipo = 'otro', unilateral = false, secundarios = []] = DETALLES[nombre] ?? [];
  return { id: idEjercicio(nombre), nombre, grupo, secundarios, equipo, unilateral, principal, propio: false, alias: [], oculto: false };
});
const POR_DEFECTO = new Map(EJERCICIOS_POR_DEFECTO.map((e) => [e.id, e]));

// ¿Un ejercicio de serie que has cambiado (principal, alias, oculto, equipo…)?
// Esos (y los tuyos) son los que viajan en la sincronización.
export function ejercicioAjustado(e) {
  if (e.propio) return true;
  const base = POR_DEFECTO.get(e.id);
  if (!base) return true;
  return (
    e.principal !== base.principal ||
    (e.alias?.length ?? 0) > 0 ||
    e.oculto === true ||
    (e.grupo !== undefined && e.grupo !== base.grupo) ||
    (e.equipo !== undefined && e.equipo !== base.equipo) ||
    (e.unilateral !== undefined && e.unilateral !== base.unilateral) ||
    (e.secundarios !== undefined && e.secundarios.join('|') !== base.secundarios.join('|'))
  );
}

function camposEjercicio(e, base, nombre) {
  const grupo = GRUPOS.includes(e.grupo) ? e.grupo : base.grupo;
  return {
    grupo,
    secundarios: Array.isArray(e.secundarios) ? [...new Set(e.secundarios.filter((g) => GRUPOS.includes(g) && g !== grupo))].slice(0, 5) : base.secundarios,
    equipo: ID_EQUIPOS.includes(e.equipo) ? e.equipo : base.equipo,
    unilateral: typeof e.unilateral === 'boolean' ? e.unilateral : base.unilateral,
    principal: typeof e.principal === 'boolean' ? e.principal : base.principal,
    alias: limpiarAlias(e.alias, nombre),
    oculto: e.oculto === true,
  };
}

export const AJUSTES_POR_DEFECTO = {
  barra: 20,
  discos: [25, 20, 15, 10, 5, 2.5, 1.25],
  descanso: 120,
  limiteIA: 30,
  avisoProteina: '18:00',
  momentoAuto: true,
};

const num = (v, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const texto = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const conId = (x, prefijo) => (typeof x.id === 'string' && x.id ? x.id : id(prefijo));

export const ORIGENES = ['manual', 'off', 'ia', 'importado'];

export const NUTRIENTES = ['kcal', 'proteina', 'hidratos', 'azucares', 'grasa', 'saturadas', 'fibra', 'sal'];

export function normalizarNutrientes(n = {}) {
  const salida = {};
  for (const k of NUTRIENTES) {
    const v = num(n?.[k], 0, 100000);
    if (v !== undefined) salida[k] = v;
  }
  return salida;
}

export function normalizarPerfil(p) {
  if (!p || typeof p !== 'object') return null;
  const perfil = {
    sexo: p.sexo === 'mujer' ? 'mujer' : 'hombre',
    nacimiento: esFecha(p.nacimiento) ? p.nacimiento : '1995-01-01',
    altura: num(p.altura, 100, 250) ?? 175,
    peso: num(p.peso, 30, 350) ?? 75,
    grasa: num(p.grasa, 3, 70),
    unidades: p.unidades === 'imperial' ? 'imperial' : 'metrico',
    zona: texto(p.zona, 60) || 'Europe/Madrid',
    trabajo: ['sentado', 'de-pie', 'fisico'].includes(p.trabajo) ? p.trabajo : 'sentado',
    pasos: ['menos-5', '5-8', '8-12', 'mas-12'].includes(p.pasos) ? p.pasos : '5-8',
    pasosExactos: num(p.pasosExactos, 0, 60000),
    diasEntreno: num(p.diasEntreno, 0, 7) ?? 4,
    minutosSesion: num(p.minutosSesion, 0, 300) ?? 60,
    tipoEntreno: ['pesas', 'cardio', 'mixto'].includes(p.tipoEntreno) ? p.tipoEntreno : 'pesas',
    cardioSemana: num(p.cardioSemana, 0, 2000) ?? 0,
    objetivo: ['perder', 'recomposicion', 'mantener', 'volumen'].includes(p.objetivo) ? p.objetivo : 'perder',
    pesoObjetivo: num(p.pesoObjetivo, 30, 350),
    grasaObjetivo: num(p.grasaObjetivo, 3, 70),
    ritmo: ['suave', 'moderado', 'agresivo'].includes(p.ritmo) ? p.ritmo : 'moderado',
    modoKcal: p.modoKcal === 'ciclo' ? 'ciclo' : 'fijas',
    proteinaPorKg: num(p.proteinaPorKg, 0.8, 3.5),
    grasaPct: num(p.grasaPct, 15, 45),
    mantenimientoReal: num(p.mantenimientoReal, 800, 8000),
    creado: esFecha(p.creado) ? p.creado : undefined,
  };
  for (const k of Object.keys(perfil)) if (perfil[k] === undefined) delete perfil[k];
  return perfil;
}

function normalizarAlimento(a) {
  const nombre = texto(a.nombre, 120);
  if (!nombre) return null;
  return {
    id: conId(a, 'a'),
    nombre,
    marca: texto(a.marca, 80),
    // Los valores van siempre por 100 g o por 100 ml (bebidas), según la unidad.
    unidad: a.unidad === 'ml' ? 'ml' : 'g',
    racion: num(a.racion, 0.1, 5000) ?? 100,
    racionNombre: texto(a.racionNombre, 40),
    por100: normalizarNutrientes(a.por100),
    // Otros nombres con los que lo reconoces al importar («Yogur proteínas fresa»).
    alias: limpiarAlias(a.alias, nombre),
    codigo: texto(a.codigo, 32),
    origen: ORIGENES.includes(a.origen) ? a.origen : 'manual',
    favorito: a.favorito === true,
    usado: num(a.usado, 0) ?? 0,
    veces: num(a.veces, 0) ?? 0,
  };
}

// Un alimento apuntado en el diario: guarda sus valores ya calculados, así no
// cambia si luego editas el alimento.
function normalizarRegistro(r) {
  if (!esFecha(r.fecha)) return null;
  const nombre = texto(r.nombre, 160);
  if (!nombre) return null;
  return {
    id: conId(r, 'r'),
    fecha: r.fecha,
    momento: texto(r.momento, 40) || 'comida',
    minuto: num(r.minuto, 0, 1439) ?? 720,
    nombre,
    alimentoId: texto(r.alimentoId, 60) || undefined,
    // Cantidad en la unidad del alimento (g o ml).
    gramos: num(r.gramos, 0, 10000),
    ...(r.unidad === 'ml' ? { unidad: 'ml' } : {}),
    ...normalizarNutrientes(r),
    estimado: r.estimado === true,
    libre: r.libre === true,
    ...(r.origen === 'importado' ? { origen: 'importado' } : {}),
    creado: num(r.creado, 0) ?? Date.now(),
  };
}

function normalizarSesion(s) {
  if (!esFecha(s.fecha)) return null;
  return {
    id: conId(s, 's'),
    fecha: s.fecha,
    rutinaId: texto(s.rutinaId, 60) || undefined,
    nombre: texto(s.nombre, 80),
    inicio: num(s.inicio, 0),
    fin: num(s.fin, 0),
    notas: texto(s.notas, 2000),
    series: lista(s.series)
      .map((x) => ({
        id: conId(x, 'k'),
        ejercicioId: texto(x.ejercicioId, 80),
        kg: num(x.kg, 0, 1000) ?? 0,
        reps: num(x.reps, 0, 500) ?? 0,
        rir: num(x.rir, 0, 10),
        fallo: x.fallo === true,
        calentamiento: x.calentamiento === true,
        hecha: x.hecha !== false,
      }))
      .filter((x) => x.ejercicioId),
    cardio: lista(s.cardio).map((c) => ({
      id: conId(c, 'c'),
      tipo: texto(c.tipo, 40) || 'Cardio',
      minutos: num(c.minutos, 0, 600) ?? 0,
      intensidad: ['suave', 'media', 'intensa'].includes(c.intensidad) ? c.intensidad : 'media',
      kcal: num(c.kcal, 0, 5000) ?? 0,
    })),
  };
}

export function normalizarForma(d = {}) {
  d = d && typeof d === 'object' ? d : {};
  const ajustes = { ...AJUSTES_POR_DEFECTO, ...(d.ajustes && typeof d.ajustes === 'object' ? d.ajustes : {}) };
  ajustes.barra = num(ajustes.barra, 0, 50) ?? 20;
  ajustes.discos = (Array.isArray(ajustes.discos) ? ajustes.discos : AJUSTES_POR_DEFECTO.discos).filter((x) => num(x, 0.1, 100) !== undefined);
  ajustes.descanso = num(ajustes.descanso, 10, 900) ?? 120;
  ajustes.limiteIA = num(ajustes.limiteIA, 0, 500) ?? 30;
  // Los de serie se rehacen siempre (con tus cambios encima); los tuyos, tal cual.
  const guardados = new Map(lista(d.ejercicios).filter((e) => typeof e.id === 'string').map((e) => [e.id, e]));
  const propios = lista(d.ejercicios).filter((e) => e.propio && texto(e.nombre, 80));
  const BASE_PROPIO = { grupo: 'Otro', secundarios: [], equipo: 'otro', unilateral: false, principal: false };
  const ejercicios = [
    ...EJERCICIOS_POR_DEFECTO.map((e) => (guardados.has(e.id) ? { ...e, ...camposEjercicio(guardados.get(e.id), e, e.nombre) } : { ...e, secundarios: [...e.secundarios], alias: [] })),
    ...propios.map((e) => {
      const nombre = texto(e.nombre, 80);
      return { id: conId(e, 'x'), nombre, ...camposEjercicio(e, BASE_PROPIO, nombre), propio: true };
    }),
  ];
  const bloqueados = {};
  for (const [k, v] of Object.entries(d.bloqueados ?? {})) if (num(v, 0, 20000) !== undefined) bloqueados[k] = v;
  return {
    perfil: normalizarPerfil(d.perfil),
    bloqueados,
    ajustes,
    momentos: lista(d.momentos).length
      ? lista(d.momentos)
          .map((m) => ({ id: conId(m, 'm'), nombre: texto(m.nombre, 30) || 'Comida', hora: /^\d{2}:\d{2}$/.test(m.hora) ? m.hora : '12:00' }))
          .slice(0, 10)
      : MOMENTOS_POR_DEFECTO.map((m) => ({ ...m })),
    suplementos: lista(d.suplementos)
      .map((s) => ({ id: conId(s, 'u'), nombre: texto(s.nombre, 40) }))
      .filter((s) => s.nombre),
    tiposMedida: Array.isArray(d.tiposMedida) && d.tiposMedida.length ? d.tiposMedida.map((t) => texto(t, 30)).filter(Boolean) : [...MEDIDAS_POR_DEFECTO],
    alimentos: lista(d.alimentos).map(normalizarAlimento).filter(Boolean),
    registros: lista(d.registros).map(normalizarRegistro).filter(Boolean),
    plantillas: lista(d.plantillas)
      .map((t) => ({ id: conId(t, 't'), nombre: texto(t.nombre, 60) || 'Comida', items: lista(t.items).map((x) => normalizarRegistro({ ...x, fecha: '2000-01-01' })).filter(Boolean) }))
      .filter((t) => t.items.length),
    descartadas: Array.isArray(d.descartadas) ? d.descartadas.filter((x) => typeof x === 'string').slice(-200) : [],
    dias: Object.fromEntries(
      Object.entries(d.dias && typeof d.dias === 'object' ? d.dias : {})
        .filter(([f, v]) => esFecha(f) && v && typeof v === 'object')
        .map(([f, v]) => [f, { agua: num(v.agua, 0, 20000) ?? 0, suplementos: Array.isArray(v.suplementos) ? v.suplementos.filter((x) => typeof x === 'string') : [], entreno: typeof v.entreno === 'boolean' ? v.entreno : undefined }]),
    ),
    pesos: lista(d.pesos)
      .filter((p) => esFecha(p.fecha) && num(p.kg, 20, 400) !== undefined)
      .map((p) => ({ id: conId(p, 'w'), fecha: p.fecha, kg: p.kg })),
    medidas: lista(d.medidas)
      .filter((m) => esFecha(m.fecha) && num(m.cm, 1, 400) !== undefined && texto(m.tipo, 30))
      .map((m) => ({ id: conId(m, 'v'), fecha: m.fecha, tipo: texto(m.tipo, 30), cm: m.cm })),
    hitos: lista(d.hitos)
      .filter((h) => ['peso', 'medida', 'fuerza'].includes(h.tipo) && num(h.valor, 0, 2000) !== undefined)
      .map((h) => ({
        id: conId(h, 'h'),
        tipo: h.tipo,
        valor: h.valor,
        comparador: h.comparador === '>' ? '>' : '<',
        medida: texto(h.medida, 30) || undefined,
        ejercicioId: texto(h.ejercicioId, 80) || undefined,
        recompensa: texto(h.recompensa, 200),
        cumplido: esFecha(h.cumplido) ? h.cumplido : null,
        automatico: h.automatico === true,
      })),
    ejercicios,
    rutinas: lista(d.rutinas)
      .map((r) => ({
        id: conId(r, 'q'),
        nombre: texto(r.nombre, 60) || 'Rutina',
        ejercicios: lista(r.ejercicios)
          .map((e) => ({ ejercicioId: texto(e.ejercicioId, 80), series: num(e.series, 1, 20) ?? 3, repMin: num(e.repMin, 1, 100) ?? 8, repMax: num(e.repMax, 1, 100) ?? 12 }))
          .filter((e) => e.ejercicioId),
      }))
      .filter((r) => r.ejercicios.length),
    sesiones: lista(d.sesiones).map(normalizarSesion).filter(Boolean),
    activa: d.activa && typeof d.activa === 'object' ? normalizarSesion(d.activa) : null,
    descargas: Array.isArray(d.descargas) ? d.descargas.filter(esFecha) : [],
    descargaDescartada: esFecha(d.descargaDescartada) ? d.descargaDescartada : null,
    usosIA: Object.fromEntries(Object.entries(d.usosIA ?? {}).filter(([f, n]) => esFecha(f) && num(n, 0) !== undefined)),
    resumenVisto: esFecha(d.resumenVisto) ? d.resumenVisto : null,
    // Parejas «idA|idB» que marcaste como «No son el mismo» en Posibles duplicados.
    noDuplicados: Array.isArray(d.noDuplicados) ? [...new Set(d.noDuplicados.filter((x) => typeof x === 'string' && x.includes('|')))].slice(-500) : [],
    avisosVistos: Array.isArray(d.avisosVistos) ? d.avisosVistos.filter((x) => typeof x === 'string').slice(-100) : [],
  };
}

export const ejercicio = (datos, eid) => datos.ejercicios.find((e) => e.id === eid) ?? { id: eid, nombre: 'Ejercicio', grupo: 'Otro', secundarios: [], equipo: 'otro', unilateral: false, principal: false, alias: [], oculto: false };
