import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude } from '../src/compartido/claude.js';
import { Memoria } from '../src/compartido/memoria.js';
import { ClienteCalendario } from '../src/compartido/calendario.js';

// API de Claude simulada: cada petición recibe la siguiente respuesta (eventos SSE).
function apiSimulada(respuestas) {
  const peticiones = [];
  const fetch = async (url, init) => {
    if (init?.method === 'GET') return new Response('{}', { headers: { 'content-type': 'application/json' } });
    peticiones.push(JSON.parse(init.body));
    const eventos = respuestas[peticiones.length - 1];
    const cuerpo = eventos.map(([tipo, datos]) => `event: ${tipo}\ndata: ${JSON.stringify({ type: tipo, ...datos })}\n\n`).join('');
    return new Response(cuerpo, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, peticiones };
}

const inicio = (id) => ['message_start', { message: { id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 5, output_tokens: 1 } } }];
const fin = (motivo) => [['message_delta', { delta: { stop_reason: motivo }, usage: { output_tokens: 5 } }], ['message_stop', {}]];
const texto = (i, t, citas = []) => [
  ['content_block_start', { index: i, content_block: { type: 'text', text: '', ...(citas.length ? { citations: [] } : {}) } }],
  ['content_block_delta', { index: i, delta: { type: 'text_delta', text: t } }],
  ...citas.map((c) => ['content_block_delta', { index: i, delta: { type: 'citations_delta', citation: c } }]),
  ['content_block_stop', { index: i }],
];
const herramienta = (i, id, nombre, entrada) => [
  ['content_block_start', { index: i, content_block: { type: 'tool_use', id, name: nombre, input: {} } }],
  ['content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(entrada) } }],
  ['content_block_stop', { index: i }],
];

function conversacion(fetch, extra = {}) {
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async () => 'sk-ant-prueba',
    obtenerAjustes: () => ({ modelo: 'claude-opus-5-5', busquedaWeb: true, usarMemoria: true, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: { fetch, maxRetries: 0 },
    ...extra,
  });
  return { c, eventos };
}

test('búsqueda web: reanuda tras pause_turn, une el turno y emite las fuentes', async () => {
  const cita = { type: 'web_search_result_location', url: 'https://www.aemet.es/x', title: 'AEMET', cited_text: 'sol', encrypted_index: 'e' };
  const { fetch, peticiones } = apiSimulada([
    [inicio('m1'), ['content_block_start', { index: 0, content_block: { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: {} } }],
      ['content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"tiempo Madrid"}' } }],
      ['content_block_stop', { index: 0 }], ...fin('pause_turn')],
    [inicio('m2'), ...texto(0, 'Mañana, sol.', [cita]), ...fin('end_turn')],
  ]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('¿Qué tiempo hará?');
  assert.equal(peticiones.length, 2);
  const busqueda = peticiones[0].tools.find((t) => t.name === 'web_search');
  assert.equal(busqueda.type, 'web_search_20260209');
  // La segunda petición termina en el turno del asistente pausado, sin "continúa".
  assert.equal(peticiones[1].messages.at(-1).role, 'assistant');
  assert.equal(c.historial.length, 2);
  assert.deepEqual(c.historial[1].content.map((b) => b.type), ['server_tool_use', 'text']);
  assert.ok(eventos.some((e) => e.tipo === 'herramienta' && e.nombre === 'web_search'));
  assert.deepEqual(eventos.find((e) => e.tipo === 'fuentes').fuentes, [{ url: 'https://www.aemet.es/x', titulo: 'AEMET' }]);
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('calendario: crear un evento espera la confirmación del usuario', async () => {
  for (const acepta of [true, false]) {
    const creados = [];
    const { fetch, peticiones } = apiSimulada([
      [inicio('m1'), ...herramienta(0, 'tu1', 'crear_evento', { titulo: 'Tren a Valencia', inicio: '2026-11-14T08:35:00+01:00', fin: '2026-11-14T10:21:00+01:00' }), ...fin('tool_use')],
      [inicio('m2'), ...texto(0, 'Hecho.'), ...fin('end_turn')],
    ]);
    const { c, eventos } = conversacion(fetch, {
      calendario: { estado: async () => ({ conectado: true }), eventos: async () => [], crear: async (e) => (creados.push(e), { id: 'ev1', ...e }) },
    });
    const turno = c.enviar('Añade el tren a mi calendario');
    while (!eventos.some((e) => e.tipo === 'confirmar')) await new Promise((r) => setTimeout(r, 5));
    const pregunta = eventos.find((e) => e.tipo === 'confirmar');
    assert.equal(pregunta.accion.titulo, 'Tren a Valencia');
    assert.equal(pregunta.accion.inicio, Date.parse('2026-11-14T08:35:00+01:00'));
    c.responderConfirmacion(pregunta.id, acepta);
    await turno;
    assert.equal(creados.length, acepta ? 1 : 0);
    const resultado = JSON.parse(peticiones[1].messages.at(-1).content[0].content);
    assert.equal(resultado.creado, acepta);
  }
});

test('cancelar mientras espera la confirmación no crea el evento', async () => {
  const creados = [];
  const { fetch } = apiSimulada([[inicio('m1'), ...herramienta(0, 'tu1', 'crear_evento', { titulo: 'X', inicio: '2026-11-14' }), ...fin('tool_use')]]);
  const { c, eventos } = conversacion(fetch, {
    calendario: { estado: async () => ({ conectado: true }), eventos: async () => [], crear: async (e) => creados.push(e) },
  });
  const turno = c.enviar('Añade X');
  while (!eventos.some((e) => e.tipo === 'confirmar')) await new Promise((r) => setTimeout(r, 5));
  c.cancelar();
  await turno;
  assert.equal(creados.length, 0);
  assert.equal(c.historial.length, 0);
});

test('memoria: la conoce en el sistema y guarda datos nuevos con recordar', async () => {
  let datos = [{ id: 'm1', texto: 'Su hermana se llama Ana', creado: 1 }];
  const memoria = new Memoria({ leer: async () => datos, guardar: async (l) => (datos = l) });
  const { fetch, peticiones } = apiSimulada([
    [inicio('m1'), ...herramienta(0, 'tu1', 'recordar', { dato: 'Es vegetariano' }), ...fin('tool_use')],
    [inicio('m2'), ...texto(0, 'Apuntado.'), ...fin('end_turn')],
  ]);
  const { c, eventos } = conversacion(fetch, { memoria });
  await c.enviar('Recuerda que soy vegetariano');
  assert.match(peticiones[0].system, /\[m1\] Su hermana se llama Ana/);
  assert.ok(peticiones[0].tools.some((t) => t.name === 'recordar'));
  assert.deepEqual(datos.map((d) => d.texto), ['Su hermana se llama Ana', 'Es vegetariano']);
  assert.equal(eventos.find((e) => e.tipo === 'memoria').dato.texto, 'Es vegetariano');
});

test('memoria: no repite datos, olvida y se vacía', async () => {
  let datos = [];
  const m = new Memoria({ leer: async () => datos, guardar: async (l) => (datos = l) });
  const a = await m.recordar('  Le gusta   el café  ');
  assert.equal(a.texto, 'Le gusta el café');
  assert.equal((await m.recordar('le gusta el café')).id, a.id);
  await assert.rejects(m.recordar(''), /nada que recordar/);
  await m.olvidar(a.id);
  assert.equal(datos.length, 0);
  await assert.rejects(m.olvidar('mx'), /No encuentro/);
});

test('calendario: convierte eventos, crea los de todo el día como fechas y avisa una vez', async () => {
  const llamadas = [];
  const ahora = Date.now();
  globalThis.fetch = async (url, init = {}) => {
    llamadas.push({ url: String(url), metodo: init.method ?? 'GET', cuerpo: init.body && JSON.parse(init.body) });
    if (init.method === 'POST') return Response.json({ id: 'n1', summary: 'Cumple', start: { date: '2026-11-15' }, end: { date: '2026-11-16' } });
    return Response.json({
      items: [
        { id: 'a', summary: 'Dentista', start: { dateTime: new Date(ahora + 10 * 60000).toISOString() }, end: { dateTime: new Date(ahora + 70 * 60000).toISOString() } },
        { id: 'b', status: 'cancelled', start: { dateTime: new Date(ahora).toISOString() }, end: { dateTime: new Date(ahora).toISOString() } },
      ],
    });
  };
  const cal = new ClienteCalendario({ token: async () => 't', invalidar: () => {} });
  assert.deepEqual((await cal.proximas(15)).map((e) => e.titulo), ['Dentista']);
  assert.equal((await cal.proximas(15)).length, 0);
  const creado = await cal.crear({ titulo: 'Cumple', inicio: new Date(2026, 10, 15).getTime(), fin: new Date(2026, 10, 15).getTime(), todoElDia: true });
  assert.deepEqual(llamadas.at(-1).cuerpo.start, { date: '2026-11-15' });
  assert.deepEqual(llamadas.at(-1).cuerpo.end, { date: '2026-11-16' });
  assert.equal(creado.inicio, new Date(2026, 10, 15).getTime());
  assert.match(llamadas[0].url, /singleEvents=true/);
});
