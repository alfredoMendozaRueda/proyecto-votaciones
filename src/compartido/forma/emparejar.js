// Emparejar lo que llega (de una importación o de tu propio catálogo) con lo
// que ya tienes, para no acabar con «Yogur proteínas fresa» y «Yogur de fresa
// proteico» como dos alimentos distintos. Mismo algoritmo para alimentos y
// ejercicios, por orden de prioridad:
//   1. id  2. ean (código de barras, solo alimentos)  3. nombre normalizado
//   (+ marca)  4. alias  5. aproximado: palabras clave parecidas (Jaccard) y,
//   en alimentos, kcal y proteína por 100 a menos de un 10 %.
// Los niveles 1-4 son seguros (se usa el existente); el 5 solo se SUGIERE.
// Sin dependencias: lo usan los datos, el importador y la fusión.

// Palabras que no distinguen un alimento de otro.
const VACIAS = new Set(['de', 'del', 'con', 'al', 'a', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'en', 'un', 'una', 'para']);
export const SIMILITUD_MINIMA = 0.6;
export const MARGEN_NUTRIENTES = 0.1;

export const sinTildes = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Palabras significativas: sin tildes, sin signos y sin palabras vacías.
export const palabras = (t) =>
  sinTildes(t)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !VACIAS.has(w));

// «Yogur de fresa proteico» → «fresa proteico yogur»: el orden no importa.
export const normalizarNombre = (t) => palabras(t).sort().join(' ');

// Lematización simple: sin plural y como mucho 5 letras
// (proteico, proteína, proteínas → «prote»; fresas → «fresa»).
export function raiz(w) {
  if (/^\d/.test(w)) return w;
  const r = w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
  return r.slice(0, 5);
}

export const clavesDe = (t) => new Set(palabras(t).map(raiz));

export function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  return comunes / (a.size + b.size - comunes);
}

// Lo más parecido entre un nombre y el nombre o los alias de un elemento.
export function similitud(nombre, elemento) {
  const c = clavesDe(nombre);
  return Math.max(jaccard(c, clavesDe(elemento.nombre)), ...(elemento.alias ?? []).map((a) => jaccard(c, clavesDe(a))));
}

// Dos valores a menos de un 10 % (los dos 0 también valen; si falta uno, no).
export function parecidos(a, b, margen = MARGEN_NUTRIENTES) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const mayor = Math.max(a, b);
  return mayor === 0 || Math.abs(a - b) / mayor <= margen;
}

export const nutrientesParecidos = (p, q) => parecidos(p?.kcal, q?.kcal) && parecidos(p?.proteina, q?.proteina);

// Las dos marcas puestas y distintas.
export const marcasDistintas = (m1, m2) => Boolean(normalizarNombre(m1) && normalizarNombre(m2) && normalizarNombre(m1) !== normalizarNombre(m2));

const mismaMarca = (m1, m2) => normalizarNombre(m1) === normalizarNombre(m2);

// Alias limpios: sin repetir, sin el propio nombre, como mucho 20.
export function limpiarAlias(alias, nombre = '') {
  const vistos = new Set([normalizarNombre(nombre)]);
  const salida = [];
  for (const a of Array.isArray(alias) ? alias : []) {
    if (typeof a !== 'string') continue;
    const t = a.trim().slice(0, 120);
    const k = normalizarNombre(t);
    if (!t || !k || vistos.has(k)) continue;
    vistos.add(k);
    salida.push(t);
  }
  return salida.slice(0, 20);
}

// Añade un nombre como alias (si no es ya el nombre o un alias).
export const conAlias = (elemento, ...nombres) => ({ ...elemento, alias: limpiarAlias([...(elemento.alias ?? []), ...nombres], elemento.nombre) });

// ---------- Alimentos ----------

// x: { id?, ean?, nombre, marca?, por100? }. Con `sinNutrientes` (una
// referencia desde un registro) el nivel 5 solo mira las palabras y nunca se
// da por bueno solo.
// → { nivel: 'id'|'ean'|'nombre'|'alias'|'aproximado'|null, existente?, sugerencias, preseleccionar, avisos }
export function emparejarAlimento(alimentos, x, { sinNutrientes = false } = {}) {
  const avisos = [];
  if (x.id) {
    const a = alimentos.find((y) => y.id === x.id);
    if (a) return { nivel: 'id', existente: a, sugerencias: [], avisos };
    avisos.push(`el id «${x.id}» no existe; lo busco por nombre`);
  }
  if (x.ean) {
    const a = alimentos.find((y) => y.codigo && y.codigo === x.ean);
    if (a) return { nivel: 'ean', existente: a, sugerencias: [], avisos };
  }
  const n = normalizarNombre(x.nombre);
  if (n) {
    const exacto = alimentos.find((y) => normalizarNombre(y.nombre) === n && mismaMarca(y.marca, x.marca));
    if (exacto) return { nivel: 'nombre', existente: exacto, sugerencias: [], avisos };
    const porAlias = alimentos.find((y) => (y.alias ?? []).some((a) => normalizarNombre(a) === n) && !marcasDistintas(y.marca, x.marca));
    if (porAlias) return { nivel: 'alias', existente: porAlias, sugerencias: [], avisos };
  }
  const sugerencias = alimentos
    .map((y) => ({ alimento: y, similitud: similitud(x.nombre, y), marcaDistinta: marcasDistintas(y.marca, x.marca) }))
    .filter((s) => s.similitud >= SIMILITUD_MINIMA && (sinNutrientes || nutrientesParecidos(x.por100, s.alimento.por100)))
    .sort((a, b) => b.similitud - a.similitud || a.marcaDistinta - b.marcaDistinta)
    .slice(0, 3);
  if (sugerencias.length) return { nivel: 'aproximado', sugerencias, preseleccionar: !sinNutrientes && !sugerencias[0].marcaDistinta, avisos };
  return { nivel: null, sugerencias: [], avisos };
}

// ---------- Ejercicios ----------

// x: { id?, nombre }. Los ocultos (fusionados en otro) no se emparejan: su
// nombre ya es alias del que se conservó. Si no hay coincidencia segura, las 3
// sugerencias más parecidas (nunca se da una por buena sola).
export function emparejarEjercicio(ejercicios, x) {
  const visibles = ejercicios.filter((e) => !e.oculto);
  const avisos = [];
  if (x.id) {
    const e = visibles.find((y) => y.id === x.id);
    if (e) return { nivel: 'id', existente: e, sugerencias: [], avisos };
    if (!ejercicios.some((y) => y.id === x.id)) avisos.push(`el id «${x.id}» no existe; lo busco por nombre`);
  }
  const n = normalizarNombre(x.nombre);
  if (n) {
    const exacto = visibles.find((y) => normalizarNombre(y.nombre) === n);
    if (exacto) return { nivel: 'nombre', existente: exacto, sugerencias: [], avisos };
    const porAlias = visibles.find((y) => (y.alias ?? []).some((a) => normalizarNombre(a) === n));
    if (porAlias) return { nivel: 'alias', existente: porAlias, sugerencias: [], avisos };
  }
  const sugerencias = visibles
    .map((y) => ({ ejercicio: y, similitud: similitud(x.nombre, y) }))
    .filter((s) => s.similitud > 0)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, 3);
  return { nivel: null, sugerencias, avisos };
}
