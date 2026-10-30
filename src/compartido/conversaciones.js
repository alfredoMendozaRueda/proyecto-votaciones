import { mensajesVisibles, recortarHistorial, historialValido } from './historial.js';

// Historial de conversaciones guardadas, igual en Electron y en la web. Quien
// lo crea decide dónde se guarda: un índice (títulos y fechas) y cada
// conversación por separado, las dos cosas cifradas.

const MAX_CONVERSACIONES = 50;
export const ID_CONVERSACION = /^c[0-9a-z]+$/;
export const nuevoIdConversacion = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const recortar = (texto, max) => (texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto);

export class Conversaciones {
  constructor(almacen) {
    // { leerIndice, guardarIndice, leer(id), guardar(id, datos), borrar(id) }
    this.almacen = almacen;
  }

  async listar() {
    const indice = await this.almacen.leerIndice();
    return (Array.isArray(indice) ? indice : []).filter((c) => c && ID_CONVERSACION.test(c.id)).sort((a, b) => b.actualizada - a.actualizada);
  }

  // { historial, visibles } o null si no existe.
  async cargar(id) {
    if (!ID_CONVERSACION.test(id)) return null;
    const datos = await this.almacen.leer(id);
    return datos && historialValido(datos.historial) ? datos : null;
  }

  async guardar(id, historial) {
    if (!ID_CONVERSACION.test(id)) throw new Error('Identificador de conversación no válido.');
    if (!historial.length) return this.borrar(id);
    const recortado = recortarHistorial(historial);
    if (!historialValido(recortado)) return null;
    const visibles = mensajesVisibles(recortado);
    const primera = visibles.find((m) => m.rol === 'usuario')?.texto ?? 'Conversación';
    const ultima = [...visibles].reverse().find((m) => m.rol === 'kitsune')?.texto ?? '';
    await this.almacen.guardar(id, { historial: recortado, visibles });
    const lista = await this.listar();
    const anterior = lista.find((c) => c.id === id);
    const entrada = {
      id,
      titulo: recortar(primera.replace(/\s+/g, ' '), 70),
      resumen: recortar(ultima.replace(/[*_`>#]/g, '').replace(/\s+/g, ' '), 110),
      mensajes: visibles.length,
      creada: anterior?.creada ?? Date.now(),
      actualizada: Date.now(),
    };
    const nueva = [entrada, ...lista.filter((c) => c.id !== id)];
    // Las más antiguas salen del historial cuando hay demasiadas.
    for (const sobrante of nueva.splice(MAX_CONVERSACIONES)) await this.almacen.borrar(sobrante.id);
    await this.almacen.guardarIndice(nueva);
    return entrada;
  }

  async borrar(id) {
    const lista = await this.listar();
    await this.almacen.borrar(id);
    await this.almacen.guardarIndice(lista.filter((c) => c.id !== id));
    return { borrada: id };
  }

  async borrarTodo() {
    for (const c of await this.listar()) await this.almacen.borrar(c.id);
    await this.almacen.guardarIndice([]);
  }

  // La conversación más reciente si se usó hace poco: al abrir la app, se sigue con ella.
  async reciente(horas = 12) {
    const [ultima] = await this.listar();
    return ultima && Date.now() - ultima.actualizada < horas * 3_600_000 ? ultima : null;
  }
}
