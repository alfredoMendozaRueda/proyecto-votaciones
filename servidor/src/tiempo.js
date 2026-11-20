// Horas en la zona del usuario: el Worker vive en UTC.
export { partesLocales, desdeLocal } from '../../src/compartido/horas.js';

export const horaLocal = (ms, zona) =>
  new Date(ms).toLocaleTimeString('es-ES', { timeZone: zona, hour: '2-digit', minute: '2-digit' });

export const fechaLegible = (ms, zona) =>
  new Date(ms).toLocaleString('es-ES', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function enSilencio(minutos, silencio) {
  if (!silencio?.activo) return false;
  const a = aMinutos(silencio.desde);
  const b = aMinutos(silencio.hasta);
  return a <= b ? minutos >= a && minutos < b : minutos >= a || minutos < b;
}

export const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
