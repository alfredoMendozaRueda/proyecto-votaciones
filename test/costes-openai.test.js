import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costeRealOpenAI, ErrorCostes } from '../src/compartido/costes-openai.js';

const respuesta = (status, cuerpo) => ({ status, ok: status >= 200 && status < 300, json: async () => cuerpo });
const cubo = (dia, ...valores) => ({ start_time: Date.UTC(2026, 10, dia) / 1000, results: valores.map((v) => ({ amount: { value: v, currency: 'usd' } })) });

test('costes reales: suma los días del mes, pasa de página y usa la clave de administrador', async () => {
  const llamadas = [];
  const fetch = async (url, opciones) => {
    llamadas.push({ url, auth: opciones.headers.Authorization });
    return new URL(url).searchParams.get('page')
      ? respuesta(200, { data: [cubo(3, 0.5)], has_more: false })
      : respuesta(200, { data: [cubo(1, 0.1, 0.02), cubo(2, 0.3)], has_more: true, next_page: 'p2' });
  };
  const r = await costeRealOpenAI({ claveAdmin: 'sk-admin-x', fetch, ahora: new Date(2026, 10, 6) });
  assert.equal(r.usd, 0.92);
  assert.deepEqual(r.dias.map((d) => d.fecha), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[0].auth, 'Bearer sk-admin-x');
  const params = new URL(llamadas[0].url).searchParams;
  assert.equal(params.get('bucket_width'), '1d');
  assert.equal(Number(params.get('start_time')), new Date(2026, 10, 1).getTime() / 1000);
});

test('costes reales: errores claros (sin clave, clave no válida, sin permiso)', async () => {
  await assert.rejects(costeRealOpenAI({ claveAdmin: '' }), ErrorCostes);
  await assert.rejects(costeRealOpenAI({ claveAdmin: 'sk-x', fetch: async () => respuesta(401, {}) }), /no acepta esa clave/);
  await assert.rejects(costeRealOpenAI({ claveAdmin: 'sk-x', fetch: async () => respuesta(403, {}) }), /permiso/);
  await assert.rejects(costeRealOpenAI({ claveAdmin: 'sk-x', fetch: async () => { throw new TypeError('red'); } }), /No se pudo hablar/);
});
