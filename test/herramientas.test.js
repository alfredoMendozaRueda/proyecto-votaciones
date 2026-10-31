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
    assert.match(pregunta.accion.detalle, /14 nov/);
    assert.equal(pregunta.accion.boton, 'Añadir');
    c.responderConfirmacion(pregunta.id, acepta);
    await turno;
    assert.equal(creados.length, acepta ? 1 : 0);
    assert.equal(creados[0]?.inicio, acepta ? Date.parse('2026-11-14T08:35:00+01:00') : undefined);
    const resultado = JSON.parse(peticiones[1].messages.at(-1).content[0].content);
    if (acepta) assert.equal(resultado.creado, true);
    else assert.equal(resultado.hecho, false);
    assert.equal(eventos.some((e) => e.tipo === 'confirmado' && e.id === pregunta.id && e.ok), acepta);
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

// Calendario simulado con un evento de 17:00 a 18:00 el 2 de noviembre.
function calendarioSimulado(registro) {
  const evento = { id: 'cumple1', titulo: 'Cumpleaños', inicio: new Date(2026, 10, 2, 17).getTime(), fin: new Date(2026, 10, 2, 18).getTime(), todoElDia: false, lugar: '' };
  return {
    estado: async () => ({ conectado: true }),
    eventos: async () => [evento],
    crear: async (e) => (registro.push(['crear', e]), { id: 'n1', ...e }),
    obtener: async () => evento,
    modificar: async (id, cambios) => (registro.push(['modificar', id, cambios]), { ...evento, ...cambios }),
    borrar: async (id) => (registro.push(['borrar', id]), { borrado: id }),
  };
}

function conPermisos(fetch, permisos, extra) {
  const eventos = [];
  const ajustes = { modelo: 'claude-opus-5-5', busquedaWeb: false, usarMemoria: false, personalidad: '', ...permisos };
  const c = new ConversacionClaude({
    obtenerClave: async () => 'sk-ant-prueba',
    obtenerAjustes: () => ajustes,
    gmail: { estado: async () => ({ conectado: false }) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: { fetch, maxRetries: 0 },
    ...extra,
  });
  return { c, eventos };
}

test('permisos: lo prohibido no se ofrece y el sistema lo explica; lo permitido se hace sin preguntar', async () => {
  const registro = [];
  const { fetch, peticiones } = apiSimulada([
    [inicio('m1'), ...herramienta(0, 'tu1', 'crear_evento', { titulo: 'Pádel', inicio: '2026-11-03T19:00:00+01:00' }), ...fin('tool_use')],
    [inicio('m2'), ...texto(0, 'Apuntado.'), ...fin('end_turn')],
  ]);
  const { c, eventos } = conPermisos(fetch, { permisoEventoCrear: 'si', permisoEventoBorrar: 'no' }, { calendario: calendarioSimulado(registro) });
  await c.enviar('Pádel el martes a las 7');
  const nombres = peticiones[0].tools.map((t) => t.name);
  assert.ok(nombres.includes('modificar_evento'));
  assert.ok(!nombres.includes('borrar_evento'));
  assert.match(peticiones[0].system, /No tienes permiso para: eliminar eventos/);
  assert.match(peticiones[0].system, /sin preguntar: consultar tu agenda; crear eventos/);
  assert.equal(eventos.some((e) => e.tipo === 'confirmar'), false);
  assert.equal(registro[0][0], 'crear');
});

test('calendario: eliminar y cambiar eventos piden confirmación y muestran el evento', async () => {
  const registro = [];
  const { fetch, peticiones } = apiSimulada([
    [inicio('m1'), ...herramienta(0, 'tu1', 'borrar_evento', { id: 'cumple1' }), ...herramienta(1, 'tu2', 'modificar_evento', { id: 'cumple1', inicio: '2026-11-02T19:00:00' }), ...fin('tool_use')],
    [inicio('m2'), ...texto(0, 'Hecho.'), ...fin('end_turn')],
  ]);
  const { c, eventos } = conPermisos(fetch, {}, { calendario: calendarioSimulado(registro) });
  const turno = c.enviar('Quita el cumpleaños');
  while (eventos.filter((e) => e.tipo === 'confirmar').length < 2) await new Promise((r) => setTimeout(r, 5));
  const [borrar, cambiar] = eventos.filter((e) => e.tipo === 'confirmar');
  assert.equal(borrar.accion.titulo, 'Cumpleaños');
  assert.equal(borrar.accion.peligro, true);
  assert.match(borrar.accion.detalle, /lunes, 2 nov/);
  assert.match(cambiar.accion.detalle, /Antes: lunes, 2 nov, 17:00–18:00/);
  assert.match(cambiar.accion.lineas[0], /Ahora: lunes, 2 nov, 19:00–20:00/);
  c.responderConfirmacion(borrar.id, true);
  c.responderConfirmacion(cambiar.id, false);
  await turno;
  assert.deepEqual(registro, [['borrar', 'cumple1']]);
  const resultados = peticiones[1].messages.at(-1).content.map((r) => JSON.parse(r.content));
  assert.equal(resultados[0].eliminado, true);
  assert.equal(resultados[1].hecho, false);
});

test('correo: el más reciente primero, fechas locales con el día, y enviar siempre se confirma', async () => {
  const enviados = [];
  const correo = (id, ms, asunto) => ({ id, fecha: ms, asunto, de: { nombre: 'X', email: 'x@y.es' }, extracto: '', noLeido: false });
  const gmail = {
    estado: async () => ({ conectado: true, email: 'yo@gmail.com' }),
    listar: async () => ({ mensajes: [correo('a', new Date(2026, 9, 30, 19, 44).getTime(), 'Google'), correo('b', new Date(2026, 9, 30, 23, 18).getTime(), 'Railway')] }),
    leer: async (id) => ({ ...correo(id, 0, 'Railway'), para: '', adjuntos: [], texto: '' }),
    enviar: async (d) => enviados.push(d),
  };
  const { fetch, peticiones } = apiSimulada([
    [inicio('m1'), ...herramienta(0, 'tu1', 'buscar_correos', { consulta: '' }), ...fin('tool_use')],
    [inicio('m2'), ...herramienta(0, 'tu2', 'enviar_correo', { para: 'x@y.es', cuerpo: 'Gracias', responder_a: 'b' }), ...fin('tool_use')],
    [inicio('m3'), ...texto(0, 'Enviado.'), ...fin('end_turn')],
  ]);
  const { c, eventos } = conPermisos(fetch, { permisoCorreoEnviar: 'si' }, { gmail });
  const turno = c.enviar('¿Cuál es mi último correo? Respóndele gracias');
  while (!eventos.some((e) => e.tipo === 'confirmar')) await new Promise((r) => setTimeout(r, 5));
  const lista = JSON.parse(peticiones[1].messages.at(-1).content[0].content);
  assert.deepEqual(lista.map((m) => m.asunto), ['Railway', 'Google']);
  assert.match(lista[0].fecha, /viernes, 30 oct, 23:18/);
  // «si» no vale para enviar: se trata como «preguntar».
  const pregunta = eventos.find((e) => e.tipo === 'confirmar');
  assert.equal(pregunta.accion.titulo, 'Re: Railway');
  assert.equal(pregunta.accion.cuerpo, 'Gracias');
  c.responderConfirmacion(pregunta.id, true);
  await turno;
  assert.deepEqual(enviados, [{ para: 'x@y.es', asunto: '', cuerpo: 'Gracias', responderA: 'b' }]);
});

test('el contexto de cada mensaje trae el día de la semana y los próximos días', async () => {
  const { fetch, peticiones } = apiSimulada([[inicio('m1'), ...texto(0, 'Hola.'), ...fin('end_turn')]]);
  const { c } = conPermisos(fetch, {}, {});
  await c.enviar('Hola');
  const contexto = peticiones[0].messages[0].content[0].text;
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
  assert.match(contexto, new RegExp(`Fecha y hora local del usuario: ${hoy}`));
  assert.match(contexto, /Esta semana va del lunes, \d+ \S+ al domingo/);
  assert.equal(contexto.split('Próximos días: ')[1].split('; ').length, 7);
});

test('calendario: modificar conserva la duración y cambia entre hora y todo el día', async () => {
  const llamadas = [];
  globalThis.fetch = async (url, init = {}) => {
    llamadas.push({ metodo: init.method ?? 'GET', cuerpo: init.body && JSON.parse(init.body) });
    return Response.json({ id: 'e1', summary: 'Cita', start: { dateTime: '2026-11-02T17:00:00+01:00' }, end: { dateTime: '2026-11-02T18:30:00+01:00' } });
  };
  const cal = new ClienteCalendario({ token: async () => 't', invalidar: () => {} });
  await cal.modificar('e1', { inicio: Date.parse('2026-11-03T10:00:00+01:00') });
  assert.equal(llamadas.at(-1).metodo, 'PATCH');
  assert.equal(Date.parse(llamadas.at(-1).cuerpo.end.dateTime) - Date.parse(llamadas.at(-1).cuerpo.start.dateTime), 90 * 60000);
  await cal.modificar('e1', { titulo: 'Otra' });
  assert.deepEqual(llamadas.at(-1).cuerpo, { summary: 'Otra' });
  await cal.modificar('e1', { inicio: new Date(2026, 10, 5).getTime(), todoElDia: true });
  assert.deepEqual(llamadas.at(-1).cuerpo.start, { date: '2026-11-05', dateTime: null });
  assert.deepEqual(llamadas.at(-1).cuerpo.end, { date: '2026-11-06', dateTime: null });
});
