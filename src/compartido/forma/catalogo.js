// Tu catálogo (alimentos y ejercicios): fusionar duplicados, sugerir posibles
// duplicados y exportarlo para que la IA use tus nombres e ids.
import { normalizarNombre, similitud, nutrientesParecidos, marcasDistintas, conAlias, limpiarAlias, SIMILITUD_MINIMA } from './emparejar.js';

export class ErrorFusion extends Error {}

const parClave = (a, b) => [a, b].sort().join('|');

// Comprueba la selección: el que se conserva y al menos otro, todos existentes.
function seleccion(lista, conservarId, otrosIds, nombre) {
  const conservado = lista.find((x) => x.id === conservarId);
  if (!conservado) throw new ErrorFusion(`El ${nombre} que quieres conservar ya no existe.`);
  const ids = [...new Set(otrosIds)].filter((x) => x !== conservarId);
  if (!ids.length) throw new ErrorFusion(`Elige al menos otro ${nombre} para fusionar.`);
  const otros = ids.map((x) => lista.find((y) => y.id === x));
  if (otros.some((x) => !x)) throw new ErrorFusion(`Alguno de los ${nombre}s ya no existe. Vuelve a elegirlos.`);
  return { conservado, otros, ids: new Set(ids) };
}

// Los nombres y alias de los que desaparecen pasan a ser alias del conservado.
const aliasFusionados = (conservado, otros) => limpiarAlias([...conservado.alias, ...otros.flatMap((o) => [o.nombre, ...o.alias])], conservado.nombre);

// Quita de «No son el mismo» las parejas con ids que ya no existen.
const limpiarNoDuplicados = (lista, fuera) => lista.filter((k) => !k.split('|').some((x) => fuera.has(x)));

// ---------- Fusionar ----------

// Alimentos: todo lo apuntado y las plantillas pasan al conservado. Lo ya
// apuntado conserva sus kcal y macros (el diario guarda sus propios valores).
export function fusionarAlimentos(datos, conservarId, otrosIds) {
  const { conservado, otros, ids } = seleccion(datos.alimentos, conservarId, otrosIds, 'alimento');
  const nuevo = {
    ...conservado,
    alias: aliasFusionados(conservado, otros),
    veces: otros.reduce((t, o) => t + (o.veces ?? 0), conservado.veces ?? 0),
    usado: Math.max(conservado.usado ?? 0, ...otros.map((o) => o.usado ?? 0)),
    favorito: conservado.favorito || otros.some((o) => o.favorito),
    codigo: conservado.codigo || otros.find((o) => o.codigo)?.codigo || '',
  };
  const mover = (x) => (x.alimentoId && ids.has(x.alimentoId) ? { ...x, alimentoId: conservarId } : x);
  return {
    ...datos,
    alimentos: datos.alimentos.filter((a) => !ids.has(a.id)).map((a) => (a.id === conservarId ? nuevo : a)),
    registros: datos.registros.map(mover),
    plantillas: datos.plantillas.map((t) => ({ ...t, items: t.items.map(mover) })),
    noDuplicados: limpiarNoDuplicados(datos.noDuplicados ?? [], ids),
  };
}

// Ejercicios: series de todas las sesiones (y del entreno en curso), rutinas e
// hitos pasan al conservado. Los de serie no se pueden borrar: quedan ocultos.
export function fusionarEjercicios(datos, conservarId, otrosIds) {
  const visibles = datos.ejercicios.filter((e) => !e.oculto);
  const { conservado, otros, ids } = seleccion(visibles, conservarId, otrosIds, 'ejercicio');
  const nuevo = { ...conservado, alias: aliasFusionados(conservado, otros), principal: conservado.principal || otros.some((o) => o.principal) };
  const cambiar = (eid) => (ids.has(eid) ? conservarId : eid);
  const series = (s) => ({ ...s, series: s.series.map((x) => (ids.has(x.ejercicioId) ? { ...x, ejercicioId: conservarId } : x)) });
  const ejercicios = datos.ejercicios
    .filter((e) => !(ids.has(e.id) && e.propio))
    .map((e) => (e.id === conservarId ? nuevo : ids.has(e.id) ? { ...e, oculto: true, principal: false, alias: [] } : e));
  const rutinas = datos.rutinas.map((r) => {
    // Si la rutina acaba con el mismo ejercicio dos veces, se queda la primera fila.
    const vistos = new Set();
    const lista = [];
    for (const x of r.ejercicios) {
      const eid = cambiar(x.ejercicioId);
      if (vistos.has(eid)) continue;
      vistos.add(eid);
      lista.push({ ...x, ejercicioId: eid });
    }
    return { ...r, ejercicios: lista };
  });
  return {
    ...datos,
    ejercicios,
    sesiones: datos.sesiones.map(series),
    activa: datos.activa ? series(datos.activa) : datos.activa,
    rutinas,
    hitos: datos.hitos.map((h) => (h.ejercicioId && ids.has(h.ejercicioId) ? { ...h, ejercicioId: conservarId } : h)),
    noDuplicados: limpiarNoDuplicados(datos.noDuplicados ?? [], ids),
  };
}

// ---------- Posibles duplicados ----------

// Parejas que parecen la misma cosa, con el mismo criterio que el nivel 5 del
// importador. En alimentos, con marcas distintas no se sugieren (son productos
// distintos); en ejercicios, al menos uno tiene que ser tuyo (los de serie
// ya son distintos entre sí).
export function posiblesDuplicados(datos, tipo, max = 30) {
  const descartadas = new Set(datos.noDuplicados ?? []);
  const lista = tipo === 'alimentos' ? datos.alimentos : datos.ejercicios.filter((e) => !e.oculto);
  const parejas = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i];
      const b = lista[j];
      if (descartadas.has(parClave(a.id, b.id))) continue;
      if (tipo === 'alimentos' && marcasDistintas(a.marca, b.marca)) continue;
      if (tipo === 'ejercicios' && !a.propio && !b.propio) continue;
      const igual = normalizarNombre(a.nombre) === normalizarNombre(b.nombre);
      const s = igual ? 1 : Math.max(similitud(a.nombre, b), similitud(b.nombre, a));
      if (s < SIMILITUD_MINIMA) continue;
      if (tipo === 'alimentos' && !igual && !nutrientesParecidos(a.por100, b.por100)) continue;
      parejas.push({ a, b, similitud: s });
    }
  }
  return parejas.sort((x, y) => y.similitud - x.similitud).slice(0, max);
}

export const noSonElMismo = (datos, idA, idB) => ({ ...datos, noDuplicados: [...new Set([...(datos.noDuplicados ?? []), parClave(idA, idB)])] });

// Asocia un nombre a un elemento existente como alias.
export function anadirAlias(datos, tipo, eid, ...nombres) {
  const lista = datos[tipo].map((x) => (x.id === eid ? conAlias(x, ...nombres) : x));
  return { ...datos, [tipo]: lista };
}

// ---------- Catálogo para la IA ----------

export const INSTRUCCION_CATALOGO = 'Usa exactamente estos nombres o ids al generar el JSON de importación; solo crea elementos nuevos si no existen.';

// JSON compacto con lo que tienes guardado. Alias y código de barras solo si hay.
export function catalogoParaIA(datos) {
  const alimentos = datos.alimentos.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    ...(a.marca ? { marca: a.marca } : {}),
    unidad: a.unidad ?? 'g',
    kcal: a.por100.kcal ?? 0,
    proteina: a.por100.proteina ?? 0,
    ...(a.codigo ? { ean: a.codigo } : {}),
    ...(a.alias?.length ? { alias: a.alias } : {}),
  }));
  const ejercicios = datos.ejercicios
    .filter((e) => !e.oculto)
    .map((e) => ({ id: e.id, nombre: e.nombre, ...(e.alias?.length ? { alias: e.alias } : {}) }));
  return `${INSTRUCCION_CATALOGO}\n${JSON.stringify({ catalogo: { alimentos, ejercicios } })}`;
}
