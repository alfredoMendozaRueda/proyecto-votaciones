// Memoria personal: datos que el usuario quiere que Kitsune tenga presentes
// ("mi hermana se llama Ana", "soy vegetariano"). Compartida por Electron y
// la web; cada uno decide dónde se guarda (leer, guardar).

const MAX_DATO = 300;
const MAX_DATOS = 100;

const nuevoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export class Memoria {
  constructor({ leer, guardar }) {
    this.leer = leer;
    this.guardar = guardar;
  }

  async listar() {
    const datos = await this.leer();
    return Array.isArray(datos) ? datos.filter((d) => d && typeof d.id === 'string' && typeof d.texto === 'string') : [];
  }

  async recordar(texto) {
    const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DATO);
    if (!limpio) throw new Error('No hay nada que recordar.');
    const lista = await this.listar();
    const repetido = lista.find((d) => d.texto.toLowerCase() === limpio.toLowerCase());
    if (repetido) return repetido;
    if (lista.length >= MAX_DATOS) throw new Error('La memoria está llena: borra algún dato en Ajustes.');
    const dato = { id: nuevoId(), texto: limpio, creado: Date.now() };
    await this.guardar([...lista, dato]);
    return dato;
  }

  async olvidar(id) {
    const lista = await this.listar();
    const resto = lista.filter((d) => d.id !== id);
    if (resto.length === lista.length) throw new Error('No encuentro ese dato en la memoria.');
    await this.guardar(resto);
    return { olvidado: id };
  }

  async olvidarTodo() {
    await this.guardar([]);
  }
}
