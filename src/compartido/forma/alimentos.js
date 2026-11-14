// Alimentos: tu catálogo, Open Food Facts (búsqueda y código de barras) y la
// búsqueda local. A muchos productos de Open Food Facts les faltan datos: se
// guarda lo que haya y se marca lo que falta.
import { id } from './datos.js';

const OFF = 'https://world.openfoodfacts.org';
const CAMPOS = 'code,product_name,product_name_es,generic_name_es,brands,nutriments,serving_size,serving_quantity,image_front_small_url';

export const urlProducto = (codigo) => `${OFF}/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}`;
export const urlBusqueda = (texto, pagina = 1) =>
  `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(texto)}&search_simple=1&action=process&json=1&page_size=20&page=${pagina}&sort_by=unique_scans_n&fields=${CAMPOS}`;

const n = (v) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(x) && x >= 0 ? x : undefined;
};

// Un producto de Open Food Facts → alimento de tu catálogo (o null si no sirve).
export function deOpenFoodFacts(producto) {
  if (!producto || typeof producto !== 'object') return null;
  const nombre = String(producto.product_name_es || producto.product_name || producto.generic_name_es || '').trim();
  if (!nombre) return null;
  const nu = producto.nutriments ?? {};
  let kcal = n(nu['energy-kcal_100g']);
  if (kcal === undefined && n(nu.energy_100g) !== undefined) kcal = Math.round(n(nu.energy_100g) / 4.184);
  const por100 = {
    kcal,
    proteina: n(nu.proteins_100g),
    hidratos: n(nu.carbohydrates_100g),
    azucares: n(nu.sugars_100g),
    grasa: n(nu.fat_100g),
    saturadas: n(nu['saturated-fat_100g']),
    fibra: n(nu.fiber_100g),
    sal: n(nu.salt_100g),
  };
  for (const k of Object.keys(por100)) if (por100[k] === undefined) delete por100[k];
  const racion = n(producto.serving_quantity);
  const faltan = ['kcal', 'proteina', 'hidratos', 'grasa'].filter((k) => por100[k] === undefined);
  return {
    nombre: nombre.slice(0, 120),
    marca: String(producto.brands ?? '').split(',')[0].trim().slice(0, 80),
    racion: racion && racion < 2000 ? racion : 100,
    racionNombre: racion ? String(producto.serving_size ?? '').slice(0, 40) : '',
    por100,
    codigo: String(producto.code ?? '').slice(0, 32),
    origen: 'off',
    imagen: typeof producto.image_front_small_url === 'string' ? producto.image_front_small_url : '',
    faltan,
  };
}

export async function buscarProducto(codigo, { fetch = globalThis.fetch } = {}) {
  let r;
  try {
    r = await fetch(urlProducto(codigo));
  } catch {
    throw new Error('No he podido conectar con Open Food Facts. Revisa la conexión.');
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Open Food Facts no responde ahora. Prueba en un momento.');
  const d = await r.json();
  if (d.status === 0 || !d.product) return null;
  return deOpenFoodFacts({ ...d.product, code: d.code ?? codigo });
}

export async function buscarEnOpenFoodFacts(texto, { fetch = globalThis.fetch, espera = 1200 } = {}) {
  let r = null;
  // La búsqueda de Open Food Facts a veces va saturada (503, a veces sin cabeceras
  // CORS, y el navegador lo ve como un fallo de red): se reintenta dos veces.
  for (let intento = 0; intento < 3; intento++) {
    try {
      r = await fetch(urlBusqueda(texto));
      if (r.status !== 503 && r.status !== 429 && r.status !== 502) break;
    } catch {
      r = null;
    }
    if (intento < 2) await new Promise((res) => setTimeout(res, espera * (intento + 1)));
  }
  if (!r) throw new Error('No he podido conectar con Open Food Facts. Revisa la conexión o prueba en unos segundos (también puedes escanear el código de barras).');
  if (!r.ok) throw new Error('Open Food Facts está saturado ahora mismo. Prueba en unos segundos o escanea el código de barras.');
  const d = await r.json();
  return (d.products ?? []).map(deOpenFoodFacts).filter((a) => a && a.por100.kcal !== undefined);
}

const normal = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Búsqueda en tu catálogo: por palabras, con favoritos y frecuentes primero.
export function buscarLocal(datos, texto, max = 30) {
  const palabras = normal(texto).split(/\s+/).filter(Boolean);
  const lista = datos.alimentos.filter((a) => {
    const t = normal(`${a.nombre} ${a.marca}`);
    return palabras.every((p) => t.includes(p));
  });
  return lista.sort((a, b) => (b.favorito - a.favorito) * 100 + (b.veces - a.veces) + (b.usado - a.usado) / 1e12).slice(0, max);
}

export const recientes = (datos, max = 12) => [...datos.alimentos].filter((a) => a.usado).sort((a, b) => b.usado - a.usado).slice(0, max);
export const favoritos = (datos) => datos.alimentos.filter((a) => a.favorito);

// Añade (o actualiza, si ya estaba por código o por nombre y marca) un alimento al catálogo.
export function guardarAlimento(datos, alimento) {
  const igual = datos.alimentos.find((a) => (alimento.id && a.id === alimento.id) || (alimento.codigo && a.codigo === alimento.codigo) || (normal(a.nombre) === normal(alimento.nombre) && normal(a.marca) === normal(alimento.marca)));
  const { faltan, imagen, ...limpio } = alimento;
  if (igual) {
    const nuevo = { ...igual, ...limpio, id: igual.id, veces: igual.veces, usado: igual.usado, favorito: limpio.favorito ?? igual.favorito };
    return { datos: { ...datos, alimentos: datos.alimentos.map((a) => (a.id === igual.id ? nuevo : a)) }, alimento: nuevo };
  }
  const nuevo = { favorito: false, usado: 0, veces: 0, racion: 100, racionNombre: '', marca: '', codigo: '', origen: 'manual', ...limpio, id: id('a') };
  return { datos: { ...datos, alimentos: [...datos.alimentos, nuevo] }, alimento: nuevo };
}
