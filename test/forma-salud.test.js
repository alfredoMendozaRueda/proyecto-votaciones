import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroTolerante, momentoDe, validarSalud, aplicarSalud, anotarUltima, crearLlaveBuzon, cifrarParaBuzon, descifrarDelBuzon, mediaPasos } from '../src/compartido/forma/salud.js';
import { normalizarForma } from '../src/compartido/forma/datos.js';
import { pesosPorDia, pesoDelDia, serieComposicion } from '../src/compartido/forma/progreso.js';
import { apuntarPeso } from '../src/compartido/forma/acciones.js';
import { objetivoDelDia, pasosExtraDelDia } from '../src/compartido/forma/diario.js';

const AHORA = Date.parse('2026-11-20T21:30:00+01:00');
const Z = 'Europe/Madrid';

test('números tolerantes: coma decimal, unidades y miles en los pasos', () => {
  assert.equal(numeroTolerante('77,55'), 77.55);
  assert.equal(numeroTolerante('77.55'), 77.55);
  assert.equal(numeroTolerante(' 77,55 kg '), 77.55);
  assert.equal(numeroTolerante('22,9 %'), 22.9);
  assert.equal(numeroTolerante('1.234,5'), 1234.5);
  assert.equal(numeroTolerante(77.55), 77.55);
  assert.equal(numeroTolerante('11.234', { entero: true }), 11234);
  assert.equal(numeroTolerante('11234', { entero: true }), 11234);
  assert.ok(Number.isNaN(numeroTolerante('mucho')));
  assert.ok(Number.isNaN(numeroTolerante('7,7,5')));
  assert.ok(Number.isNaN(numeroTolerante(null)));
});

test('fecha y hora: con zona, en UTC y sin zona (la del usuario, con horario de verano)', () => {
  assert.equal(momentoDe('2026-11-20T08:12:00+01:00', Z), Date.parse('2026-11-20T07:12:00Z'));
  assert.equal(momentoDe('2026-11-20T07:12:00Z', Z), Date.parse('2026-11-20T07:12:00Z'));
  assert.equal(momentoDe('2026-11-20T08:12:00', Z), Date.parse('2026-11-20T07:12:00Z'));
  assert.equal(momentoDe('2026-07-20 08:12', Z), Date.parse('2026-07-20T06:12:00Z'));
  assert.equal(momentoDe('2026-11-20T08:12:00+0100', Z), Date.parse('2026-11-20T07:12:00Z'));
  assert.equal(momentoDe('20/11/2026 8:12', Z), null);
  assert.equal(momentoDe('2026-02-30T08:00:00', Z), null);
});

test('validar: grasa en fracción o en %, días repetidos y pesaje en la zona del usuario', () => {
  const v = validarSalud(
    {
      dias: [
        { fecha: '2026-11-19', pasos: 1000 },
        { fecha: '2026-11-19', pasos: 11234.4 },
        { fecha: '2026-11-20', pasos: '4.321' },
      ],
      pesaje: { fecha_hora: '2026-11-20T07:12:00Z', peso_kg: '77,55', grasa_pct: 0.229, masa_magra_kg: 59.8 },
    },
    { zona: Z, ahora: AHORA },
  );
  assert.deepEqual(v.errores, []);
  assert.deepEqual(v.dias, [
    { fecha: '2026-11-19', pasos: 11234 },
    { fecha: '2026-11-20', pasos: 4321 },
  ]);
  assert.equal(v.pesaje.hora, '08:12');
  assert.equal(v.pesaje.grasa, 22.9);
  assert.equal(validarSalud({ pesaje: { fecha_hora: '2026-11-20T08:00', peso_kg: 77, grasa_pct: '22,9' } }, { zona: Z, ahora: AHORA }).pesaje.grasa, 22.9);
  const mal = validarSalud({ pesaje: { fecha_hora: '2026-11-20T08:00', peso_kg: 77, masa_magra_kg: 80 } }, { zona: Z, ahora: AHORA });
  assert.equal(mal.errores[0].campo, 'pesaje.masa_magra_kg');
  assert.equal(validarSalud({ pesaje: { fecha_hora: '2026-11-21T08:00', peso_kg: 77 } }, { zona: Z, ahora: AHORA }).errores[0].motivo, 'es una hora futura');
  assert.match(validarSalud([], { zona: Z }).errores[0].motivo, /objeto JSON/);
});

test('peso del día: el primero antes de las 12; si no, el primero; el que apuntas a mano manda', () => {
  const datos = normalizarForma({
    pesos: [
      { fecha: '2026-11-18', kg: 78.4, hora: '19:30', momento: 3, fuente: 'apple_salud' },
      { fecha: '2026-11-18', kg: 78.9, hora: '13:10', momento: 2, fuente: 'apple_salud' },
      { fecha: '2026-11-19', kg: 77.9, hora: '21:00', momento: 6, fuente: 'apple_salud', grasa: 23.4 },
      { fecha: '2026-11-19', kg: 77.6, hora: '08:05', momento: 4, fuente: 'apple_salud', grasa: 23.1, magra: 59.7 },
      { fecha: '2026-11-19', kg: 77.4, hora: '10:30', momento: 5, fuente: 'apple_salud' },
      { fecha: '2026-11-20', kg: 77.3, hora: '07:50', momento: 7, fuente: 'apple_salud' },
      { fecha: '2026-11-20', kg: 77.0 },
    ],
  });
  assert.deepEqual(
    pesosPorDia(datos).map((p) => p.kg),
    [78.9, 77.6, 77.0],
  );
  assert.equal(pesoDelDia([]), null);
  assert.deepEqual(serieComposicion(datos), [{ fecha: '2026-11-19', grasa: 23.1, magra: 59.7 }]);
  // Apuntar a mano cambia solo el peso manual del día; los de la báscula se quedan.
  const otra = apuntarPeso(datos, '2026-11-20', 76.8);
  assert.equal(otra.pesos.filter((p) => p.fecha === '2026-11-20').length, 2);
  assert.equal(pesosPorDia(otra).at(-1).kg, 76.8);
});

test('aplicar: los pasos reemplazan el total del día y un pesaje repetido no se duplica', () => {
  let datos = normalizarForma({ perfil: { peso: 78 }, dias: { '2026-11-19': { agua: 1500, suplementos: ['u1'] } } });
  const envio = { recibido: AHORA, dias: [{ fecha: '2026-11-19', pasos: 9000 }], pesaje: { momento: Date.parse('2026-11-20T07:12:00Z'), kg: 77.55, grasa: 22.9 } };
  let r = aplicarSalud(datos, envio, { ahora: AHORA });
  assert.deepEqual(r.resultado, { pasos: 1, pesaje: 'guardado', errores: [] });
  datos = normalizarForma(r.datos);
  assert.equal(datos.dias['2026-11-19'].agua, 1500);
  assert.deepEqual(datos.dias['2026-11-19'].suplementos, ['u1']);
  r = aplicarSalud(datos, { ...envio, dias: [{ fecha: '2026-11-19', pasos: 11234 }], pesaje: { ...envio.pesaje, momento: envio.pesaje.momento + 30_000 } }, { ahora: AHORA });
  assert.equal(r.resultado.pesaje, 'duplicado');
  datos = normalizarForma(r.datos);
  assert.equal(datos.dias['2026-11-19'].pasos, 11234);
  assert.equal(datos.pesos.length, 1);
  assert.equal(datos.pesos[0].hora, '08:12');
  assert.equal(datos.pesos[0].fuente, 'apple_salud');
  // Lo que llega mal del buzón no se aplica.
  assert.equal(aplicarSalud(datos, { recibido: AHORA, dias: [{ fecha: '2026-11-19', pasos: -1 }] }, { ahora: AHORA }).resultado.pesaje, 'no_valido');
});

test('pasos en el objetivo: días pasados con los reales; hoy solo suma', () => {
  const base = normalizarForma({ perfil: { sexo: 'hombre', nacimiento: '1995-01-01', altura: 178, peso: 78, pasos: '5-8', objetivo: 'perder' }, pesos: [{ fecha: '2026-11-01', kg: 78 }] });
  const con = (pasos, fecha) => normalizarForma({ ...base, dias: { [fecha]: { pasos, pasosFuente: 'apple_salud' } } });
  const ayer = '2026-11-19';
  const hoy = '2026-11-20';
  const sin = objetivoDelDia(base, ayer, undefined, hoy);
  const muchos = objetivoDelDia(con(14000, ayer), ayer, undefined, hoy);
  const pocos = objetivoDelDia(con(2000, ayer), ayer, undefined, hoy);
  // 7.500 pasos más que la estimación del perfil (6.500): 7.500 × 78 kg × 0,0005 ≈ 293 kcal.
  assert.equal(muchos.kcal - sin.kcal, 293);
  assert.equal(muchos.pasos, 14000);
  assert.ok(pocos.kcal < sin.kcal);
  // Hoy va a medias: 2.000 pasos por la mañana no quitan nada.
  assert.equal(objetivoDelDia(con(2000, hoy), hoy, undefined, hoy).kcal, objetivoDelDia(base, hoy, undefined, hoy).kcal);
  assert.ok(pasosExtraDelDia(con(14000, hoy), hoy, hoy).kcal > 0);
  assert.deepEqual(pasosExtraDelDia(base, hoy, hoy), { kcal: 0, pasos: null, fuente: null });
  assert.equal(mediaPasos(normalizarForma({ dias: { '2026-11-17': { pasos: 8000 }, '2026-11-18': { pasos: 9000 }, '2026-11-19': { pasos: 10000 } } }), hoy), 9000);
});

test('buzón: cifrado de un solo uso que solo abre la llave privada', async () => {
  const llave = await crearLlaveBuzon();
  const otra = await crearLlaveBuzon();
  const sobre = await cifrarParaBuzon(llave.publica, { dias: [{ fecha: '2026-11-20', pasos: 4321 }] });
  assert.doesNotMatch(JSON.stringify(sobre), /4321/);
  assert.deepEqual(await descifrarDelBuzon(llave.privada, sobre), { dias: [{ fecha: '2026-11-20', pasos: 4321 }] });
  await assert.rejects(descifrarDelBuzon(otra.privada, sobre));
  // La llave sobrevive a normalizar los datos (viaja cifrada con la sincronización).
  const datos = normalizarForma({ integracion: llave });
  assert.deepEqual(await descifrarDelBuzon(datos.integracion.privada, sobre), { dias: [{ fecha: '2026-11-20', pasos: 4321 }] });
  // «Última sincronización» solo cambia por un envío más reciente.
  let d = anotarUltima(datos, { recibido: 2000, dias: [], pesaje: null, resultado: 'no_enviado' });
  d = anotarUltima(d, { recibido: 1000, dias: [{ fecha: '2026-11-20', pasos: 1 }], resultado: 'guardado' });
  assert.equal(normalizarForma(d).integracion.ultima.recibido, 2000);
});
