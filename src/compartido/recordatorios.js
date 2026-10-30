// Recordatorios que Claude apunta ("recuérdame llamar a Lucía a las 18:00").
// Compartido por Electron y la web: cada uno decide dónde se guardan (leer,
// guardar) y cómo se avisa (avisar). Los vencidos mientras la app estaba
// cerrada se avisan al volver a abrirla.

const MAX_TEXTO = 200;
const MAX_PENDIENTES = 100;
const MAX_ADELANTO = 400 * 24 * 60 * 60 * 1000;
// setTimeout no admite esperas de más de ~24,8 días: se reprograma por tramos.
const MAX_ESPERA = 2 ** 31 - 1;
// Los avisados se conservan un día por si el usuario pregunta por ellos.
const CONSERVAR_AVISADOS = 24 * 60 * 60 * 1000;

const nuevoId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export class Recordatorios {
  constructor({ leer, guardar, avisar }) {
    this.leer = leer;
    this.guardar = guardar;
    this.avisar = avisar;
    this.temporizador = null;
  }

  async #lista() {
    const datos = await this.leer();
    return Array.isArray(datos) ? datos.filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.cuando)) : [];
  }

  async listar() {
    const lista = await this.#lista();
    return lista.filter((r) => !r.avisado).sort((a, b) => a.cuando - b.cuando);
  }

  async crear({ texto, cuando }) {
    const limpio = String(texto ?? '').trim().slice(0, MAX_TEXTO);
    const fecha = typeof cuando === 'number' ? cuando : Date.parse(cuando);
    if (!limpio) throw new Error('El recordatorio necesita un texto.');
    if (!Number.isFinite(fecha)) throw new Error('La fecha del recordatorio no es válida.');
    if (fecha < Date.now() - 60_000) throw new Error('Esa hora ya ha pasado.');
    if (fecha > Date.now() + MAX_ADELANTO) throw new Error('Solo puedo apuntar recordatorios para el próximo año.');
    const lista = await this.#lista();
    if (lista.filter((r) => !r.avisado).length >= MAX_PENDIENTES) throw new Error('Hay demasiados recordatorios pendientes.');
    const recordatorio = { id: nuevoId(), texto: limpio, cuando: fecha, avisado: false };
    lista.push(recordatorio);
    await this.guardar(lista);
    this.programar();
    return recordatorio;
  }

  async borrar(id) {
    const lista = await this.#lista();
    const resto = lista.filter((r) => r.id !== id);
    if (resto.length === lista.length) throw new Error('No encuentro ese recordatorio.');
    await this.guardar(resto);
    this.programar();
    return { borrado: id };
  }

  // Avisa de los vencidos y deja un único temporizador para el siguiente.
  async programar() {
    clearTimeout(this.temporizador);
    const ahora = Date.now();
    let lista = await this.#lista();
    const vencidos = lista.filter((r) => !r.avisado && r.cuando <= ahora);
    if (vencidos.length) {
      for (const r of vencidos) r.avisado = true;
      lista = lista.filter((r) => !r.avisado || ahora - r.cuando < CONSERVAR_AVISADOS);
      await this.guardar(lista);
      for (const r of vencidos) this.avisar(r);
    }
    const siguiente = lista.filter((r) => !r.avisado).sort((a, b) => a.cuando - b.cuando)[0];
    if (siguiente) {
      this.temporizador = setTimeout(() => this.programar(), Math.min(MAX_ESPERA, Math.max(0, siguiente.cuando - Date.now()) + 250));
    }
  }
}
