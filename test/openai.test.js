import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude } from '../src/compartido/claude.js';
import { Memoria } from '../src/compartido/memoria.js';
import { tareaOpenAI } from '../src/compartido/openai.js';
import { normalizarAjustes, aplicarCambios } from '../src/compartido/ajustes.js';

// API de OpenAI simulada: Chat Completions en directo (SSE) y Responses en JSON.
function openaiSimulado(respuestas) {
  const peticiones = [];
  const fetch = async (url, init = {}) => {
    peticiones.push({ url: String(url), metodo: init.method, cabeceras: init.headers, cuerpo: init.body && JSON.parse(init.body) });
    const r = respuestas[peticiones.length - 1];
    if (r.estado) return new Response(JSON.stringify({ error: { message: r.mensaje ?? 'error', code: r.codigo ?? null } }), { status: r.estado });
    if (r.json) return Response.json(r.json);
    const cuerpo = r.trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n';
    return new Response(cuerpo, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, peticiones };
}
const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });
const salida = (texto, anotaciones = []) => ({
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'web_search_call', status: 'completed' },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: texto, annotations: anotaciones }] },
  ],
});

function conversacion(fetch, extra = {}) {
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async (p) => (p === 'openai' ? 'sk-prueba' : null),
    obtenerAjustes: () => ({ proveedor: 'openai', modeloOpenAI: 'gpt-6-luna', busquedaWeb: true, usarMemoria: true, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: { fetch },
    ...extra,
  });
  return { c, eventos };
}

test('OpenAI: GPT-6 Luna usa las herramientas de Kitsune en directo y sin razonamiento', async () => {
  let datos = [];
  const memoria = new Memoria({ leer: async () => datos, guardar: async (l) => (datos = l) });
  const { fetch, peticiones } = openaiSimulado([
    {
      trozos: [
        delta({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'recordar', arguments: '{"dato":' } }] }),
        delta({ tool_calls: [{ index: 0, function: { arguments: '"Mi hermana se llama Ana"}' } }] }),
        delta({}, 'tool_calls'),
      ],
    },
    { trozos: [delta({ content: 'Apuntado.' }), delta({}, 'stop')] },
  ]);
  const { c, eventos } = conversacion(fetch, { memoria });
  await c.enviar('Recuerda que mi hermana se llama Ana');

  const [primera, segunda] = peticiones;
  assert.equal(primera.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(primera.cabeceras.Authorization, 'Bearer sk-prueba');
  assert.equal(primera.cuerpo.model, 'gpt-6-luna');
  assert.equal(primera.cuerpo.reasoning_effort, 'none');
  assert.equal(primera.cuerpo.store, false);
  const nombres = primera.cuerpo.tools.map((t) => t.function.name);
  // Con OpenAI van todas las herramientas (no hay límite por minuto como en Groq) y la búsqueda es la de Kitsune.
  for (const n of ['recordar', 'olvidar', 'ver_tiempo', 'buscar_en_internet']) assert.ok(nombres.includes(n), n);
  assert.ok(!nombres.includes('web_search'));
  assert.equal(segunda.cuerpo.messages.at(-1).tool_call_id, 'call_1');
  assert.deepEqual(datos.map((d) => d.texto), ['Mi hermana se llama Ana']);
  assert.equal(eventos.filter((e) => e.tipo === 'texto').map((e) => e.delta).join(''), 'Apuntado.');
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('OpenAI: busca en internet con la API Responses y enseña las fuentes', async () => {
  const { fetch, peticiones } = openaiSimulado([
    {
      trozos: [
        delta({ tool_calls: [{ index: 0, id: 'call_b', type: 'function', function: { name: 'buscar_en_internet', arguments: '{"consulta":"resultado del Valencia"}' } }] }),
        delta({}, 'tool_calls'),
      ],
    },
    { json: salida('El Valencia ganó 2-1.', [{ type: 'url_citation', url: 'https://www.marca.com/futbol/valencia.html?utm_source=openai', title: 'Marca' }]) },
    { trozos: [delta({ content: 'Ganó el Valencia 2-1.' }), delta({}, 'stop')] },
  ]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('¿Cómo quedó el Valencia?');
  const busqueda = peticiones[1];
  assert.equal(busqueda.url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(busqueda.cuerpo.tools, [{ type: 'web_search' }]);
  assert.equal(busqueda.cuerpo.model, 'gpt-6-luna');
  assert.match(peticiones[2].cuerpo.messages.at(-1).content, /2-1/);
  const fuentes = eventos.filter((e) => e.tipo === 'fuentes').flatMap((e) => e.fuentes);
  assert.deepEqual(fuentes.map((f) => f.url), ['https://www.marca.com/futbol/valencia.html']);
});

test('OpenAI: las tareas de Empleo que piden JSON lo reciben garantizado; con web, buscan', async () => {
  const { fetch, peticiones } = openaiSimulado([
    { json: salida('{"evaluaciones":[]}') },
    { json: salida('Empresa de logística fundada en 2019.', [{ type: 'url_citation', url: 'https://brujula.es/', title: 'Brújula' }]) },
  ]);
  const a = await tareaOpenAI({ apiKey: 'sk-x', modelo: 'gpt-6-luna', sistema: 'Devuelve SOLO JSON: {"evaluaciones":[]}', usuario: 'ofertas', fetch });
  assert.equal(a.texto, '{"evaluaciones":[]}');
  assert.deepEqual(peticiones[0].cuerpo.text, { format: { type: 'json_object' } });
  assert.equal(peticiones[0].cuerpo.reasoning.effort, 'low');
  assert.equal(peticiones[0].cuerpo.instructions, 'Devuelve SOLO JSON: {"evaluaciones":[]}');
  // OpenAI rechaza json_object si la palabra «json» no está en la entrada (las instrucciones no cuentan).
  assert.match(peticiones[0].cuerpo.input, /json/i);
  assert.ok(peticiones[0].cuerpo.input.startsWith('ofertas'));
  const b = await tareaOpenAI({ apiKey: 'sk-x', modelo: 'gpt-6-luna', sistema: 'Investiga la empresa', usuario: 'Brújula Labs', web: true, fetch });
  assert.deepEqual(peticiones[1].cuerpo.tools, [{ type: 'web_search' }]);
  assert.equal(peticiones[1].cuerpo.text, undefined);
  assert.deepEqual(b.fuentes, [{ url: 'https://brujula.es/', titulo: 'Brújula' }]);
});

test('OpenAI: errores claros (clave, saldo) y reintento si es el límite por minuto', async () => {
  const sinSaldo = openaiSimulado([{ estado: 429, codigo: 'insufficient_quota', mensaje: 'You exceeded your current quota' }]);
  const a = conversacion(sinSaldo.fetch);
  await a.c.enviar('Hola');
  assert.match(a.eventos.at(-1).mensaje, /sin saldo en OpenAI/);
  assert.equal(sinSaldo.peticiones.length, 1, 'sin saldo no se repite');

  const limite = openaiSimulado([{ estado: 429, mensaje: 'Rate limit reached' }, { trozos: [delta({ content: 'Hola.' }), delta({}, 'stop')] }]);
  const b = conversacion(limite.fetch);
  await b.c.enviar('Hola');
  assert.equal(b.eventos.at(-1).tipo, 'fin');
  assert.equal(limite.peticiones.length, 2);

  const malo = openaiSimulado([{ estado: 401 }]);
  await assert.rejects(ConversacionClaude.probarClave('sk-mal', 'x', { fetch: malo.fetch }, 'openai'), /clave de OpenAI no es válida/);
  assert.equal(malo.peticiones[0].url, 'https://api.openai.com/v1/models');
});

test('OpenAI: proveedor y modelo válidos en los ajustes', () => {
  const a = aplicarCambios(normalizarAjustes({}), { proveedor: 'openai', modeloOpenAI: 'gpt-6.1-terra' });
  assert.equal(a.proveedor, 'openai');
  assert.equal(normalizarAjustes({}).modeloOpenAI, 'gpt-6-luna');
  assert.throws(() => aplicarCambios(a, { modeloOpenAI: 'gpt-3' }));
});

import { Consumo, coste, sumarUso, usoDeRespuesta } from '../src/compartido/consumo.js';

test('gasto: precios oficiales, caché más barata y búsquedas a 0,01 $', () => {
  // GPT-6 Luna: 1 M de entrada (la mitad en caché) y 100.000 de salida.
  const u = { entrada: 1_000_000, cache: 500_000, salida: 100_000, busquedas: 2 };
  assert.equal(Math.round(coste('gpt-6-luna', u) * 1e4) / 1e4, Math.round((0.05 + 0.005 + 0.05 + 0.02) * 1e4) / 1e4);
  assert.equal(coste('gpt-6.1-sol', { entrada: 1_000_000, cache: 0, salida: 0 }), 2);
  assert.deepEqual(usoDeRespuesta({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 4 }, output_tokens: 3 }, output: [{ type: 'web_search_call' }, { type: 'message' }] }), {
    entrada: 10,
    cache: 4,
    salida: 3,
    busquedas: 1,
  });
  let meses = {};
  for (let i = 0; i < 14; i++) meses = sumarUso(meses, 'gpt-6-luna', { entrada: 1, cache: 0, salida: 1 }, Date.UTC(2025, i, 15));
  assert.equal(Object.keys(meses).length, 12, 'solo se guardan los últimos 12 meses');
});

test('gasto: cada respuesta de OpenAI (chat, búsqueda y tareas) se apunta con sus tokens', async () => {
  const usos = [];
  const { fetch, peticiones } = openaiSimulado([
    {
      trozos: [
        delta({ content: 'Hola.' }),
        delta({}, 'stop'),
        { choices: [], usage: { prompt_tokens: 3000, prompt_tokens_details: { cached_tokens: 2048 }, completion_tokens: 12 } },
      ],
    },
    { json: { ...salida('{"a":1}'), usage: { input_tokens: 500, output_tokens: 80 } } },
  ]);
  const { c } = conversacion(fetch, { anotarUso: (modelo, uso) => usos.push({ modelo, ...uso }) });
  await c.enviar('Hola');
  assert.deepEqual(peticiones[0].cuerpo.stream_options, { include_usage: true });
  await c.tarea({ sistema: 'Devuelve SOLO JSON', usuario: 'x' });
  assert.deepEqual(usos, [
    { modelo: 'gpt-6-luna', entrada: 3000, cache: 2048, salida: 12, busquedas: 0 },
    { modelo: 'gpt-6-luna', entrada: 500, cache: 0, salida: 80, busquedas: 1 },
  ]);

  let guardado = null;
  const consumo = new Consumo({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)), nombre: 'iPhone' });
  await Promise.all(usos.map((u) => consumo.anotar(u.modelo, u)));
  guardado.otros = { gpc: { nombre: 'Windows (CASA)', meses: { [Object.keys(guardado.meses)[0]]: { usd: 0.5, peticiones: 3 } } } };
  const r = await consumo.resumen({ servidor: { [Object.keys(guardado.meses)[0]]: { usd: 0.25, peticiones: 1 } } });
  assert.equal(r.total.peticiones, 6);
  assert.ok(Math.abs(r.total.usd - (0.75 + coste('gpt-6-luna', usos[0]) + coste('gpt-6-luna', usos[1]))) < 1e-6);
  assert.deepEqual(r.dispositivos.map((d) => d.nombre), ['iPhone', 'Windows (CASA)', 'Servidor (alertas y automatizaciones)']);
});
