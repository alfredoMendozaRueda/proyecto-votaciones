import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude } from '../src/compartido/claude.js';

const conversacion = () =>
  new ConversacionClaude({ obtenerClave: async () => null, obtenerAjustes: () => ({}), gmail: {}, emitir: () => {} });

const HISTORIAL = [
  { role: 'user', content: [{ type: 'text', text: '<contexto>Fecha y hora local del usuario: hoy.</contexto>' }, { type: 'text', text: '¿Correos?' }] },
  { role: 'assistant', content: [{ type: 'text', text: 'Miro.' }, { type: 'tool_use', id: 't1', name: 'buscar_correos', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '[]' }] },
  { role: 'assistant', content: [{ type: 'text', text: 'No tienes ninguno.' }] },
];

test('restaura una conversación válida y muestra solo lo visible', () => {
  const c = conversacion();
  assert.equal(c.restaurar(structuredClone(HISTORIAL)), true);
  assert.deepEqual(c.mensajesVisibles(), [
    { rol: 'usuario', texto: '¿Correos?' },
    { rol: 'kitsune', texto: 'Miro.' },
    { rol: 'kitsune', texto: 'No tienes ninguno.' },
  ]);
});

test('rechaza historiales que la API no aceptaría', () => {
  const c = conversacion();
  assert.equal(c.restaurar(HISTORIAL.slice(0, 3)), false);
  assert.equal(c.restaurar([HISTORIAL[1], HISTORIAL[0]]), false);
  assert.equal(c.restaurar('nada'), false);
  assert.deepEqual(c.historial, []);
});

test('ajustes: los guardados antes de la revisión 2 pasan al estilo Ilustración y los permisos se validan', async () => {
  const { normalizarAjustes, aplicarCambios } = await import('../src/compartido/ajustes.js');
  assert.equal(normalizarAjustes({ estilo: 'realista', paleta: 'sombra' }).estilo, 'ilustracion');
  assert.equal(normalizarAjustes({ estilo: 'realista', paleta: 'sombra' }).paleta, 'sombra');
  assert.equal(normalizarAjustes({ estilo: 'anime', revision: 2 }).estilo, 'anime');
  const a = normalizarAjustes({});
  assert.equal(a.permisoEventoBorrar, 'preguntar');
  assert.equal(aplicarCambios(a, { permisoEventoBorrar: 'no' }).permisoEventoBorrar, 'no');
  assert.throws(() => aplicarCambios(a, { permisoCorreoEnviar: 'si' }));
  assert.throws(() => aplicarCambios(a, { permisoCorreoLeer: 'preguntar' }));
});
