// Gastos: los puntuales (un café, la compra, la gasolina) y los fijos que se
// repiten solos (alquiler, Netflix, el seguro del coche…). Todo en céntimos,
// para que las sumas cuadren siempre, y con fechas locales «AAAA-MM-DD».
// También los ingresos (la nómina, una paga extra, un Bizum que te hacen): son
// movimientos y fijos con «ingreso: true» y sus propias categorías.
//
// Un gasto fijo no se apunta cada mes: se calcula. Si un mes cambia (la luz
// subió) o no toca (lo pausaste), se guarda como excepción de ese día.

export const CATEGORIAS = [
  { id: 'casa', nombre: 'Casa', color: '#c58b5a' },
  { id: 'super', nombre: 'Súper', color: '#8fb06d' },
  { id: 'comer', nombre: 'Comer fuera', color: '#d9935a' },
  { id: 'transporte', nombre: 'Transporte', color: '#6fa0c8' },
  { id: 'facturas', nombre: 'Facturas', color: '#a98fd3' },
  { id: 'suscripciones', nombre: 'Suscripciones', color: '#d4727a' },
  { id: 'ocio', nombre: 'Ocio', color: '#d6b860' },
  { id: 'salud', nombre: 'Salud', color: '#5fb5a5' },
  { id: 'compras', nombre: 'Compras', color: '#c983ad' },
  { id: 'otros', nombre: 'Otros', color: '#958b80' },
];
export const CATEGORIAS_INGRESO = [
  { id: 'nomina', nombre: 'Nómina', color: '#7fc28f' },
  { id: 'extra', nombre: 'Pagas y extras', color: '#a9cf7c' },
  { id: 'ingresos', nombre: 'Otros ingresos', color: '#79bfb0' },
];
const POR_ID = new Map([...CATEGORIAS, ...CATEGORIAS_INGRESO].map((c) => [c.id, c]));
const DE_INGRESO = new Set(CATEGORIAS_INGRESO.map((c) => c.id));
export const esCategoriaIngreso = (id) => DE_INGRESO.has(id);
export const categoria = (id) => POR_ID.get(id) ?? POR_ID.get('otros');

export const FRECUENCIAS = [
  { id: 'mensual', nombre: 'Cada mes', meses: 1 },
  { id: 'trimestral', nombre: 'Cada 3 meses', meses: 3 },
  { id: 'anual', nombre: 'Cada año', meses: 12 },
  { id: 'semanal', nombre: 'Cada semana', meses: 12 / 52 },
];
const FRECUENCIA = new Map(FRECUENCIAS.map((f) => [f.id, f]));
export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const MAX_CENTIMOS = 100_000_000; // un millón de euros
const MAX_MOVIMIENTOS = 5000;
const MAX_FIJOS = 200;

// ---------- Fechas y dinero ----------

const dos = (n) => String(n).padStart(2, '0');
export const fechaISO = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const mesDe = (fecha) => String(fecha).slice(0, 7);
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(\d{2})$/;
export function fechaValida(texto) {
  const m = FECHA.exec(String(texto ?? ''));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}
export const mesValido = (texto) => MES.test(String(texto ?? '')) && Number(String(texto).slice(5)) >= 1 && Number(String(texto).slice(5)) <= 12;
const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate();
export function sumarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;
}
export function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  return fechaISO(new Date(a, m - 1, d + n));
}
// «noviembre de 2026»; con corto, «noviembre».
export function nombreMes(mes, { corto = false } = {}) {
  const [a, m] = mes.split('-').map(Number);
  return corto ? MESES[m - 1] : `${MESES[m - 1]} de ${a}`;
}

// 1.234,50 € (con punto de miles también en 4 cifras, que Intl en español no pone) ·
// con redondo, sin céntimos si son ,00.
export function euros(centimos, { redondo = false } = {}) {
  const c = Math.round(Number(centimos) || 0);
  const abs = Math.abs(c);
  const miles = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = abs % 100;
  return `${c < 0 ? '−' : ''}${redondo && !resto ? miles : `${miles},${String(resto).padStart(2, '0')}`} €`;
}

// Para lo estimado: al euro, sin céntimos que aparenten una precisión que no hay.
export const aprox = (centimos) => euros(Math.round((Number(centimos) || 0) / 100) * 100, { redondo: true });

// «12», «12,5», «12.50», «1.200», «1.200,50», «1,200.50», «€12» → céntimos (o null).
export function leerImporte(texto) {
  let t = String(texto ?? '').replace(/[€\s]|eur(os?)?/gi, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  if (coma !== -1 && punto !== -1) {
    // Los dos: el último es el decimal.
    const decimal = coma > punto ? ',' : '.';
    t = t.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.');
  } else if (coma !== -1 || punto !== -1) {
    const sep = coma !== -1 ? ',' : '.';
    const partes = t.split(sep);
    const ultima = partes.at(-1);
    // Con 1 o 2 cifras al final es decimal; con 3, de miles («1.200»).
    if (partes.length === 2 && ultima.length <= 2) t = `${partes[0]}.${ultima}`;
    else if (partes.slice(1).every((p) => p.length === 3)) t = partes.join('');
    else return null;
  }
  const n = Math.round(Number(t) * 100);
  return Number.isFinite(n) && n > 0 && n <= MAX_CENTIMOS ? n : null;
}

// ---------- Categoría por el concepto ----------

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// El orden importa: «amazon prime» es una suscripción antes que una compra.
const PISTAS = [
  ['suscripciones', /netflix|spotify|hbo|\bmax\b|disney|prime video|amazon prime|\bprime\b|youtube premium|apple (music|tv|one)|icloud|google one|chatgpt|openai|claude|suscripci|filmin|movistar plus|dazn|twitch|patreon|xbox game pass|playstation plus|audible|kindle unlimited/],
  ['casa', /alquiler|hipoteca|comunidad|ibi|seguro (de )?hogar|mueble|ikea|leroy|bricomart|reforma|fontaner|electricista|limpieza|cerrajer|decoraci/],
  ['facturas', /\bluz\b|electricidad|\bagua\b|\bgas\b|butano|internet|fibra|movil|telefon|iberdrola|endesa|naturgy|repsol luz|holaluz|movistar|vodafone|orange|\bdigi\b|masmovil|pepephone|\bo2\b|lowi|simyo|yoigo|jazztel|seguro|impuesto|hacienda|multa|banco|comision/],
  ['super', /\bsuper\b|supermercado|mercadona|carrefour|\blidl\b|\bdia\b|alcampo|eroski|\baldi\b|consum|hipercor|ahorramas|bonpreu|condis|caprabo|gadis|froiz|compra semanal|\bcompra\b|fruteri|carniceri|pescaderi|panaderi|mercado/],
  ['comer', /restaurante|\bbar\b|cafe|cafeteri|cena|comida fuera|almuerzo|desayuno|\bmenu\b|glovo|just ?eat|uber ?eats|deliveroo|pizza|burger|hamburgues|kebab|sushi|cerveza|cana|copas|vermut|tapas|brunch|telepizza|mcdonald|starbucks|100 montaditos/],
  ['transporte', /gasolina|gasoil|gasoleo|diesel|combustible|repostar|\bmetro\b|\bbus\b|autobus|\btaxi\b|\buber\b|cabify|\bbolt\b|renfe|\btren\b|\bave\b|avion|vuelo|ryanair|vueling|iberia|parking|aparcamiento|\bora\b|peaje|\bitv\b|taller|neumatic|abono (de )?transporte|bicing|patinete|blablacar|alsa/],
  ['salud', /farmacia|medico|medicina|dentista|fisio|gimnasio|\bgym\b|optica|gafas|lentillas|psicolog|clinica|hospital|analitica|seguro medico|sanitas|adeslas|asisa|veterinari/],
  ['ocio', /\bcine\b|concierto|entradas|teatro|museo|videojuego|\bjuego\b|steam|nintendo|playstation|\bxbox\b|libro|libreria|viaje|hotel|airbnb|booking|vacaciones|escapada|festival|discoteca|bolera|parque|futbol|padel|deporte/],
  ['compras', /ropa|zapat|zapatill|camiseta|pantal|abrigo|amazon|aliexpress|shein|zara|primark|mango|pull ?and ?bear|bershka|h ?& ?m|decathlon|el corte ingles|mediamarkt|fnac|pccomponentes|electronica|regalo|cosmetic|perfume|peluqueri/],
];
export function adivinarCategoria(concepto) {
  const t = sinTildes(concepto);
  return PISTAS.find(([, re]) => re.test(t))?.[0] ?? 'otros';
}

// Ingresos: lo que te llega (nómina, paga extra, Bizum recibido, una devolución…).
const PISTA_INGRESO = /\b(nomina|sueldo|salario|paga extra|paga de (navidad|verano|julio|diciembre)|pagas? extras?|ingreso|ingresado|ingresan|me (han )?(ingresado|pagado|transferido|devuelto|hecho un bizum)|me pagan|bizum recibido|cobro|cobrado|he cobrado|devolucion|reembolso|venta|vendido|premio|bonus|incentivo|freelance|honorarios|pension|paro|subsidio|beca|alquiler cobrado)\b/;
export function adivinarIngreso(concepto) {
  const t = sinTildes(concepto);
  if (/nomina|sueldo|salario|pension|paro|subsidio/.test(t)) return 'nomina';
  if (/paga|extra|bonus|incentivo|premio/.test(t)) return 'extra';
  return 'ingresos';
}

// ¿Qué es lo que cuenta? Tres cosas distintas:
//   gasto   «he gastado 30», «he pagado la luz», «me han cobrado 12 del parking»  → resta
//   ingreso «me han ingresado la nómina, 1.850», «me han dado 50», «he cobrado»   → suma
//   saldo   «tengo 2.300 €», «me quedan 300 en el banco», «saldo 1.200»          → ni suma ni resta:
//           es lo que hay en la cuenta, el punto de partida para saber cómo acaba cada mes.
// Primero los verbos de gasto (así «me han cobrado» nunca es un ingreso), luego los
// de ingreso, luego el saldo y al final las palabras sueltas («nómina 1.850»).
const VERBO_GASTO = /\b(?:he gastado|me he gastado|hemos gastado|gaste|he pagado|hemos pagado|pague|me (?:ha |han )?cobr\w*|me costo|me ha costado|he comprado|compre|he invertido|he dado|di|le he dado|he prestado|preste)\b/;
const VERBO_INGRESO = /^\s*\+|\b(?:me (?:han |ha )?(?:ingresado|pagado|transferido|devuelto|dado|abonado|hecho un bizum|enviado)|me ingresaron|me pagaron|me dieron|me devolvieron|me transfirieron|he cobrado|cobre|hemos cobrado|he recibido|recibi|he ganado|gane|me han tocado|me toco|bizum recibido|me (?:ha |han )?llegad?o (?:la |el |una |un |mi )?(?:nomina|paga|sueldo|salario|bizum|transferencia|ingreso|dinero|devolucion|pension))\b/;
const PISTA_SALDO = /\bsaldo\b|\b(?:tengo|me quedan?|quedan|hay|dispongo de|cuento con|llevo ahorrad[oa]s)\s+(?:ahora\s+|ya\s+|todavia\s+|aun\s+|unos?\s+|en total\s+|mas o menos\s+|casi\s+)*(?:€\s*)?\d|\ben (?:la|mi) cuenta (?:tengo|hay|me quedan?)\b|\b(?:tengo|hay)\b.*\ben (?:la|mi) cuenta\b|\ben el banco\b|\bahorrad[oa]s\b/;
export function tipoDeTexto(texto) {
  const t = sinTildes(texto);
  if (VERBO_GASTO.test(t)) return 'gasto';
  if (VERBO_INGRESO.test(texto) || VERBO_INGRESO.test(t)) return 'ingreso';
  if (PISTA_SALDO.test(t)) return 'saldo';
  if (PISTA_INGRESO.test(t)) return 'ingreso';
  return 'gasto';
}

// ---------- Escribir un gasto en una línea ----------
// «12,50 súper», «súper 12,50», «ayer 30€ gasolina», «netflix 12,99 al mes»,
// «seguro coche 420 al año» → { centimos, concepto, categoria, fecha, fijo }.
const RE_IMPORTE = /(?:€\s*)?\d+(?:[.,]\d+)*(?:\s*(?:€|eur(?:os?)?\b))?/gi;
export function interpretarGasto(texto, hoy = fechaISO()) {
  let t = ` ${String(texto ?? '').trim()} `;
  const tipo = tipoDeTexto(texto ?? '');
  const ingreso = tipo === 'ingreso';
  t = t.replace(/^\s*\+\s*/, ' ');
  let fecha = hoy;
  const fechas = [
    [/\banteayer\b/i, -2],
    [/\bayer\b/i, -1],
    [/\bhoy\b/i, 0],
  ];
  for (const [re, dias] of fechas) {
    if (re.test(t)) {
      fecha = sumarDias(hoy, dias);
      t = t.replace(re, ' ');
      break;
    }
  }
  let fijo = null;
  const repeticiones = [
    [/\b(?:cada|al|por|\/)\s*mes\b|\bmensual(?:es|mente)?\b|\/mes\b/i, 'mensual'],
    [/\b(?:cada|al|por)\s*a[nñ]o\b|\banual(?:es|mente)?\b|\/a[nñ]o\b/i, 'anual'],
    [/\b(?:cada|a la|por)\s*semana\b|\bsemanal(?:es|mente)?\b/i, 'semanal'],
    [/\b(?:cada\s*(?:3|tres)\s*meses|trimestral(?:es|mente)?)\b/i, 'trimestral'],
  ];
  for (const [re, frecuencia] of repeticiones) {
    if (re.test(t)) {
      fijo = { frecuencia };
      t = t.replace(re, ' ');
      break;
    }
  }
  // El importe: el que lleva €, si no el que tiene decimales, si no el último número.
  const candidatos = [...t.matchAll(RE_IMPORTE)].map((m) => ({ texto: m[0], indice: m.index, centimos: leerImporte(m[0]), euro: /€|eur/i.test(m[0]), decimales: /[.,]\d{1,2}\b/.test(m[0]) }));
  const validos = candidatos.filter((c) => c.centimos);
  const elegido = validos.find((c) => c.euro) ?? validos.find((c) => c.decimales) ?? validos.at(-1) ?? null;
  if (elegido) t = t.slice(0, elegido.indice) + ' ' + t.slice(elegido.indice + elegido.texto.length);
  // El concepto: lo que queda, sin «de», «en», «por» sueltos al principio.
  let concepto = t.replace(/\s+/g, ' ').replace(/[,.;:]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  // Fuera el verbo («me han ingresado», «he pagado», «tengo que pagar»…): queda de qué es.
  const verbo = /^(?:me (?:han|ha) (?:ingresado|pagado|transferido|devuelto|dado|abonado|hecho|enviado|llegado|cobrado|costado)|me (?:ingresaron|pagaron|dieron|devolvieron|transfirieron|cobraron|llego|lleg[oó]|cost[oó])|(?:(?:le|les) )?(?:he|hemos|me he) (?:gastado|pagado|comprado|cobrado|recibido|ganado|dado|invertido|prestado)|tengo que pagar|hay que pagar|pagu[eé]|gast[eé]|compr[eé]|cobr[eé]|recib[ií]|gan[eé])(?:\s+|$)/i;
  const conVerbo = verbo.test(concepto);
  concepto = concepto.replace(verbo, '');
  // «en el bar» → «bar»; el artículo solo se quita detrás de una preposición o del verbo («La compra» se queda).
  const conPreposicion = /^(?:de|en|del|por|para)\s+\S/i.test(concepto);
  concepto = concepto.replace(/^(?:de|en|del|por|para)\s+/i, '');
  if (conPreposicion || conVerbo) concepto = concepto.replace(/^(?:el|la|los|las|un|una|mi|mis)\s+(?=\S)/i, '');
  // «a mi hermano» (lo que le diste a alguien) → «Para mi hermano».
  concepto = concepto.replace(/^a\s+(?=\S)/i, 'para ');
  concepto = concepto.replace(/\s+(?:de|en|por)$/i, '').trim();
  concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);
  return {
    centimos: elegido?.centimos ?? null,
    concepto: concepto.slice(0, 80),
    categoria: ingreso ? adivinarIngreso(concepto) : concepto ? adivinarCategoria(concepto) : 'otros',
    fecha,
    fijo: tipo === 'saldo' ? null : fijo,
    ingreso,
    tipo,
  };
}

// ---------- Datos ----------

const cadena = (t, max) => (typeof t === 'string' ? t.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const entero = (n, min, max) => (Number.isInteger(n) && n >= min && n <= max ? n : null);
export const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function normalizarMovimiento(m) {
  if (!m || typeof m !== 'object') return null;
  const centimos = entero(m.centimos, 1, MAX_CENTIMOS);
  if (!centimos || !fechaValida(m.fecha)) return null;
  const ingreso = m.ingreso === true || (m.ingreso === undefined && DE_INGRESO.has(m.categoria));
  const cat = POR_ID.has(m.categoria) && DE_INGRESO.has(m.categoria) === ingreso ? m.categoria : null;
  const concepto = cadena(m.concepto, 80);
  const catFinal = cat ?? (ingreso ? adivinarIngreso(concepto) : adivinarCategoria(concepto));
  return {
    id: typeof m.id === 'string' && /^g[0-9a-z]{4,30}$/.test(m.id) ? m.id : nuevoId('g'),
    fecha: m.fecha,
    centimos,
    ingreso,
    concepto: concepto || categoria(catFinal).nombre,
    categoria: catFinal,
    nota: cadena(m.nota, 200),
    creado: Number.isFinite(m.creado) ? m.creado : 0,
  };
}

function normalizarExcepciones(e) {
  if (!e || typeof e !== 'object') return {};
  const salida = {};
  for (const [fecha, x] of Object.entries(e).slice(0, 400)) {
    if (!fechaValida(fecha) || !x || typeof x !== 'object') continue;
    if (x.omitido === true) salida[fecha] = { omitido: true };
    else if (entero(x.centimos, 1, MAX_CENTIMOS)) salida[fecha] = { centimos: x.centimos };
  }
  return salida;
}

function normalizarFijo(f, hoy) {
  if (!f || typeof f !== 'object') return null;
  const centimos = entero(f.centimos, 1, MAX_CENTIMOS);
  if (!centimos) return null;
  const ingreso = f.ingreso === true || (f.ingreso === undefined && DE_INGRESO.has(f.categoria));
  const cat = POR_ID.has(f.categoria) && DE_INGRESO.has(f.categoria) === ingreso ? f.categoria : null;
  const concepto = cadena(f.concepto, 80);
  const desde = fechaValida(f.desde) ? f.desde : `${mesDe(hoy)}-01`;
  const catFinal = cat ?? (ingreso ? adivinarIngreso(concepto) : adivinarCategoria(concepto));
  return {
    id: typeof f.id === 'string' && /^f[0-9a-z]{4,30}$/.test(f.id) ? f.id : nuevoId('f'),
    concepto: concepto || categoria(catFinal).nombre,
    centimos,
    ingreso,
    categoria: catFinal,
    frecuencia: FRECUENCIA.has(f.frecuencia) ? f.frecuencia : 'mensual',
    // El día del mes (1-31; si el mes es más corto, el último), o de la semana (1 = lunes).
    dia: entero(f.dia, 1, 31) ?? Number(desde.slice(8)),
    diaSemana: entero(f.diaSemana, 1, 7) ?? 1,
    // Mes de referencia de los anuales y trimestrales (1-12).
    mes: entero(f.mes, 1, 12) ?? Number(desde.slice(5, 7)),
    desde,
    hasta: fechaValida(f.hasta) && f.hasta >= desde ? f.hasta : '',
    excepciones: normalizarExcepciones(f.excepciones),
    creado: Number.isFinite(f.creado) ? f.creado : 0,
  };
}

export function normalizarGastos(d = {}, hoy = fechaISO()) {
  const datos = d && typeof d === 'object' ? d : {};
  const movimientos = (Array.isArray(datos.movimientos) ? datos.movimientos : []).map(normalizarMovimiento).filter(Boolean);
  movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  return {
    movimientos: movimientos.slice(0, MAX_MOVIMIENTOS),
    fijos: (Array.isArray(datos.fijos) ? datos.fijos : []).map((f) => normalizarFijo(f, hoy)).filter(Boolean).slice(0, MAX_FIJOS),
    presupuesto: entero(datos.presupuesto, 0, MAX_CENTIMOS) ?? 0,
    // Lo que había en la cuenta un día concreto: desde ahí se calcula el saldo de cada fin de mes.
    saldo: datos.saldo && entero(datos.saldo.centimos, -MAX_CENTIMOS, MAX_CENTIMOS) !== null && fechaValida(datos.saldo.fecha) ? { centimos: datos.saldo.centimos, fecha: datos.saldo.fecha } : null,
  };
}

// ---------- Cambiar los datos (siempre devuelven datos nuevos) ----------

export function anadirMovimiento(datos, m, ahora = Date.now()) {
  const movimiento = normalizarMovimiento({ ...m, id: undefined, creado: ahora });
  if (!movimiento) throw new Error('Pon un importe mayor que cero y una fecha válida.');
  return { datos: normalizarGastos({ ...datos, movimientos: [movimiento, ...datos.movimientos] }), movimiento };
}

export function editarMovimiento(datos, id, cambios) {
  const anterior = datos.movimientos.find((m) => m.id === id);
  if (!anterior) throw new Error('Ese gasto ya no existe.');
  const movimiento = normalizarMovimiento({ ...anterior, ...cambios, id });
  if (!movimiento) throw new Error('Pon un importe mayor que cero y una fecha válida.');
  return normalizarGastos({ ...datos, movimientos: datos.movimientos.map((m) => (m.id === id ? movimiento : m)) });
}

export const borrarMovimiento = (datos, id) => normalizarGastos({ ...datos, movimientos: datos.movimientos.filter((m) => m.id !== id) });

export function anadirFijo(datos, f, hoy = fechaISO(), ahora = Date.now()) {
  if (datos.fijos.length >= MAX_FIJOS) throw new Error(`Puedes tener hasta ${MAX_FIJOS} gastos fijos.`);
  const fijo = normalizarFijo({ ...f, id: undefined, creado: ahora }, hoy);
  if (!fijo) throw new Error('Pon un importe mayor que cero.');
  return { datos: normalizarGastos({ ...datos, fijos: [...datos.fijos, fijo] }, hoy), fijo };
}

export function editarFijo(datos, id, cambios, hoy = fechaISO()) {
  const anterior = datos.fijos.find((f) => f.id === id);
  if (!anterior) throw new Error('Ese gasto fijo ya no existe.');
  const fijo = normalizarFijo({ ...anterior, ...cambios, id }, hoy);
  if (!fijo) throw new Error('Pon un importe mayor que cero.');
  return normalizarGastos({ ...datos, fijos: datos.fijos.map((f) => (f.id === id ? fijo : f)) }, hoy);
}

// Borrar del todo (también de los meses pasados).
export const borrarFijo = (datos, id) => normalizarGastos({ ...datos, fijos: datos.fijos.filter((f) => f.id !== id) });

// Darlo de baja: deja de contar a partir de ahora; lo ya pagado (hasta hoy) se queda.
export const darDeBajaFijo = (datos, id, hoy = fechaISO()) => editarFijo(datos, id, { hasta: hoy }, hoy);
export const reactivarFijo = (datos, id, hoy = fechaISO()) => editarFijo(datos, id, { hasta: '' }, hoy);

// Un mes concreto de un fijo: otro importe ({ centimos }), que no toca ({ omitido: true }) o como siempre (null).
export function cambiarOcurrencia(datos, id, fecha, cambio, hoy = fechaISO()) {
  const fijo = datos.fijos.find((f) => f.id === id);
  if (!fijo) throw new Error('Ese gasto fijo ya no existe.');
  const excepciones = { ...fijo.excepciones };
  if (cambio === null || (cambio.centimos && cambio.centimos === fijo.centimos)) delete excepciones[fecha];
  else excepciones[fecha] = cambio;
  return editarFijo(datos, id, { excepciones }, hoy);
}

export const ponerPresupuesto = (datos, centimos) => normalizarGastos({ ...datos, presupuesto: entero(centimos, 0, MAX_CENTIMOS) ?? 0 });
// El saldo de la cuenta un día (hoy, si no se dice; null para quitarlo).
export const ponerSaldo = (datos, centimos, fecha = fechaISO()) => normalizarGastos({ ...datos, saldo: centimos === null ? null : { centimos, fecha } }, fecha);

// ---------- Cuentas ----------

const diaSemanaDe = (anio, mes, dia) => ((new Date(anio, mes - 1, dia).getDay() + 6) % 7) + 1;

// Las veces que toca un fijo en un mes («AAAA-MM») → [{ fecha, centimos, omitido, cambiado }].
export function ocurrencias(fijo, mes) {
  const [anio, m] = mes.split('-').map(Number);
  const total = diasDelMes(anio, m);
  const dias = [];
  switch (fijo.frecuencia) {
    case 'semanal':
      for (let d = 1; d <= total; d++) if (diaSemanaDe(anio, m, d) === fijo.diaSemana) dias.push(d);
      break;
    case 'anual':
      if (m === fijo.mes) dias.push(Math.min(fijo.dia, total));
      break;
    case 'trimestral':
      if ((((m - fijo.mes) % 3) + 3) % 3 === 0) dias.push(Math.min(fijo.dia, total));
      break;
    default:
      dias.push(Math.min(fijo.dia, total));
  }
  return dias
    .map((d) => `${mes}-${dos(d)}`)
    .filter((fecha) => fecha >= fijo.desde && (!fijo.hasta || fecha <= fijo.hasta))
    .map((fecha) => {
      const e = fijo.excepciones[fecha];
      return { fecha, centimos: e?.centimos ?? fijo.centimos, omitido: Boolean(e?.omitido), cambiado: Boolean(e?.centimos) };
    });
}

// Lo que cuesta un fijo al mes, de media (anuales /12, semanales ×52/12…).
export const alMes = (fijo) => Math.round((fijo.centimos / FRECUENCIA.get(fijo.frecuencia).meses));
export const fijoActivo = (fijo, hoy = fechaISO()) => !fijo.hasta || fijo.hasta > hoy;
export const totalFijosAlMes = (datos, hoy = fechaISO()) => datos.fijos.filter((f) => !f.ingreso && fijoActivo(f, hoy)).reduce((s, f) => s + alMes(f), 0);
export const totalIngresosFijosAlMes = (datos, hoy = fechaISO()) => datos.fijos.filter((f) => f.ingreso && fijoActivo(f, hoy)).reduce((s, f) => s + alMes(f), 0);

// «Cada mes, el día 1», «Cada año, el 15 de marzo», «Cada semana, los lunes».
export function cuandoFijo(fijo) {
  switch (fijo.frecuencia) {
    case 'semanal':
      return `Cada semana, los ${DIAS_SEMANA[fijo.diaSemana - 1]}`;
    case 'anual':
      return `Cada año, el ${fijo.dia} de ${MESES[fijo.mes - 1]}`;
    case 'trimestral':
      return `Cada 3 meses, el día ${fijo.dia}`;
    default:
      return `Cada mes, el día ${fijo.dia}`;
  }
}

// La próxima vez que toca (desde hoy incluido), buscando hasta un año.
export function proximaFecha(fijo, hoy = fechaISO()) {
  if (!fijoActivo(fijo, hoy)) return null;
  for (let i = 0; i <= 12; i++) {
    const o = ocurrencias(fijo, sumarMeses(mesDe(hoy), i)).find((x) => x.fecha >= hoy && !x.omitido);
    if (o) return o;
  }
  return null;
}

// Todo lo de un mes: puntuales y fijos juntos, por fecha (lo más reciente arriba).
export function resumenMes(datos, mes, hoy = fechaISO()) {
  const puntuales = datos.movimientos.filter((m) => m.fecha.startsWith(mes)).map((m) => ({ ...m, tipo: 'puntual', pendiente: false }));
  const fijos = datos.fijos.flatMap((f) =>
    ocurrencias(f, mes)
      .filter((o) => !o.omitido)
      .map((o) => ({
        id: `${f.id}@${o.fecha}`,
        fijoId: f.id,
        tipo: 'fijo',
        fecha: o.fecha,
        centimos: o.centimos,
        concepto: f.concepto,
        categoria: f.categoria,
        ingreso: f.ingreso,
        cambiado: o.cambiado,
        pendiente: o.fecha > hoy,
      })),
  );
  const omitidos = datos.fijos.flatMap((f) => ocurrencias(f, mes).filter((o) => o.omitido).map((o) => ({ fijoId: f.id, fecha: o.fecha, concepto: f.concepto })));
  const lista = [...puntuales, ...fijos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0));
  const suma = (xs) => xs.reduce((s, x) => s + x.centimos, 0);
  const gastos = lista.filter((x) => !x.ingreso);
  const entradas = lista.filter((x) => x.ingreso);
  const gastado = suma(gastos.filter((x) => !x.pendiente));
  const pendiente = suma(gastos.filter((x) => x.pendiente));
  const porCategoria = new Map();
  for (const x of gastos) porCategoria.set(x.categoria, (porCategoria.get(x.categoria) ?? 0) + x.centimos);
  const previsto = gastado + pendiente;
  const ingresado = suma(entradas.filter((x) => !x.pendiente));
  const porCobrar = suma(entradas.filter((x) => x.pendiente));
  return {
    mes,
    lista,
    omitidos,
    gastado,
    pendiente,
    previsto,
    fijos: suma(gastos.filter((x) => x.tipo === 'fijo')),
    puntuales: suma(gastos.filter((x) => x.tipo === 'puntual')),
    ingresado,
    porCobrar,
    ingresos: ingresado + porCobrar,
    porCategoria: [...porCategoria]
      .map(([id, centimos]) => ({ id, nombre: categoria(id).nombre, color: categoria(id).color, centimos, parte: previsto ? centimos / previsto : 0 }))
      .sort((a, b) => b.centimos - a.centimos),
    presupuesto: datos.presupuesto,
    // Lo que aún se puede gastar este mes, contando los fijos que faltan.
    disponible: datos.presupuesto ? datos.presupuesto - previsto : null,
  };
}

// Los últimos n meses hasta «mes» (incluido) → [{ mes, total, ingresos }].
export function historico(datos, mes, n = 6, hoy = fechaISO()) {
  return Array.from({ length: n }, (_, i) => sumarMeses(mes, i - n + 1)).map((m) => {
    const r = resumenMes(datos, m, hoy);
    return { mes: m, total: r.previsto, ingresos: r.ingresos };
  });
}

// ---------- Apuntar sin contar dos veces ----------
// Si ya tienes la nómina (o el alquiler) como fijo y dices «me ha llegado la nómina,
// 1.900» o «he pagado el alquiler», no es otro movimiento: es ese fijo, ese mes.
// Se ajusta su importe de ese mes (si cambia) en vez de sumarlo otra vez.
const palabrasDe = (t) => new Set(sinTildes(t).split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 4));
export function fijoQueEs(datos, { concepto, categoria: cat, ingreso, fecha }) {
  const suyas = palabrasDe(concepto);
  let mejor = null;
  for (const f of datos.fijos) {
    if (f.ingreso !== ingreso || (f.hasta && f.hasta < fecha)) continue;
    const parecido = [...palabrasDe(f.concepto)].some((p) => suyas.has(p)) || (ingreso && cat === 'nomina' && f.categoria === 'nomina' && suyas.size <= 1);
    if (!parecido) continue;
    for (const m of [sumarMeses(mesDe(fecha), -1), mesDe(fecha), sumarMeses(mesDe(fecha), 1)]) {
      for (const o of ocurrencias(f, m)) {
        if (o.omitido) continue;
        const dias = Math.abs((Date.parse(`${o.fecha}T12:00`) - Date.parse(`${fecha}T12:00`)) / 86_400_000);
        if (dias <= 12 && (!mejor || dias < mejor.dias)) mejor = { fijo: f, fecha: o.fecha, centimos: o.centimos, dias };
      }
    }
  }
  return mejor;
}

// Un gasto o ingreso suelto → { datos, resultado }. resultado sirve para enseñarlo y para deshacerlo.
export function apuntarMovimiento(datos, m, hoy = fechaISO(), ahora = Date.now()) {
  const fecha = fechaValida(m.fecha) ? m.fecha : hoy;
  const ingreso = m.ingreso === true;
  const cat = ingreso ? (DE_INGRESO.has(m.categoria) ? m.categoria : adivinarIngreso(m.concepto)) : m.categoria;
  const es = fijoQueEs(datos, { concepto: m.concepto, categoria: cat, ingreso, fecha });
  if (es) {
    const anterior = es.fijo.excepciones[es.fecha] ?? null;
    const nuevos = cambiarOcurrencia(datos, es.fijo.id, es.fecha, { centimos: m.centimos }, hoy);
    return {
      datos: nuevos,
      resultado: { tipo: 'fijo-ajustado', ingreso, fijoId: es.fijo.id, fecha: es.fecha, concepto: es.fijo.concepto, centimos: m.centimos, antes: es.centimos, anterior, igual: es.centimos === m.centimos },
    };
  }
  const r = anadirMovimiento(datos, { ...m, fecha, ingreso, categoria: cat }, ahora);
  return { datos: r.datos, resultado: { tipo: 'puntual', ingreso, id: r.movimiento.id, concepto: r.movimiento.concepto, categoria: r.movimiento.categoria, centimos: r.movimiento.centimos, fecha } };
}

// Deshacer cualquier cosa apuntada (desde el chat o la línea rápida).
export function deshacerApunte(datos, r, hoy = fechaISO()) {
  if (r.tipo === 'saldo') return normalizarGastos({ ...datos, saldo: r.anterior ?? null }, hoy);
  if (r.tipo === 'fijo-ajustado') {
    if (!datos.fijos.some((f) => f.id === r.fijoId)) return datos;
    return cambiarOcurrencia(datos, r.fijoId, r.fecha, r.anterior, hoy);
  }
  if (r.tipo === 'fijo') return borrarFijo(datos, r.id);
  return borrarMovimiento(datos, r.id);
}

// ---------- Previsión ----------
// Lo fijo se sabe (alquiler, nómina, el seguro de marzo…). Lo del día a día se
// estima con la media de tus últimos meses, quitando el efecto de la época del
// año, y se ajusta al mes que viene: en Navidad se gasta más, en febrero menos.
// Si ya tienes un año de datos, cuenta también lo que gastaste ese mes el año pasado.

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher) → «AAAA-MM-DD».
export function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

// Cuánto se suele gastar en el día a día cada mes en España, frente a un mes normal.
const ESTACION = [
  [1.12, 'Reyes y rebajas (la cuesta de enero)'],
  [0.92, 'febrero suele ser más tranquilo'],
  [0.97, ''],
  [0.98, ''],
  [1.0, ''],
  [1.04, 'empieza el verano'],
  [1.15, 'vacaciones de verano'],
  [1.2, 'vacaciones de verano'],
  [1.08, 'vuelta al cole y a la rutina'],
  [0.97, ''],
  [1.06, 'Black Friday'],
  [1.3, 'Navidad: regalos, cenas y viajes'],
];
export function factorEstacional(mes) {
  const [anio, m] = mes.split('-').map(Number);
  let [factor, motivo] = ESTACION[m - 1];
  // Semana Santa cae en marzo o abril según el año: el mes de su Jueves Santo.
  if (mesDe(sumarDias(domingoDePascua(anio), -3)) === mes) {
    factor += 0.06;
    motivo = 'Semana Santa';
  }
  return { factor: Math.round(factor * 100) / 100, motivo };
}

const gastoDelDia = (datos, mes) => datos.movimientos.filter((m) => !m.ingreso && m.fecha.startsWith(mes)).reduce((s, m) => s + m.centimos, 0);

// El gasto del día a día (sin fijos) que cabe esperar en un mes → { centimos, base, factor, motivo, meses, añoPasado } o null.
export function estimarDiaADia(datos, mes, hoy = fechaISO()) {
  const actual = mesDe(hoy);
  const fechas = datos.movimientos.filter((m) => !m.ingreso).map((m) => m.fecha);
  if (!fechas.length) return null;
  const primero = mesDe(fechas.reduce((a, b) => (a < b ? a : b)));
  // Los meses completos anteriores al actual, hasta 6, desde que hay datos.
  const meses = [];
  for (let m = sumarMeses(actual, -1); m >= primero && meses.length < 6; m = sumarMeses(m, -1)) meses.push(m);
  let base;
  if (meses.length) {
    // Más peso a los recientes; cada mes, sin su efecto de temporada.
    let suma = 0;
    let pesos = 0;
    meses.forEach((m, i) => {
      const peso = meses.length - i;
      suma += (gastoDelDia(datos, m) / factorEstacional(m).factor) * peso;
      pesos += peso;
    });
    base = suma / pesos;
  } else {
    // Primer mes: el ritmo de lo que va de mes (si ya hay una semana).
    const dia = Number(hoy.slice(8));
    if (dia < 7) return null;
    const [a, m] = actual.split('-').map(Number);
    base = ((gastoDelDia(datos, actual) / dia) * diasDelMes(a, m)) / factorEstacional(actual).factor;
  }
  const { factor, motivo } = factorEstacional(mes);
  let centimos = base * factor;
  const pasado = sumarMeses(mes, -12);
  const delAñoPasado = pasado >= primero && pasado < actual ? gastoDelDia(datos, pasado) : 0;
  if (delAñoPasado) centimos = 0.6 * centimos + 0.4 * delAñoPasado;
  return { centimos: Math.round(centimos), base: Math.round(base), factor, motivo, meses: meses.length, añoPasado: delAñoPasado || null };
}

// Un mes entero: lo real y, en el actual y los que vienen, lo estimado.
// → { mes, tipo: 'pasado' | 'actual' | 'futuro', gastos, ingresos, ahorro, fijos, diaADia, estimado, factor, motivo }
export function prevision(datos, mes, hoy = fechaISO()) {
  const actual = mesDe(hoy);
  const r = resumenMes(datos, mes, hoy);
  const tipo = mes < actual ? 'pasado' : mes === actual ? 'actual' : 'futuro';
  const puntuales = gastoDelDia(datos, mes);
  const est = tipo === 'pasado' ? null : estimarDiaADia(datos, mes, hoy);
  // Lo que falta por gastar en el día a día (lo ya apuntado cuenta).
  const resto = est ? Math.max(0, est.centimos - puntuales) : 0;
  const gastos = r.previsto + resto;
  return {
    mes,
    tipo,
    gastos,
    real: r.gastado,
    ingresos: r.ingresos,
    ahorro: r.ingresos - gastos,
    fijos: r.fijos,
    diaADia: puntuales + resto,
    estimado: resto,
    factor: est?.factor ?? factorEstacional(mes).factor,
    motivo: est?.motivo ?? '',
    añoPasado: est?.añoPasado ?? null,
    fiable: Boolean(est && est.meses >= 2),
  };
}

// Saldo de la cuenta al acabar cada mes, desde el saldo que apuntaste (o null).
export function saldoAlFinal(datos, mes, hoy = fechaISO()) {
  const s = datos.saldo;
  if (!s || mes < mesDe(s.fecha)) return null;
  const actual = mesDe(hoy);
  let saldo = s.centimos;
  for (let m = mesDe(s.fecha); m <= mes; m = sumarMeses(m, 1)) {
    const r = resumenMes(datos, m, hoy);
    // Solo lo que pasa después del día del saldo (lo anterior ya está dentro).
    for (const x of r.lista) if (x.fecha > s.fecha) saldo += x.ingreso ? x.centimos : -x.centimos;
    if (m >= actual) {
      const est = estimarDiaADia(datos, m, hoy);
      if (est) {
        // El día a día que falta: en el mes del saldo, solo la parte de los días que quedan.
        const yaApuntado = gastoDelDia(datos, m);
        let resto = Math.max(0, est.centimos - yaApuntado);
        if (m === mesDe(s.fecha)) {
          const [a, mm] = m.split('-').map(Number);
          const total = diasDelMes(a, mm);
          resto = Math.min(resto, Math.round((est.centimos * (total - Number(s.fecha.slice(8)))) / total));
        }
        saldo -= resto;
      }
    }
  }
  return saldo;
}

// Los meses de la gráfica: los 5 anteriores, este y los 3 siguientes.
export function serieBalance(datos, hoy = fechaISO(), { atras = 5, adelante = 3 } = {}) {
  const actual = mesDe(hoy);
  return Array.from({ length: atras + 1 + adelante }, (_, i) => sumarMeses(actual, i - atras)).map((m) => ({ ...prevision(datos, m, hoy), saldo: saldoAlFinal(datos, m, hoy) }));
}

// Los fijos que tocan en los próximos días (para Hoy y el chat).
export function proximosFijos(datos, hoy = fechaISO(), dias = 7) {
  const fin = sumarDias(hoy, dias);
  return datos.fijos
    .map((f) => ({ fijo: f, proxima: proximaFecha(f, hoy) }))
    .filter((x) => x.proxima && x.proxima.fecha <= fin)
    .sort((a, b) => a.proxima.fecha.localeCompare(b.proxima.fecha))
    .map(({ fijo, proxima }) => ({ id: fijo.id, concepto: fijo.concepto, categoria: fijo.categoria, ingreso: fijo.ingreso, fecha: proxima.fecha, centimos: proxima.centimos }));
}

// Para abrir en Excel o Numbers: separado por «;» y con coma decimal, como en España.
export function aCSV(datos, desde, hasta, hoy = fechaISO()) {
  const filas = [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Importe']];
  for (let mes = desde; mes <= hasta; mes = sumarMeses(mes, 1)) {
    const r = resumenMes(datos, mes, hoy);
    for (const x of [...r.lista].reverse()) {
      const tipo = `${x.ingreso ? 'Ingreso' : 'Gasto'}${x.tipo === 'fijo' ? ` fijo${x.pendiente ? (x.ingreso ? ' (por cobrar)' : ' (por pagar)') : ''}` : ''}`;
      // Gastos en negativo e ingresos en positivo: así la columna suma el ahorro.
      filas.push([x.fecha, x.concepto, categoria(x.categoria).nombre, tipo, `${x.ingreso ? '' : '-'}${(x.centimos / 100).toFixed(2).replace('.', ',')}`]);
    }
  }
  const celda = (v) => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  // La marca BOM hace que Excel lea bien las tildes.
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}

// Para el chat: lo esencial de un mes, en texto corto y números legibles.
export function resumenParaIA(datos, mes, hoy = fechaISO()) {
  const r = resumenMes(datos, mes, hoy);
  return {
    mes: nombreMes(mes),
    gastado: euros(r.gastado),
    fijos_por_pagar: euros(r.pendiente),
    previsto_del_mes: euros(r.previsto),
    presupuesto: r.presupuesto ? euros(r.presupuesto) : 'sin presupuesto',
    disponible: r.disponible === null ? undefined : euros(r.disponible),
    por_categoria: r.porCategoria.map((c) => `${c.nombre}: ${euros(c.centimos)} (${Math.round(c.parte * 100)} %)`),
    fijos_al_mes: euros(totalFijosAlMes(datos, hoy)),
    gastos_fijos: datos.fijos.filter((f) => !f.ingreso && fijoActivo(f, hoy)).map((f) => `${f.concepto}: ${euros(f.centimos)} · ${cuandoFijo(f).toLowerCase()}`),
    ingresos_del_mes: r.ingresos ? euros(r.ingresos) : 'ninguno apuntado',
    ingresos_fijos: datos.fijos.filter((f) => f.ingreso && fijoActivo(f, hoy)).map((f) => `${f.concepto}: ${euros(f.centimos)} · ${cuandoFijo(f).toLowerCase()}`),
    estimacion_fin_de_mes: mes >= mesDe(hoy) ? (() => {
      const p = prevision(datos, mes, hoy);
      return `gastos ~${aprox(p.gastos)}, ingresos ${euros(p.ingresos, { redondo: true })}, ahorro ~${aprox(p.ahorro)}`;
    })() : undefined,
    proximos_meses: [1, 2, 3].map((n) => {
      const p = prevision(datos, sumarMeses(mesDe(hoy), n), hoy);
      return `${nombreMes(p.mes)}: gastos ~${aprox(p.gastos)}${p.motivo ? ` (${p.motivo})` : ''}, ingresos ${euros(p.ingresos, { redondo: true })}, ahorro ~${aprox(p.ahorro)}`;
    }),
    saldo: datos.saldo ? `${euros(datos.saldo.centimos)} el ${datos.saldo.fecha}; a fin de este mes ~${aprox(saldoAlFinal(datos, mesDe(hoy), hoy))}` : 'no lo ha apuntado',
    ultimos: r.lista.filter((x) => x.tipo === 'puntual').slice(0, 15).map((x) => `${x.fecha} · ${x.ingreso ? 'ingreso' : 'gasto'} · ${x.concepto} · ${euros(x.centimos)} · ${categoria(x.categoria).nombre}`),
  };
}

// ---------- Guardado (web y Windows) y lo que usa el chat ----------
// leer/guardar: el documento entero, cifrado en cada plataforma.
export function crearAlmacenGastos({ leer, guardar, alCambiar = () => {} }) {
  const cargar = async () => normalizarGastos((await leer()) ?? {});
  const escribir = async (d) => {
    await guardar(normalizarGastos(d));
    alCambiar();
  };
  return {
    leer: cargar,
    guardar: escribir,
    // Desde el chat: { concepto, importe (euros), ingreso?, categoria?, fecha?, frecuencia?, dia? }.
    async apuntar(entrada, hoy = fechaISO()) {
      const datos = await cargar();
      const centimos = Math.round(Number(entrada.importe) * 100);
      const fecha = fechaValida(entrada.fecha) ? entrada.fecha : hoy;
      const base = { concepto: entrada.concepto, centimos, categoria: entrada.categoria, ingreso: entrada.ingreso === true };
      if (entrada.frecuencia && FRECUENCIA.has(entrada.frecuencia)) {
        const dia = entero(entrada.dia, 1, 31) ?? Number(fecha.slice(8));
        const r = anadirFijo(datos, { ...base, frecuencia: entrada.frecuencia, dia, mes: Number(fecha.slice(5, 7)), diaSemana: entero(entrada.dia_semana, 1, 7) ?? undefined, desde: `${mesDe(fecha)}-01` }, hoy);
        await escribir(r.datos);
        return { tipo: 'fijo', ingreso: r.fijo.ingreso, id: r.fijo.id, concepto: r.fijo.concepto, importe: euros(r.fijo.centimos), categoria: categoria(r.fijo.categoria).nombre, cuando: cuandoFijo(r.fijo), al_mes: euros(alMes(r.fijo)) };
      }
      const { datos: nuevos, resultado } = apuntarMovimiento(datos, { ...base, fecha }, hoy);
      await escribir(nuevos);
      if (resultado.tipo === 'fijo-ajustado') {
        return {
          ...resultado,
          importe: euros(resultado.centimos),
          nota: resultado.igual
            ? `Ya estaba contado: es «${resultado.concepto}» del ${resultado.fecha}. No lo sumo otra vez.`
            : `Es «${resultado.concepto}» del ${resultado.fecha}: lo dejo en ${euros(resultado.centimos)} ese mes (normalmente ${euros(resultado.antes)}), sin sumarlo otra vez.`,
        };
      }
      return { ...resultado, importe: euros(resultado.centimos), categoria: categoria(resultado.categoria).nombre };
    },
    // Lo que hay en la cuenta: ni suma ni resta, es el punto de partida.
    async saldo(entrada, hoy = fechaISO()) {
      const datos = await cargar();
      const centimos = Math.round(Number(entrada.importe) * 100);
      const fecha = fechaValida(entrada.fecha) ? entrada.fecha : hoy;
      await escribir(ponerSaldo(datos, centimos, fecha));
      const nuevos = await cargar();
      return { tipo: 'saldo', centimos, importe: euros(centimos), fecha, anterior: datos.saldo, fin_de_mes: aprox(saldoAlFinal(nuevos, mesDe(hoy), hoy) ?? centimos) };
    },
    // Deshacer lo que apuntó el chat (lo que devolvió apuntar o saldo).
    async deshacer(resultado, hoy = fechaISO()) {
      await escribir(deshacerApunte(await cargar(), resultado, hoy));
    },
    async quitar(id) {
      const datos = await cargar();
      await escribir(id.startsWith('f') ? borrarFijo(datos, id) : borrarMovimiento(datos, id));
    },
    async resumen(mes, hoy = fechaISO()) {
      return resumenParaIA(await cargar(), mesValido(mes) ? mes : mesDe(hoy), hoy);
    },
  };
}
