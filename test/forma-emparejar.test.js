import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNombre, palabras, raiz, clavesDe, jaccard, emparejarAlimento, emparejarEjercicio, limpiarAlias, parecidos } from '../src/compartido/forma/emparejar.js';
import { fusionarAlimentos, fusionarEjercicios, posiblesDuplicados, noSonElMismo, catalogoParaIA, anadirAlias, ErrorFusion, INSTRUCCION_CATALOGO } from '../src/compartido/forma/catalogo.js';
import { leerImportacion, aplicarImportacion, resolverPlan } from '../src/compartido/forma/importar.js';
import { normalizarForma, grupoDesdeTexto, ejercicioAjustado, EJERCICIOS_POR_DEFECTO } from '../src/compartido/forma/datos.js';
import { coleccionForma } from '../src/compartido/sincro.js';

const HOY = '2026-11-16';
const OPC = { hoy: HOY, ahoraMin: 13 * 60 };
const P = (kcal, proteina, hidratos = 5, grasa = 2) => ({ kcal, proteina, hidratos, grasa });
const YOGUR = { id: 'a-yogur', nombre: 'Yogur de fresa proteico', marca: '', racion: 120, por100: P(64, 10) };

const con = (alimentos, extra = {}) => normalizarForma({ alimentos, ...extra });
const importar = (d, obj) => leerImportacion(d, JSON.stringify({ forma_import: 1, ...obj }), OPC);

// ---------- Normalización ----------

test('emparejar: normaliza sin mayúsculas, tildes, signos ni palabras vacías y con las palabras ordenadas', () => {
  assert.equal(normalizarNombre('Yogur de fresa PROTEICO'), 'fresa proteico yogur');
  assert.equal(normalizarNombre('proteico, fresa — yogur'), 'fresa proteico yogur');
  assert.equal(normalizarNombre('Pechuga de pavo con la piel y el hueso al horno'), 'horno hueso pavo pechuga piel');
  assert.equal(normalizarNombre('Café (con leche) 0%'), '0 cafe leche');
  assert.deepEqual(palabras('Jalón al pecho'), ['jalon', 'pecho']);
});

test('emparejar: lematización simple (proteico/proteínas → prote, plurales fuera)', () => {
  assert.equal(raiz('proteico'), 'prote');
  assert.equal(raiz('proteinas'), 'prote');
  assert.equal(raiz('fresas'), 'fresa');
  assert.equal(raiz('100'), '100');
  assert.deepEqual([...clavesDe('Yogur proteínas fresa')].sort(), [...clavesDe('Yogur de fresa proteico')].sort());
  assert.equal(jaccard(clavesDe('Yogur proteínas fresa'), clavesDe('Yogur de fresa proteico')), 1);
  assert.ok(jaccard(clavesDe('Peso muerto'), clavesDe('Press banca')) < 0.2);
});

test('emparejar: los nutrientes «parecidos» son a menos de un 10 %', () => {
  assert.ok(parecidos(100, 109));
  assert.ok(!parecidos(100, 112));
  assert.ok(parecidos(0, 0));
  assert.ok(!parecidos(undefined, 5));
});

test('emparejar: los alias se limpian (sin repetir, sin el propio nombre, máximo 20)', () => {
  assert.deepEqual(limpiarAlias(['Yogur fresa proteico', ' yogur  FRESA proteico ', 'Skyr fresa', '', 7], 'Yogur de fresa proteico'), ['Skyr fresa']);
  assert.equal(limpiarAlias(Array.from({ length: 30 }, (_, i) => `Alias ${i}`)).length, 20);
});

// ---------- Niveles de emparejamiento ----------

test('emparejar alimentos: nivel 1, por id (gana aunque el nombre sea otro)', () => {
  const d = con([YOGUR, { id: 'a-otro', nombre: 'Leche', racion: 200, por100: P(46, 3) }]);
  const e = emparejarAlimento(d.alimentos, { id: 'a-yogur', nombre: 'Leche', por100: P(46, 3) });
  assert.equal(e.nivel, 'id');
  assert.equal(e.existente.id, 'a-yogur');
});

test('emparejar alimentos: un id que no existe avisa y sigue por nombre', () => {
  const d = con([YOGUR]);
  const e = emparejarAlimento(d.alimentos, { id: 'a-borrado', nombre: 'Yogur de fresa proteico' });
  assert.equal(e.nivel, 'nombre');
  assert.match(e.avisos[0], /el id «a-borrado» no existe; lo busco por nombre/);
});

test('emparejar alimentos: nivel 2, por código de barras (ean)', () => {
  const d = con([{ ...YOGUR, codigo: '8410000000001' }]);
  const e = emparejarAlimento(d.alimentos, { ean: '8410000000001', nombre: 'Otro nombre cualquiera' });
  assert.equal(e.nivel, 'ean');
  assert.equal(e.existente.id, 'a-yogur');
});

test('emparejar alimentos: nivel 3, nombre normalizado y marca', () => {
  const d = con([{ ...YOGUR, marca: 'Danone' }]);
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'fresa proteico, yogur', marca: 'DANONE' }).nivel, 'nombre');
  // Con otra marca no es el mismo por nombre.
  assert.notEqual(emparejarAlimento(d.alimentos, { nombre: 'Yogur de fresa proteico', marca: 'Hacendado', por100: P(64, 10) }).nivel, 'nombre');
});

test('emparejar alimentos: nivel 4, por alias', () => {
  const d = con([{ ...YOGUR, alias: ['Yogur proteínas fresa'] }]);
  const e = emparejarAlimento(d.alimentos, { nombre: 'yogur proteinas fresa', por100: P(200, 1) });
  assert.equal(e.nivel, 'alias');
  assert.equal(e.existente.id, 'a-yogur');
});

test('emparejar alimentos: nivel 5, palabras parecidas Y kcal y proteína a menos de un 10 % → sugerido y preseleccionado', () => {
  const d = con([YOGUR]);
  const e = emparejarAlimento(d.alimentos, { nombre: 'Yogur proteínas fresa', por100: P(60, 9.5) });
  assert.equal(e.nivel, 'aproximado');
  assert.equal(e.sugerencias[0].alimento.id, 'a-yogur');
  assert.equal(e.preseleccionar, true);
  // Con las kcal a más de un 10 %, no.
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'Yogur proteínas fresa', por100: P(80, 10) }).nivel, null);
  // Con la proteína a más de un 10 %, tampoco.
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'Yogur proteínas fresa', por100: P(64, 6) }).nivel, null);
  // Palabras poco parecidas: no.
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'Natillas de vainilla', por100: P(64, 10) }).nivel, null);
});

test('emparejar alimentos: con marcas distintas se sugiere pero DESMARCADO; si falta una marca, marcado', () => {
  const d = con([{ ...YOGUR, marca: 'Danone' }]);
  const distinta = emparejarAlimento(d.alimentos, { nombre: 'Yogur proteínas fresa', marca: 'Hacendado', por100: P(64, 10) });
  assert.equal(distinta.nivel, 'aproximado');
  assert.equal(distinta.sugerencias[0].marcaDistinta, true);
  assert.equal(distinta.preseleccionar, false);
  const sinMarca = emparejarAlimento(d.alimentos, { nombre: 'Yogur proteínas fresa', por100: P(64, 10) });
  assert.equal(sinMarca.preseleccionar, true);
});

test('emparejar alimentos: la prioridad es id > ean > nombre > alias > aproximado', () => {
  const d = con([
    { id: 'a1', nombre: 'Uno', racion: 1, por100: P(64, 10), codigo: '11111111' },
    { id: 'a2', nombre: 'Dos', racion: 1, por100: P(64, 10), codigo: '22222222' },
    { id: 'a3', nombre: 'Tres', racion: 1, por100: P(64, 10), alias: ['Cuatro'] },
    { id: 'a4', nombre: 'Cuatro', racion: 1, por100: P(64, 10) },
  ]);
  assert.equal(emparejarAlimento(d.alimentos, { id: 'a1', ean: '22222222', nombre: 'Cuatro' }).existente.id, 'a1');
  assert.equal(emparejarAlimento(d.alimentos, { ean: '22222222', nombre: 'Cuatro' }).existente.id, 'a2');
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'Cuatro' }).existente.id, 'a4');
  assert.equal(emparejarAlimento(d.alimentos, { nombre: 'Uno' }).nivel, 'nombre');
});

test('emparejar ejercicios: id, nombre, alias y, si no, las 3 sugerencias más parecidas (nunca automático)', () => {
  const d = normalizarForma({ ejercicios: [{ id: 'x-jalon-al-pecho', principal: false, alias: ['Lat pulldown'] }] });
  assert.equal(emparejarEjercicio(d.ejercicios, { id: 'x-jalon-al-pecho', nombre: 'Lo que sea' }).nivel, 'id');
  assert.equal(emparejarEjercicio(d.ejercicios, { nombre: 'JALON pecho' }).nivel, 'nombre');
  assert.equal(emparejarEjercicio(d.ejercicios, { nombre: 'lat pulldown' }).existente.id, 'x-jalon-al-pecho');
  const nuevo = emparejarEjercicio(d.ejercicios, { nombre: 'Press banca inclinado con barra' });
  assert.equal(nuevo.nivel, null);
  assert.equal(nuevo.sugerencias.length, 3);
  assert.ok(nuevo.sugerencias.some((s) => s.ejercicio.id === 'x-press-banca'));
});

// ---------- Modelo ----------

test('modelo: grupos ampliados, equipo, unilateral y secundarios en la biblioteca', () => {
  const d = normalizarForma({});
  const remo = d.ejercicios.find((e) => e.id === 'x-remo-con-mancuerna');
  assert.equal(remo.equipo, 'mancuerna');
  assert.equal(remo.unilateral, true);
  assert.deepEqual(remo.secundarios, ['Bíceps']);
  assert.equal(d.ejercicios.find((e) => e.id === 'x-dominadas').equipo, 'peso_corporal');
  assert.equal(EJERCICIOS_POR_DEFECTO.length, 39);
  assert.equal(grupoDesdeTexto('espalda'), 'Espalda');
  assert.equal(grupoDesdeTexto('BICEPS'), 'Bíceps');
  assert.equal(grupoDesdeTexto('abdomen'), 'Core');
  assert.equal(grupoDesdeTexto('pierna'), 'Pierna');
  assert.equal(grupoDesdeTexto('cuadriceps'), 'Cuádriceps');
  assert.equal(grupoDesdeTexto('antebrazo'), 'Antebrazo');
  assert.equal(grupoDesdeTexto('nada'), null);
  // Un ejercicio tuyo antiguo, sin los campos nuevos, se completa.
  const viejo = normalizarForma({ ejercicios: [{ id: 'x1', nombre: 'Remo Gironda', grupo: 'Espalda', propio: true }] }).ejercicios.at(-1);
  assert.deepEqual([viejo.equipo, viejo.unilateral, viejo.secundarios, viejo.alias, viejo.oculto], ['otro', false, [], [], false]);
});

test('modelo: los cambios a un ejercicio de serie (alias, oculto, equipo) se guardan y viajan', () => {
  const d = normalizarForma({ ejercicios: [{ id: 'x-plancha', alias: ['Plank'], equipo: 'otro' }] });
  const plancha = d.ejercicios.find((e) => e.id === 'x-plancha');
  assert.deepEqual(plancha.alias, ['Plank']);
  assert.equal(plancha.equipo, 'otro');
  assert.equal(plancha.nombre, 'Plancha');
  assert.ok(ejercicioAjustado(plancha));
  assert.ok(!ejercicioAjustado(d.ejercicios.find((e) => e.id === 'x-flexiones')));
});

// ---------- Alias automáticos al importar ----------

test('alias: aceptar la sugerencia aproximada guarda el nombre importado como alias', () => {
  const d = con([YOGUR]);
  const plan = importar(d, { alimentos: [{ nombre: 'Yogur proteínas fresa', unidad: 'g', racion_habitual: 120, por_100: P(62, 10) }] });
  assert.equal(plan.alimentos[0].nivel, 'aproximado');
  assert.equal(plan.alimentos[0].decision, 'usar');
  const { datos, resumen } = aplicarImportacion(d, plan, OPC);
  assert.equal(datos.alimentos.length, 1);
  assert.deepEqual(datos.alimentos[0].alias, ['Yogur proteínas fresa']);
  assert.equal(resumen.alias, 1);
  // La próxima vez se reconoce solo (nivel 4).
  assert.equal(importar(normalizarForma(datos), { alimentos: [{ nombre: 'yogur proteinas fresa', unidad: 'g', racion_habitual: 120, por_100: P(99, 1) }] }).alimentos[0].nivel, 'alias');
});

test('alias: con marcas distintas la sugerencia viene desmarcada y se crea uno nuevo', () => {
  const d = con([{ ...YOGUR, marca: 'Danone' }]);
  const plan = importar(d, { alimentos: [{ nombre: 'Yogur proteínas fresa', marca: 'Hacendado', unidad: 'g', racion_habitual: 120, por_100: P(64, 10) }] });
  assert.equal(plan.alimentos[0].decision, 'crear');
  assert.equal(plan.alimentos[0].sugerencias[0].marcaDistinta, true);
  const { datos } = aplicarImportacion(d, plan, OPC);
  assert.equal(datos.alimentos.length, 2);
});

test('alias: «Es uno que ya tengo…» (asociar a mano) también guarda el alias', () => {
  const d = con([YOGUR]);
  const plan = importar(d, { alimentos: [{ nombre: 'Postre lácteo rosa', unidad: 'g', racion_habitual: 120, por_100: P(64, 10) }] });
  assert.equal(plan.alimentos[0].decision, 'crear');
  plan.alimentos[0].existenteId = 'a-yogur';
  plan.alimentos[0].decision = 'usar';
  const { datos } = aplicarImportacion(d, plan, OPC);
  assert.deepEqual(datos.alimentos[0].alias, ['Postre lácteo rosa']);
});

test('alias: un registro sin alimento conocido ofrece sugerencias; asociarlo guarda el alias', () => {
  const d = con([YOGUR]);
  const plan = importar(d, { registros: [{ alimento: 'Yogur proteínas fresa', cantidad: 120, momento: 'merienda' }] });
  const r = resolverPlan(d, plan, OPC);
  assert.equal(r.errores.length, 1);
  assert.equal(r.errores[0].sugerencias[0].id, 'a-yogur');
  plan.registros[0].alimentoId = 'a-yogur';
  plan.registros[0].asociado = true;
  const { datos } = aplicarImportacion(d, plan, OPC);
  assert.equal(datos.registros[0].alimentoId, 'a-yogur');
  assert.deepEqual(datos.alimentos[0].alias, ['Yogur proteínas fresa']);
});

test('importar: «alimento_id» en un registro manda sobre el nombre; si no existe, avisa y busca por nombre', () => {
  const d = con([YOGUR, { id: 'a-leche', nombre: 'Leche', racion: 200, por100: P(46, 3) }]);
  const plan = importar(d, { registros: [{ alimento_id: 'a-leche', alimento: 'Yogur de fresa proteico', cantidad: 200 }, { alimento_id: 'a-no', alimento: 'Leche', cantidad: 100 }] });
  const r = resolverPlan(d, plan, OPC);
  assert.deepEqual(r.errores, []);
  assert.equal(r.registros[0].alimento.id, 'a-leche');
  assert.equal(r.registros[1].alimento.id, 'a-leche');
  assert.match(r.registros[1].aviso, /no existe; lo busco por nombre/);
});

test('importar: «id» y «ean» en un alimento; repetidos por id dentro del JSON son error', () => {
  const d = con([{ ...YOGUR, codigo: '8410000000001' }]);
  const plan = importar(d, { alimentos: [{ ean: '8410000000001', nombre: 'Yogur Fresa 0%', unidad: 'g', racion_habitual: 125, por_100: P(64, 10) }] });
  assert.equal(plan.alimentos[0].nivel, 'ean');
  assert.equal(plan.alimentos[0].decision, 'usar');
  assert.throws(
    () => importar(d, { alimentos: [{ id: 'a-yogur', nombre: 'Uno', unidad: 'g', racion_habitual: 1, por_100: P(1, 0) }, { id: 'a-yogur', nombre: 'Dos', unidad: 'g', racion_habitual: 1, por_100: P(1, 0) }] }),
    /está repetido/,
  );
  assert.throws(() => importar(d, { alimentos: [{ ean: '12ab', nombre: 'X', unidad: 'g', racion_habitual: 1, por_100: P(1, 0) }] }), /ean: debe ser un código de barras/);
});

// ---------- Fusión ----------

test('fusión de alimentos: reasigna registros y plantillas, los nombres pasan a alias, suma usos (todo en uno)', () => {
  const d = normalizarForma({
    alimentos: [
      { ...YOGUR, veces: 3, usado: 10 },
      { id: 'a-dup', nombre: 'Yogur proteínas fresa', marca: '', racion: 125, por100: P(62, 10), veces: 2, usado: 50, favorito: true, codigo: '8410000000001', alias: ['Yogur prote'] },
      { id: 'a-leche', nombre: 'Leche', racion: 200, por100: P(46, 3) },
    ],
    registros: [
      { id: 'r1', fecha: HOY, momento: 'cena', nombre: 'Yogur proteínas fresa', alimentoId: 'a-dup', gramos: 125, kcal: 78 },
      { id: 'r2', fecha: HOY, momento: 'cena', nombre: 'Leche', alimentoId: 'a-leche', gramos: 200, kcal: 92 },
    ],
    plantillas: [{ id: 't1', nombre: 'Merienda', items: [{ nombre: 'Yogur proteínas fresa', alimentoId: 'a-dup', gramos: 125, kcal: 78 }] }],
    noDuplicados: ['a-dup|a-leche'],
  });
  const f = normalizarForma(fusionarAlimentos(d, 'a-yogur', ['a-dup']));
  assert.deepEqual(f.alimentos.map((a) => a.id), ['a-yogur', 'a-leche']);
  const y = f.alimentos[0];
  assert.deepEqual(y.alias, ['Yogur proteínas fresa', 'Yogur prote']);
  assert.equal(y.veces, 5);
  assert.equal(y.usado, 50);
  assert.equal(y.favorito, true);
  assert.equal(y.codigo, '8410000000001');
  assert.equal(f.registros.find((r) => r.id === 'r1').alimentoId, 'a-yogur');
  assert.equal(f.registros.find((r) => r.id === 'r1').kcal, 78, 'lo apuntado conserva sus valores');
  assert.equal(f.registros.find((r) => r.id === 'r2').alimentoId, 'a-leche');
  assert.equal(f.plantillas[0].items[0].alimentoId, 'a-yogur');
  assert.deepEqual(f.noDuplicados, []);
  // Los datos de partida no cambian (se aplica sobre una copia).
  assert.equal(d.alimentos.length, 3);
});

test('fusión de alimentos: errores claros si la selección no vale', () => {
  const d = con([YOGUR]);
  assert.throws(() => fusionarAlimentos(d, 'a-yogur', ['a-yogur']), ErrorFusion);
  assert.throws(() => fusionarAlimentos(d, 'a-no', ['a-yogur']), /ya no existe/);
  assert.throws(() => fusionarAlimentos(d, 'a-yogur', ['a-no']), /ya no existe/);
});

test('fusión de ejercicios: reasigna series (también del entreno en curso), rutinas e hitos; oculta los de serie', () => {
  const d = normalizarForma({
    ejercicios: [{ id: 'x-mio', nombre: 'Jalón polea alta', grupo: 'Espalda', propio: true, alias: ['Pulldown'], principal: true }],
    rutinas: [{ id: 'q1', nombre: 'Espalda', ejercicios: [{ ejercicioId: 'x-mio', series: 4, repMin: 6, repMax: 10 }, { ejercicioId: 'x-jalon-al-pecho', series: 3, repMin: 8, repMax: 12 }, { ejercicioId: 'x-dominadas', series: 3 }] }],
    sesiones: [{ id: 's1', fecha: HOY, series: [{ id: 'k1', ejercicioId: 'x-mio', kg: 55, reps: 10 }, { id: 'k2', ejercicioId: 'x-dominadas', kg: 0, reps: 8 }], cardio: [] }],
    activa: { id: 's2', fecha: HOY, nombre: 'Libre', inicio: 1, notas: '', series: [{ id: 'k3', ejercicioId: 'x-mio', kg: 50, reps: 0, hecha: false }], cardio: [] },
    hitos: [{ id: 'h1', tipo: 'fuerza', valor: 70, comparador: '>', ejercicioId: 'x-mio' }],
  });
  // Conservas el de serie y fusionas el tuyo.
  const f = normalizarForma(fusionarEjercicios(d, 'x-jalon-al-pecho', ['x-mio']));
  assert.ok(!f.ejercicios.some((e) => e.id === 'x-mio'), 'el tuyo desaparece');
  const jalon = f.ejercicios.find((e) => e.id === 'x-jalon-al-pecho');
  assert.deepEqual(jalon.alias, ['Jalón polea alta', 'Pulldown']);
  assert.equal(jalon.principal, true);
  assert.equal(f.sesiones[0].series[0].ejercicioId, 'x-jalon-al-pecho');
  assert.equal(f.activa.series[0].ejercicioId, 'x-jalon-al-pecho');
  assert.equal(f.hitos[0].ejercicioId, 'x-jalon-al-pecho');
  assert.deepEqual(f.rutinas[0].ejercicios.map((x) => [x.ejercicioId, x.series]), [['x-jalon-al-pecho', 4], ['x-dominadas', 3]], 'en la rutina se queda la primera fila');
  // Al revés: conservas el tuyo y el de serie queda oculto (no se puede borrar).
  const g = normalizarForma(fusionarEjercicios(d, 'x-mio', ['x-jalon-al-pecho']));
  const oculto = g.ejercicios.find((e) => e.id === 'x-jalon-al-pecho');
  assert.equal(oculto.oculto, true);
  assert.deepEqual(g.ejercicios.find((e) => e.id === 'x-mio').alias, ['Pulldown', 'Jalón al pecho']);
  // Después, «Jalón al pecho» (o su id) se empareja con el que conservaste.
  assert.equal(emparejarEjercicio(g.ejercicios, { nombre: 'Jalón al pecho' }).existente.id, 'x-mio');
  assert.equal(emparejarEjercicio(g.ejercicios, { id: 'x-jalon-al-pecho', nombre: 'Jalón al pecho' }).existente.id, 'x-mio');
  // Los ocultos no se pueden conservar ni volver a fusionar.
  assert.throws(() => fusionarEjercicios(g, 'x-jalon-al-pecho', ['x-dominadas']), ErrorFusion);
});

test('fusión: sobrevive a la sincronización (el oculto viaja; el borrado se borra)', async () => {
  let almacen = normalizarForma({ perfil: { peso: 80 }, ejercicios: [{ id: 'x-mio', nombre: 'Jalón polea alta', grupo: 'Espalda', propio: true }] });
  const col = coleccionForma({ leer: async () => almacen, guardar: async (d) => (almacen = d), normalizar: normalizarForma });
  const antes = await col.leer();
  assert.ok(antes.has('ejercicios:x-mio'));
  almacen = normalizarForma(fusionarEjercicios(almacen, 'x-mio', ['x-jalon-al-pecho']));
  const despues = await col.leer();
  assert.ok(despues.has('ejercicios:x-jalon-al-pecho'), 'el de serie oculto viaja');
  // En el otro dispositivo llega el oculto y se aplica.
  let otro = normalizarForma({ perfil: { peso: 80 } });
  const col2 = coleccionForma({ leer: async () => otro, guardar: async (d) => (otro = d), normalizar: normalizarForma });
  await col2.aplicar([...despues.entries()].map(([id, v]) => ({ id, valor: v.valor })));
  assert.equal(otro.ejercicios.find((e) => e.id === 'x-jalon-al-pecho').oculto, true);
  assert.deepEqual(otro.ejercicios.find((e) => e.id === 'x-mio').alias, ['Jalón al pecho']);
  // Si deja de viajar, vuelve a ser el de serie.
  await col2.aplicar([{ id: 'ejercicios:x-jalon-al-pecho', valor: null }]);
  assert.equal(otro.ejercicios.find((e) => e.id === 'x-jalon-al-pecho').oculto, false);
});

// ---------- Posibles duplicados ----------

test('posibles duplicados: alimentos parecidos (sin marcas distintas) y «No son el mismo»', () => {
  const d = con([
    YOGUR,
    { id: 'a-dup', nombre: 'Yogur proteínas fresa', racion: 125, por100: P(62, 10) },
    { id: 'a-danone', nombre: 'Yogur proteínas fresa', marca: 'Danone', racion: 125, por100: P(62, 10) },
    { id: 'a-hac', nombre: 'Yogur proteínas fresa', marca: 'Hacendado', racion: 125, por100: P(62, 10) },
    { id: 'a-leche', nombre: 'Leche', racion: 200, por100: P(46, 3) },
  ]);
  const pares = posiblesDuplicados(d, 'alimentos').map((p) => [p.a.id, p.b.id].sort().join('|'));
  assert.ok(pares.includes('a-dup|a-yogur'));
  assert.ok(!pares.includes('a-danone|a-hac'), 'marcas distintas: no');
  assert.ok(!pares.some((p) => p.includes('a-leche')));
  const d2 = noSonElMismo(d, 'a-yogur', 'a-dup');
  assert.ok(!posiblesDuplicados(d2, 'alimentos').some((p) => [p.a.id, p.b.id].sort().join('|') === 'a-dup|a-yogur'));
});

test('posibles duplicados: en ejercicios solo con alguno tuyo (los de serie ya son distintos)', () => {
  assert.equal(posiblesDuplicados(normalizarForma({}), 'ejercicios').length, 0, 'Peso muerto y Peso muerto rumano no se sugieren');
  const d = normalizarForma({ ejercicios: [{ id: 'x1', nombre: 'Jalón pecho polea', propio: true, grupo: 'Espalda' }] });
  const p = posiblesDuplicados(d, 'ejercicios');
  assert.ok(p.some((x) => [x.a.id, x.b.id].includes('x-jalon-al-pecho')));
});

// ---------- Catálogo ----------

test('catálogo para la IA: instrucción + JSON compacto con ids de texto, alias y ean solo si hay, sin ocultos', () => {
  let d = normalizarForma({
    alimentos: [{ ...YOGUR, alias: ['Yogur prote'], codigo: '8410000000001' }, { id: 'a-leche', nombre: 'Leche', marca: 'COVAP', unidad: 'ml', racion: 200, por100: P(46, 3.1) }],
    ejercicios: [{ id: 'x-mio', nombre: 'Jalón polea alta', propio: true }],
  });
  d = fusionarEjercicios(d, 'x-mio', ['x-jalon-al-pecho']);
  const texto = catalogoParaIA(d);
  const [instruccion, json] = texto.split('\n');
  assert.equal(instruccion, INSTRUCCION_CATALOGO);
  const c = JSON.parse(json).catalogo;
  assert.deepEqual(c.alimentos[0], { id: 'a-yogur', nombre: 'Yogur de fresa proteico', unidad: 'g', kcal: 64, proteina: 10, ean: '8410000000001', alias: ['Yogur prote'] });
  assert.deepEqual(c.alimentos[1], { id: 'a-leche', nombre: 'Leche', marca: 'COVAP', unidad: 'ml', kcal: 46, proteina: 3.1 });
  assert.ok(!c.ejercicios.some((e) => e.id === 'x-jalon-al-pecho'), 'sin ocultos');
  assert.deepEqual(c.ejercicios.find((e) => e.id === 'x-mio'), { id: 'x-mio', nombre: 'Jalón polea alta', alias: ['Jalón al pecho'] });
  assert.deepEqual(c.ejercicios.find((e) => e.id === 'x-press-banca'), { id: 'x-press-banca', nombre: 'Press banca' });
});

test('alias: añadir a mano a un alimento o ejercicio', () => {
  const d = normalizarForma(anadirAlias(normalizarForma({ alimentos: [YOGUR] }), 'alimentos', 'a-yogur', 'Yogur rosa', 'yogur de fresa proteico'));
  assert.deepEqual(d.alimentos[0].alias, ['Yogur rosa']);
  const e = normalizarForma(anadirAlias(normalizarForma({}), 'ejercicios', 'x-dominadas', 'Pull-ups'));
  assert.deepEqual(e.ejercicios.find((x) => x.id === 'x-dominadas').alias, ['Pull-ups']);
});
