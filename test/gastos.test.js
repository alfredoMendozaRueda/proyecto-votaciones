import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leerImporte,
  interpretarGasto,
  adivinarCategoria,
  euros,
  normalizarGastos,
  anadirMovimiento,
  editarMovimiento,
  borrarMovimiento,
  anadirFijo,
  darDeBajaFijo,
  cambiarOcurrencia,
  ponerPresupuesto,
  ocurrencias,
  resumenMes,
  historico,
  alMes,
  totalFijosAlMes,
  proximaFecha,
  proximosFijos,
  cuandoFijo,
  aCSV,
  crearAlmacenGastos,
  resumenParaIA,
} from '../src/compartido/gastos.js';
import { coleccionGastos, Sincronizador, COLECCIONES_SINCRO } from '../src/compartido/sincro.js';
import { gruposParaGroq, ConversacionClaude } from '../src/compartido/claude.js';

const HOY = '2026-11-14';

test('gastos: importes como los escribe la gente', () => {
  const casos = { '12': 1200, '12,5': 1250, '12,50': 1250, '12.50': 1250, '1.200': 120000, '1.200,50': 120050, '1,200.50': 120050, '€8': 800, '8€': 800, '45 euros': 4500, '0': null, 'abc': null, '1,2345': null, '': null };
  for (const [texto, esperado] of Object.entries(casos)) assert.equal(leerImporte(texto), esperado, texto);
  assert.equal(euros(111075), '1.110,75 €');
  assert.equal(euros(5), '0,05 €');
  assert.equal(euros(-4000), '−40,00 €');
  assert.equal(euros(160000, { redondo: true }), '1.600 €');
  assert.equal(euros(1299, { redondo: true }), '12,99 €');
});

test('gastos: una línea → importe, concepto, categoría, fecha y si se repite', () => {
  const i = (t) => {
    const r = interpretarGasto(t, HOY);
    return [r.centimos, r.concepto, r.categoria, r.fecha, r.fijo?.frecuencia ?? null];
  };
  assert.deepEqual(i('12,50 súper'), [1250, 'Súper', 'super', HOY, null]);
  assert.deepEqual(i('súper 12,50'), [1250, 'Súper', 'super', HOY, null]);
  assert.deepEqual(i('ayer 30€ gasolina'), [3000, 'Gasolina', 'transporte', '2026-11-13', null]);
  assert.deepEqual(i('anteayer taxi 14'), [1400, 'Taxi', 'transporte', '2026-11-12', null]);
  assert.deepEqual(i('netflix 12,99 al mes'), [1299, 'Netflix', 'suscripciones', HOY, 'mensual']);
  assert.deepEqual(i('gimnasio 29,90/mes'), [2990, 'Gimnasio', 'salud', HOY, 'mensual']);
  assert.deepEqual(i('seguro coche 420 al año'), [42000, 'Seguro coche', 'facturas', HOY, 'anual']);
  assert.deepEqual(i('1.200 alquiler cada mes'), [120000, 'Alquiler', 'casa', HOY, 'mensual']);
  // El importe con decimales gana a otros números; «2 cafés» se queda en el concepto.
  assert.deepEqual(i('2 cafés 3,40'), [340, '2 cafés', 'comer', HOY, null]);
  assert.deepEqual(i('he gastado 45 euros en la compra'), [4500, 'Compra', 'super', HOY, null]);
  assert.deepEqual(i('gasté 20 en el bar'), [2000, 'Bar', 'comer', HOY, null]);
  assert.deepEqual(i('La compra 60'), [6000, 'La compra', 'super', HOY, null]);
  assert.deepEqual(i('cena con Ana 38'), [3800, 'Cena con Ana', 'comer', HOY, null]);
  assert.equal(interpretarGasto('comida', HOY).centimos, null);
  assert.equal(interpretarGasto('15', HOY).concepto, '');
  // Categorías: «amazon prime» es suscripción; «amazon», compras.
  assert.equal(adivinarCategoria('Amazon Prime'), 'suscripciones');
  assert.equal(adivinarCategoria('Amazon'), 'compras');
  assert.equal(adivinarCategoria('Farmacia'), 'salud');
  assert.equal(adivinarCategoria('Regalo para Lucía'), 'compras');
  assert.equal(adivinarCategoria('Cosas varias'), 'otros');
});

const fijo = (extra) => normalizarGastos({ fijos: [{ concepto: 'X', centimos: 1000, frecuencia: 'mensual', dia: 1, desde: '2026-01-01', ...extra }] }, HOY).fijos[0];

test('gastos fijos: cuándo tocan (meses cortos, anuales, trimestrales, semanales, altas y bajas)', () => {
  assert.deepEqual(ocurrencias(fijo({ dia: 31 }), '2026-02').map((o) => o.fecha), ['2026-02-28']);
  assert.deepEqual(ocurrencias(fijo({ dia: 31 }), '2028-02').map((o) => o.fecha), ['2028-02-29']);
  const anual = fijo({ frecuencia: 'anual', mes: 3, dia: 15 });
  assert.deepEqual(ocurrencias(anual, '2026-03').map((o) => o.fecha), ['2026-03-15']);
  assert.deepEqual(ocurrencias(anual, '2026-04'), []);
  const trimestral = fijo({ frecuencia: 'trimestral', mes: 2, dia: 10 });
  assert.deepEqual(['2026-02', '2026-03', '2026-05', '2026-08', '2026-11'].map((m) => ocurrencias(trimestral, m).length), [1, 0, 1, 1, 1]);
  // Noviembre de 2026 tiene 5 lunes (2, 9, 16, 23, 30).
  assert.equal(ocurrencias(fijo({ frecuencia: 'semanal', diaSemana: 1 }), '2026-11').length, 5);
  assert.deepEqual(ocurrencias(fijo({ frecuencia: 'semanal', diaSemana: 1 }), '2026-11')[0].fecha, '2026-11-02');
  // Antes de «desde» y después de «hasta», nada.
  assert.deepEqual(ocurrencias(fijo({ desde: '2026-06-01' }), '2026-05'), []);
  assert.deepEqual(ocurrencias(fijo({ hasta: '2026-06-30' }), '2026-07'), []);
  // Lo que cuestan al mes.
  assert.equal(alMes(anual), 83);
  assert.equal(alMes(fijo({ frecuencia: 'semanal' })), 4333);
  assert.equal(alMes(trimestral), 333);
  assert.equal(cuandoFijo(anual), 'Cada año, el 15 de marzo');
  assert.equal(cuandoFijo(fijo({ frecuencia: 'semanal', diaSemana: 5 })), 'Cada semana, los viernes');
  assert.deepEqual(proximaFecha(anual, HOY), { fecha: '2027-03-15', centimos: 1000, omitido: false, cambiado: false });
});

test('gastos: resumen del mes (gastado, por pagar, presupuesto, categorías) y cambios de un mes', () => {
  let d = normalizarGastos({}, HOY);
  d = anadirMovimiento(d, { concepto: 'Súper', centimos: 4500, categoria: 'super', fecha: '2026-11-03' }).datos;
  d = anadirMovimiento(d, { concepto: 'Cine', centimos: 900, fecha: '2026-11-10' }).datos;
  d = anadirMovimiento(d, { concepto: 'Octubre', centimos: 10000, fecha: '2026-10-20' }).datos;
  const alquiler = anadirFijo(d, { concepto: 'Alquiler', centimos: 80000, categoria: 'casa', dia: 1, desde: '2026-01-01' }, HOY);
  d = alquiler.datos;
  const netflix = anadirFijo(d, { concepto: 'Netflix', centimos: 1399, dia: 20, desde: '2026-01-01' }, HOY);
  d = ponerPresupuesto(netflix.datos, 100000);
  assert.equal(d.movimientos.find((m) => m.concepto === 'Cine').categoria, 'ocio', 'categoría adivinada');
  let r = resumenMes(d, '2026-11', HOY);
  assert.equal(r.gastado, 4500 + 900 + 80000);
  assert.equal(r.pendiente, 1399, 'Netflix se cobra el 20: aún por pagar');
  assert.equal(r.previsto, 86799);
  assert.equal(r.disponible, 100000 - 86799);
  assert.deepEqual(r.porCategoria.map((c) => c.id), ['casa', 'super', 'suscripciones', 'ocio']);
  assert.deepEqual(r.lista.map((x) => x.concepto), ['Netflix', 'Cine', 'Súper', 'Alquiler']);
  // Este mes la luz… digo, Netflix subió; y el alquiler de diciembre no toca.
  d = cambiarOcurrencia(d, netflix.fijo.id, '2026-11-20', { centimos: 1599 }, HOY);
  d = cambiarOcurrencia(d, alquiler.fijo.id, '2026-12-01', { omitido: true }, HOY);
  r = resumenMes(d, '2026-11', HOY);
  assert.equal(r.pendiente, 1599);
  assert.ok(r.lista.find((x) => x.concepto === 'Netflix').cambiado);
  const dic = resumenMes(d, '2026-12', HOY);
  assert.ok(!dic.lista.some((x) => x.concepto === 'Alquiler'));
  assert.deepEqual(dic.omitidos.map((o) => o.concepto), ['Alquiler']);
  // Volver a como siempre.
  d = cambiarOcurrencia(d, netflix.fijo.id, '2026-11-20', null, HOY);
  assert.equal(resumenMes(d, '2026-11', HOY).pendiente, 1399);
  // Dar de baja: lo pagado se queda, lo que viene no.
  d = darDeBajaFijo(d, alquiler.fijo.id, HOY);
  assert.ok(resumenMes(d, '2026-11', HOY).lista.some((x) => x.concepto === 'Alquiler'));
  assert.ok(!resumenMes(d, '2027-01', HOY).lista.some((x) => x.concepto === 'Alquiler'));
  assert.equal(totalFijosAlMes(d, HOY), 1399);
  // Histórico.
  assert.deepEqual(historico(d, '2026-11', 2, HOY), [{ mes: '2026-10', total: 10000 + 80000 + 1399 }, { mes: '2026-11', total: 86799 }]);
  assert.deepEqual(proximosFijos(d, HOY, 3).map((x) => x.concepto), []);
  assert.deepEqual(proximosFijos(d, HOY, 7).map((x) => x.concepto), ['Netflix']);
  assert.deepEqual(proximosFijos(d, '2026-11-18', 7).map((x) => [x.concepto, x.fecha]), [['Netflix', '2026-11-20']]);
  // Editar y borrar un gasto.
  const cine = d.movimientos.find((m) => m.concepto === 'Cine');
  d = editarMovimiento(d, cine.id, { centimos: 1100, fecha: '2026-11-11' });
  assert.equal(d.movimientos.find((m) => m.id === cine.id).centimos, 1100);
  d = borrarMovimiento(d, cine.id);
  assert.ok(!d.movimientos.some((m) => m.id === cine.id));
  assert.throws(() => anadirMovimiento(d, { concepto: 'x', centimos: 0, fecha: HOY }), /mayor que cero/);
});

test('gastos: datos raros se limpian; el CSV se abre bien en Excel', () => {
  const d = normalizarGastos({
    movimientos: [
      { concepto: 'Bien', centimos: 250, fecha: '2026-11-02' },
      { concepto: 'Sin importe', fecha: '2026-11-02' },
      { concepto: 'Fecha mala', centimos: 100, fecha: '2026-02-30' },
      { concepto: 'Con ; y "comillas"', centimos: 1999, fecha: '2026-11-05', categoria: 'inventada' },
    ],
    fijos: [{ concepto: 'Luz', centimos: 6000, dia: 40, frecuencia: 'rara', desde: '2026-01-01' }],
    presupuesto: -5,
  }, HOY);
  assert.equal(d.movimientos.length, 2);
  assert.equal(d.presupuesto, 0);
  assert.equal(d.fijos[0].frecuencia, 'mensual');
  assert.equal(d.fijos[0].dia, 1, 'un día imposible vuelve al del alta');
  assert.equal(d.movimientos.find((m) => m.concepto.startsWith('Con')).categoria, 'otros');
  const csv = aCSV(d, '2026-11', '2026-11', HOY);
  assert.ok(csv.startsWith('﻿Fecha;Concepto;Categoría;Tipo;Importe\r\n'));
  assert.match(csv, /2026-11-01;Luz;Facturas;Fijo;60,00/);
  assert.match(csv, /2026-11-05;"Con ; y ""comillas""";Otros;Puntual;19,99/);
  const ia = resumenParaIA(d, '2026-11', HOY);
  assert.equal(ia.gastado, '82,49 €');
  assert.deepEqual(ia.gastos_fijos, ['Luz: 60,00 € · cada mes, el día 1']);
});

test('gastos: el almacén que usa el chat apunta puntuales y fijos y los quita', async () => {
  let guardado = null;
  let cambios = 0;
  const g = crearAlmacenGastos({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)), alCambiar: () => cambios++ });
  const a = await g.apuntar({ concepto: 'Gasolina', importe: 58.4, fecha: '2026-11-13' }, HOY);
  assert.deepEqual({ ...a, id: undefined }, { tipo: 'puntual', id: undefined, concepto: 'Gasolina', importe: '58,40 €', categoria: 'Transporte', fecha: '2026-11-13' });
  const b = await g.apuntar({ concepto: 'Spotify', importe: 10.99, frecuencia: 'mensual', dia: 22 }, HOY);
  assert.equal(b.tipo, 'fijo');
  assert.equal(b.cuando, 'Cada mes, el día 22');
  assert.equal(guardado.fijos[0].desde, '2026-11-01', 'cuenta desde el principio de este mes');
  assert.equal(cambios, 2);
  const r = await g.resumen('2026-11', HOY);
  assert.equal(r.gastado, '58,40 €');
  assert.equal(r.fijos_por_pagar, '10,99 €');
  await g.quitar(b.id);
  await g.quitar(a.id);
  assert.equal(guardado.fijos.length + guardado.movimientos.length, 0);
});

test('gastos: se sincronizan gasto a gasto y se activan solos en los dispositivos que ya sincronizaban', async () => {
  let datos = normalizarGastos({ presupuesto: 50000, movimientos: [{ id: 'gaaaaa1', concepto: 'A', centimos: 100, fecha: HOY }], fijos: [{ id: 'fbbbbb1', concepto: 'B', centimos: 200, desde: '2026-01-01' }] }, HOY);
  const c = coleccionGastos({ leer: async () => datos, guardar: async (d) => (datos = d), normalizar: (d) => normalizarGastos(d, HOY) });
  const mapa = await c.leer();
  assert.deepEqual([...mapa.keys()].sort(), ['base', 'f:fbbbbb1', 'm:gaaaaa1']);
  // Llega de otro dispositivo: un gasto nuevo, el fijo borrado y otro presupuesto.
  await c.aplicar([
    { id: 'm:gcccccc', valor: JSON.stringify({ id: 'gcccccc', concepto: 'C', centimos: 300, fecha: HOY, categoria: 'ocio' }) },
    { id: 'f:fbbbbb1', valor: null },
    { id: 'base', valor: JSON.stringify({ presupuesto: 70000 }) },
  ]);
  assert.deepEqual(datos.movimientos.map((m) => m.id).sort(), ['gaaaaa1', 'gcccccc']);
  assert.equal(datos.fijos.length, 0);
  assert.equal(datos.presupuesto, 70000);

  assert.ok(COLECCIONES_SINCRO.some(([c]) => c === 'gastos'));
  // Un estado guardado antes de existir Gastos: se añade y se baja todo una vez.
  let estado = { cursor: 42, base: {}, pendientes: {}, ultima: 1, error: '', primera: false, colecciones: ['memoria', 'ajustes'] };
  const sincro = new Sincronizador({
    cliente: async () => ({ sincroEstado: async () => ({ activa: false, solicitudes: [] }) }),
    colecciones: {},
    leerEstado: async () => estado,
    guardarEstado: async (e) => (estado = e),
    leerLlave: async () => null,
    guardarLlave: async () => {},
    borrarLlave: async () => {},
  });
  await sincro.resumen();
  assert.deepEqual(estado.colecciones, ['memoria', 'ajustes', 'gastos'], 'respeta lo que el usuario quitó y añade Gastos');
  assert.equal(estado.cursor, 0);
  // Si luego lo quita, no vuelve a activarse solo.
  estado = { ...estado, colecciones: ['memoria'], cursor: 9 };
  await sincro.resumen();
  assert.deepEqual(estado.colecciones, ['memoria']);
  assert.equal(estado.cursor, 9);
});

// ---------- El chat ----------

test('gastos en el chat: con Groq se mandan sus herramientas cuando se habla de gastos', () => {
  assert.ok(gruposParaGroq(['apunta 12 euros de gasolina']).has('gastos'));
  assert.ok(gruposParaGroq(['¿cuánto llevo gastado este mes?']).has('gastos'));
  assert.ok(gruposParaGroq(['he pagado 30 € en la cena']).has('gastos'));
  assert.ok(!gruposParaGroq(['¿qué tiempo hace mañana?']).has('gastos'));
});

test('gastos en el chat: «apunta 12,50 del súper» llama a apuntar_gasto y avisa a la app', async () => {
  const sse = (trozos) => new Response(trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });
  const peticiones = [];
  const apuntados = [];
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async (p) => (p === 'openai' ? 'sk-prueba' : null),
    obtenerAjustes: () => ({ proveedor: 'openai', modeloOpenAI: 'gpt-6-luna', busquedaWeb: false, usarMemoria: false, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    gastos: {
      apuntar: async (e) => (apuntados.push(e), { tipo: 'puntual', id: 'gx1', concepto: e.concepto, importe: '12,50 €', categoria: 'Súper', fecha: HOY }),
      resumen: async () => ({}),
    },
    emitir: (e) => eventos.push(e),
    opcionesCliente: {
      fetch: async (url, init) => {
        const cuerpo = JSON.parse(init.body);
        peticiones.push(cuerpo);
        if (cuerpo.messages.at(-1).role === 'tool') return sse([delta({ content: 'Apuntado: 12,50 € del súper.' }), delta({}, 'stop')]);
        return sse([
          delta({ tool_calls: [{ index: 0, id: 'call_g', type: 'function', function: { name: 'apuntar_gasto', arguments: '{"concepto":"Súper","importe":12.5,"categoria":"super"}' } }] }),
          delta({}, 'tool_calls'),
        ]);
      },
    },
  });
  await c.enviar('apunta 12,50 del súper');
  assert.ok(peticiones[0].tools.some((t) => t.function.name === 'apuntar_gasto'));
  assert.ok(peticiones[0].tools.some((t) => t.function.name === 'ver_gastos'));
  assert.deepEqual(apuntados, [{ concepto: 'Súper', importe: 12.5, categoria: 'super', fecha: undefined, frecuencia: undefined, dia: undefined }]);
  assert.deepEqual(eventos.find((e) => e.tipo === 'gasto')?.gasto.concepto, 'Súper');
  assert.match(peticiones[0].messages[0].content, /Llevas sus gastos/);
});
