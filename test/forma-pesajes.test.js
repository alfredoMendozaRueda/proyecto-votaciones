// Pesajes excluidos de la media, regeneración del resumen semanal al tocar
// pesajes y aviso de que el Atajo de Apple Salud lleva tiempo sin ejecutarse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarForma } from '../src/compartido/forma/datos.js';
import { sumarDias } from '../src/compartido/forma/fechas.js';
import { excluirPeso, excluirAnteriores, borrarPeso } from '../src/compartido/forma/acciones.js';
import { pesoDeReferencia, ritmoReal, mediasSemanales, serieMedia, pesajesExcluidos, estadoHito } from '../src/compartido/forma/progreso.js';
import { metricasSemana, generarResumen } from '../src/compartido/forma/semanas.js';

const PERFIL = { sexo: 'hombre', nacimiento: '1995-01-01', altura: 178, peso: 80, objetivo: 'perder', ritmo: 'moderado', pesoObjetivo: 70, zona: 'Europe/Madrid', diasEntreno: 4 };
const base = (extra = {}) => normalizarForma({ perfil: PERFIL, ...extra });
const semana = (lunes, kgs, extra = {}) => kgs.map((kg, i) => (kg === null ? null : { id: `w${lunes}${i}`, fecha: sumarDias(lunes, i), kg, ...extra })).filter(Boolean);
const L1 = '2026-11-02';
const L2 = '2026-11-09';
const L3 = '2026-11-16';
const HOY = '2026-11-23';

test('excluir: el campo se guarda (los pesajes antiguos cuentan) y el motivo es opcional', () => {
  const d = base({ pesos: [{ id: 'a', fecha: L1, kg: 80 }, { id: 'b', fecha: L2, kg: 79, excluido: true, motivoExclusion: 'báscula antigua' }, { id: 'c', fecha: L3, kg: 78, excluido: 'sí', motivoExclusion: 'x' }] });
  assert.equal(d.pesos[0].excluido, undefined);
  assert.deepEqual([d.pesos[1].excluido, d.pesos[1].motivoExclusion], [true, 'báscula antigua']);
  // Solo «true» excluye; sin excluir, el motivo no se guarda.
  assert.deepEqual([d.pesos[2].excluido, d.pesos[2].motivoExclusion], [undefined, undefined]);
  const sinMotivo = normalizarForma(excluirPeso(d, 'a', true, '', HOY));
  assert.deepEqual([sinMotivo.pesos[0].excluido, sinMotivo.pesos[0].motivoExclusion], [true, undefined]);
  const otraVez = normalizarForma(excluirPeso(sinMotivo, 'b', false, '', HOY));
  assert.deepEqual([otraVez.pesos[1].excluido, otraVez.pesos[1].motivoExclusion], [undefined, undefined]);
});

test('excluir: cambia la media de 7 días, el ritmo y la media semanal, pero se sigue viendo', () => {
  // Báscula antigua: marca 1,5 kg de más. Del 12 al 15 de noviembre, las dos a la vez.
  const viejas = semana(L2, [81.5, 81.4, 81.3, 81.3, 81.2, 81.1, 81.0]).map((p) => ({ ...p, id: `v${p.id}`, hora: '07:00' }));
  const nuevas = semana(L2, [null, null, null, 79.8, 79.7, 79.6, 79.5], { fuente: 'apple_salud', hora: '07:30' });
  const tercera = semana(L3, [79.4, 79.3, 79.3, 79.2, 79.1, 79.0, 79.0], { fuente: 'apple_salud', hora: '07:30' });
  let d = base({ pesos: [...semana(L1, Array(7).fill(81.6)).map((p) => ({ ...p, id: `x${p.id}` })), ...viejas, ...nuevas, ...tercera] });
  const antes = { ref: pesoDeReferencia(d, '2026-11-15'), semana2: mediasSemanales(d).find((s) => s.lunes === L2).media };
  // A mano manda el apuntado a mano: los días con las dos básculas cuenta la vieja.
  assert.ok(antes.semana2 > 81);
  const r = excluirAnteriores(d, L3 /* todo lo anterior al 16 */, 'báscula antigua', HOY);
  assert.equal(r.cambiados, 18);
  d = normalizarForma(r.datos);
  // Lo de la báscula nueva de esa semana sí sigue (también era anterior al 16)… así que
  // se vuelve a meter a mano: es lo que harías desde «Pesos apuntados».
  for (const p of nuevas) d = normalizarForma(excluirPeso(d, p.id, false, '', HOY));
  assert.equal(pesajesExcluidos(d).length, 14);
  const s2 = mediasSemanales(d).find((s) => s.lunes === L2);
  assert.deepEqual([s2.media, s2.n], [79.65, 4]); // solo la báscula nueva
  assert.ok(Math.abs(pesoDeReferencia(d, '2026-11-15') - 79.65) < 0.001);
  assert.notEqual(pesoDeReferencia(d, '2026-11-15'), antes.ref);
  // La serie que se pinta solo lleva los que cuentan; los excluidos van aparte, en gris.
  assert.ok(serieMedia(d).every((p) => p.fecha >= sumarDias(L2, 3)));
  assert.equal(pesajesExcluidos(d)[0].fecha, L1);
  // Ritmo: sin la semana 1 (excluida) no hay 2 semanas de historia.
  assert.equal(ritmoReal(d, HOY, 2), null);
  assert.notEqual(ritmoReal(base({ pesos: r.datos.pesos.map(({ excluido: _e, motivoExclusion: _m, ...p }) => p) }), HOY, 2), null);
});

test('excluir: los hitos dejan de contar con pesajes excluidos (y vuelven si los recuperas)', () => {
  const pesos = [...semana(L1, Array(7).fill(76.5)), ...semana(L2, Array(7).fill(75.6), { fuente: 'apple_salud' }), ...semana(L3, Array(7).fill(76.4))];
  let d = base({ pesos, hitos: [{ id: 'h76', tipo: 'peso', comparador: '<', valor: 76, recompensa: 'Burger Lab' }] });
  // Con todo, la semana 2 (75,6) lo consigue.
  d = normalizarForma(generarResumen(d, L2, { ahora: 1 }).datos);
  assert.equal(d.hitos[0].semana, L2);
  // La semana 2 era de la báscula que marcaba de menos: fuera.
  for (const p of pesos.filter((x) => x.fuente)) d = normalizarForma(excluirPeso(d, p.id, true, 'báscula antigua', HOY));
  assert.equal(d.hitos[0].cumplido, null);
  assert.equal(d.hitos[0].semana, undefined);
  assert.equal(estadoHito(d, d.hitos[0], HOY).cumple, false);
  // Y el resumen de esa semana ya no tiene pesajes.
  assert.equal(metricasSemana(d, L2).peso.n, 0);
  // Se recuperan: vuelve a estar conseguido, con su semana.
  for (const p of pesos.filter((x) => x.fuente)) d = normalizarForma(excluirPeso(d, p.id, false, '', HOY));
  assert.deepEqual([d.hitos[0].semana, d.hitos[0].cumplido], [L2, sumarDias(L2, 6)]);
  // Borrar los pesajes que lo consiguieron también lo deshace.
  for (const p of pesos.filter((x) => x.fuente)) d = normalizarForma(borrarPeso(d, p.id, HOY));
  assert.equal(d.hitos[0].cumplido, null);
});

test('excluir anteriores: no toca los que ya estaban excluidos (ni su motivo)', () => {
  const d = base({ pesos: [{ id: 'a', fecha: L1, kg: 80, excluido: true, motivoExclusion: 'con ropa' }, { id: 'b', fecha: L2, kg: 80 }, { id: 'c', fecha: L3, kg: 79 }] });
  const r = excluirAnteriores(d, L3, 'báscula antigua', HOY);
  assert.equal(r.cambiados, 1);
  assert.deepEqual(
    normalizarForma(r.datos).pesos.map((p) => [p.id, p.excluido ?? false, p.motivoExclusion ?? '']),
    [
      ['a', true, 'con ropa'],
      ['b', true, 'báscula antigua'],
      ['c', false, ''],
    ],
  );
  assert.equal(excluirAnteriores(r.datos, L3, 'báscula antigua', HOY).cambiados, 0);
});

test('excluir: no deshace hitos que no dependían de esos pesajes', () => {
  // Conseguido a mano (o con la regla antigua del pesaje suelto): la media nunca bajó de 76.
  const d = base({ pesos: semana(L2, Array(7).fill(77)), hitos: [{ id: 'h76', tipo: 'peso', comparador: '<', valor: 76, cumplido: '2026-10-01' }] });
  const r = normalizarForma(excluirPeso(d, d.pesos[0].id, true, '', HOY));
  assert.equal(r.hitos[0].cumplido, '2026-10-01');
  assert.equal(normalizarForma(borrarPeso(d, d.pesos[1].id, HOY)).hitos[0].cumplido, '2026-10-01');
});

test('resumen semanal: se regenera solo al añadir, excluir o borrar un pesaje de su semana', async () => {
  const { semanasConPesajesCambiados, regenerarPorPesajes } = await import('../src/compartido/forma/semanas.js');
  const { aplicarSalud } = await import('../src/compartido/forma/salud.js');
  let d = base({ pesos: [...semana(L1, Array(7).fill(80)), ...semana(L2, [79.6, 79.5, null, 79.4, null, 79.3, null])] });
  d = normalizarForma(generarResumen(d, L1, { ahora: 1 }).datos);
  d = normalizarForma(generarResumen(d, L2, { ahora: 2 }).datos);
  const foto = (x, l) => x.resumenes.find((r) => r.id === l);
  assert.equal(foto(d, L2).datos.peso.n, 4);
  // Nada cambia en los pesos: nada que regenerar (aunque cambien otras cosas).
  assert.deepEqual(semanasConPesajesCambiados(d, { ...d, registros: [] }), []);
  assert.deepEqual(semanasConPesajesCambiados(d, normalizarForma(d)), []);

  // 1) Llega por Apple Salud el pesaje del miércoles de la semana 2 (el Atajo no se ejecutó ese día).
  const antes = d;
  const { datos: conSalud } = aplicarSalud(d, { recibido: Date.parse('2026-11-20T21:00:00Z'), pesajes: [{ momento: Date.parse(`${sumarDias(L2, 2)}T06:30:00Z`), kg: 79.45 }] }, { ahora: Date.parse('2026-11-20T21:00:00Z') });
  assert.deepEqual(semanasConPesajesCambiados(antes, conSalud), [L2]);
  let r = regenerarPorPesajes(antes, conSalud, { ahora: 3 });
  d = normalizarForma(r.datos);
  assert.deepEqual(r.semanas, [L2]);
  assert.equal(foto(d, L2).datos.peso.n, 5);
  assert.equal(foto(d, L2).generado, 3);
  assert.equal(foto(d, L1).generado, 1); // la otra semana no se toca

  // 2) Excluir uno de la semana 1 regenera la 1 y también la 2 (su cambio se mide contra la 1).
  const excluido = normalizarForma(excluirPeso(d, d.pesos.find((p) => p.fecha === L1).id, true, '', HOY));
  r = regenerarPorPesajes(d, excluido, { ahora: 4 });
  assert.deepEqual(r.semanas, [L1, L2]);
  d = normalizarForma(r.datos);
  assert.equal(foto(d, L1).datos.peso.n, 6);
  assert.deepEqual([foto(d, L1).generado, foto(d, L2).generado], [4, 4]);

  // 3) Borrar uno de la semana 2: vuelve a 4 pesajes.
  const borrado = normalizarForma(borrarPeso(d, d.pesos.find((p) => p.fecha === sumarDias(L2, 2)).id, HOY));
  r = regenerarPorPesajes(d, borrado, { ahora: 5 });
  assert.deepEqual(r.semanas, [L2]);
  assert.equal(foto(normalizarForma(r.datos), L2).datos.peso.n, 4);

  // Una semana sin resumen no se genera por esto (eso lo hace el domingo).
  const nuevaSemana = normalizarForma({ ...d, pesos: [...d.pesos, { id: 'z', fecha: L3, kg: 79 }] });
  assert.deepEqual(semanasConPesajesCambiados(d, nuevaSemana), []);
});

test('aviso del Atajo: más de 36 h sin ejecutarse, con lo recogido o lo que espera en el servidor', async () => {
  const { avisoAtajo } = await import('../src/compartido/forma/salud.js');
  const H = 3_600_000;
  const ahora = Date.parse('2026-11-23T10:00:00Z');
  const token = { id: 't1', revocado: false, creado_en: ahora - 30 * 24 * H };
  // 36 h justas: todavía no; 37 h: sí, con las horas en el texto.
  assert.equal(avisoAtajo({ ultima: { recibido: ahora - 36 * H }, tokens: [token] }, ahora), null);
  const a = avisoAtajo({ ultima: { recibido: ahora - 37 * H - 5 * 60_000 }, tokens: [token] }, ahora);
  assert.equal(a.horas, 37);
  assert.equal(a.texto, 'El atajo de Apple Salud no se ha ejecutado desde hace 37 h. Ábrelo o ejecútalo a mano.');
  // Si llegó algo al servidor que la app aún no ha recogido, cuenta eso.
  assert.equal(avisoAtajo({ ultima: { recibido: ahora - 50 * H }, ultimoEnvio: ahora - 2 * H, tokens: [token] }, ahora), null);
  // Sin token activo (revocado o sin montar), no se avisa.
  assert.equal(avisoAtajo({ ultima: { recibido: ahora - 99 * H }, tokens: [{ ...token, revocado: true }] }, ahora), null);
  assert.equal(avisoAtajo({ tokens: [] }, ahora), null);
  // Sin saber del servidor (sin conexión): con lo último recogido; si nunca llegó nada, nada.
  assert.equal(avisoAtajo({ ultima: { recibido: ahora - 40 * H } }, ahora).horas, 40);
  assert.equal(avisoAtajo({}, ahora), null);
  // Token creado y el Atajo nunca ha mandado nada: cuenta desde que se creó.
  assert.equal(avisoAtajo({ tokens: [{ ...token, creado_en: ahora - 48 * H }] }, ahora).horas, 48);
  assert.equal(avisoAtajo({ tokens: [{ ...token, creado_en: ahora - 2 * H }] }, ahora), null);
});
