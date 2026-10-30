import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude } from '../src/compartido/claude.js';
import { Memoria } from '../src/compartido/memoria.js';
import { mensajesOpenAI, inicioReciente } from '../src/compartido/groq.js';

// API de Groq simulada: respuestas en directo (SSE) en el formato de OpenAI.
function groqSimulado(respuestas) {
  const peticiones = [];
  const fetch = async (url, init = {}) => {
    peticiones.push({ url: String(url), metodo: init.method, cabeceras: init.headers, cuerpo: init.body && JSON.parse(init.body) });
    const r = respuestas[peticiones.length - 1];
    if (r.estado) return new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: r.estado });
    if (r.json) return Response.json(r.json);
    const cuerpo = r.trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n';
    return new Response(cuerpo, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, peticiones };
}
const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });

function conversacion(fetch, extra = {}) {
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async (p) => (p === 'groq' ? 'gsk_prueba' : null),
    obtenerAjustes: () => ({ proveedor: 'groq', modeloGroq: 'openai/gpt-oss-120b', busquedaWeb: true, usarMemoria: true, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: { fetch },
    ...extra,
  });
  return { c, eventos };
}

test('Groq: herramienta en trozos, resultado y respuesta; el historial queda en formato Claude', async () => {
  let datos = [];
  const memoria = new Memoria({ leer: async () => datos, guardar: async (l) => (datos = l) });
  const { fetch, peticiones } = groqSimulado([
    {
      trozos: [
        delta({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'recordar', arguments: '{"da' } }] }),
        delta({ tool_calls: [{ index: 0, function: { arguments: 'to":"Es vegetariano"}' } }] }),
        delta({}, 'tool_calls'),
      ],
    },
    { trozos: [delta({ content: 'Apuntado, ' }), delta({ content: 'lo recordaré.' }), delta({}, 'stop')] },
  ]);
  const { c, eventos } = conversacion(fetch, { memoria });
  await c.enviar('Recuerda que soy vegetariano');

  const [primera, segunda] = peticiones;
  assert.equal(primera.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(primera.cabeceras.Authorization, 'Bearer gsk_prueba');
  assert.equal(primera.cuerpo.model, 'openai/gpt-oss-120b');
  assert.equal(primera.cuerpo.stream, true);
  const nombres = primera.cuerpo.tools.map((t) => t.function.name);
  assert.ok(nombres.includes('recordar'));
  assert.ok(!nombres.includes('web_search'), 'la búsqueda web es solo de Claude');
  assert.equal(primera.cuerpo.messages[0].role, 'system');
  assert.deepEqual(segunda.cuerpo.messages.slice(-2).map((m) => m.role), ['assistant', 'tool']);
  assert.equal(segunda.cuerpo.messages.at(-1).tool_call_id, 'call_1');

  assert.deepEqual(datos.map((d) => d.texto), ['Es vegetariano']);
  assert.deepEqual(c.historial.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(c.historial[1].content[0].type, 'tool_use');
  assert.equal(c.historial[2].content[0].type, 'tool_result');
  assert.equal(eventos.filter((e) => e.tipo === 'texto').map((e) => e.delta).join(''), 'Apuntado, lo recordaré.');
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('Groq: el límite gratuito alcanzado se explica y no deja el turno a medias', async () => {
  const { fetch } = groqSimulado([{ estado: 429 }]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('Hola');
  assert.match(eventos.at(-1).mensaje, /límite gratuito de Groq/);
  assert.equal(c.historial.length, 0);
});

test('Groq: la clave se comprueba pidiendo la lista de modelos', async () => {
  const { fetch, peticiones } = groqSimulado([{ json: { data: [] } }]);
  await ConversacionClaude.probarClave('gsk_x', 'x', { fetch }, 'groq');
  assert.equal(peticiones[0].url, 'https://api.groq.com/openai/v1/models');
  const malo = groqSimulado([{ estado: 401 }]);
  await assert.rejects(ConversacionClaude.probarClave('gsk_mal', 'x', { fetch: malo.fetch }, 'groq'), /no es válida/);
});

test('traducción: bloques propios de Claude fuera, herramientas y resultados emparejados', () => {
  const historial = [
    { role: 'user', content: [{ type: 'text', text: '<contexto>hoy</contexto>' }, { type: 'text', text: '¿Tiempo?' }] },
    { role: 'assistant', content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }, { type: 'text', text: 'Sol.' }] },
    { role: 'user', content: 'Busca mi correo' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'buscar_correos', input: { consulta: '' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'sin conexión' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'No pude.' }] },
  ];
  const m = mensajesOpenAI('Sistema', historial);
  assert.deepEqual(m.map((x) => x.role), ['system', 'user', 'assistant', 'user', 'assistant', 'tool', 'assistant']);
  assert.equal(m[1].content, '<contexto>hoy</contexto>\n¿Tiempo?');
  assert.equal(m[2].content, 'Sol.');
  assert.equal(m[4].tool_calls[0].function.arguments, '{"consulta":""}');
  assert.equal(m[5].content, 'Error: sin conexión');
});

test('recorte: con poco margen solo viaja el turno actual, empezando en una pregunta', () => {
  const largo = 'x'.repeat(3000);
  const historial = [];
  for (let i = 0; i < 6; i++) historial.push({ role: 'user', content: `${i} ${largo}` }, { role: 'assistant', content: [{ type: 'text', text: largo }] });
  historial.push({ role: 'user', content: 'actual' });
  const desde = inicioReciente(historial, historial.length - 1, 14_000);
  assert.ok(desde > 0 && desde < historial.length - 1);
  assert.equal(historial[desde].role, 'user');
  assert.equal(inicioReciente(historial, historial.length - 1, 10), historial.length - 1);
});
