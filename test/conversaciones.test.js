import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Conversaciones, nuevoIdConversacion } from '../src/compartido/conversaciones.js';

function almacen() {
  const datos = new Map();
  let indice = [];
  const c = new Conversaciones({
    leerIndice: async () => indice,
    guardarIndice: async (l) => (indice = structuredClone(l)),
    leer: async (id) => structuredClone(datos.get(id) ?? null),
    guardar: async (id, d) => datos.set(id, structuredClone(d)),
    borrar: async (id) => datos.delete(id),
  });
  return { c, datos };
}

const turno = (pregunta, respuesta) => [
  { role: 'user', content: [{ type: 'text', text: '<contexto>Fecha y hora local del usuario: hoy.</contexto>' }, { type: 'text', text: pregunta }] },
  { role: 'assistant', content: [{ type: 'text', text: respuesta }] },
];

test('guarda con título, resumen y número de mensajes, y vuelve a cargar', async () => {
  const { c } = almacen();
  const id = nuevoIdConversacion();
  const entrada = await c.guardar(id, [...turno('¿Qué llevo a Valencia?', 'Una **chaqueta** ligera.'), ...turno('¿Y paraguas?', 'Sí, por si acaso.')]);
  assert.equal(entrada.titulo, '¿Qué llevo a Valencia?');
  assert.equal(entrada.resumen, 'Sí, por si acaso.');
  assert.equal(entrada.mensajes, 4);
  const datos = await c.cargar(id);
  assert.equal(datos.historial.length, 4);
  assert.equal(datos.visibles[1].texto, 'Una **chaqueta** ligera.');
});

test('las acciones con texto se titulan con la instrucción, no con el texto', async () => {
  const { c } = almacen();
  const e = await c.guardar(nuevoIdConversacion(), turno('Resume este texto en pocas líneas:\n\n<texto>\nmuy largo\n</texto>', 'Resumen.'));
  assert.equal(e.titulo, 'Resume este texto en pocas líneas: (texto)');
});

test('ordena por la más reciente, borra y vacía', async () => {
  const { c, datos } = almacen();
  const a = 'ca1';
  const b = 'cb2';
  await c.guardar(a, turno('Primera', 'Uno'));
  await new Promise((r) => setTimeout(r, 5));
  await c.guardar(b, turno('Segunda', 'Dos'));
  assert.deepEqual((await c.listar()).map((x) => x.id), [b, a]);
  assert.equal((await c.reciente()).id, b);
  await c.borrar(b);
  assert.deepEqual((await c.listar()).map((x) => x.id), [a]);
  assert.equal(datos.has(b), false);
  await c.borrarTodo();
  assert.equal((await c.listar()).length, 0);
  assert.equal(datos.size, 0);
});

test('no carga historiales rotos ni ids no válidos', async () => {
  const { c, datos } = almacen();
  datos.set('crota', { historial: [{ role: 'assistant', content: [] }] });
  assert.equal(await c.cargar('crota'), null);
  assert.equal(await c.cargar('../../secretos'), null);
  await assert.rejects(c.guardar('x', turno('a', 'b')), /no válido/);
});
