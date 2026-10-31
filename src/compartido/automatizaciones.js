// Automatizaciones: «cuando pase X, haz Y». Las ejecuta el servidor de
// Kitsune (servidor/) aunque la app esté cerrada; la app y el chat solo las
// crean y las editan. Este módulo, compartido por los dos, define su forma,
// las valida y las describe en español.
//
//   cuando: { tipo: 'correo', de, asunto, contiene }  llega un correo que coincide
//           { tipo: 'cita', minutos, titulo }         falta poco para una cita
//           { tipo: 'horario', hora, dias }           a una hora, ciertos días
//   hacer:  { notificar, texto, recordatorio, evento, leido, archivar, resumen }

export const MAX_AUTOMATIZACIONES = 40;
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const texto = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');
const entero = (valor, min, max, defecto) => (Number.isInteger(valor) ? Math.min(max, Math.max(min, valor)) : defecto);

export const nuevoIdAutomatizacion = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Devuelve la automatización limpia o lanza un error que se puede enseñar al usuario.
export function normalizarAutomatizacion(entrada, id = entrada?.id) {
  if (!entrada || typeof entrada !== 'object') throw new Error('Automatización no válida.');
  const c = entrada.cuando ?? {};
  let cuando;
  if (c.tipo === 'correo') {
    cuando = { tipo: 'correo', de: texto(c.de, 200), asunto: texto(c.asunto, 200), contiene: texto(c.contiene, 200) };
    if (!cuando.de && !cuando.asunto && !cuando.contiene) {
      throw new Error('Di qué correos: de quién, qué asunto o qué palabras deben llevar.');
    }
  } else if (c.tipo === 'cita') {
    cuando = { tipo: 'cita', minutos: entero(c.minutos, 1, 1440, 30), titulo: texto(c.titulo, 200) };
  } else if (c.tipo === 'horario') {
    const dias = Array.isArray(c.dias) ? [...new Set(c.dias.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : [];
    if (!HORA.test(c.hora ?? '')) throw new Error('La hora debe ser como 08:30.');
    cuando = { tipo: 'horario', hora: c.hora, dias: dias.length ? dias : [1, 2, 3, 4, 5, 6, 7] };
  } else {
    throw new Error('Elige cuándo se activa: al llegar un correo, antes de una cita o a una hora.');
  }

  const h = entrada.hacer ?? {};
  const deCorreo = cuando.tipo === 'correo';
  const hacer = {
    notificar: h.notificar !== false,
    texto: texto(h.texto, 200),
    // Recordatorio N minutos después (correo) o el texto a la hora (horario).
    recordatorio: Number.isInteger(h.recordatorio) && h.recordatorio > 0 ? Math.min(h.recordatorio, 60 * 24 * 30) : 0,
    evento: deCorreo && h.evento === true,
    leido: deCorreo && h.leido === true,
    archivar: deCorreo && h.archivar === true,
    resumen: cuando.tipo === 'horario' && h.resumen === true,
  };
  if (!hacer.notificar && !hacer.recordatorio && !hacer.evento && !hacer.leido && !hacer.archivar && !hacer.resumen) {
    throw new Error('Elige al menos una cosa que hacer.');
  }
  return {
    id: typeof id === 'string' && /^a[0-9a-z]{4,20}$/.test(id) ? id : nuevoIdAutomatizacion(),
    nombre: texto(entrada.nombre, 80) || describirCuando(cuando),
    activa: entrada.activa !== false,
    cuando,
    hacer,
  };
}

// Sin mayúsculas ni tildes, para comparar como lo haría una persona.
export const plano = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// "factura, recibo | pago" → cualquiera de ellas.
const alguna = (patron, donde) =>
  plano(patron)
    .split(/[,|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => plano(donde).includes(p));

// correo: { de: { nombre, email }, asunto, extracto }
export function coincideCorreo(automatizacion, correo) {
  const c = automatizacion.cuando;
  if (c.tipo !== 'correo') return false;
  if (c.de && !alguna(c.de, `${correo.de?.nombre ?? ''} ${correo.de?.email ?? ''}`)) return false;
  if (c.asunto && !alguna(c.asunto, correo.asunto)) return false;
  if (c.contiene && !alguna(c.contiene, `${correo.asunto ?? ''} ${correo.extracto ?? ''}`)) return false;
  return true;
}

export function coincideCita(automatizacion, evento) {
  const c = automatizacion.cuando;
  return c.tipo === 'cita' && (!c.titulo || alguna(c.titulo, evento.titulo));
}

function listaDias(dias) {
  if (dias.length === 7) return 'todos los días';
  if (dias.join() === '1,2,3,4,5') return 'de lunes a viernes';
  if (dias.join() === '6,7') return 'los fines de semana';
  return `los ${dias.map((d) => DIAS[d - 1]).join(', ')}`;
}

export function describirCuando(c) {
  if (c.tipo === 'correo') {
    const partes = [c.de && `de «${c.de}»`, c.asunto && `con «${c.asunto}» en el asunto`, c.contiene && `que hable de «${c.contiene}»`];
    return `Correo ${partes.filter(Boolean).join(' ')}`;
  }
  if (c.tipo === 'cita') return `${c.minutos} min antes de ${c.titulo ? `«${c.titulo}»` : 'cada cita'}`;
  return `A las ${c.hora}, ${listaDias(c.dias)}`;
}

export function describirHacer(h, tipo) {
  const partes = [];
  if (h.resumen) partes.push('enviarte el resumen del día');
  if (h.notificar) partes.push(h.texto ? `avisarte: «${h.texto}»` : 'avisarte');
  if (h.evento) partes.push('añadir el evento a tu agenda');
  if (h.recordatorio) partes.push(tipo === 'correo' ? `recordártelo en ${duracion(h.recordatorio)}` : 'apuntarte un recordatorio');
  if (h.leido) partes.push('marcarlo como leído');
  if (h.archivar) partes.push('archivarlo');
  return partes.join(', ');
}

export function duracion(minutos) {
  if (minutos % 1440 === 0) return minutos === 1440 ? '1 día' : `${minutos / 1440} días`;
  if (minutos % 60 === 0) return minutos === 60 ? '1 hora' : `${minutos / 60} horas`;
  return `${minutos} min`;
}

// Puntos de partida para crear una sin pensar demasiado.
export const PLANTILLAS = [
  {
    id: 'reservas',
    titulo: 'Reservas a la agenda',
    detalle: 'Billetes, vuelos, citas y reservas que lleguen por correo pasan solos a tu calendario.',
    automatizacion: {
      nombre: 'Reservas a la agenda',
      cuando: { tipo: 'correo', asunto: 'reserva, confirmación, billete, vuelo, cita, entradas' },
      hacer: { notificar: true, evento: true },
    },
  },
  {
    id: 'resumen',
    titulo: 'Resumen de la mañana',
    detalle: 'A las 8:00 de lunes a viernes: tus citas de hoy, correos sin leer y recordatorios.',
    automatizacion: { nombre: 'Resumen de la mañana', cuando: { tipo: 'horario', hora: '08:00', dias: [1, 2, 3, 4, 5] }, hacer: { notificar: false, resumen: true } },
  },
  {
    id: 'facturas',
    titulo: 'Facturas pendientes',
    detalle: 'Cuando llegue una factura, te la recuerda al día siguiente para pagarla.',
    automatizacion: {
      nombre: 'Facturas pendientes',
      cuando: { tipo: 'correo', asunto: 'factura, recibo, pago pendiente' },
      hacer: { notificar: true, texto: 'Ha llegado una factura', recordatorio: 1440 },
    },
  },
  {
    id: 'cita30',
    titulo: 'Media hora antes de cada cita',
    detalle: 'Un aviso con tiempo para salir.',
    automatizacion: { nombre: 'Media hora antes', cuando: { tipo: 'cita', minutos: 30 }, hacer: { notificar: true } },
  },
  {
    id: 'boletines',
    titulo: 'Boletines fuera de la bandeja',
    detalle: 'Los boletines y promociones se archivan solos, sin avisarte.',
    automatizacion: {
      nombre: 'Boletines archivados',
      cuando: { tipo: 'correo', contiene: 'newsletter, boletín, darse de baja, unsubscribe' },
      hacer: { notificar: false, leido: true, archivar: true },
    },
  },
];
