// La IA de Forma: estimar una comida por texto o foto e ideas para cuadrar los
// macros. Siempre pide JSON con un esquema fijo y lo valida antes de enseñarlo;
// el resultado se revisa y se edita antes de guardarlo.

const SISTEMA =
  'Eres un dietista que estima valores nutricionales de comidas españolas y de cualquier país. ' +
  'Respondes SOLO con JSON válido, sin texto alrededor. Usa gramos de la porción realmente comida. ' +
  'Sé realista con las raciones de bar, panadería o restaurante (suelen ser grandes y con aceite). ' +
  '«confianza» va de 0 a 1: baja si la descripción es vaga o la foto no se ve bien.';

const ESQUEMA_ITEM = '{"nombre": texto, "cantidad_g": número, "kcal": número, "proteina_g": número, "hidratos_g": número, "grasa_g": número, "fibra_g": número, "confianza": número}';

export function peticionEstimar({ descripcion = '', conFoto = false, etiqueta = false }) {
  const que = etiqueta
    ? 'La foto es una etiqueta nutricional. Lee los valores por 100 g y la ración si aparece. Devuelve un único elemento por 100 g (cantidad_g = 100) con el nombre del producto si se ve.'
    : conFoto
      ? 'Estima lo que hay en la foto del plato, alimento a alimento.'
      : 'Estima esta comida, alimento a alimento.';
  return {
    sistema: SISTEMA,
    usuario:
      `${que}${descripcion ? `\nDescripción: ${descripcion.slice(0, 600)}` : ''}\n\n` +
      `Devuelve JSON con esta forma exacta: {"items": [${ESQUEMA_ITEM}]}. Máximo 12 elementos.`,
    max: 1500,
    etiqueta: conFoto ? 'forma-foto' : 'forma-estimar',
  };
}

export function peticionIdeas({ quedan, frecuentes = [], momento = '' }) {
  return {
    sistema: SISTEMA,
    usuario:
      `Me quedan para hoy: ${Math.round(quedan.kcal)} kcal, ${Math.round(quedan.proteina)} g de proteína, ${Math.round(Math.max(0, quedan.hidratos))} g de hidratos y ${Math.round(Math.max(0, quedan.grasa))} g de grasa.` +
      (momento ? ` Es para ${momento.toLowerCase()}.` : '') +
      (frecuentes.length ? `\nAlimentos que suelo comer: ${frecuentes.slice(0, 20).join(', ')}.` : '') +
      '\n\nPropón 3 comidas concretas y variadas, fáciles de preparar en España, que se acerquen a esos macros sin pasarse de kcal ni de grasa. Prioriza la proteína. ' +
      `Devuelve JSON con esta forma exacta: {"ideas": [{"nombre": texto, "items": [${ESQUEMA_ITEM}]}]}.`,
    max: 2500,
    etiqueta: 'forma-ideas',
  };
}

// Saca el JSON aunque venga envuelto en ```json … ``` o con texto alrededor.
export function extraerJSON(texto) {
  const t = String(texto ?? '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const bloque = /```(?:json)?\s*([\s\S]*?)```/.exec(t)?.[1] ?? t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);
    return JSON.parse(bloque);
  }
}

const num = (v, max) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

// Un elemento válido o null. Las kcal se comprueban contra los macros: si no
// cuadran ni de lejos (± 35 %), se recalculan con 4/4/9.
export function validarItem(x) {
  if (!x || typeof x !== 'object') return null;
  const nombre = String(x.nombre ?? '').trim().slice(0, 120);
  const g = num(x.cantidad_g, 5000);
  const p = num(x.proteina_g, 500);
  const h = num(x.hidratos_g, 1000);
  const gr = num(x.grasa_g, 500);
  let kcal = num(x.kcal, 10000);
  if (!nombre || g === null || p === null || h === null || gr === null) return null;
  const calculadas = p * 4 + h * 4 + gr * 9;
  if (kcal === null || (calculadas > 20 && Math.abs(kcal - calculadas) > calculadas * 0.35)) kcal = Math.round(calculadas);
  return {
    nombre,
    gramos: Math.round(g),
    kcal: Math.round(kcal),
    proteina: Math.round(p * 10) / 10,
    hidratos: Math.round(h * 10) / 10,
    grasa: Math.round(gr * 10) / 10,
    fibra: Math.round((num(x.fibra_g, 200) ?? 0) * 10) / 10,
    confianza: Math.min(1, Math.max(0, num(x.confianza, 1) ?? 0.5)),
  };
}

export function leerEstimacion(texto) {
  const d = extraerJSON(texto);
  const items = (Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : []).map(validarItem).filter(Boolean).slice(0, 12);
  if (!items.length) throw new Error('La IA no ha devuelto una estimación que se pueda usar.');
  return items;
}

export function leerIdeas(texto) {
  const d = extraerJSON(texto);
  const ideas = (Array.isArray(d?.ideas) ? d.ideas : [])
    .map((i) => ({ nombre: String(i?.nombre ?? '').trim().slice(0, 120), items: (Array.isArray(i?.items) ? i.items : []).map(validarItem).filter(Boolean) }))
    .filter((i) => i.nombre && i.items.length)
    .slice(0, 3);
  if (!ideas.length) throw new Error('La IA no ha devuelto ideas que se puedan usar.');
  return ideas;
}

// Estimación rápida de una comida libre (restaurante) cuando solo das las kcal:
// reparto típico de comer fuera (20 % proteína, 45 % hidratos, 35 % grasa).
export function macrosDeKcal(kcal, proteina = null) {
  const p = Number.isFinite(proteina) ? proteina : Math.round((kcal * 0.2) / 4);
  const restante = Math.max(0, kcal - p * 4);
  return { kcal: Math.round(kcal), proteina: p, hidratos: Math.round((restante * (45 / 80)) / 4), grasa: Math.round((restante * (35 / 80)) / 9), fibra: Math.round((kcal / 1000) * 8) };
}

export const usosDeHoy = (datos, fecha) => datos.usosIA[fecha] ?? 0;
export const puedeUsarIA = (datos, fecha) => usosDeHoy(datos, fecha) < datos.ajustes.limiteIA;
