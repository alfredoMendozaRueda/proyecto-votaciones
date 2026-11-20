// Horas en una zona concreta (con su horario de verano), sin librerías: las usan
// el servidor (que vive en UTC) y la app (lo que llega de Apple Salud).
const SEMANA = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function partesLocales(ms, zona) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
    dia: SEMANA[partes.weekday],
  };
}

// Milisegundos de «año-mes-día hora:min» en esa zona (con su horario de verano).
export function desdeLocal(fecha, hora, zona) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi] = (hora ?? '00:00').split(':').map(Number);
  const supuesto = Date.UTC(a, m - 1, d, h, mi);
  let ms = supuesto;
  for (let i = 0; i < 2; i++) {
    const p = partesLocales(ms, zona);
    const [pa, pm, pd] = p.fecha.split('-').map(Number);
    const visto = Date.UTC(pa, pm - 1, pd, Math.floor(p.minutos / 60), p.minutos % 60);
    ms += supuesto - visto;
  }
  return ms;
}
