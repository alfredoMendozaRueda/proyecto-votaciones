// «Cristal líquido»: la física de los gestos (fluidez.js) y que las hojas de
// estilo traen sus muelles bien formados y respetan la accesibilidad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proyectar, elastico } from '../src/app/fluidez.js';

const css = (ruta) => readFileSync(new URL(`../src/app/${ruta}`, import.meta.url), 'utf8');

test('proyección del impulso: la de Apple (decaimiento exponencial), simétrica y proporcional', () => {
  // 1000 px/s con deceleración 0,998 → ~499 px más allá.
  assert.ok(Math.abs(proyectar(1000) - 499) < 1);
  assert.equal(proyectar(0), 0);
  assert.equal(proyectar(-800), -proyectar(800));
  assert.ok(proyectar(2000) > proyectar(1000));
  // Más «rápida» (0,99): mucho menos recorrido.
  assert.ok(proyectar(1000, 0.99) < proyectar(1000) / 4);
});

test('borde elástico: sigue menos cuanto más te pasas, sin llegar nunca al tamaño entero', () => {
  const alto = 400;
  let previo = 0;
  for (const exceso of [10, 50, 100, 300, 1000, 5000]) {
    const v = elastico(exceso, alto);
    assert.ok(v > previo, `crece (${exceso})`);
    assert.ok(v < exceso, 'siempre menos que el dedo');
    assert.ok(v < alto, 'tope por debajo del tamaño');
    previo = v;
  }
  // Al principio casi 1:1 (para que se note que responde), luego frena.
  assert.ok(elastico(5, alto) / 5 > 0.5);
  assert.ok(elastico(1000, alto) / 1000 < 0.25);
  assert.equal(elastico(-100, alto), -elastico(100, alto));
});

test('muelles: curvas linear() que empiezan en 0, acaban en 1 y con el rebote justo', () => {
  const k = css('cristal.css');
  const muelles = Object.fromEntries([...k.matchAll(/--muelle-([a-z]+): linear\(([^)]+)\);/g)].map(([, n, v]) => [n, v.split(',').map(Number)]));
  assert.deepEqual(Object.keys(muelles).sort(), ['hoja', 'rapido', 'rebote', 'suave']);
  for (const [nombre, v] of Object.entries(muelles)) {
    assert.equal(v[0], 0, nombre);
    assert.equal(v.at(-1), 1, nombre);
    assert.ok(v.every(Number.isFinite), nombre);
  }
  // Críticos (ζ = 1): nunca se pasan. El de rebote se pasa un poco (< 3 %).
  assert.ok(Math.max(...muelles.suave) <= 1);
  assert.ok(Math.max(...muelles.rapido) <= 1);
  assert.ok(Math.max(...muelles.rebote) > 1 && Math.max(...muelles.rebote) < 1.03);
  // Cada muelle trae su duración.
  for (const n of Object.keys(muelles)) assert.match(k, new RegExp(`--muelle-${n}-ms: \\d+ms;`));
});

test('accesibilidad: menos movimiento, menos transparencia y más contraste en Kitsune y en Forma', () => {
  for (const ruta of ['cristal.css', 'forma/cristal.css']) {
    const c = css(ruta);
    assert.match(c, /@media \(prefers-reduced-motion: reduce\)/, ruta);
    assert.match(c, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*backdrop-filter: none/, ruta);
    assert.match(c, /@media \(prefers-contrast: more\)/, ruta);
    // Safari necesita el prefijo en cada desenfoque.
    const sin = [...c.matchAll(/^\s*backdrop-filter: (?!none)/gm)].length;
    const con = [...c.matchAll(/-webkit-backdrop-filter: (?!none)/g)].length;
    assert.equal(con, sin, `${ruta}: -webkit-backdrop-filter en todos`);
  }
});
