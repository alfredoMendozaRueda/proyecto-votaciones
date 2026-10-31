import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude, gruposParaGroq } from '../src/compartido/claude.js';
import { Memoria } from '../src/compartido/memoria.js';
import { mensajesOpenAI, inicioReciente, segundosDeEspera } from '../src/compartido/groq.js';

// API de Groq simulada: respuestas en directo (SSE) en el formato de OpenAI.
function groqSimulado(respuestas) {
  const peticiones = [];
  const fetch = async (url, init = {}) => {
    peticiones.push({ url: String(url), metodo: init.method, cabeceras: init.headers, cuerpo: init.body && JSON.parse(init.body) });
    const r = respuestas[peticiones.length - 1];
    if (r.estado) return new Response(JSON.stringify({ error: { message: r.mensaje ?? 'Rate limit reached' } }), { status: r.estado });
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
  assert.ok(!nombres.includes('web_search'), 'la búsqueda de Anthropic no se envía a Groq');
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

const limiteMinuto = (s) =>
  `Rate limit reached for model \`openai/gpt-oss-120b\` on tokens per minute (TPM): Limit 8000, Used 7000, Requested 3000. Please try again in ${s}.`;
const limiteDia = (m) => `Rate limit reached for model \`${m}\` on tokens per day (TPD): Limit 200000, Used 199000. Please try again in 7m30s.`;
const hola = { trozos: [delta({ content: 'Hola.' }), delta({}, 'stop')] };

test('Groq: si el límite por minuto se libera en segundos, espera, avisa y repite solo', async () => {
  const { fetch, peticiones } = groqSimulado([{ estado: 429, mensaje: limiteMinuto('0.05s') }, hola]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('Hola');
  assert.equal(peticiones.length, 2);
  assert.deepEqual(eventos.find((e) => e.tipo === 'esperando'), { tipo: 'esperando', segundos: 1 });
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('Groq: con el cupo del día gastado prueba otro modelo, y si todos están gastados lo explica', async () => {
  const otro = groqSimulado([{ estado: 429, mensaje: limiteDia('openai/gpt-oss-120b') }, hola]);
  const a = conversacion(otro.fetch);
  await a.c.enviar('Hola');
  assert.deepEqual(otro.peticiones.map((p) => p.cuerpo.model), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  assert.equal(otro.peticiones[1].cuerpo.reasoning_effort, 'low');
  assert.equal(a.eventos.at(-1).tipo, 'fin');

  const gastado = groqSimulado([1, 2, 3].map(() => ({ estado: 429, mensaje: limiteDia('x') })));
  const b = conversacion(gastado.fetch);
  await b.c.enviar('Hola');
  assert.match(b.eventos.at(-1).mensaje, /uso gratuito de Groq de hoy/);
  assert.equal(b.c.historial.length, 0);
});

test('Groq: con un modelo lleno se prueba otro; si todos lo están y la espera es larga, se avisa', async () => {
  // Más de un minuto de espera con todos los modelos llenos: se avisa (las esperas más cortas se hacen solas).
  const { fetch, peticiones } = groqSimulado([1, 2, 3].map(() => ({ estado: 429, mensaje: limiteMinuto('2m') })));
  const { c, eventos } = conversacion(fetch);
  await c.enviar('Hola');
  assert.equal(peticiones.length, 3);
  assert.ok(!eventos.some((e) => e.tipo === 'esperando'));
  assert.match(eventos.at(-1).mensaje, /límite de uso gratuito por minuto/);
});

test('Groq: tiempos de espera del mensaje de error', () => {
  assert.equal(segundosDeEspera(null, 'Please try again in 11.25s.'), 11.25);
  assert.equal(segundosDeEspera(null, 'Please try again in 1m2.5s.'), 62.5);
  assert.equal(segundosDeEspera(null, 'Please try again in 7m30s.'), 450);
  assert.equal(segundosDeEspera(null, 'Please try again in 340ms.'), 0.34);
  assert.equal(segundosDeEspera('4', 'try again in 9s'), 4);
  assert.equal(segundosDeEspera(null, 'sin datos'), null);
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

test('Groq: busca en internet en una petición aparte y muestra las fuentes bajo la respuesta', async () => {
  const { fetch, peticiones } = groqSimulado([
    {
      trozos: [
        delta({ tool_calls: [{ index: 0, id: 'call_b', type: 'function', function: { name: 'buscar_en_internet', arguments: '{"consulta":"¿Quién ganó ayer?"}' } }] }),
        delta({}, 'tool_calls'),
      ],
    },
    {
      json: {
        choices: [
          {
            message: {
              content: 'Ganó el Albacete 2-1【1†L3-L5】. Fuentes: https://www.marca.com/futbol/albacete.html',
              executed_tools: [{ type: 'browser_search', search_results: { results: [{ url: 'https://as.com/partido', title: 'Crónica del partido' }] } }],
            },
          },
        ],
      },
    },
    { trozos: [delta({ content: 'Ganó el Albacete 2-1.' }), delta({}, 'stop')] },
  ]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('¿Quién ganó ayer?');

  const nombres = peticiones[0].cuerpo.tools.map((t) => t.function.name);
  // Con Groq solo va lo que encaja con la pregunta (para no gastar el límite por minuto).
  assert.ok(nombres.includes('buscar_en_internet'));
  assert.ok(!nombres.includes('recordar') && !nombres.includes('ver_tiempo'));
  const busqueda = peticiones[1].cuerpo;
  assert.equal(busqueda.model, 'openai/gpt-oss-20b');
  assert.deepEqual(busqueda.tools, [{ type: 'browser_search' }]);
  assert.equal(busqueda.messages.at(-1).content, '¿Quién ganó ayer?');
  const resultado = JSON.parse(peticiones[2].cuerpo.messages.at(-1).content);
  assert.ok(!resultado.resultado.includes('【'), 'sin marcas de cita');
  const fuentes = eventos.filter((e) => e.tipo === 'fuentes').flatMap((e) => e.fuentes);
  assert.deepEqual(fuentes, [
    { url: 'https://as.com/partido', titulo: 'Crónica del partido' },
    { url: 'https://www.marca.com/futbol/albacete.html', titulo: 'marca.com' },
  ]);
  assert.ok(eventos.findIndex((e) => e.tipo === 'fuentes') > eventos.findIndex((e) => e.tipo === 'texto'), 'las fuentes van tras el texto');
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('tiempo: Open-Meteo sin clave; con la búsqueda apagada no se ofrece buscar', async () => {
  const { fetch, peticiones } = groqSimulado([
    {
      trozos: [
        delta({ tool_calls: [{ index: 0, id: 'call_t', type: 'function', function: { name: 'ver_tiempo', arguments: '{"lugar":"Albacete, España","dias":2}' } }] }),
        delta({}, 'tool_calls'),
      ],
    },
    {
      json: {
        results: [
          { name: 'Albacete', admin1: 'Otro sitio', country: 'Estados Unidos', latitude: 1, longitude: 1 },
          { name: 'Albacete', admin1: 'Castilla-La Mancha', country: 'España', latitude: 38.99, longitude: -1.86 },
        ],
      },
    },
    {
      json: {
        current: { temperature_2m: 17.4, apparent_temperature: 16.2, relative_humidity_2m: 40, weather_code: 2, wind_speed_10m: 11.6 },
        daily: {
          time: ['2026-10-30', '2026-10-31'],
          weather_code: [2, 61],
          temperature_2m_max: [21.2, 18],
          temperature_2m_min: [7.6, 9.1],
          precipitation_probability_max: [5, 70],
        },
      },
    },
    { trozos: [delta({ content: 'Hoy 17 °C.' }), delta({}, 'stop')] },
  ]);
  const { c } = conversacion(fetch, {
    obtenerAjustes: () => ({ proveedor: 'groq', modeloGroq: 'openai/gpt-oss-120b', busquedaWeb: false, usarMemoria: false, personalidad: '' }),
  });
  await c.enviar('¿Qué tiempo hace en Albacete?');

  const nombres = peticiones[0].cuerpo.tools.map((t) => t.function.name);
  assert.ok(nombres.includes('ver_tiempo') && !nombres.includes('buscar_en_internet'));
  assert.match(peticiones[0].cuerpo.messages[0].content, /No puedes buscar en internet/);
  assert.match(peticiones[1].url, /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search\?name=Albacete&/);
  assert.match(peticiones[2].url, /latitude=38\.99&longitude=-1\.86/);
  assert.match(peticiones[2].url, /forecast_days=2/);
  const tiempo = JSON.parse(peticiones[3].cuerpo.messages.at(-1).content);
  assert.equal(tiempo.lugar, 'Albacete, Castilla-La Mancha, España');
  assert.deepEqual(tiempo.ahora, { temperatura: '17 °C', sensacion: '16 °C', estado: 'parcialmente nuboso', humedad: '40 %', viento: '12 km/h' });
  assert.equal(tiempo.dias[1].estado, 'lluvia débil');
  assert.equal(tiempo.dias[1].probabilidadLluvia, '70 %');
});

test('Groq: un modelo retirado no corta la respuesta: se pasa al siguiente', async () => {
  const retirado = (m) => ({ estado: 404, mensaje: `The model \`${m}\` does not exist or you do not have access to it.` });
  const { fetch, peticiones } = groqSimulado([
    { estado: 429, mensaje: limiteDia('openai/gpt-oss-120b') },
    retirado('openai/gpt-oss-20b'),
    hola,
  ]);
  const { c, eventos } = conversacion(fetch);
  await c.enviar('Hola');
  assert.deepEqual(peticiones.map((p) => p.cuerpo.model), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
  assert.equal(peticiones[2].cuerpo.reasoning_effort, 'none');
  assert.equal(eventos.at(-1).tipo, 'fin');

  const todos = groqSimulado([1, 2, 3].map(() => retirado('x')));
  const b = conversacion(todos.fetch);
  await b.c.enviar('Hola');
  assert.match(b.eventos.at(-1).mensaje, /ya no está disponible/);
  assert.ok(!b.eventos.at(-1).mensaje.includes('`'));
});

test('Groq: herramientas según lo que se pide (y lo anterior), para no pasar de 8.000 tokens por minuto', () => {
  const g = (t, antes = '', usadas = []) => [...gruposParaGroq([t, antes], usadas)].sort().join(',');
  assert.equal(g('Hola'), '');
  assert.equal(g('¡Gracias!'), '');
  assert.equal(g('qué tengo pendiente de la semana que viene'), 'agenda,recordatorios');
  assert.equal(g('¿Llueve mañana en Madrid?'), 'agenda,tiempo');
  assert.equal(g('Lee el último correo de Lucía'), 'correo');
  assert.equal(g('cada vez que llegue una factura avísame'), 'automatizaciones,correo,recordatorios');
  assert.equal(g('bórralo', 'recuérdame llamar a mamá'), 'recordatorios');
  assert.equal(g('sí, hazlo', '', ['crear_evento']), 'agenda');
  assert.equal(g('¿Cuál es la capital de Mongolia?'), 'consulta');
  assert.equal(g('dame mi pulso del día'), 'agenda,correo,pulso,recordatorios,web');
});
