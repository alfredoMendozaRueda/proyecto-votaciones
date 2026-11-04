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
  domingoDePascua,
  factorEstacional,
  estimarDiaADia,
  prevision,
  saldoAlFinal,
  serieBalance,
  ponerSaldo,
  totalIngresosFijosAlMes,
  apuntarMovimiento,
  deshacerApunte,
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
  assert.deepEqual(historico(d, '2026-11', 2, HOY), [{ mes: '2026-10', total: 10000 + 80000 + 1399, ingresos: 0 }, { mes: '2026-11', total: 86799, ingresos: 0 }]);
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
  assert.match(csv, /2026-11-01;Luz;Facturas;Gasto fijo;-60,00/);
  assert.match(csv, /2026-11-05;"Con ; y ""comillas""";Otros;Gasto;-19,99/);
  const ia = resumenParaIA(d, '2026-11', HOY);
  assert.equal(ia.gastado, '82,49 €');
  assert.deepEqual(ia.gastos_fijos, ['Luz: 60,00 € · cada mes, el día 1']);
});

test('gastos: el almacén que usa el chat apunta puntuales y fijos y los quita', async () => {
  let guardado = null;
  let cambios = 0;
  const g = crearAlmacenGastos({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)), alCambiar: () => cambios++ });
  const a = await g.apuntar({ concepto: 'Gasolina', importe: 58.4, fecha: '2026-11-13' }, HOY);
  assert.deepEqual({ ...a, id: undefined }, { tipo: 'puntual', ingreso: false, id: undefined, concepto: 'Gasolina', centimos: 5840, importe: '58,40 €', categoria: 'Transporte', fecha: '2026-11-13' });
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
  assert.deepEqual(apuntados, [{ concepto: 'Súper', importe: 12.5, ingreso: false, categoria: 'super', fecha: undefined, frecuencia: undefined, dia: undefined }]);
  assert.deepEqual(eventos.find((e) => e.tipo === 'gasto')?.gasto.concepto, 'Súper');
  assert.match(peticiones[0].messages[0].content, /Llevas sus cuentas.*TIENE.*poner_saldo.*ENTRA.*ingreso=true.*GASTA/s);
});

// ---------- Ingresos, saldo y previsión ----------

test('ingresos: la nómina y lo que te llega se reconocen y se cuentan aparte', () => {
  const i = (t) => {
    const r = interpretarGasto(t, HOY);
    return [r.ingreso, r.centimos, r.concepto, r.categoria, r.fijo?.frecuencia ?? null];
  };
  assert.deepEqual(i('nómina 1.850 cada mes'), [true, 185000, 'Nómina', 'nomina', 'mensual']);
  assert.deepEqual(i('+40 bizum de Ana'), [true, 4000, 'Bizum de Ana', 'ingresos', null]);
  assert.deepEqual(i('paga extra 1.850'), [true, 185000, 'Paga extra', 'extra', null]);
  assert.deepEqual(i('me han pagado 200 de la venta de la bici'), [true, 20000, 'Venta de la bici', 'ingresos', null]);
  assert.deepEqual(i('devolución Amazon 25,99'), [true, 2599, 'Devolución Amazon', 'ingresos', null]);
  assert.equal(i('he pagado 30 en la cena')[0], false);
  assert.equal(i('alquiler 850 al mes')[0], false);
  let d = normalizarGastos({}, HOY);
  d = anadirFijo(d, { concepto: 'Nómina', centimos: 185000, ingreso: true, dia: 28, desde: '2026-01-01' }, HOY).datos;
  d = anadirFijo(d, { concepto: 'Alquiler', centimos: 80000, dia: 1, desde: '2026-01-01' }, HOY).datos;
  d = anadirMovimiento(d, { concepto: 'Bizum', centimos: 4000, ingreso: true, fecha: '2026-11-02' }).datos;
  d = anadirMovimiento(d, { concepto: 'Súper', centimos: 6000, fecha: '2026-11-03' }).datos;
  // Una categoría de gasto en un ingreso no vale: se adivina otra de ingreso.
  assert.equal(normalizarGastos({ movimientos: [{ concepto: 'Venta', centimos: 100, fecha: HOY, ingreso: true, categoria: 'super' }] }).movimientos[0].categoria, 'ingresos');
  const r = resumenMes(d, '2026-11', HOY);
  assert.equal(r.gastado, 86000, 'los ingresos no suman al gasto');
  assert.equal(r.ingresado, 4000);
  assert.equal(r.porCobrar, 185000);
  assert.deepEqual(r.porCategoria.map((c) => c.id), ['casa', 'super']);
  assert.equal(totalFijosAlMes(d, HOY), 80000);
  assert.equal(totalIngresosFijosAlMes(d, HOY), 185000);
  assert.match(aCSV(d, '2026-11', '2026-11', HOY), /2026-11-28;Nómina;Nómina;Ingreso fijo \(por cobrar\);1850,00/);
});

test('previsión: Semana Santa en su mes y Navidad, rebajas y verano con su peso', () => {
  assert.deepEqual([2026, 2027, 2028, 2030].map((a) => domingoDePascua(a)), ['2026-04-05', '2027-03-28', '2028-04-16', '2030-04-21']);
  assert.match(factorEstacional('2027-03').motivo, /Semana Santa/);
  assert.equal(factorEstacional('2026-03').motivo, '');
  assert.match(factorEstacional('2026-12').motivo, /Navidad/);
  assert.ok(factorEstacional('2026-12').factor > factorEstacional('2026-11').factor);
  assert.ok(factorEstacional('2027-02').factor < 1);
  assert.match(factorEstacional('2027-08').motivo, /vacaciones/);
});

test('previsión: el día a día se estima con tus meses anteriores y la época; lo fijo, exacto', () => {
  // Seis meses gastando 600 € al mes en el día a día (mayo a octubre), y en noviembre de momento 200 €.
  const movimientos = [];
  for (const mes of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) movimientos.push({ concepto: 'Súper', centimos: 60000, fecha: `${mes}-10` });
  movimientos.push({ concepto: 'Súper', centimos: 20000, fecha: '2026-11-05' });
  let d = normalizarGastos({ movimientos, fijos: [{ concepto: 'Alquiler', centimos: 80000, dia: 1, desde: '2026-01-01' }, { concepto: 'Nómina', centimos: 200000, ingreso: true, dia: 28, desde: '2026-01-01' }, { concepto: 'Paga extra', centimos: 200000, ingreso: true, frecuencia: 'anual', mes: 12, dia: 20, desde: '2026-01-01' }] }, HOY);
  const nov = estimarDiaADia(d, '2026-11', HOY);
  const dic = estimarDiaADia(d, '2026-12', HOY);
  const feb = estimarDiaADia(d, '2027-02', HOY);
  assert.equal(nov.meses, 6);
  assert.ok(dic.centimos > nov.centimos * 1.15, `${dic.centimos} vs ${nov.centimos}`);
  assert.ok(feb.centimos < nov.centimos);
  assert.match(dic.motivo, /Navidad/);
  // Noviembre en curso: lo apuntado (200 €) más lo que falta hasta la estimación.
  const pNov = prevision(d, '2026-11', HOY);
  assert.equal(pNov.tipo, 'actual');
  assert.equal(pNov.diaADia, nov.centimos);
  assert.equal(pNov.gastos, 80000 + nov.centimos);
  assert.equal(pNov.ingresos, 200000);
  // Diciembre: alquiler + día a día de Navidad; ingresos con la paga extra.
  const pDic = prevision(d, '2026-12', HOY);
  assert.equal(pDic.tipo, 'futuro');
  assert.equal(pDic.ingresos, 400000);
  assert.equal(pDic.gastos, 80000 + dic.centimos);
  assert.equal(pDic.ahorro, 400000 - pDic.gastos);
  // Un mes pasado es lo que fue, sin estimar.
  const pOct = prevision(d, '2026-10', HOY);
  assert.equal(pOct.tipo, 'pasado');
  assert.equal(pOct.gastos, 60000 + 80000);
  assert.equal(pOct.estimado, 0);
  // Con un año de datos, cuenta lo que gastaste ese mismo mes el año pasado.
  d = normalizarGastos({ ...d, movimientos: [...d.movimientos, { concepto: 'Regalos', centimos: 150000, fecha: '2025-12-15' }] }, HOY);
  const dicConHistoria = estimarDiaADia(d, '2026-12', HOY);
  assert.equal(dicConHistoria.añoPasado, 150000);
  assert.ok(dicConHistoria.centimos > dic.centimos);
  // La serie de la gráfica: 5 meses atrás, este y 3 más.
  const serie = serieBalance(d, HOY);
  assert.deepEqual(serie.map((x) => x.mes), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(serie.map((x) => x.tipo), ['pasado', 'pasado', 'pasado', 'pasado', 'pasado', 'actual', 'futuro', 'futuro', 'futuro']);
  assert.ok(serie.every((x) => x.saldo === null), 'sin saldo apuntado, sin línea de saldo');
  // Sin ningún gasto, no hay estimación.
  assert.equal(estimarDiaADia(normalizarGastos({}), '2026-12', HOY), null);
});

test('saldo: desde lo que hay hoy en la cuenta, cómo acaba cada mes', () => {
  let d = normalizarGastos({
    movimientos: [
      { concepto: 'Súper', centimos: 30000, fecha: '2026-10-10' },
      { concepto: 'Cine', centimos: 1000, fecha: '2026-11-10' },
      { concepto: 'Cena', centimos: 5000, fecha: '2026-11-16' },
    ],
    fijos: [
      { concepto: 'Alquiler', centimos: 80000, dia: 1, desde: '2026-01-01' },
      { concepto: 'Nómina', centimos: 200000, ingreso: true, dia: 28, desde: '2026-01-01' },
    ],
  }, HOY);
  d = ponerSaldo(d, 300000, HOY);
  assert.deepEqual(d.saldo, { centimos: 300000, fecha: HOY });
  assert.equal(saldoAlFinal(d, '2026-10', HOY), null, 'antes del saldo no se sabe');
  // Noviembre: lo apuntado antes de hoy ya está en el saldo; después, la cena (16) y la nómina (28),
  // y el resto estimado del día a día solo para los días que quedan.
  const est = estimarDiaADia(d, '2026-11', HOY);
  const restoNov = Math.min(Math.max(0, est.centimos - 6000), Math.round((est.centimos * (30 - 14)) / 30));
  assert.equal(saldoAlFinal(d, '2026-11', HOY), 300000 - 5000 + 200000 - restoNov);
  // Diciembre: alquiler, nómina y el día a día estimado.
  const dic = estimarDiaADia(d, '2026-12', HOY);
  assert.equal(saldoAlFinal(d, '2026-12', HOY), saldoAlFinal(d, '2026-11', HOY) - 80000 + 200000 - dic.centimos);
  assert.equal(ponerSaldo(d, null, HOY).saldo, null);
  const ia = resumenParaIA(d, '2026-11', HOY);
  assert.match(ia.saldo, /^3\.000,00 € el 2026-11-14; a fin de este mes ~/);
  assert.equal(ia.proximos_meses.length, 3);
  assert.match(ia.proximos_meses[0], /^diciembre de 2026: gastos ~.*\(Navidad: regalos, cenas y viajes\), ingresos 2\.000 €/);
});

test('ingresos en el chat: «me han ingresado la nómina» se apunta como ingreso', async () => {
  let guardado = null;
  const g = crearAlmacenGastos({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)) });
  const r = await g.apuntar({ concepto: 'Nómina', importe: 1850, ingreso: true, frecuencia: 'mensual', dia: 28 }, HOY);
  assert.equal(r.ingreso, true);
  assert.equal(guardado.fijos[0].categoria, 'nomina');
  assert.ok(gruposParaGroq(['me han ingresado la nómina']).has('gastos'));
  assert.ok(gruposParaGroq(['¿cuánto ahorraré en diciembre?']).has('gastos'));
});

// ---------- Saldo, ingreso o gasto: qué suma, qué resta y qué no ----------

test('tipo: «tengo» es saldo, «me han ingresado» suma, «he gastado» resta (y «me han cobrado» también resta)', () => {
  const t = (texto) => {
    const r = interpretarGasto(texto, HOY);
    return [r.tipo, r.centimos, r.concepto];
  };
  assert.deepEqual(t('tengo 2.300 €'), ['saldo', 230000, 'Tengo']);
  assert.equal(t('me quedan 300 en el banco')[0], 'saldo');
  assert.equal(t('en mi cuenta tengo 3.150,40')[1], 315040);
  assert.equal(t('saldo 1.200')[0], 'saldo');
  assert.equal(t('tengo 3000 ahorrados')[0], 'saldo');
  assert.deepEqual(t('me han ingresado la nómina, 1.850'), ['ingreso', 185000, 'Nómina']);
  assert.deepEqual(t('me ha llegado la nómina 1.900'), ['ingreso', 190000, 'Nómina']);
  assert.deepEqual(t('me han dado 50'), ['ingreso', 5000, '']);
  assert.deepEqual(t('he cobrado 300 de un trabajo'), ['ingreso', 30000, 'Trabajo']);
  assert.deepEqual(t('me han hecho un bizum de 15'), ['ingreso', 1500, 'Bizum']);
  assert.deepEqual(t('me han devuelto 25 de Amazon'), ['ingreso', 2500, 'Amazon']);
  assert.deepEqual(t('he gastado 30 en la cena'), ['gasto', 3000, 'Cena']);
  assert.deepEqual(t('he pagado el alquiler 850'), ['gasto', 85000, 'Alquiler']);
  assert.deepEqual(t('me han cobrado 12 del parking'), ['gasto', 1200, 'Parking']);
  assert.deepEqual(t('me ha llegado la factura de la luz 64'), ['gasto', 6400, 'Factura de la luz']);
  assert.deepEqual(t('tengo que pagar 30 del gimnasio'), ['gasto', 3000, 'Gimnasio']);
  assert.deepEqual(t('le he dado 20 a mi hermano'), ['gasto', 2000, 'Para mi hermano']);
  // Un saldo no se repite: nunca es un fijo.
  assert.equal(interpretarGasto('tengo 2.000 cada mes', HOY).fijo, null);
});

test('no se cuenta dos veces: «me ha llegado la nómina» ajusta la nómina fija de ese mes', () => {
  let d = normalizarGastos({ fijos: [
    { id: 'fnomina1', concepto: 'Nómina', centimos: 185000, ingreso: true, dia: 28, desde: '2026-01-01' },
    { id: 'falquil1', concepto: 'Alquiler', centimos: 85000, dia: 1, desde: '2026-01-01' },
  ] }, HOY);
  // Llega el 28 de octubre pero lo dice el 4 de noviembre: es la de octubre.
  let r = apuntarMovimiento(d, { concepto: 'Nómina', centimos: 190000, ingreso: true, fecha: '2026-11-04' }, '2026-11-04');
  assert.equal(r.resultado.tipo, 'fijo-ajustado');
  assert.equal(r.resultado.fecha, '2026-10-28');
  assert.equal(r.resultado.antes, 185000);
  assert.equal(resumenMes(r.datos, '2026-10', '2026-11-04').ingresos, 190000);
  assert.equal(r.datos.movimientos.length, 0, 'no se añade un ingreso aparte');
  // Deshacer deja la nómina como estaba.
  const vuelta = deshacerApunte(r.datos, r.resultado, '2026-11-04');
  assert.equal(resumenMes(vuelta, '2026-10', '2026-11-04').ingresos, 185000);
  // Mismo importe: ya estaba contado.
  r = apuntarMovimiento(d, { concepto: 'el alquiler', centimos: 85000, fecha: '2026-11-02' }, '2026-11-04');
  assert.equal(r.resultado.tipo, 'fijo-ajustado');
  assert.ok(r.resultado.igual);
  assert.equal(resumenMes(r.datos, '2026-11', '2026-11-04').gastado, 85000);
  // Otra cosa (o lejos de su día) sí es un movimiento nuevo.
  assert.equal(apuntarMovimiento(d, { concepto: 'Cena', centimos: 3000, fecha: HOY }, HOY).resultado.tipo, 'puntual');
  assert.equal(apuntarMovimiento(d, { concepto: 'Bizum de Ana', centimos: 3000, ingreso: true, fecha: HOY }, HOY).resultado.tipo, 'puntual');
  assert.equal(apuntarMovimiento(d, { concepto: 'Nómina', centimos: 50000, ingreso: true, fecha: '2026-11-14' }, HOY).resultado.tipo, 'puntual', 'a 14 días de cualquier nómina');
  // Un gasto que se llama como un ingreso fijo no lo toca.
  assert.equal(apuntarMovimiento(d, { concepto: 'Nómina de la asistenta', centimos: 30000, fecha: '2026-10-28' }, HOY).resultado.tipo, 'puntual');
});

test('saldo desde el chat: no suma ni resta; se puede deshacer', async () => {
  let guardado = normalizarGastos({ movimientos: [{ concepto: 'Cena', centimos: 3000, fecha: '2026-11-02' }], saldo: { centimos: 100000, fecha: '2026-10-01' } }, HOY);
  const g = crearAlmacenGastos({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)) });
  const r = await g.saldo({ importe: 2300 }, HOY);
  assert.equal(r.tipo, 'saldo');
  assert.equal(r.importe, '2.300,00 €');
  assert.deepEqual(guardado.saldo, { centimos: 230000, fecha: HOY });
  assert.equal(resumenMes(guardado, '2026-11', HOY).gastado, 3000, 'el saldo no es un gasto ni un ingreso');
  assert.equal(guardado.movimientos.length, 1);
  await g.deshacer(r, HOY);
  assert.deepEqual(guardado.saldo, { centimos: 100000, fecha: '2026-10-01' });
  // Y la nómina fija que ya existe se ajusta en vez de duplicarse.
  guardado = normalizarGastos({ fijos: [{ id: 'fnomina1', concepto: 'Nómina', centimos: 185000, ingreso: true, dia: 14, desde: '2026-01-01' }] }, HOY);
  const n = await g.apuntar({ concepto: 'Nómina', importe: 1850, ingreso: true }, HOY);
  assert.equal(n.tipo, 'fijo-ajustado');
  assert.match(n.nota, /Ya estaba contado/);
  assert.equal(guardado.movimientos.length, 0);
});

test('saldo en el chat: «tengo 2.300 en la cuenta» llama a poner_saldo, no a apuntar_gasto', async () => {
  const sse = (trozos) => new Response(trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });
  const peticiones = [];
  const saldos = [];
  const eventos = [];
  const c = new ConversacionClaude({
    obtenerClave: async (p) => (p === 'openai' ? 'sk-prueba' : null),
    obtenerAjustes: () => ({ proveedor: 'openai', modeloOpenAI: 'gpt-6-luna', busquedaWeb: false, usarMemoria: false, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    gastos: {
      apuntar: async () => assert.fail('no es un gasto'),
      saldo: async (e) => (saldos.push(e), { tipo: 'saldo', centimos: 230000, importe: '2.300,00 €', fecha: HOY, anterior: null, fin_de_mes: '2.900 €' }),
      resumen: async () => ({}),
    },
    emitir: (e) => eventos.push(e),
    opcionesCliente: {
      fetch: async (url, init) => {
        const cuerpo = JSON.parse(init.body);
        peticiones.push(cuerpo);
        if (cuerpo.messages.at(-1).role === 'tool') return sse([delta({ content: 'Apuntado: tienes 2.300 €.' }), delta({}, 'stop')]);
        return sse([delta({ tool_calls: [{ index: 0, id: 'call_s', type: 'function', function: { name: 'poner_saldo', arguments: '{"importe":2300}' } }] }), delta({}, 'tool_calls')]);
      },
    },
  });
  await c.enviar('tengo 2.300 en la cuenta');
  const herramientas = peticiones[0].tools.map((t) => t.function.name);
  assert.ok(herramientas.includes('poner_saldo') && herramientas.includes('apuntar_gasto'));
  assert.deepEqual(saldos, [{ importe: 2300, fecha: undefined }]);
  assert.equal(eventos.find((e) => e.tipo === 'gasto')?.gasto.tipo, 'saldo');
  assert.match(peticiones[0].messages[0].content, /poner_saldo/);
  assert.ok(gruposParaGroq(['tengo 2.300 en la cuenta']).has('gastos'));
  assert.ok(gruposParaGroq(['me quedan 300 en el banco']).has('gastos'));
});
