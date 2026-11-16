import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerObjeto, validarImportacion, validarAlimento, validarRegistro, leerImportacion, prepararImportacion, resolverPlan, aplicarImportacion, totalesPorDia, resolverMomento, duplicadosDe, desvioKcal, formatoParaIA, ErrorImportacion, textoError } from '../src/compartido/forma/importar.js';
import { normalizarForma } from '../src/compartido/forma/datos.js';
import { nutrientesDe } from '../src/compartido/forma/diario.js';

const HOY = '2026-11-16';
const OPC = { hoy: HOY, ahoraMin: 21 * 60 };

const LECHE = { nombre: 'Leche Calcio semidesnatada', marca: 'COVAP', unidad: 'ml', racion_habitual: 250, por_100: { kcal: 51, proteina: 3.9, hidratos: 5.2, azucares: 5.2, grasa: 1.6, saturadas: 1.0, fibra: 0, sal: 0.13 } };
const EJEMPLO = { forma_import: 1, alimentos: [LECHE], registros: [{ fecha: HOY, momento: 'cena', alimento: 'Leche Calcio semidesnatada', marca: 'COVAP', cantidad: 250 }] };

const vacios = () => normalizarForma({});
const conAlimentos = (alimentos) => normalizarForma({ alimentos });
const errores = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ErrorImportacion, `esperaba ErrorImportacion y llegó ${e}`);
    return e.errores.map(textoError);
  }
  assert.fail('no ha lanzado ningún error');
};

// ---------- Parseo ----------

test('importar: lee el JSON dentro de un bloque ```json con texto alrededor', () => {
  const texto = `¡Claro! Aquí tienes los datos:\n\n\`\`\`json\n${JSON.stringify(EJEMPLO, null, 2)}\n\`\`\`\n\nSi quieres, añado más.`;
  assert.deepEqual(extraerObjeto(texto), EJEMPLO);
});

test('importar: lee el JSON suelto entre frases y prefiere el que parece una importación', () => {
  const texto = `Uso {"nota": 1} como ejemplo. Los datos: ${JSON.stringify(EJEMPLO)} y ya está.`;
  assert.deepEqual(extraerObjeto(texto), EJEMPLO);
});

test('importar: acepta decimales con coma, comillas tipográficas y comas sobrantes', () => {
  const texto = `{ “forma_import”: 1, "alimentos": [ { "nombre": "Pan", "unidad": "g", "racion_habitual": 60, "por_100": { "kcal": 265, "proteina": 8,8, "hidratos": 49,1, "grasa": 3,2, } }, ] }`;
  const o = extraerObjeto(texto);
  assert.equal(o.alimentos[0].por_100.proteina, 8.8);
  assert.equal(o.alimentos[0].por_100.hidratos, 49.1);
  assert.equal(o.alimentos[0].por_100.grasa, 3.2);
});

test('importar: las llaves dentro de cadenas no lo confunden', () => {
  const o = extraerObjeto('{"forma_import":1,"alimentos":[{"nombre":"Salsa {picante}","unidad":"g","racion_habitual":15,"por_100":{"kcal":40,"proteina":1,"hidratos":8,"grasa":0.4}}]}');
  assert.equal(o.alimentos[0].nombre, 'Salsa {picante}');
});

test('importar: texto sin JSON, vacío o enorme da un error claro', () => {
  assert.match(errores(() => extraerObjeto('hola, no hay nada'))[0], /No encuentro ningún objeto JSON/);
  assert.match(errores(() => extraerObjeto('   '))[0], /Pega primero/);
  assert.match(errores(() => extraerObjeto(`{"a":"${'x'.repeat(200_001)}"}`))[0], /demasiado largo/);
});

// ---------- Validación ----------

test('importar: el ejemplo del formato es válido y sin avisos de kcal', () => {
  const v = validarImportacion(EJEMPLO, OPC);
  assert.deepEqual(v.errores, []);
  assert.deepEqual(v.avisos, []);
  assert.equal(v.alimentos[0].unidad, 'ml');
  assert.equal(v.alimentos[0].racion, 250);
  assert.equal(v.registros[0].cantidad, 250);
});

test('importar: dice qué campo falla y en qué elemento', () => {
  const v = validarImportacion(
    {
      forma_import: 1,
      alimentos: [
        { nombre: 'Atún', unidad: 'g', racion_habitual: 80, por_100: { kcal: 110, proteina: 25, hidratos: 0, grasa: -1 } },
        { marca: 'X', unidad: 'kg', racion_habitual: 0, por_100: { kcal: '12a', proteina: 1, hidratos: 1 } },
      ],
      registros: [{ alimento: 'Atún', cantidad: 0, fecha: '2026-02-30' }],
    },
    OPC,
  );
  const t = v.errores.map(textoError);
  assert.ok(t.includes('Alimento 1 («Atún») › por_100.grasa: debe ser un número ≥ 0'), t.join('\n'));
  assert.ok(t.includes('Alimento 2 › nombre: es obligatorio'));
  assert.ok(t.some((x) => x.startsWith('Alimento 2 › unidad: «kg» no vale')));
  assert.ok(t.includes('Alimento 2 › racion_habitual: debe ser un número mayor que 0 y como mucho 5000'));
  assert.ok(t.includes('Alimento 2 › por_100.kcal: debe ser un número ≥ 0'));
  assert.ok(t.includes('Alimento 2 › por_100.grasa: es obligatorio'));
  assert.ok(t.includes('Registro 1 («Atún») › cantidad: debe ser un número mayor que 0 y como mucho 10000'));
  assert.ok(t.some((x) => x.startsWith('Registro 1 («Atún») › fecha: «2026-02-30» no es una fecha válida')));
});

test('importar: números como texto con coma, unidades escritas de otra forma y marca opcional', () => {
  const v = validarAlimento({ nombre: 'Aceite de oliva', unidad: 'Mililitros', racion_habitual: '10', por_100: { kcal: '824', proteina: 0, hidratos: 0, grasa: '91,6' } });
  assert.deepEqual(v.errores, []);
  assert.deepEqual(v.valor, { nombre: 'Aceite de oliva', marca: '', unidad: 'ml', racion: 10, por100: { kcal: 824, proteina: 0, hidratos: 0, grasa: 91.6 } });
});

test('importar: avisa (sin bloquear) si las kcal no cuadran con los macros por más de un 15 %', () => {
  const v = validarAlimento({ nombre: 'Barrita', unidad: 'g', racion_habitual: 40, por_100: { kcal: 250, proteina: 20, hidratos: 40, grasa: 15 } });
  assert.deepEqual(v.errores, []);
  assert.ok(v.valor);
  assert.equal(v.avisos.length, 1);
  assert.match(v.avisos[0].mensaje, /P×4 \+ H×4 \+ G×9 = 375/);
  // Dentro del 15 %: sin aviso.
  assert.equal(validarAlimento({ nombre: 'Pan', unidad: 'g', racion_habitual: 60, por_100: { kcal: 265, proteina: 8.8, hidratos: 49.1, grasa: 3.2 } }).avisos.length, 0);
  assert.equal(Math.round(desvioKcal({ kcal: 100, proteina: 10, hidratos: 10, grasa: 0 }).desvio * 100), 20);
});

test('importar: valores imposibles por 100 g son error', () => {
  const t = validarAlimento({ nombre: 'Raro', unidad: 'g', racion_habitual: 10, por_100: { kcal: 1200, proteina: 120, hidratos: 0, grasa: 0 } }).errores.map(textoError);
  assert.ok(t.some((x) => x.includes('por_100.kcal: no puede pasar de 900')));
  assert.ok(t.some((x) => x.includes('por_100.proteina: no puede pasar de 100')));
});

test('importar: hace falta al menos una lista, la versión 1 y listas de verdad', () => {
  assert.match(textoError(validarImportacion({ forma_import: 1 }, OPC).errores[0]), /No hay nada que importar/);
  assert.match(textoError(validarImportacion({ forma_import: 2, alimentos: [LECHE] }, OPC).errores[0]), /versión 2 no es compatible/);
  assert.match(textoError(validarImportacion({ forma_import: 1, alimentos: {} }, OPC).errores[0]), /alimentos: tiene que ser una lista/);
  const sinVersion = validarImportacion({ alimentos: [LECHE] }, OPC);
  assert.deepEqual(sinVersion.errores, []);
  assert.match(textoError(sinVersion.avisos[0]), /versión 1/);
});

test('importar: un alimento repetido dentro del JSON es error', () => {
  const v = validarImportacion({ forma_import: 1, alimentos: [LECHE, { ...LECHE, nombre: 'leche calcio SEMIDESNATADA', marca: 'covap' }] }, OPC);
  assert.match(textoError(v.errores[0]), /Alimento 2 .* está repetido \(es igual que el alimento 1\)/);
});

test('importar: fechas fuera de rango y sin fecha (hoy)', () => {
  assert.match(textoError(validarRegistro({ alimento: 'X', cantidad: 1, fecha: '2024-01-01' }, 0, OPC).errores[0]), /hace más de un año/);
  assert.match(textoError(validarRegistro({ alimento: 'X', cantidad: 1, fecha: '2026-11-20' }, 0, OPC).errores[0]), /del futuro/);
  assert.equal(validarRegistro({ alimento: 'X', cantidad: 1, fecha: '2026-11-17' }, 0, OPC).errores.length, 0);
  assert.equal(validarRegistro({ alimento: 'X', cantidad: 1 }, 0, OPC).valor.fecha, HOY);
});

// ---------- Momentos ----------

test('importar: el momento se busca por id o nombre sin tildes; si no, el más cercano por hora', () => {
  const d = vacios();
  assert.deepEqual(resolverMomento(d.momentos, 'CENA', { fecha: HOY, hoy: HOY }), { id: 'cena', aviso: null });
  assert.equal(resolverMomento(d.momentos, 'Merienda', {}).id, 'merienda');
  const r = resolverMomento(d.momentos, 'pre-entreno', { hora: '17:40', fecha: HOY, hoy: HOY });
  assert.equal(r.id, 'merienda');
  assert.match(r.aviso, /«pre-entreno» no es una de tus comidas: lo pongo en Merienda/);
  // Sin hora: la de ahora si es hoy…
  assert.equal(resolverMomento(d.momentos, 'snack', { fecha: HOY, hoy: HOY, ahoraMin: 8 * 60 }).id, 'desayuno');
  // …y la de la comida si es otro día.
  assert.equal(resolverMomento(d.momentos, '', { fecha: '2026-11-10', hoy: HOY }).id, 'comida');
});

// ---------- Duplicados ----------

test('importar: detecta duplicados por nombre y marca sin mayúsculas ni tildes', () => {
  const d = conAlimentos([{ nombre: 'Leche calcio semidesnatada', marca: 'Covap', racion: 250, unidad: 'ml', por100: LECHE.por_100 }, { nombre: 'Plátano', racion: 120, por100: { kcal: 89, proteina: 1.1, hidratos: 23, grasa: 0.3 } }]);
  assert.equal(duplicadosDe(d, 'LECHE CALCIO  semidesnatada', 'COVAP').length, 1);
  assert.equal(duplicadosDe(d, 'platano', '').length, 1);
  assert.equal(duplicadosDe(d, 'Plátano', 'Chiquita').length, 0);
});

test('importar: decisión por defecto: crear si es nuevo y usar el tuyo si ya existe (aunque cambien los valores)', () => {
  const iguales = conAlimentos([{ nombre: 'Leche Calcio semidesnatada', marca: 'COVAP', unidad: 'ml', racion: 250, por100: LECHE.por_100 }]);
  assert.equal(leerImportacion(iguales, JSON.stringify(EJEMPLO), OPC).alimentos[0].decision, 'usar');
  const distinta = conAlimentos([{ nombre: 'leche calcio semidesnatada', marca: 'covap', unidad: 'ml', racion: 200, por100: { ...LECHE.por_100, kcal: 46 } }]);
  const plan = leerImportacion(distinta, JSON.stringify(EJEMPLO), OPC);
  assert.equal(plan.alimentos[0].decision, 'usar');
  assert.equal(plan.alimentos[0].nivel, 'nombre');
  assert.equal(plan.alimentos[0].iguales, false);
  assert.equal(plan.alimentos[0].existenteId, distinta.alimentos[0].id);
  assert.equal(leerImportacion(vacios(), JSON.stringify(EJEMPLO), OPC).alimentos[0].decision, 'crear');
});

// ---------- Macros por cantidad ----------

test('importar: calcula kcal y macros por cantidad (también en ml)', () => {
  const plan = leerImportacion(vacios(), JSON.stringify(EJEMPLO), OPC);
  const r = resolverPlan(vacios(), plan, OPC);
  assert.deepEqual(r.errores, []);
  assert.equal(r.registros[0].unidad, 'ml');
  assert.deepEqual(r.registros[0].nutrientes, { kcal: 128, proteina: 9.8, hidratos: 13, azucares: 13, grasa: 4, saturadas: 2.5, fibra: 0, sal: 0.3 });
  const t = totalesPorDia(r);
  assert.deepEqual(Object.keys(t), [HOY]);
  assert.equal(t[HOY].kcal, 128);
  assert.equal(t[HOY].n, 1);
});

test('importar: si la cantidad se edita en la vista previa, los valores cambian', () => {
  const plan = leerImportacion(vacios(), JSON.stringify(EJEMPLO), OPC);
  plan.registros[0].cantidad = 500;
  assert.equal(resolverPlan(vacios(), plan, OPC).registros[0].nutrientes.kcal, 255);
});

// ---------- Referencias ----------

test('importar: un registro puede usar un alimento que ya tenías', () => {
  const d = conAlimentos([{ nombre: 'Plátano', racion: 120, por100: { kcal: 89, proteina: 1.1, hidratos: 23, grasa: 0.3 } }]);
  const plan = leerImportacion(d, JSON.stringify({ forma_import: 1, registros: [{ alimento: 'platano', cantidad: 120, momento: 'merienda' }] }), OPC);
  const { datos, resumen } = aplicarImportacion(d, plan, OPC);
  assert.equal(resumen.registros, 1);
  assert.equal(resumen.creados, 0);
  const reg = datos.registros.at(-1);
  assert.equal(reg.alimentoId, d.alimentos[0].id);
  assert.equal(reg.kcal, 107);
  assert.equal(reg.origen, 'importado');
});

test('importar: registro sin alimento conocido, desmarcado o ambiguo da error claro', () => {
  const d = conAlimentos([
    { nombre: 'Yogur natural', marca: 'Danone', racion: 125, por100: { kcal: 60, proteina: 3.5, hidratos: 4.5, grasa: 3 } },
    { nombre: 'Yogur natural', marca: 'Hacendado', racion: 125, por100: { kcal: 58, proteina: 3.6, hidratos: 4.4, grasa: 2.8 } },
  ]);
  const kefir = leerImportacion(d, JSON.stringify({ forma_import: 1, registros: [{ alimento: 'Kéfir', cantidad: 200 }] }), OPC);
  const t = errores(() => aplicarImportacion(d, kefir, OPC));
  assert.match(t[0], /Registro 1 \(«Kéfir»\) › alimento: «Kéfir» no está en la importación ni en tus alimentos/);
  const ambiguo = leerImportacion(d, JSON.stringify({ forma_import: 1, registros: [{ alimento: 'Yogur natural', cantidad: 125 }] }), OPC);
  assert.match(errores(() => aplicarImportacion(d, ambiguo, OPC))[0], /hay varios «Yogur natural» de distinta marca/);
  const desmarcado = leerImportacion(vacios(), JSON.stringify(EJEMPLO), OPC);
  desmarcado.alimentos[0].incluir = false;
  assert.match(errores(() => aplicarImportacion(vacios(), desmarcado, OPC))[0], /\(lo has desmarcado\)/);
});

// ---------- Guardar: todo o nada ----------

test('importar: crea, marca «importado», enlaza el registro y lo pone en recientes', () => {
  const d = vacios();
  const plan = leerImportacion(d, JSON.stringify(EJEMPLO), OPC);
  const { datos, resumen } = aplicarImportacion(d, plan, { ...OPC, ahora: 1_800_000_000_000 });
  assert.deepEqual(resumen, { creados: 1, actualizados: 0, usados: 0, alias: 0, registros: 1, fechas: [HOY] });
  const n = normalizarForma(datos);
  const a = n.alimentos[0];
  assert.equal(a.origen, 'importado');
  assert.equal(a.unidad, 'ml');
  assert.equal(a.racion, 250);
  assert.equal(a.veces, 1);
  assert.equal(a.usado, 1_800_000_000_000);
  const r = n.registros[0];
  assert.equal(r.alimentoId, a.id);
  assert.equal(r.momento, 'cena');
  assert.equal(r.minuto, 21 * 60 + 30);
  assert.equal(r.gramos, 250);
  assert.equal(r.unidad, 'ml');
  assert.equal(r.origen, 'importado');
  assert.equal(r.kcal, nutrientesDe(a, 250).kcal);
});

test('importar: «actualizar» cambia el que tenías sin perder favorito ni usos; «crear» hace otro', () => {
  const d = conAlimentos([{ nombre: 'Leche calcio semidesnatada', marca: 'COVAP', racion: 200, favorito: true, veces: 7, usado: 5, por100: { kcal: 46, proteina: 3.1, hidratos: 4.7, grasa: 1.6 } }]);
  const plan = leerImportacion(d, JSON.stringify(EJEMPLO), OPC);
  plan.alimentos[0].decision = 'actualizar';
  const act = aplicarImportacion(d, plan, OPC).datos;
  assert.equal(act.alimentos.length, 1);
  assert.equal(act.alimentos[0].id, d.alimentos[0].id);
  assert.equal(act.alimentos[0].por100.kcal, 51);
  assert.equal(act.alimentos[0].unidad, 'ml');
  assert.equal(act.alimentos[0].favorito, true);
  assert.equal(act.alimentos[0].veces, 8);
  plan.alimentos[0].decision = 'crear';
  const nuevo = aplicarImportacion(d, plan, OPC).datos;
  assert.equal(nuevo.alimentos.length, 2);
  assert.equal(nuevo.registros[0].alimentoId, nuevo.alimentos[1].id);
  plan.alimentos[0].decision = 'usar';
  const usado = aplicarImportacion(d, plan, OPC).datos;
  assert.equal(usado.alimentos[0].por100.kcal, 46);
  assert.equal(usado.registros[0].kcal, 115);
});

test('importar: si un elemento no vale, no se guarda nada (todo o nada)', () => {
  const d = vacios();
  const plan = leerImportacion(d, JSON.stringify({ ...EJEMPLO, registros: [...EJEMPLO.registros, { alimento: 'Leche Calcio semidesnatada', marca: 'COVAP', cantidad: 100, momento: 'desayuno' }] }), OPC);
  const copia = JSON.stringify(d);
  plan.registros[1].cantidad = -3; // editado mal en la vista previa
  assert.match(errores(() => aplicarImportacion(d, plan, OPC))[0], /Registro 2 .* cantidad/);
  assert.equal(JSON.stringify(d), copia);
});

test('importar: se revalida todo al confirmar (plan manipulado o alimento borrado)', () => {
  const d = conAlimentos([{ nombre: 'Leche Calcio semidesnatada', marca: 'COVAP', racion: 200, por100: { kcal: 46, proteina: 3.1, hidratos: 4.7, grasa: 1.6 } }]);
  const plan = leerImportacion(d, JSON.stringify(EJEMPLO), OPC);
  // Entre la vista previa y el guardado, el alimento se borró en otro dispositivo.
  assert.match(errores(() => aplicarImportacion(vacios(), plan, OPC))[0], /ya no existe/);
  const malo = structuredClone(plan);
  malo.alimentos[0].alimento.por100.kcal = -5;
  assert.match(errores(() => aplicarImportacion(d, malo, OPC))[0], /por_100\.kcal: debe ser un número ≥ 0/);
  const momento = structuredClone(plan);
  momento.registros[0].momento = 'inventado';
  assert.match(errores(() => aplicarImportacion(d, momento, OPC))[0], /momento: elige una de tus comidas/);
  const decision = structuredClone(plan);
  decision.alimentos[0].decision = 'borrar';
  assert.match(errores(() => aplicarImportacion(d, decision, OPC))[0], /decisión/);
  assert.match(errores(() => aplicarImportacion(d, { alimentos: 'x' }, OPC))[0], /no tiene el formato/);
  const nada = structuredClone(plan);
  nada.alimentos[0].incluir = false;
  nada.registros[0].incluir = false;
  assert.match(errores(() => aplicarImportacion(d, nada, OPC))[0], /No has marcado nada/);
});

test('importar: los datos importados sobreviven a la normalización (sincronización)', () => {
  const { datos } = aplicarImportacion(vacios(), leerImportacion(vacios(), JSON.stringify(EJEMPLO), OPC), OPC);
  const dos = normalizarForma(JSON.parse(JSON.stringify(normalizarForma(datos))));
  assert.equal(dos.alimentos[0].origen, 'importado');
  assert.equal(dos.alimentos[0].unidad, 'ml');
  assert.equal(dos.registros[0].unidad, 'ml');
  assert.equal(dos.registros[0].origen, 'importado');
});

test('importar: el plan solo con alimentos se guarda en Mis alimentos sin registros', () => {
  const plan = prepararImportacion(vacios(), validarImportacion({ forma_import: 1, alimentos: [LECHE] }, OPC), OPC);
  const { datos, resumen } = aplicarImportacion(vacios(), plan, OPC);
  assert.equal(datos.alimentos.length, 1);
  assert.equal(datos.registros.length, 0);
  assert.equal(resumen.creados, 1);
  assert.equal(datos.alimentos[0].veces, 0);
});

test('importar: el formato para la IA lleva tus comidas y es un JSON de ejemplo válido', () => {
  const texto = formatoParaIA(vacios().momentos);
  assert.match(texto, /desayuno, almuerzo, comida, merienda, cena/);
  assert.ok(texto.length < 1600);
  const o = extraerObjeto(texto.replace('AAAA-MM-DD', HOY));
  assert.deepEqual(validarImportacion(o, OPC).errores, []);
});
