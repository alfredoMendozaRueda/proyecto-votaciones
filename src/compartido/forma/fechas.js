// Fechas de Forma: días locales «AAAA-MM-DD», sin horas, para que un registro
// pertenezca siempre al día en que lo apuntaste en tu zona horaria.

const dos = (n) => String(n).padStart(2, '0');

export const fechaISO = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

// Una fecha real AAAA-MM-DD (el 30 de febrero no vale aunque Date lo pase a marzo).
export function esFecha(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = aDia(f);
  return !Number.isNaN(d.getTime()) && d.getDate() === Number(f.slice(8, 10)) && d.getMonth() + 1 === Number(f.slice(5, 7));
}

// Mediodía: así un cambio de hora nunca mueve la fecha.
export const aDia = (f) => new Date(`${f}T12:00:00`);

export function sumarDias(fecha, n) {
  const d = aDia(fecha);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

export const diasEntre = (desde, hasta) => Math.round((aDia(hasta) - aDia(desde)) / 86_400_000);

// Lunes de la semana de esa fecha (las semanas empiezan en lunes).
export function lunesDe(fecha) {
  const d = aDia(fecha).getDay();
  return sumarDias(fecha, -((d + 6) % 7));
}

export function edadEn(nacimiento, hoy = fechaISO()) {
  if (!esFecha(nacimiento)) return null;
  const [a, m, d] = nacimiento.split('-').map(Number);
  const [ah, mh, dh] = hoy.split('-').map(Number);
  return ah - a - (mh < m || (mh === m && dh < d) ? 1 : 0);
}

// Minutos desde medianoche de una hora «HH:MM» (o de una fecha).
export function minutosDe(hora) {
  if (hora instanceof Date) return hora.getHours() * 60 + hora.getMinutes();
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? ''));
  return m ? Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2])) : null;
}

export const horaDe = (minutos) => `${dos(Math.floor(minutos / 60) % 24)}:${dos(minutos % 60)}`;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreDia(fecha, hoy = fechaISO()) {
  const dif = diasEntre(hoy, fecha);
  if (dif === 0) return 'Hoy';
  if (dif === -1) return 'Ayer';
  if (dif === 1) return 'Mañana';
  const d = aDia(fecha);
  return `${DIAS[d.getDay()][0].toUpperCase()}${DIAS[d.getDay()].slice(1)} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function fechaCorta(fecha) {
  const d = aDia(fecha);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

export function fechaLarga(fecha) {
  const d = aDia(fecha);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
