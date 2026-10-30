// Google Calendar (calendario principal), igual en Electron y en la web. Como
// ClienteGmail, quien lo crea decide cómo se consigue el token.

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const PERMISO_CALENDARIO = 'https://www.googleapis.com/auth/calendar.events';
const ID_VALIDO = /^[0-9a-zA-Z_-]+$/;
const DIA = 24 * 60 * 60 * 1000;

const dos = (n) => String(n).padStart(2, '0');
const fechaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};
// "2026-11-14" es un día en la zona del usuario, no medianoche UTC.
const inicioDelDia = (texto) => {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d).getTime();
};

function convertir(evento) {
  const todoElDia = Boolean(evento.start?.date);
  return {
    id: evento.id,
    titulo: evento.summary || '(Sin título)',
    inicio: todoElDia ? inicioDelDia(evento.start.date) : Date.parse(evento.start?.dateTime),
    fin: todoElDia ? inicioDelDia(evento.end.date) : Date.parse(evento.end?.dateTime),
    todoElDia,
    lugar: evento.location || '',
    enlace: evento.htmlLink || '',
  };
}

export class ClienteCalendario {
  constructor({ token, invalidar }) {
    this.token = token;
    this.invalidar = invalidar;
    this.avisados = new Set();
  }

  async api(consulta = '', opciones = {}, reintento = true) {
    const respuesta = await fetch(`${API}${consulta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (respuesta.status === 401 && reintento) {
      this.invalidar();
      return this.api(consulta, opciones, false);
    }
    const datos = respuesta.status === 204 ? {} : await respuesta.json().catch(() => ({}));
    if (respuesta.status === 403) {
      throw new Error('Kitsune no tiene permiso para usar tu calendario. Vuelve a conectar la cuenta de Google en Ajustes.');
    }
    if (!respuesta.ok) throw new Error(datos.error?.message || `Google Calendar respondió ${respuesta.status}.`);
    return datos;
  }

  async eventos({ desde = Date.now(), hasta = Date.now() + 7 * DIA, maximo = 25 } = {}) {
    const parametros = new URLSearchParams({
      timeMin: new Date(desde).toISOString(),
      timeMax: new Date(hasta).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.min(Math.max(maximo, 1), 250)),
    });
    const datos = await this.api(`?${parametros}`);
    return (datos.items ?? []).filter((e) => e.status !== 'cancelled').map(convertir);
  }

  // inicio y fin en milisegundos. Si es de todo el día, se guarda como fechas.
  async crear({ titulo, inicio, fin, todoElDia = false, lugar = '', descripcion = '' }) {
    const cuerpo = {
      summary: titulo,
      ...(lugar ? { location: lugar } : {}),
      ...(descripcion ? { description: descripcion } : {}),
      start: todoElDia ? { date: fechaLocal(inicio) } : { dateTime: new Date(inicio).toISOString() },
      end: todoElDia ? { date: fechaLocal(Math.max(fin, inicio + DIA)) } : { dateTime: new Date(fin).toISOString() },
    };
    return convertir(await this.api('', { method: 'POST', body: JSON.stringify(cuerpo) }));
  }

  async borrar(id) {
    if (!ID_VALIDO.test(id)) throw new Error('Identificador de evento no válido.');
    await this.api(`/${id}`, { method: 'DELETE' });
    return { borrado: id };
  }

  // Citas que empiezan en los próximos minutos y aún no se han avisado.
  async proximas(minutos = 15) {
    const ahora = Date.now();
    const eventos = await this.eventos({ desde: ahora, hasta: ahora + minutos * 60 * 1000, maximo: 10 });
    const nuevas = eventos.filter((e) => !e.todoElDia && e.inicio >= ahora && !this.avisados.has(`${e.id}:${e.inicio}`));
    for (const e of nuevas) this.avisados.add(`${e.id}:${e.inicio}`);
    return nuevas;
  }
}
