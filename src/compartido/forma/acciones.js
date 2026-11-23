// Cambios sobre los datos de Forma: cada función recibe los datos y devuelve
// unos nuevos (no toca los de entrada). La pantalla guarda el resultado.
import { id } from './datos.js';
import { sumarDias, fechaISO } from './fechas.js';
import { revisarHitos, recalcularHitosPeso } from './progreso.js';

const conDia = (datos, fecha, cambio) => {
  const dia = datos.dias[fecha] ?? { agua: 0, suplementos: [] };
  return { ...datos, dias: { ...datos.dias, [fecha]: { ...dia, ...cambio(dia) } } };
};

export function guardarPerfil(datos, perfil, hoy = fechaISO()) {
  let nuevo = { ...datos, perfil: { ...perfil, creado: datos.perfil?.creado ?? perfil.creado ?? hoy } };
  // El peso del perfil es el primer registro de peso si aún no hay ninguno.
  if (!datos.pesos.length && Number.isFinite(perfil.peso)) nuevo = { ...nuevo, pesos: [{ id: id('w'), fecha: hoy, kg: perfil.peso }] };
  return nuevo;
}

// Apunta uno o varios alimentos en un momento del día.
export function apuntar(datos, { fecha, momento, minuto, items }) {
  const ahora = Date.now();
  const registros = items.map((x, i) => ({
    id: id('r'),
    fecha,
    momento,
    minuto,
    nombre: x.nombre,
    alimentoId: x.alimentoId,
    gramos: x.gramos,
    ...(x.unidad === 'ml' ? { unidad: 'ml' } : {}),
    kcal: x.kcal ?? 0,
    proteina: x.proteina ?? 0,
    hidratos: x.hidratos ?? 0,
    grasa: x.grasa ?? 0,
    fibra: x.fibra ?? 0,
    ...(Number.isFinite(x.azucares) ? { azucares: x.azucares } : {}),
    ...(Number.isFinite(x.saturadas) ? { saturadas: x.saturadas } : {}),
    ...(Number.isFinite(x.sal) ? { sal: x.sal } : {}),
    estimado: x.estimado === true,
    libre: x.libre === true,
    creado: ahora + i,
  }));
  const usados = new Set(items.map((x) => x.alimentoId).filter(Boolean));
  const alimentos = usados.size ? datos.alimentos.map((a) => (usados.has(a.id) ? { ...a, usado: ahora, veces: a.veces + 1 } : a)) : datos.alimentos;
  return { datos: { ...datos, registros: [...datos.registros, ...registros], alimentos }, registros };
}

export const editarRegistro = (datos, rid, cambios) => ({ ...datos, registros: datos.registros.map((r) => (r.id === rid ? { ...r, ...cambios, id: r.id } : r)) });
export const borrarRegistros = (datos, ids) => ({ ...datos, registros: datos.registros.filter((r) => !ids.includes(r.id)) });

// Copia las comidas de un día (o de un momento) a otro.
export function copiarDia(datos, desde, hasta, momento = null) {
  const items = datos.registros.filter((r) => r.fecha === desde && (!momento || r.momento === momento));
  const ahora = Date.now();
  const copias = items.map((r, i) => ({ ...r, id: id('r'), fecha: hasta, creado: ahora + i }));
  return { ...datos, registros: [...datos.registros, ...copias] };
}

export function guardarPlantilla(datos, nombre, registros) {
  const items = registros.map(({ id: _i, fecha: _f, creado: _c, ...resto }) => ({ ...resto, fecha: '2000-01-01' }));
  return { ...datos, plantillas: [...datos.plantillas, { id: id('t'), nombre: nombre.trim().slice(0, 60) || 'Comida', items }] };
}
export const borrarPlantilla = (datos, tid) => ({ ...datos, plantillas: datos.plantillas.filter((t) => t.id !== tid) });

export const descartarSugerencia = (datos, firma) => ({ ...datos, descartadas: [...new Set([...datos.descartadas, firma])] });

export const sumarAgua = (datos, fecha, ml) => conDia(datos, fecha, (d) => ({ agua: Math.max(0, (d.agua ?? 0) + ml) }));

export const alternarSuplemento = (datos, fecha, sid) =>
  conDia(datos, fecha, (d) => ({ suplementos: d.suplementos?.includes(sid) ? d.suplementos.filter((x) => x !== sid) : [...(d.suplementos ?? []), sid] }));

export const marcarEntreno = (datos, fecha, valor) => conDia(datos, fecha, () => ({ entreno: valor }));

// Un peso a mano por día: si ya habías apuntado uno ese día, se cambia (los
// pesajes de la báscula se quedan, pero manda el tuyo).
export function apuntarPeso(datos, fecha, kg) {
  const pesos = [...datos.pesos.filter((p) => p.fecha !== fecha || p.fuente), { id: id('w'), fecha, kg: Math.round(kg * 100) / 100 }];
  return revisarHitos({ ...datos, pesos }, fechaISO()).datos;
}
export const borrarPeso = (datos, pid, hoy = fechaISO()) => recalcularHitosPeso(datos, { ...datos, pesos: datos.pesos.filter((p) => p.id !== pid) }, hoy);

// Sacar (o volver a meter) un pesaje de la media: sigue guardado y se ve en gris.
export function excluirPeso(datos, pid, excluido = true, motivo = '', hoy = fechaISO()) {
  const pesos = datos.pesos.map((p) => {
    if (p.id !== pid) return p;
    const { excluido: _e, motivoExclusion: _m, ...resto } = p;
    return excluido ? { ...resto, excluido: true, ...(String(motivo).trim() ? { motivoExclusion: String(motivo).trim().slice(0, 60) } : {}) } : resto;
  });
  return recalcularHitosPeso(datos, { ...datos, pesos }, hoy);
}

// «Excluir todos los pesajes anteriores a una fecha» (la báscula antigua):
// los que ya estaban excluidos conservan su motivo. Devuelve cuántos cambian.
export function excluirAnteriores(datos, fecha, motivo = 'báscula antigua', hoy = fechaISO()) {
  let cambiados = 0;
  const pesos = datos.pesos.map((p) => {
    if (p.fecha >= fecha || p.excluido) return p;
    cambiados++;
    return { ...p, excluido: true, motivoExclusion: motivo };
  });
  return { datos: cambiados ? recalcularHitosPeso(datos, { ...datos, pesos }, hoy) : datos, cambiados };
}

export function apuntarMedida(datos, fecha, tipo, cm) {
  const medidas = [...datos.medidas.filter((m) => !(m.fecha === fecha && m.tipo === tipo)), { id: id('v'), fecha, tipo, cm: Math.round(cm * 10) / 10 }];
  return revisarHitos({ ...datos, medidas }, fechaISO()).datos;
}
export const borrarMedida = (datos, mid) => ({ ...datos, medidas: datos.medidas.filter((m) => m.id !== mid) });

export function anadirHito(datos, hito) {
  const nuevo = { id: id('h'), cumplido: null, recompensa: '', comparador: '<', ...hito };
  return revisarHitos({ ...datos, hitos: [...datos.hitos, nuevo] }, fechaISO()).datos;
}
export const borrarHito = (datos, hid) => ({ ...datos, hitos: datos.hitos.filter((h) => h.id !== hid) });

// ---------- Entrenos ----------

export function empezarSesion(datos, { rutina = null, fecha = fechaISO(), ahora = Date.now() } = {}) {
  const series = [];
  for (const e of rutina?.ejercicios ?? []) for (let i = 0; i < e.series; i++) series.push({ id: id('k'), ejercicioId: e.ejercicioId, kg: 0, reps: 0, calentamiento: false, hecha: false });
  return { ...datos, activa: { id: id('s'), fecha, rutinaId: rutina?.id, nombre: rutina?.nombre ?? 'Entreno libre', inicio: ahora, notas: '', series, cardio: [] } };
}

export const actualizarActiva = (datos, cambio) => (datos.activa ? { ...datos, activa: { ...datos.activa, ...cambio(datos.activa) } } : datos);

export function terminarSesion(datos, ahora = Date.now()) {
  const s = datos.activa;
  if (!s) return datos;
  const series = s.series.filter((x) => x.hecha !== false && x.reps > 0);
  const resto = { ...datos, activa: null };
  if (!series.length && !s.cardio.length) return resto;
  return revisarHitos({ ...resto, sesiones: [...datos.sesiones, { ...s, series, fin: ahora }] }, fechaISO()).datos;
}

export const descartarActiva = (datos) => ({ ...datos, activa: null });
export const borrarSesion = (datos, sid) => ({ ...datos, sesiones: datos.sesiones.filter((s) => s.id !== sid) });

export function crearEjercicio(datos, nombre, grupo) {
  const nuevo = { id: id('x'), nombre: nombre.trim().slice(0, 80), grupo, principal: false, propio: true };
  return { datos: { ...datos, ejercicios: [...datos.ejercicios, nuevo] }, ejercicio: nuevo };
}
export const alternarPrincipal = (datos, eid) => ({ ...datos, ejercicios: datos.ejercicios.map((e) => (e.id === eid ? { ...e, principal: !e.principal } : e)) });

export function guardarRutina(datos, rutina) {
  const r = { ...rutina, id: rutina.id ?? id('q') };
  const existe = datos.rutinas.some((x) => x.id === r.id);
  return { ...datos, rutinas: existe ? datos.rutinas.map((x) => (x.id === r.id ? r : x)) : [...datos.rutinas, r] };
}
export const borrarRutina = (datos, rid) => ({ ...datos, rutinas: datos.rutinas.filter((r) => r.id !== rid) });

export const aceptarDescarga = (datos, hoy = fechaISO()) => ({ ...datos, descargas: [...datos.descargas, hoy] });
export const descartarDescarga = (datos, hoy = fechaISO()) => ({ ...datos, descargaDescartada: hoy });

export const contarUsoIA = (datos, fecha = fechaISO()) => ({ ...datos, usosIA: { ...Object.fromEntries(Object.entries(datos.usosIA).filter(([f]) => f >= sumarDias(fecha, -30))), [fecha]: (datos.usosIA[fecha] ?? 0) + 1 } });

export const verAviso = (datos, aid) => ({ ...datos, avisosVistos: [...new Set([...datos.avisosVistos, aid])] });
