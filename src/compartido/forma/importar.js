// Importar alimentos y comidas desde un JSON (el que te prepara una IA en el
// chat). Todo es puro y sin interfaz: la pantalla valida al pegar y, al
// confirmar, `aplicarImportacion` vuelve a validarlo TODO sobre tus datos de
// ese momento (en Windows lo hace el proceso principal, aparte de la ventana).
// Se aplica sobre una copia y se guarda de una vez: o entra todo o no entra nada.
//
// Formato (versión 1):
// { "forma_import": 1,
//   "alimentos": [{ "nombre", "marca"?, "unidad": "g"|"ml", "racion_habitual",
//                   "por_100": { "kcal", "proteina", "hidratos", "grasa",
//                                "azucares"?, "saturadas"?, "fibra"?, "sal"? } }],
//   "registros": [{ "fecha"?, "momento"?, "hora"?, "alimento", "marca"?, "cantidad" }] }
import { id, NUTRIENTES } from './datos.js';
import { nutrientesDe, momentoPorHora, totales } from './diario.js';
import { esFecha, diasEntre, minutosDe } from './fechas.js';
import { emparejarAlimento, normalizarNombre, limpiarAlias, conAlias } from './emparejar.js';
import { prepararEntreno, resolverEntreno, aplicarEntreno, LIMITES_ENTRENO } from './importar-entreno.js';

export const VERSION_IMPORTACION = 1;
export const LIMITES = { texto: 200_000, alimentos: 300, registros: 500, diasAtras: 366, diasAdelante: 1 };
export const DESVIO_KCAL = 0.15;
const OBLIGATORIOS = ['kcal', 'proteina', 'hidratos', 'grasa'];
const MAXIMO_100 = { kcal: 900, sal: 100 }; // el resto, como mucho 100 g por cada 100

export class ErrorImportacion extends Error {
  constructor(errores) {
    const lista = errores.map(textoError);
    super(lista.length > 1 ? `Hay ${lista.length} errores:\n${lista.slice(0, 8).join('\n')}${lista.length > 8 ? '\n…' : ''}` : lista[0]);
    this.errores = errores;
  }
}

// «Alimento 2 · «Leche» › por_100.grasa: debe ser un número ≥ 0»
export const textoError = (e) => `${e.donde ? `${e.donde}${e.campo ? ` › ${e.campo}` : ''}: ` : e.campo ? `${e.campo}: ` : ''}${e.mensaje}`;

// ---------- Texto → objeto ----------

const normal = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Nombre normalizado (sin tildes, signos ni palabras vacías, en cualquier orden) y marca.
export const claveAlimento = (nombre, marca = '') => `${normalizarNombre(nombre)}|${normalizarNombre(marca)}`;

// Desde una «{», el trozo hasta su «}» (respetando las cadenas).
function bloqueDesde(texto, inicio) {
  let nivel = 0;
  let enCadena = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i++;
      else if (c === '"') enCadena = false;
    } else if (c === '"') enCadena = true;
    else if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) return texto.slice(inicio, i + 1);
  }
  return null;
}

// Lo que suele estropear un JSON copiado de un chat: comillas tipográficas,
// decimales con coma («3,9») y comas sobrantes antes de «}» o «]».
const reparar = (t) =>
  t
    .replace(/[“”„]/g, '"')
    .replace(/(:\s*-?\d+),(\d+)(?=\s*[,}\]\r\n])/g, '$1.$2')
    .replace(/,(\s*[}\]])/g, '$1');

function intentar(trozo) {
  for (const t of [trozo, reparar(trozo)]) {
    try {
      const v = JSON.parse(t);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch {
      // Se prueba la versión reparada.
    }
  }
  return null;
}

// El primer objeto JSON válido del texto, aunque venga en un bloque ```json o
// con frases alrededor. Prefiere el que parece una importación.
export function extraerObjeto(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw new ErrorImportacion([{ mensaje: 'Pega primero el texto con el JSON.' }]);
  if (texto.length > LIMITES.texto) throw new ErrorImportacion([{ mensaje: `El texto es demasiado largo (más de ${LIMITES.texto / 1000} KB). Impórtalo en varias partes.` }]);
  const bloques = [...texto.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g)].map((m) => m[1]);
  let primero = null;
  for (const fuente of [...bloques, texto]) {
    const t = fuente.replace(/[“”„]/g, '"');
    for (let i = t.indexOf('{'); i !== -1; i = t.indexOf('{', i + 1)) {
      const trozo = bloqueDesde(t, i);
      if (!trozo) continue;
      const v = intentar(trozo);
      if (!v) continue;
      if ('forma_import' in v || 'alimentos' in v || 'registros' in v) return v;
      primero ??= v;
    }
  }
  if (primero) return primero;
  throw new ErrorImportacion([{ mensaje: 'No encuentro ningún objeto JSON válido en el texto. Copia la respuesta entera de la IA, desde la «{» hasta la «}».' }]);
}

// ---------- Validación ----------

// Número ≥ 0 (también «3,9» en texto). undefined si falta; NaN si no vale.
function numero(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : NaN;
  if (typeof v === 'string') {
    const t = v.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
  }
  return NaN;
}

const cadena = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const nombreCorto = (t) => (t.length > 28 ? `${t.slice(0, 27)}…` : t);

const UNIDADES = { g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g', ml: 'ml', mililitro: 'ml', mililitros: 'ml' };

// kcal declaradas frente a P×4 + H×4 + G×9.
export function desvioKcal(p) {
  const calculadas = (p.proteina ?? 0) * 4 + (p.hidratos ?? 0) * 4 + (p.grasa ?? 0) * 9;
  const kcal = p.kcal ?? 0;
  if (!kcal && !calculadas) return { calculadas: 0, desvio: 0 };
  return { calculadas: Math.round(calculadas), desvio: kcal ? Math.abs(kcal - calculadas) / kcal : 1 };
}

// Un alimento del JSON → { valor, errores, avisos }. `i` es su posición (desde 0).
export function validarAlimento(a, i = 0) {
  const errores = [];
  const avisos = [];
  const nombre = cadena(a?.nombre);
  const donde = `Alimento ${i + 1}${nombre ? ` («${nombreCorto(nombre)}»)` : ''}`;
  const mal = (campo, mensaje) => errores.push({ donde, campo, mensaje });
  if (!a || typeof a !== 'object' || Array.isArray(a)) return { valor: null, errores: [{ donde: `Alimento ${i + 1}`, mensaje: 'tiene que ser un objeto { … }' }], avisos };
  if (!nombre) mal('nombre', 'es obligatorio');
  else if (nombre.length > 120) mal('nombre', 'es demasiado largo (máximo 120 caracteres)');
  if (a.marca !== undefined && a.marca !== null && typeof a.marca !== 'string') mal('marca', 'tiene que ser un texto');
  const marca = cadena(a.marca).slice(0, 80);
  const unidadTexto = normal(a.unidad);
  const unidad = UNIDADES[unidadTexto];
  if (!unidadTexto) mal('unidad', 'es obligatoria: "g" o "ml"');
  else if (!unidad) mal('unidad', `«${cadena(a.unidad)}» no vale: usa "g" o "ml"`);
  const racion = numero(a.racion_habitual ?? a.racion);
  if (racion === undefined) mal('racion_habitual', 'es obligatoria (la cantidad que sueles tomar)');
  else if (!(racion > 0) || racion > 5000) mal('racion_habitual', 'debe ser un número mayor que 0 y como mucho 5000');
  const por100 = {};
  const p = a.por_100 ?? a.por100;
  if (!p || typeof p !== 'object' || Array.isArray(p)) mal('por_100', 'es obligatorio: { "kcal", "proteina", "hidratos", "grasa" }');
  else {
    for (const k of NUTRIENTES) {
      const v = numero(p[k]);
      if (v === undefined) {
        if (OBLIGATORIOS.includes(k)) mal(`por_100.${k}`, 'es obligatorio');
        continue;
      }
      if (Number.isNaN(v)) mal(`por_100.${k}`, 'debe ser un número ≥ 0');
      else if (v > (MAXIMO_100[k] ?? 100)) mal(`por_100.${k}`, `no puede pasar de ${MAXIMO_100[k] ?? 100} por cada 100 ${unidad ?? 'g'}`);
      else por100[k] = Math.round(v * 100) / 100;
    }
  }
  if (!errores.length) {
    const { calculadas, desvio } = desvioKcal(por100);
    if (desvio > DESVIO_KCAL)
      avisos.push({ donde, campo: 'por_100.kcal', mensaje: `las kcal (${por100.kcal}) no cuadran con los macros: P×4 + H×4 + G×9 = ${calculadas} (${Math.round(desvio * 100)} % de diferencia). Revisa los valores.` });
  }
  const idApp = cadena(a.id).slice(0, 60);
  let ean = '';
  if (a.ean !== undefined && a.ean !== null && a.ean !== '') {
    ean = cadena(a.ean).replace(/\s/g, '');
    if (!/^\d{6,14}$/.test(ean)) mal('ean', 'debe ser un código de barras de 6 a 14 cifras');
  }
  if (a.alias !== undefined && !Array.isArray(a.alias)) mal('alias', 'tiene que ser una lista de textos');
  const alias = limpiarAlias(a.alias, nombre);
  return { valor: errores.length ? null : { nombre, marca, unidad, racion, por100, ...(idApp ? { id: idApp } : {}), ...(ean ? { ean } : {}), ...(alias.length ? { alias } : {}) }, errores, avisos };
}

// Un registro del JSON → { valor, errores, avisos }.
export function validarRegistro(r, i = 0, { hoy }) {
  const errores = [];
  const avisos = [];
  const alimento = cadena(r?.alimento);
  const alimentoId = cadena(r?.alimento_id ?? r?.alimentoId).slice(0, 60);
  const donde = `Registro ${i + 1}${alimento ? ` («${nombreCorto(alimento)}»)` : alimentoId ? ` (${alimentoId})` : ''}`;
  const mal = (campo, mensaje) => errores.push({ donde, campo, mensaje });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { valor: null, errores: [{ donde: `Registro ${i + 1}`, mensaje: 'tiene que ser un objeto { … }' }], avisos };
  if (!alimento && !alimentoId) mal('alimento', 'es obligatorio (el nombre del alimento o su "alimento_id")');
  const marca = cadena(r.marca).slice(0, 80);
  const cantidad = numero(r.cantidad);
  if (cantidad === undefined) mal('cantidad', 'es obligatoria');
  else if (!(cantidad > 0) || cantidad > 10000) mal('cantidad', 'debe ser un número mayor que 0 y como mucho 10000');
  let fecha = hoy;
  if (r.fecha !== undefined && r.fecha !== null && r.fecha !== '') {
    fecha = cadena(r.fecha);
    if (!esFecha(fecha)) mal('fecha', `«${fecha}» no es una fecha válida: usa AAAA-MM-DD`);
    else {
      const d = diasEntre(fecha, hoy);
      if (d > LIMITES.diasAtras) mal('fecha', 'es de hace más de un año');
      else if (d < -LIMITES.diasAdelante) mal('fecha', 'es del futuro (como mucho, mañana)');
    }
  }
  let hora;
  if (r.hora !== undefined && r.hora !== null && r.hora !== '') {
    hora = cadena(r.hora);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      avisos.push({ donde, campo: 'hora', mensaje: `«${hora}» no es una hora HH:MM; la ignoro` });
      hora = undefined;
    }
  }
  return { valor: errores.length ? null : { alimento, marca, cantidad, fecha, momento: cadena(r.momento).slice(0, 40), hora, ...(alimentoId ? { alimentoId } : {}) }, errores, avisos };
}

// Valida el objeto entero. Devuelve los elementos limpios, los errores y los avisos.
export function validarImportacion(obj, { hoy }) {
  const errores = [];
  const avisos = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { alimentos: [], registros: [], errores: [{ mensaje: 'El JSON tiene que ser un objeto { … }' }], avisos };
  if (obj.forma_import === undefined) avisos.push({ campo: 'forma_import', mensaje: 'no viene; lo leo como la versión 1' });
  else if (Number(obj.forma_import) !== VERSION_IMPORTACION) errores.push({ campo: 'forma_import', mensaje: `la versión ${cadena(obj.forma_import)} no es compatible (esta app lee la ${VERSION_IMPORTACION})` });
  for (const k of ['alimentos', 'registros', 'ejercicios', 'rutinas', 'sesiones']) if (obj[k] !== undefined && !Array.isArray(obj[k])) errores.push({ campo: k, mensaje: 'tiene que ser una lista [ … ]' });
  const listaA = Array.isArray(obj.alimentos) ? obj.alimentos : [];
  const listaR = Array.isArray(obj.registros) ? obj.registros : [];
  // Entrenos: aquí solo la forma; cada elemento se valida en la vista previa (y se corrige allí).
  const entreno = Object.fromEntries(['ejercicios', 'rutinas', 'sesiones'].map((k) => [k, Array.isArray(obj[k]) ? obj[k] : []]));
  for (const [k, lista] of Object.entries(entreno)) if (lista.length > LIMITES_ENTRENO[k]) errores.push({ campo: k, mensaje: `son ${lista.length}; como mucho ${LIMITES_ENTRENO[k]} de una vez` });
  const hayEntreno = Object.values(entreno).some((l) => l.length);
  if (!listaA.length && !listaR.length && !hayEntreno && !errores.length) errores.push({ mensaje: 'No hay nada que importar: hace falta «alimentos», «registros», «ejercicios», «rutinas» o «sesiones».' });
  if (listaA.length > LIMITES.alimentos) errores.push({ campo: 'alimentos', mensaje: `son ${listaA.length}; como mucho ${LIMITES.alimentos} de una vez` });
  if (listaR.length > LIMITES.registros) errores.push({ campo: 'registros', mensaje: `son ${listaR.length}; como mucho ${LIMITES.registros} de una vez` });
  if (errores.length) return { alimentos: [], registros: [], errores, avisos };
  const alimentos = [];
  const fuenteEntreno = hayEntreno ? entreno : null;
  const vistos = new Map();
  listaA.forEach((a, i) => {
    const v = validarAlimento(a, i);
    errores.push(...v.errores);
    avisos.push(...v.avisos.map((e) => ({ ...e, clave: `a${i}` })));
    if (!v.valor) return;
    const claves = [claveAlimento(v.valor.nombre, v.valor.marca), v.valor.id && `id:${v.valor.id}`, v.valor.ean && `ean:${v.valor.ean}`].filter(Boolean);
    const repetida = claves.find((k) => vistos.has(k));
    if (repetida) return errores.push({ donde: `Alimento ${i + 1} («${nombreCorto(v.valor.nombre)}»)`, mensaje: `está repetido (es igual que el alimento ${vistos.get(repetida) + 1})` });
    for (const k of claves) vistos.set(k, i);
    alimentos.push({ ...v.valor, indice: i });
  });
  const registros = [];
  listaR.forEach((r, i) => {
    const v = validarRegistro(r, i, { hoy });
    errores.push(...v.errores);
    avisos.push(...v.avisos.map((e) => ({ ...e, clave: `r${i}` })));
    if (v.valor) registros.push({ ...v.valor, indice: i });
  });
  return { alimentos, registros, errores, avisos, entreno: fuenteEntreno };
}

// ---------- Duplicados, momentos y referencias ----------

// Tus alimentos con ese nombre y marca (sin mayúsculas ni tildes). Los más usados primero.
export function duplicadosDe(datos, nombre, marca = '') {
  const clave = claveAlimento(nombre, marca);
  return datos.alimentos.filter((a) => claveAlimento(a.nombre, a.marca) === clave).sort((a, b) => b.veces - a.veces);
}

const casi = (a, b) => Math.abs((a ?? -1) - (b ?? -1)) < 0.051;
export const mismosValores = (a, b) => a.unidad === b.unidad && casi(a.racion, b.racion) && NUTRIENTES.every((k) => casi(a.por100?.[k], b.por100?.[k]));

// El momento del JSON → uno de los tuyos (por id o nombre, sin tildes). Si no
// coincide, el más cercano por hora (la del JSON, la de ahora si es hoy o la comida).
export function resolverMomento(momentos, texto, { hora, fecha, hoy, ahoraMin = 13 * 60 } = {}) {
  const t = normal(texto);
  const exacto = t && momentos.find((m) => normal(m.id) === t || normal(m.nombre) === t);
  if (exacto) return { id: exacto.id, aviso: null };
  const minuto = hora ? minutosDe(hora) : fecha === hoy ? ahoraMin : 13 * 60 + 30;
  const elegido = momentoPorHora(momentos, minuto);
  const nombre = momentos.find((m) => m.id === elegido)?.nombre ?? elegido;
  return { id: elegido, aviso: t ? `«${cadena(texto)}» no es una de tus comidas: lo pongo en ${nombre}` : `sin momento: lo pongo en ${nombre}` };
}

// ---------- Vista previa ----------

// Del JSON validado a un plan editable: cada alimento con su decisión ante un
// duplicado y cada registro con su momento ya resuelto.
export function prepararImportacion(datos, validado, { hoy, ahoraMin } = {}) {
  const alimentos = validado.alimentos.map((a) => {
    const e = emparejarAlimento(datos.alimentos, a);
    const sugerencias = e.sugerencias.map((s) => ({ id: s.alimento.id, nombre: s.alimento.nombre, marca: s.alimento.marca, similitud: Math.round(s.similitud * 100) / 100, marcaDistinta: s.marcaDistinta }));
    // Niveles 1-4: se usa el que tienes. Nivel 5: se sugiere (marcado salvo con marcas distintas).
    const existenteId = e.existente?.id ?? sugerencias[0]?.id ?? null;
    const existente = existenteId ? datos.alimentos.find((x) => x.id === existenteId) : null;
    const decision = e.existente || (e.nivel === 'aproximado' && e.preseleccionar) ? 'usar' : 'crear';
    return { clave: `a${a.indice}`, indice: a.indice, incluir: true, alimento: a, nivel: e.nivel, existenteId, sugerencias, iguales: existente ? mismosValores(a, existente) : false, decision, avisoId: e.avisos[0] ?? null };
  });
  const registros = validado.registros.map((r) => {
    const m = resolverMomento(datos.momentos, r.momento, { hora: r.hora, fecha: r.fecha, hoy, ahoraMin });
    return { clave: `r${r.indice}`, indice: r.indice, incluir: true, alimento: r.alimento, marca: r.marca, ...(r.alimentoId ? { alimentoId: r.alimentoId } : {}), cantidad: r.cantidad, fecha: r.fecha, momento: m.id, hora: r.hora, avisoMomento: m.aviso };
  });
  return { version: VERSION_IMPORTACION, alimentos, registros, avisos: validado.avisos, ...(validado.entreno ? prepararEntreno(datos, validado.entreno, { hoy }) : {}) };
}

// Desde el texto pegado hasta el plan (o los errores).
export function leerImportacion(datos, texto, opciones) {
  const validado = validarImportacion(extraerObjeto(texto), opciones);
  if (validado.errores.length) throw new ErrorImportacion(validado.errores);
  return prepararImportacion(datos, validado, opciones);
}

const DECISIONES = ['usar', 'actualizar', 'crear'];

// Resuelve el plan contra tus datos: qué alimento acaba usando cada registro y
// qué aporta. Valida otra vez cada elemento (puede haberse editado).
export function resolverPlan(datos, plan, { hoy }) {
  const errores = [];
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.alimentos) || !Array.isArray(plan.registros)) throw new ErrorImportacion([{ mensaje: 'La importación no tiene el formato esperado. Vuelve a pegar el JSON.' }]);
  // Cómo quedará cada alimento del JSON en tu catálogo (por nombre+marca, alias e id).
  const json = { porClave: new Map(), porId: new Map(), porExistente: new Map(), desmarcados: new Set() };
  const alimentos = [];
  for (const x of plan.alimentos) {
    const i = Number.isInteger(x?.indice) ? x.indice : alimentos.length;
    const v = validarAlimento(x?.alimento, i);
    if (!x?.incluir) {
      if (v.valor) json.desmarcados.add(claveAlimento(v.valor.nombre, v.valor.marca));
      continue;
    }
    errores.push(...v.errores.map((e) => ({ ...e, clave: `a${i}` })));
    if (!v.valor) continue;
    if (!DECISIONES.includes(x.decision)) {
      errores.push({ clave: `a${i}`, donde: `Alimento ${i + 1}`, campo: 'decisión', mensaje: 'elige usar el existente, actualizarlo o crear uno nuevo' });
      continue;
    }
    const existente = x.decision === 'crear' ? null : datos.alimentos.find((a) => a.id === x.existenteId);
    if (x.decision !== 'crear' && !existente) {
      errores.push({ clave: `a${i}`, donde: `Alimento ${i + 1} («${nombreCorto(v.valor.nombre)}»)`, mensaje: 'el alimento que ya tenías ya no existe; elige «crear uno nuevo»' });
      continue;
    }
    const clave = claveAlimento(v.valor.nombre, v.valor.marca);
    if (json.porClave.get(clave)) {
      errores.push({ clave: `a${i}`, donde: `Alimento ${i + 1} («${nombreCorto(v.valor.nombre)}»)`, mensaje: 'está repetido en la importación' });
      continue;
    }
    const entrada = { decision: x.decision, valor: v.valor, existente, clave: `a${i}` };
    for (const k of [clave, ...(v.valor.alias ?? []).map((al) => claveAlimento(al, v.valor.marca))]) if (!json.porClave.has(k)) json.porClave.set(k, entrada);
    if (v.valor.id) json.porId.set(v.valor.id, entrada);
    if (existente) json.porExistente.set(existente.id, entrada);
    alimentos.push(entrada);
  }
  // Con qué alimento va cada registro y qué aporta.
  const registros = [];
  for (const x of plan.registros) {
    if (!x?.incluir) continue;
    const i = Number.isInteger(x.indice) ? x.indice : registros.length;
    const v = validarRegistro({ ...x, alimento_id: x.alimentoId }, i, { hoy });
    errores.push(...v.errores.map((e) => ({ ...e, clave: `r${i}` })));
    if (!v.valor) continue;
    const donde = `Registro ${i + 1} («${nombreCorto(v.valor.alimento || v.valor.alimentoId)}»)`;
    if (!datos.momentos.some((m) => m.id === x.momento)) {
      errores.push({ clave: `r${i}`, donde, campo: 'momento', mensaje: 'elige una de tus comidas del día' });
      continue;
    }
    const ref = buscarReferencia(datos, json, v.valor);
    if (ref.error) {
      errores.push({ clave: `r${i}`, donde, campo: 'alimento', mensaje: ref.error, sugerencias: ref.sugerencias ?? [] });
      continue;
    }
    const base = ref.entrada ? (ref.entrada.decision === 'usar' ? ref.entrada.existente : ref.entrada.valor) : ref.alimento;
    registros.push({ ...v.valor, nombreImportado: v.valor.alimento, indice: i, clave: `r${i}`, momento: x.momento, asociado: x.asociado === true, aviso: ref.aviso ?? null, entrada: ref.entrada ?? null, alimento: ref.alimento ?? null, nutrientes: nutrientesDe(base, v.valor.cantidad), unidad: base.unidad ?? 'g', nombre: base.nombre });
  }
  // Entrenos (ejercicios, rutinas y sesiones), si los hay.
  const entreno = plan.ejercicios || plan.rutinas || plan.sesiones ? resolverEntreno(datos, plan, { hoy }) : null;
  if (entreno) errores.push(...entreno.errores);
  return { alimentos, registros, errores, entreno };
}

// El alimento de un registro: por id (del JSON o tuyo), luego por nombre y
// marca o alias (primero los del JSON, luego los tuyos). Si un alimento del
// JSON va a parar a uno tuyo, el registro usa esa entrada (con sus valores).
function buscarReferencia(datos, json, { alimento: nombre, marca, alimentoId }) {
  const deTuyo = (a) => (json.porExistente.has(a.id) ? { entrada: json.porExistente.get(a.id) } : { alimento: a });
  let aviso = null;
  if (alimentoId) {
    if (json.porId.has(alimentoId)) return { entrada: json.porId.get(alimentoId) };
    const a = datos.alimentos.find((y) => y.id === alimentoId);
    if (a) return deTuyo(a);
    if (!nombre) return { error: `el alimento_id «${alimentoId}» no existe en tus alimentos ni en la importación` };
    aviso = `el alimento_id «${alimentoId}» no existe; lo busco por nombre`;
  }
  const con = (r) => ({ ...r, aviso });
  const clave = claveAlimento(nombre, marca);
  if (json.porClave.has(clave)) return con({ entrada: json.porClave.get(clave) });
  const e = emparejarAlimento(datos.alimentos, { nombre, marca }, { sinNutrientes: true });
  if (e.existente) return con(deTuyo(e.existente));
  const desmarcado = json.desmarcados.has(clave) ? ' (lo has desmarcado)' : '';
  const sugerencias = e.sugerencias.map((s) => ({ id: s.alimento.id, nombre: s.alimento.nombre, marca: s.alimento.marca }));
  if (marca) return { error: `«${nombre}» (${marca}) no está en la importación ni en tus alimentos${desmarcado}`, sugerencias };
  // Sin marca: el único con ese nombre (del JSON o tuyo).
  const n = normalizarNombre(nombre);
  const candidatosJSON = [...new Set([...json.porClave.entries()].filter(([k]) => k.split('|')[0] === n).map(([, v]) => v))];
  const candidatosTuyos = datos.alimentos.filter((y) => normalizarNombre(y.nombre) === n && !candidatosJSON.some((c) => c.existente?.id === y.id));
  if (candidatosJSON.length + candidatosTuyos.length > 1) return { error: `hay varios «${nombre}» de distinta marca: indica la marca`, sugerencias: candidatosTuyos.map((y) => ({ id: y.id, nombre: y.nombre, marca: y.marca })) };
  if (candidatosJSON.length) return con({ entrada: candidatosJSON[0] });
  if (candidatosTuyos.length) return con(deTuyo(candidatosTuyos[0]));
  const desmarcadoN = [...json.desmarcados].some((k) => k.split('|')[0] === n) ? ' (lo has desmarcado)' : '';
  return { error: `«${nombre}» no está en la importación ni en tus alimentos${desmarcadoN}`, sugerencias };
}

// Lo que se sumará a cada día: { fecha: { kcal, proteina, … , n } }.
export function totalesPorDia(resuelto) {
  const dias = {};
  for (const r of resuelto.registros) (dias[r.fecha] ??= []).push(r.nutrientes);
  return Object.fromEntries(
    Object.entries(dias)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, lista]) => [f, { ...totales(lista), n: lista.length }]),
  );
}

// ---------- Guardar ----------

// Aplica el plan sobre una copia de tus datos. Si algo no vale, lanza
// ErrorImportacion y tus datos no cambian.
export function aplicarImportacion(datos, plan, { hoy, ahora = Date.now() } = {}) {
  const resuelto = resolverPlan(datos, plan, { hoy });
  if (resuelto.errores.length) throw new ErrorImportacion(resuelto.errores);
  const e = resuelto.entreno;
  if (e) {
    // Nunca se crea un ejercicio en silencio: todo tiene que estar resuelto.
    const faltan = [
      ...e.pendientes.map((r) => ({ clave: `ref:${r.clave}`, donde: `«${r.ref.nombre || r.ref.id}»`, mensaje: 'elige a qué ejercicio tuyo corresponde o créalo nuevo' })),
      ...e.rutinasPendientes.map((s) => ({ clave: s.clave, donde: `Rutina «${s.rutina.nombre}»`, mensaje: 'no existe: elige crearla con los ejercicios de la sesión o importar la sesión sin rutina' })),
    ];
    if (faltan.length) throw new ErrorImportacion(faltan);
  }
  const hayEntreno = e && (e.defs.length || e.rutinas.length || e.sesiones.some((s) => s.incluir));
  if (!resuelto.alimentos.length && !resuelto.registros.length && !hayEntreno) throw new ErrorImportacion([{ mensaje: 'No has marcado nada para importar.' }]);
  let lista = [...datos.alimentos];
  const resumen = { creados: 0, actualizados: 0, usados: 0, alias: 0, registros: 0 };
  for (const e of resuelto.alimentos) {
    const v = e.valor;
    const campos = { nombre: v.nombre, marca: v.marca, unidad: v.unidad, racion: v.racion, racionNombre: '', por100: v.por100, origen: 'importado' };
    if (e.decision === 'usar' || e.decision === 'actualizar') {
      // Si el nombre importado es otro, se guarda como alias para reconocerlo solo la próxima vez.
      const nombres = [v.nombre, ...(v.alias ?? [])].filter((n) => normalizarNombre(n) !== normalizarNombre(e.existente.nombre));
      const actual = lista.find((a) => a.id === e.existente.id) ?? e.existente;
      const base = e.decision === 'usar' ? actual : { ...actual, ...campos, codigo: actual.codigo || v.ean || '', id: actual.id };
      e.final = nombres.length ? conAlias(base, ...nombres) : base;
      if (e.decision === 'usar' && nombres.length && e.final.alias.length > (actual.alias?.length ?? 0)) resumen.alias++;
      lista = lista.map((a) => (a.id === e.final.id ? e.final : a));
      if (e.decision === 'usar') resumen.usados++;
      else resumen.actualizados++;
    } else {
      e.final = { ...campos, id: id('a'), codigo: v.ean ?? '', alias: limpiarAlias(v.alias, v.nombre), favorito: false, usado: 0, veces: 0 };
      lista.push(e.final);
      resumen.creados++;
    }
  }
  // Un registro que asociaste a mano a uno de tus alimentos: ese nombre pasa a ser alias.
  for (const r of resuelto.registros) {
    if (!r.asociado || !r.nombreImportado) continue;
    const destino = r.entrada ? r.entrada.final : r.alimento;
    const actual = lista.find((a) => a.id === destino.id);
    if (!actual) continue;
    const nuevo = conAlias(actual, r.nombreImportado);
    if (nuevo.alias.length === (actual.alias?.length ?? 0)) continue;
    lista = lista.map((a) => (a.id === actual.id ? nuevo : a));
    if (r.entrada) r.entrada.final = nuevo;
    resumen.alias++;
  }
  const nuevos = resuelto.registros.map((r, i) => {
    const alimento = r.entrada ? r.entrada.final : (lista.find((a) => a.id === r.alimento.id) ?? r.alimento);
    const n = nutrientesDe(alimento, r.cantidad);
    const m = datos.momentos.find((x) => x.id === r.momento);
    return {
      id: id('r'),
      fecha: r.fecha,
      momento: r.momento,
      minuto: (r.hora ? minutosDe(r.hora) : minutosDe(m?.hora)) ?? 720,
      nombre: alimento.nombre,
      alimentoId: alimento.id,
      gramos: r.cantidad,
      ...(alimento.unidad === 'ml' ? { unidad: 'ml' } : {}),
      kcal: n.kcal ?? 0,
      proteina: n.proteina ?? 0,
      hidratos: n.hidratos ?? 0,
      grasa: n.grasa ?? 0,
      fibra: n.fibra ?? 0,
      ...(Number.isFinite(n.azucares) ? { azucares: n.azucares } : {}),
      ...(Number.isFinite(n.saturadas) ? { saturadas: n.saturadas } : {}),
      ...(Number.isFinite(n.sal) ? { sal: n.sal } : {}),
      estimado: false,
      libre: false,
      origen: 'importado',
      creado: ahora + i,
    };
  });
  resumen.registros = nuevos.length;
  // Los alimentos que usas pasan a «recientes» y a «Lo de siempre».
  const usos = new Map();
  for (const r of nuevos) usos.set(r.alimentoId, (usos.get(r.alimentoId) ?? 0) + 1);
  lista = lista.map((a) => (usos.has(a.id) ? { ...a, usado: ahora, veces: (a.veces ?? 0) + usos.get(a.id) } : a));
  const fechas = [...new Set(nuevos.map((r) => r.fecha))].sort();
  const conComida = { ...datos, alimentos: lista, registros: [...datos.registros, ...nuevos] };
  if (!hayEntreno) return { datos: conComida, resumen: { ...resumen, fechas } };
  const r = aplicarEntreno(conComida, e, { ahora });
  return { datos: r.datos, resumen: { ...resumen, fechas, ...r.resumen } };
}

// ---------- Instrucciones para la IA ----------

// Texto corto para pegárselo al asistente, con tus comidas del día.
export function formatoParaIA(momentos = []) {
  const nombres = momentos.map((m) => m.id).join(', ') || 'desayuno, comida, cena';
  return `Devuélveme los datos en un único bloque JSON (formato "forma_import": 1), sin comentarios. Usa solo las secciones que necesites:
{
  "forma_import": 1,
  "alimentos": [
    { "nombre": "Leche semidesnatada", "marca": "COVAP", "unidad": "ml", "racion_habitual": 250,
      "por_100": { "kcal": 46, "proteina": 3.1, "hidratos": 4.7, "azucares": 4.7, "grasa": 1.6, "saturadas": 1.0, "fibra": 0, "sal": 0.13 } }
  ],
  "registros": [
    { "fecha": "AAAA-MM-DD", "momento": "cena", "alimento": "Leche semidesnatada", "marca": "COVAP", "cantidad": 250 }
  ],
  "ejercicios": [
    { "nombre": "Jalón al pecho", "grupo": "espalda", "grupos_secundarios": ["biceps"], "equipo": "polea", "principal": true, "unilateral": false, "alias": ["Lat pulldown"] }
  ],
  "rutinas": [
    { "nombre": "Espalda y bíceps", "ejercicios": [ { "ejercicio": "Jalón al pecho", "series": 4, "reps_min": 6, "reps_max": 10, "descanso_s": 150 } ] }
  ],
  "sesiones": [
    { "fecha": "AAAA-MM-DD", "hora_inicio": "20:00", "duracion_min": 90, "rutina": "Espalda y bíceps", "notas": "",
      "ejercicios": [ { "ejercicio": "Jalón al pecho", "notas": "", "series": [
        { "tipo": "calentamiento", "peso_kg": 30, "reps": 12 },
        { "tipo": "efectiva", "peso_kg": 55, "reps": 8, "rir": 1 },
        { "tipo": "efectiva", "peso_kg": 55, "reps": 7, "fallo": true } ] } ],
      "cardio": [ { "tipo": "cinta", "duracion_min": 15, "velocidad_kmh": 3.5, "inclinacion_pct": 10, "intensidad": "media" } ] }
  ]
}
Reglas de comida:
- Valores de "por_100" por cada 100 g o 100 ml según "unidad" ("g" o "ml"). Obligatorios: kcal, proteina, hidratos, grasa. Que las kcal cuadren con proteína×4 + hidratos×4 + grasa×9.
- En "registros", "alimento" (y "marca") es el nombre exacto de uno de la lista o de uno que ya tengo; "cantidad" en su unidad; "fecha" AAAA-MM-DD (si falta, hoy); "momento": uno de ${nombres}. Opcional "hora": "HH:MM".
Reglas de entreno:
- Serie: "tipo" calentamiento, efectiva o dropset (al fallo: "fallo": true); "peso_kg" (0 = peso corporal; o "peso_lb"); "reps" entero; opcionales "lastre_kg", "rir" (0-5), "descanso_s", "notas"; isométricos: "duracion_s" en vez de reps.
- "grupo": pecho, espalda, hombro, biceps, triceps, antebrazo, pierna, gluteo, abdomen, cardio u otro. "equipo": barra, mancuerna, polea, maquina, peso_corporal u otro. Si "unilateral": true, el peso es por lado.
- Cardio "tipo": cinta, andar, correr, bici, eliptica, remo, escaladora u otro; "intensidad": baja, media o alta. Las sesiones no pueden ser del futuro.
Si te he pasado mi catálogo, usa sus nombres exactos o sus ids ("id"; en referencias "alimento_id", "ejercicio_id", "rutina_id"); crea elementos nuevos solo si no existen. Números con punto decimal. Si no conoces un valor, no lo inventes: déjalo fuera si es opcional y avísame.`;
}
