import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerJson, analizarCV, buscarOfertas, evaluarEncaje, leerOferta, adaptarCV, normalizarDatosEmpleo } from '../src/compartido/empleo.js';

// IA de mentira: responde en orden y apunta lo que se le pide.
function iaFalsa(respuestas) {
  const pedidas = [];
  const ia = async (peticion) => {
    pedidas.push(peticion);
    const r = respuestas.shift();
    return { texto: typeof r === 'string' ? r : JSON.stringify(r), fuentes: [] };
  };
  return { ia, pedidas };
}

const CV = 'Lucía Pérez · lucia@correo.es · Madrid\nDesarrolladora frontend con 5 años de experiencia en React y TypeScript.\nAcme (2020-2025): lideré la migración a React 18 y reduje el tiempo de carga un 40 %.';
const PERFIL = {
  nombre: 'Lucía Pérez', titular: 'Desarrolladora frontend', ubicacion: 'Madrid', email: 'lucia@correo.es', telefono: '',
  resumen: 'Frontend con 5 años en React.', experiencia: [{ puesto: 'Frontend', empresa: 'Acme', inicio: '2020', fin: '2025', logros: ['Migró a React 18', 'Redujo la carga un 40 %'] }],
  formacion: [], habilidades: ['React', 'TypeScript'], idiomas: ['Inglés (C1)'], puestosObjetivo: ['Frontend senior'], nivel: 'senior',
};

test('empleo: extraer JSON con texto y bloques de código alrededor', () => {
  assert.deepEqual(extraerJson('Aquí tienes:\n```json\n{"a": "x}y", "b": [1, {"c": 2}]}\n```\nSuerte.'), { a: 'x}y', b: [1, { c: 2 }] });
  assert.throws(() => extraerJson('sin datos'), /formato/);
});

test('empleo: analizar el CV no inventa contacto y avisa si está vacío', async () => {
  const { ia, pedidas } = iaFalsa([{ ...PERFIL, experiencia: [...PERFIL.experiencia, { puesto: '', empresa: '' }], extra: 'x' }]);
  const perfil = await analizarCV(ia, CV);
  assert.equal(perfil.nombre, 'Lucía Pérez');
  assert.equal(perfil.experiencia.length, 1);
  assert.match(pedidas[0].usuario, /<cv>/);
  assert.equal(pedidas[0].web, undefined);
  await assert.rejects(analizarCV(ia, 'hola'), /casi vacío/);
});

test('empleo: buscar con web, sin ofertas sin enlace ni repetidas, y ordenar por encaje', async () => {
  const { ia, pedidas } = iaFalsa([
    { ofertas: [
      { puesto: 'Frontend Senior', empresa: 'Beta', url: 'https://www.infojobs.net/madrid/frontend/of-i123', requisitos: ['React'] },
      { puesto: 'Sin enlace', empresa: 'X' },
      { puesto: 'Frontend Senior', empresa: 'Beta', url: 'https://www.infojobs.net/madrid/frontend/of-i123' },
    ] },
    { ofertas: [
      { puesto: 'Frontend Senior', empresa: 'Beta', url: 'https://www.infojobs.net/madrid/frontend/of-i123' },
      { puesto: 'React Developer', empresa: 'Gamma', url: 'https://es.linkedin.com/jobs/view/42' },
    ] },
  ]);
  const { ofertas } = await buscarOfertas(ia, PERFIL, { puestos: 'Frontend', modalidad: 'remoto' });
  assert.equal(pedidas[0].web, true);
  assert.match(pedidas[0].usuario, /Modalidad: remoto/);
  assert.deepEqual(ofertas.map((o) => o.empresa), ['Beta', 'Gamma']);
  assert.equal(ofertas[0].fuente, 'infojobs.net');
  assert.equal(pedidas.length, 2);
  assert.match(pedidas[1].sistema, /Tecnoempleo/);
  // Si una búsqueda falla, vale la otra; si fallan las dos, se dice por qué.
  const mitad = await buscarOfertas(iaFalsa(['nada', { ofertas: [{ puesto: 'QA', empresa: 'Z', url: 'https://z.es/1' }] }]).ia, PERFIL, {});
  assert.equal(mitad.ofertas.length, 1);
  await assert.rejects(buscarOfertas(iaFalsa(['nada', 'nada']).ia, PERFIL, {}), /No he encontrado ofertas/);
  const evaluadas = await evaluarEncaje(iaFalsa([{ evaluaciones: [{ id: ofertas[0].id, encaje: 61 }, { id: ofertas[1].id, encaje: 88, motivos: ['React'] }] }]).ia, PERFIL, ofertas);
  assert.deepEqual(evaluadas.map((o) => [o.empresa, o.encaje]), [['Gamma', 88], ['Beta', 61]]);
});

test('empleo: leer una oferta por enlace usa la web; por texto, no', async () => {
  const { ia, pedidas } = iaFalsa([{ puesto: 'Frontend', empresa: 'Delta', descripcion: 'Buscamos…' }, { error: 'página privada' }]);
  const o = await leerOferta(ia, 'https://delta.es/empleo/1');
  assert.equal(o.url, 'https://delta.es/empleo/1');
  assert.equal(pedidas[0].web, true);
  await assert.rejects(leerOferta(ia, 'Texto de una oferta: puesto de frontend en Delta…'), /privada/);
  assert.equal(pedidas[1].web, false);
});

test('empleo: adaptar en dos pasos (redactor y revisor) con el contacto del CV original', async () => {
  const cvAdaptado = { ...PERFIL, titular: 'Frontend senior (React)', email: 'otro@inventado.es' };
  const { ia, pedidas } = iaFalsa([
    { cv: cvAdaptado, carta: 'Estimado equipo de Gamma…', palabrasClave: ['React'] },
    { cv: { ...cvAdaptado, resumen: 'Pulido' }, carta: 'Hola, equipo de Gamma…', notas: ['Quitado un dato sin respaldo'], encaje: 90 },
  ]);
  const pasos = [];
  const r = await adaptarCV(ia, PERFIL, { puesto: 'React Developer', empresa: 'Gamma', requisitos: [], descripcion: 'React' }, { alPaso: (p) => pasos.push(p) });
  assert.deepEqual(pasos, ['redactar', 'revisar']);
  assert.equal(r.cv.email, 'lucia@correo.es');
  assert.equal(r.cv.resumen, 'Pulido');
  assert.equal(r.encaje, 90);
  assert.match(pedidas[1].usuario, /<cv_original>/);
  assert.match(pedidas[0].sistema, /PROHIBIDO inventar/);
  // Si el revisor devuelve basura, vale el borrador.
  const { ia: ia2 } = iaFalsa([{ cv: cvAdaptado, carta: 'Carta' }, 'no sé']);
  const r2 = await adaptarCV(ia2, PERFIL, { puesto: 'X', empresa: 'Y', requisitos: [] });
  assert.equal(r2.carta, 'Carta');
  assert.match(r2.notas[0], /revisión/);
});

test('empleo: datos guardados se limpian', () => {
  const d = normalizarDatosEmpleo({ cv: { archivo: 'cv.pdf', texto: CV, perfil: PERFIL }, preferencias: { modalidad: 'marte' }, postulaciones: [{ id: 'p1', estado: 'enviada', oferta: { puesto: 'X' }, cv: PERFIL, carta: 'Hola' }] });
  assert.equal(d.preferencias.modalidad, '');
  assert.equal(d.postulaciones[0].estado, 'enviada');
  assert.equal(d.postulaciones[0].carta, 'Hola');
  assert.equal(normalizarDatosEmpleo({}).cv, null);
});
