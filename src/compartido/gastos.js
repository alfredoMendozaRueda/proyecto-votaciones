// Gastos: los puntuales (un café, la compra, la gasolina) y los fijos que se
// repiten solos (alquiler, Netflix, el seguro del coche…). Todo en céntimos,
// para que las sumas cuadren siempre, y con fechas locales «AAAA-MM-DD».
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
const POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));
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

// ---------- Escribir un gasto en una línea ----------
// «12,50 súper», «súper 12,50», «ayer 30€ gasolina», «netflix 12,99 al mes»,
// «seguro coche 420 al año» → { centimos, concepto, categoria, fecha, fijo }.
const RE_IMPORTE = /(?:€\s*)?\d+(?:[.,]\d+)*(?:\s*(?:€|eur(?:os?)?\b))?/gi;
export function interpretarGasto(texto, hoy = fechaISO()) {
  let t = ` ${String(texto ?? '').trim()} `;
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
  let concepto = t.replace(/\s+/g, ' ').trim();
  concepto = concepto.replace(/^(?:(?:he|hemos)\s+)?(?:gastado|pagado|pagu[eé]|gast[eé]|comprado|compr[eé])\s+/i, '');
  // «en el bar» → «bar»; el artículo solo se quita detrás de una preposición («La compra» se queda).
  const conPreposicion = /^(?:de|en|del|por|para)\s+\S/i.test(concepto);
  concepto = concepto.replace(/^(?:de|en|del|por|para)\s+/i, '');
  if (conPreposicion) concepto = concepto.replace(/^(?:el|la|los|las|un|una)\s+(?=\S)/i, '');
  concepto = concepto.replace(/\s+(?:de|en|por)$/i, '').trim();
  concepto = concepto.charAt(0).toUpperCase() + concepto.slice(1);
  return {
    centimos: elegido?.centimos ?? null,
    concepto: concepto.slice(0, 80),
    categoria: concepto ? adivinarCategoria(concepto) : 'otros',
    fecha,
    fijo,
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
  const cat = POR_ID.has(m.categoria) ? m.categoria : null;
  const concepto = cadena(m.concepto, 80);
  return {
    id: typeof m.id === 'string' && /^g[0-9a-z]{4,30}$/.test(m.id) ? m.id : nuevoId('g'),
    fecha: m.fecha,
    centimos,
    concepto: concepto || categoria(cat ?? 'otros').nombre,
    categoria: cat ?? adivinarCategoria(concepto),
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
  const cat = POR_ID.has(f.categoria) ? f.categoria : null;
  const concepto = cadena(f.concepto, 80);
  const desde = fechaValida(f.desde) ? f.desde : `${mesDe(hoy)}-01`;
  return {
    id: typeof f.id === 'string' && /^f[0-9a-z]{4,30}$/.test(f.id) ? f.id : nuevoId('f'),
    concepto: concepto || categoria(cat ?? 'otros').nombre,
    centimos,
    categoria: cat ?? adivinarCategoria(concepto),
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
export const totalFijosAlMes = (datos, hoy = fechaISO()) => datos.fijos.filter((f) => fijoActivo(f, hoy)).reduce((s, f) => s + alMes(f), 0);

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
        cambiado: o.cambiado,
        pendiente: o.fecha > hoy,
      })),
  );
  const omitidos = datos.fijos.flatMap((f) => ocurrencias(f, mes).filter((o) => o.omitido).map((o) => ({ fijoId: f.id, fecha: o.fecha, concepto: f.concepto })));
  const lista = [...puntuales, ...fijos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0));
  const suma = (xs) => xs.reduce((s, x) => s + x.centimos, 0);
  const gastado = suma(lista.filter((x) => !x.pendiente));
  const pendiente = suma(lista.filter((x) => x.pendiente));
  const porCategoria = new Map();
  for (const x of lista) porCategoria.set(x.categoria, (porCategoria.get(x.categoria) ?? 0) + x.centimos);
  const previsto = gastado + pendiente;
  return {
    mes,
    lista,
    omitidos,
    gastado,
    pendiente,
    previsto,
    fijos: suma(fijos),
    puntuales: suma(puntuales),
    porCategoria: [...porCategoria]
      .map(([id, centimos]) => ({ id, nombre: categoria(id).nombre, color: categoria(id).color, centimos, parte: previsto ? centimos / previsto : 0 }))
      .sort((a, b) => b.centimos - a.centimos),
    presupuesto: datos.presupuesto,
    // Lo que aún se puede gastar este mes, contando los fijos que faltan.
    disponible: datos.presupuesto ? datos.presupuesto - previsto : null,
  };
}

// Los últimos n meses hasta «mes» (incluido) → [{ mes, total }].
export function historico(datos, mes, n = 6, hoy = fechaISO()) {
  return Array.from({ length: n }, (_, i) => sumarMeses(mes, i - n + 1)).map((m) => ({ mes: m, total: resumenMes(datos, m, hoy).previsto }));
}

// Los fijos que tocan en los próximos días (para Hoy y el chat).
export function proximosFijos(datos, hoy = fechaISO(), dias = 7) {
  const fin = sumarDias(hoy, dias);
  return datos.fijos
    .map((f) => ({ fijo: f, proxima: proximaFecha(f, hoy) }))
    .filter((x) => x.proxima && x.proxima.fecha <= fin)
    .sort((a, b) => a.proxima.fecha.localeCompare(b.proxima.fecha))
    .map(({ fijo, proxima }) => ({ id: fijo.id, concepto: fijo.concepto, categoria: fijo.categoria, fecha: proxima.fecha, centimos: proxima.centimos }));
}

// Para abrir en Excel o Numbers: separado por «;» y con coma decimal, como en España.
export function aCSV(datos, desde, hasta, hoy = fechaISO()) {
  const filas = [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Importe']];
  for (let mes = desde; mes <= hasta; mes = sumarMeses(mes, 1)) {
    const r = resumenMes(datos, mes, hoy);
    for (const x of [...r.lista].reverse()) {
      filas.push([x.fecha, x.concepto, categoria(x.categoria).nombre, x.tipo === 'fijo' ? (x.pendiente ? 'Fijo (por pagar)' : 'Fijo') : 'Puntual', (x.centimos / 100).toFixed(2).replace('.', ',')]);
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
    gastos_fijos: datos.fijos.filter((f) => fijoActivo(f, hoy)).map((f) => `${f.concepto}: ${euros(f.centimos)} · ${cuandoFijo(f).toLowerCase()}`),
    ultimos: r.lista.filter((x) => x.tipo === 'puntual').slice(0, 15).map((x) => `${x.fecha} · ${x.concepto} · ${euros(x.centimos)} · ${categoria(x.categoria).nombre}`),
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
    // Desde el chat: { concepto, importe (euros), categoria?, fecha?, frecuencia?, dia? }.
    async apuntar(entrada, hoy = fechaISO()) {
      const datos = await cargar();
      const centimos = Math.round(Number(entrada.importe) * 100);
      const fecha = fechaValida(entrada.fecha) ? entrada.fecha : hoy;
      const base = { concepto: entrada.concepto, centimos, categoria: entrada.categoria };
      if (entrada.frecuencia && FRECUENCIA.has(entrada.frecuencia)) {
        const dia = entero(entrada.dia, 1, 31) ?? Number(fecha.slice(8));
        const r = anadirFijo(datos, { ...base, frecuencia: entrada.frecuencia, dia, mes: Number(fecha.slice(5, 7)), diaSemana: entero(entrada.dia_semana, 1, 7) ?? undefined, desde: `${mesDe(fecha)}-01` }, hoy);
        await escribir(r.datos);
        return { tipo: 'fijo', id: r.fijo.id, concepto: r.fijo.concepto, importe: euros(r.fijo.centimos), categoria: categoria(r.fijo.categoria).nombre, cuando: cuandoFijo(r.fijo), al_mes: euros(alMes(r.fijo)) };
      }
      const r = anadirMovimiento(datos, { ...base, fecha });
      await escribir(r.datos);
      return { tipo: 'puntual', id: r.movimiento.id, concepto: r.movimiento.concepto, importe: euros(r.movimiento.centimos), categoria: categoria(r.movimiento.categoria).nombre, fecha };
    },
    // Deshacer lo que apuntó el chat.
    async quitar(id) {
      const datos = await cargar();
      await escribir(id.startsWith('f') ? borrarFijo(datos, id) : borrarMovimiento(datos, id));
    },
    async resumen(mes, hoy = fechaISO()) {
      return resumenParaIA(await cargar(), mesValido(mes) ? mes : mesDe(hoy), hoy);
    },
  };
}
