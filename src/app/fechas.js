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

const inicioDelDia = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// "Hoy", "Mañana", "Ayer" o "Jueves 6 de noviembre".
export function nombreDelDia(ms, ahora = Date.now()) {
  const dias = Math.round((inicioDelDia(ms) - inicioDelDia(ahora)) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  const texto = new Date(ms).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto[0].toUpperCase() + texto.slice(1);
}

// "hace 5 min", "hace 3 h", "ayer", "el 2 de octubre".
export function haceCuanto(ms, ahora = Date.now()) {
  const minutos = Math.round((ahora - ms) / 60_000);
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  if (inicioDelDia(ms) === inicioDelDia(ahora)) return `hace ${Math.round(minutos / 60)} h`;
  if (inicioDelDia(ahora) - inicioDelDia(ms) === 86_400_000) return 'ayer';
  return `el ${new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
}
