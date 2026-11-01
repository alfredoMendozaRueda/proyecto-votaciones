import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversacionClaude } from '../src/compartido/claude.js';
import { rutaIA, conRespaldo, costeMensualAlerta, MAX_PREPARAR } from '../src/compartido/modos.js';
import { normalizarAjustes } from '../src/compartido/ajustes.js';

const dos = { groq: true, openai: true };

test('modos: qué IA hace cada cosa y cuál la sustituye', () => {
  assert.deepEqual(rutaIA('eficiente', 'chat', dos), ['openai', 'groq']);
  assert.deepEqual(rutaIA('eficiente', 'web', dos), ['groq', 'openai']);
  assert.deepEqual(rutaIA('eficiente', 'fondo', dos), ['groq', 'openai']);
  assert.deepEqual(rutaIA('eficiente', 'final', dos), ['openai', 'groq']);
  for (const tipo of ['chat', 'web', 'fondo', 'final']) {
    assert.deepEqual(rutaIA('ahorro', tipo, dos), ['groq', 'openai']);
    assert.deepEqual(rutaIA('calidad', tipo, dos), ['openai', 'groq']);
  }
  // Con una sola clave, todo por esa y sin respaldo.
  assert.deepEqual(rutaIA('calidad', 'web', { groq: true, openai: false }), ['groq', null]);
  assert.deepEqual(rutaIA('ahorro', 'chat', { groq: false, openai: true }), ['openai', null]);
  assert.deepEqual(rutaIA('ahorro', 'chat', { groq: false, openai: false }), [null, null]);
  // Modo desconocido: Eficiente.
  assert.deepEqual(rutaIA('turbo', 'chat', dos), ['openai', 'groq']);
  assert.equal(normalizarAjustes({}).modoIA, 'eficiente');
  assert.equal(normalizarAjustes({ modoIA: 'turbo' }).modoIA, 'eficiente');
});

test('modos: lo que cuestan las candidaturas de cada mañana', () => {
  const calidad = costeMensualAlerta({ modo: 'calidad', preparar: 2, investigar: true });
  const eficiente = costeMensualAlerta({ modo: 'eficiente', preparar: 2, investigar: true });
  assert.ok(Math.abs(calidad - 0.879) < 0.001, String(calidad));
  assert.ok(Math.abs(eficiente - 0.09) < 0.001, String(eficiente));
  assert.equal(costeMensualAlerta({ modo: 'ahorro', preparar: 10 }), 0);
  // En Eficiente, diez al día cuestan menos que dos en Calidad.
  assert.ok(costeMensualAlerta({ modo: 'eficiente', preparar: MAX_PREPARAR.eficiente }) < calidad);
});

test('modos: si la principal falla se usa la de respaldo; si fallan las dos, se cuenta el primer error', async () => {
  const usadas = [];
  const r = await conRespaldo(['groq', 'openai'], async (ia) => {
    usadas.push(ia);
    if (ia === 'groq') throw new Error('Groq al límite');
    return 'hecho';
  });
  assert.equal(r, 'hecho');
  assert.deepEqual(usadas, ['groq', 'openai']);
  await assert.rejects(
    conRespaldo(['openai', 'groq'], async (ia) => {
      throw new Error(`falla ${ia}`);
    }),
    /falla openai/,
  );
  // Cancelado por el usuario: no se prueba la otra.
  const parado = new AbortController();
  parado.abort();
  let veces = 0;
  await assert.rejects(conRespaldo(['groq', 'openai'], async () => (veces++, Promise.reject(new Error('x'))), { signal: parado.signal }));
  assert.equal(veces, 1);
});

// ---------- La conversación con las dos claves ----------

const sse = (trozos) =>
  new Response(trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });

function conversacion(modoIA, responder) {
  const peticiones = [];
  const fetch = async (url, init = {}) => {
    const p = { url: String(url), cuerpo: init.body && JSON.parse(init.body) };
    peticiones.push(p);
    return responder(p, peticiones.length);
  };
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async (p) => ({ openai: 'sk-prueba', groq: 'gsk_prueba' })[p] ?? null,
    obtenerAjustes: () => ({ proveedor: 'openai', modoIA, modeloOpenAI: 'gpt-6-luna', modeloGroq: 'openai/gpt-oss-120b', busquedaWeb: true, usarMemoria: false, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: { fetch },
  });
  return { c, eventos, peticiones };
}
const texto = (eventos) => eventos.filter((e) => e.tipo === 'texto').map((e) => e.delta).join('');

test('Eficiente: el chat va con GPT-6 Luna y la búsqueda en internet con Groq (gratis)', async () => {
  const { c, eventos, peticiones } = conversacion('eficiente', ({ url, cuerpo }) => {
    if (url.startsWith('https://api.groq.com/')) {
      assert.deepEqual(cuerpo.tools, [{ type: 'browser_search' }]);
      return Response.json({ choices: [{ message: { content: 'El Valencia ganó 2-1.' } }] });
    }
    const ultimo = cuerpo.messages.at(-1);
    if (ultimo.role === 'tool') return sse([delta({ content: 'Ganó 2-1.' }), delta({}, 'stop')]);
    return sse([
      delta({ tool_calls: [{ index: 0, id: 'call_b', type: 'function', function: { name: 'buscar_en_internet', arguments: '{"consulta":"resultado del Valencia"}' } }] }),
      delta({}, 'tool_calls'),
    ]);
  });
  await c.enviar('¿Cómo quedó el Valencia?');
  assert.deepEqual(
    peticiones.map((p) => new URL(p.url).hostname),
    ['api.openai.com', 'api.groq.com', 'api.openai.com'],
  );
  assert.equal(texto(eventos), 'Ganó 2-1.');
  assert.equal(eventos.at(-1).tipo, 'fin');
});

test('Ahorro: el chat va con Groq y, si Groq falla antes de escribir, contesta GPT-6 Luna', async () => {
  const { c, eventos, peticiones } = conversacion('ahorro', ({ url }) => {
    if (url.startsWith('https://api.groq.com/')) return Response.json({ error: { message: 'Groq está caído' } }, { status: 503 });
    return sse([delta({ content: 'Hola, aquí estoy.' }), delta({}, 'stop')]);
  });
  await c.enviar('Hola');
  assert.equal(new URL(peticiones[0].url).hostname, 'api.groq.com');
  assert.equal(new URL(peticiones.at(-1).url).hostname, 'api.openai.com');
  assert.equal(texto(eventos), 'Hola, aquí estoy.');
  assert.equal(eventos.at(-1).tipo, 'fin');
  assert.equal(c.mensajesVisibles().length, 2);
});

test('Eficiente: en Empleo, el borrador va con Groq y la revisión final con GPT-6 Luna', async () => {
  const { c, peticiones } = conversacion('eficiente', ({ url }) =>
    url.startsWith('https://api.groq.com/')
      ? Response.json({ choices: [{ message: { content: '{"borrador":true}' } }] })
      : Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"final":true}', annotations: [] }] }] }),
  );
  assert.equal((await c.tarea({ sistema: 'Redacta. Devuelve JSON.', usuario: 'x' })).texto, '{"borrador":true}');
  assert.equal((await c.tarea({ sistema: 'Revisa. Devuelve JSON.', usuario: 'x', nivel: 'final' })).texto, '{"final":true}');
  assert.deepEqual(
    peticiones.map((p) => new URL(p.url).hostname),
    ['api.groq.com', 'api.openai.com'],
  );
});
