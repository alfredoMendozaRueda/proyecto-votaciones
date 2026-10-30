// "hoy a las 18:00", "mañana a las 09:30" o "lun 3 nov, 18:00".
export function cuandoLegible(ms, ahora = new Date()) {
  const fecha = new Date(ms);
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(fecha) - dia(ahora)) / 86_400_000);
  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  const cuando = fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${cuando}, ${hora}`;
}
