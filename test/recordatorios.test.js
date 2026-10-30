import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Recordatorios } from '../src/compartido/recordatorios.js';

function crear() {
  let datos = [];
  const avisados = [];
  const r = new Recordatorios({
    leer: async () => datos,
    guardar: async (lista) => {
      datos = JSON.parse(JSON.stringify(lista));
    },
    avisar: (rec) => avisados.push(rec.texto),
  });
  return { r, avisados, datos: () => datos };
}

test('crea, lista en orden y borra recordatorios', async () => {
  const { r } = crear();
  const tarde = await r.crear({ texto: 'Llamar a Lucía', cuando: new Date(Date.now() + 3_600_000).toISOString() });
  await r.crear({ texto: 'Regar las plantas', cuando: Date.now() + 600_000 });
  assert.deepEqual((await r.listar()).map((x) => x.texto), ['Regar las plantas', 'Llamar a Lucía']);
  await r.borrar(tarde.id);
  assert.equal((await r.listar()).length, 1);
  await assert.rejects(r.borrar('rnoexiste'), /No encuentro/);
  clearTimeout(r.temporizador);
});

test('rechaza textos vacíos, fechas inválidas o pasadas', async () => {
  const { r } = crear();
  await assert.rejects(r.crear({ texto: '  ', cuando: Date.now() + 1000 }), /texto/);
  await assert.rejects(r.crear({ texto: 'x', cuando: 'mañana' }), /no es válida/);
  await assert.rejects(r.crear({ texto: 'x', cuando: Date.now() - 3_600_000 }), /ya ha pasado/);
});

test('avisa una sola vez de los vencidos al programar', async () => {
  const { r, avisados, datos } = crear();
  await r.crear({ texto: 'Ya', cuando: Date.now() + 10 });
  await new Promise((ok) => setTimeout(ok, 400));
  await r.programar();
  assert.deepEqual(avisados, ['Ya']);
  assert.equal((await r.listar()).length, 0);
  assert.equal(datos()[0].avisado, true);
  clearTimeout(r.temporizador);
});
