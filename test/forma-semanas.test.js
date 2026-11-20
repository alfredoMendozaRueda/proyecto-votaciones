import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarForma } from '../src/compartido/forma/datos.js';
import { sumarDias, lunesDe } from '../src/compartido/forma/fechas.js';
import { apuntar } from '../src/compartido/forma/acciones.js';
import {
  metricasSemana,
  generarResumen,
  semanasPendientes,
  momentoGeneracion,
  regresion,
  textoReglas,
  recomendaciones,
  peticionResumenIA,
  hitosRedondos,
  proximoHito,
  leerTextoIA,
} from '../src/compartido/forma/semanas.js';

const PERFIL = { sexo: 'hombre', nacimiento: '1995-01-01', altura: 178, peso: 80, objetivo: 'perder', ritmo: 'moderado', pesoObjetivo: 70, zona: 'Europe/Madrid', diasEntreno: 4 };
const base = (extra = {}) => normalizarForma({ perfil: PERFIL, ...extra });
// Pesos de una semana: null = ese día no te pesaste.
const semana = (lunes, kgs) => kgs.map((kg, i) => (kg === null ? null : { id: `w${lunes}${i}`, fecha: sumarDias(lunes, i), kg })).filter(Boolean);
const L1 = '2026-11-02';
const L2 = '2026-11-09';
const L3 = '2026-11-16';

test('peso: medias con semana incompleta, días sin pesaje y varios pesajes en un día', () => {
  const datos = base({
    pesos: [
      ...semana(L1, [80, 80.2, null, 79.8, 80, null, 80]),
      // Semana 2: solo 3 días, y el martes dos pesajes de la báscula (cuenta el de antes de las 12:00).
      { id: 'a', fecha: sumarDias(L2, 0), kg: 79.6 },
      { id: 'b', fecha: sumarDias(L2, 1), kg: 79.9, hora: '19:30', momento: 2, fuente: 'apple_salud' },
      { id: 'c', fecha: sumarDias(L2, 1), kg: 79.2, hora: '07:40', momento: 1, fuente: 'apple_salud' },
      { id: 'd', fecha: sumarDias(L2, 3), kg: 79.4 },
    ],
  });
  const m1 = metricasSemana(datos, L1);
  assert.equal(m1.peso.n, 5);
  assert.equal(m1.peso.media, 80);
  assert.equal(m1.peso.ritmo.estado, 'gris'); // sin semana anterior no hay ritmo
  const m2 = metricasSemana(datos, L2);
  assert.equal(m2.peso.n, 3);
  assert.equal(m2.peso.media, 79.4); // (79,6 + 79,2 + 79,4) / 3
  assert.equal(m2.peso.cambioKg, -0.6);
  assert.equal(m2.peso.cambioPct, -0.75);
  // Menos de 4 pesajes: «datos insuficientes», sin ritmo.
  assert.equal(m2.peso.ritmo.estado, 'gris');
  assert.equal(m2.peso.ritmo.kgSemana, null);
  assert.equal(m2.estado, 'datos_incompletos');
});

test('ritmo: verde 0,5–1 %, rojo > 1,25 %, amarillo < 0,25 % dos semanas seguidas', () => {
  const con = (s1, s2, s3) => base({ pesos: [...semana(L1, Array(7).fill(s1)), ...semana(L2, Array(7).fill(s2)), ...semana(L3, Array(7).fill(s3))] });
  assert.equal(metricasSemana(con(80, 80, 79.4), L3).peso.ritmo.estado, 'verde'); // −0,75 %
  assert.equal(metricasSemana(con(80, 80, 78.8), L3).peso.ritmo.estado, 'rojo'); // −1,5 %
  assert.equal(metricasSemana(con(80, 79.9, 79.8), L3).peso.ritmo.estado, 'amarillo'); // −0,13 % y −0,13 %
  // Una sola semana lenta todavía no es «lento».
  assert.equal(metricasSemana(con(80, 79.2, 79.1), L3).peso.ritmo.estado, 'neutro');
  // Con 4 pesajes ya se calcula.
  const cuatro = base({ pesos: [...semana(L2, Array(7).fill(80)), ...semana(L3, [79.4, null, 79.4, null, 79.4, null, 79.4])] });
  assert.equal(metricasSemana(cuatro, L3).peso.ritmo.estado, 'verde');
});

test('hitos: solo con la media semanal, se guardan con su semana y no se pierden al volver a subir', () => {
  let datos = base({
    pesos: [...semana(L1, Array(7).fill(77)), ...semana(L2, [76.2, 75.9, 75.8, 75.9, 75.7, 75.8, 75.9]), ...semana(L3, Array(7).fill(76.5))],
    hitos: [
      { id: 'h76', tipo: 'peso', comparador: '<', valor: 76, recompensa: 'Burger Lab', orden: 0 },
      { id: 'h74', tipo: 'peso', comparador: '<', valor: 74, recompensa: '', orden: 1 },
    ],
  });
  // Semana 1: un pesaje suelto no cuenta (todos 77).
  let r = generarResumen(datos, L1, { ahora: 1 });
  assert.equal(r.datos.hitos.find((h) => h.id === 'h76').cumplido, null);
  // Semana 2: media 75,89 ≤ 76 → conseguido, con su semana y la celebración en el resumen.
  r = generarResumen(r.datos, L2, { ahora: 2 });
  const h = r.datos.hitos.find((x) => x.id === 'h76');
  assert.equal(h.semana, L2);
  assert.equal(h.cumplido, sumarDias(L2, 6));
  assert.deepEqual(r.resumen.datos.hitos.conseguidos, [{ id: 'h76', valor: 76, recompensa: 'Burger Lab' }]);
  assert.equal(r.resumen.datos.hitos.proximo.valor, 74);
  // Semana 3: la media sube a 76,5, pero el hito sigue conseguido.
  r = generarResumen(normalizarForma(r.datos), L3, { ahora: 3 });
  assert.equal(r.datos.hitos.find((x) => x.id === 'h76').semana, L2);
  assert.deepEqual(r.resumen.datos.hitos.conseguidos, []);
  assert.equal(proximoHito(r.datos).id, 'h74');
  // Sugerencias redondas cada 2 kg hasta el objetivo.
  assert.deepEqual(hitosRedondos(base(), 77.5), [76, 74, 72, 70]);
});

test('generar es idempotente; la foto no cambia hasta que regeneras', () => {
  let datos = base({ pesos: semana(L2, Array(7).fill(80)) });
  ({ datos } = apuntar(datos, { fecha: sumarDias(L2, 1), momento: 'comida', minuto: 800, items: [{ nombre: 'Pollo', kcal: 2000, proteina: 150, hidratos: 200, grasa: 60 }] }));
  let r = generarResumen(datos, L2, { ahora: 1 });
  r = generarResumen(normalizarForma(r.datos), L2, { ahora: 2 });
  datos = normalizarForma(r.datos);
  assert.equal(datos.resumenes.length, 1);
  assert.equal(datos.resumenes[0].generado, 2);
  // Apuntas algo tarde: la foto guardada sigue igual…
  ({ datos } = apuntar(datos, { fecha: sumarDias(L2, 2), momento: 'comida', minuto: 800, items: [{ nombre: 'Arroz', kcal: 1900, proteina: 140, hidratos: 210, grasa: 55 }] }));
  assert.equal(datos.resumenes[0].datos.nutricion.dias, 1);
  // …hasta que pulsas «Regenerar».
  datos = normalizarForma(generarResumen(datos, L2, { ahora: 3 }).datos);
  assert.equal(datos.resumenes.length, 1);
  assert.equal(datos.resumenes[0].datos.nutricion.dias, 2);
  // Con texto de la IA se guarda su origen; sin texto, el de reglas.
  const conIA = generarResumen(datos, L2, { ahora: 4, texto: 'Buena semana, sigue así con la proteína en cada comida.', origen: 'ia' });
  assert.equal(conIA.resumen.origen, 'ia');
  assert.equal(generarResumen(datos, L2).resumen.origen, 'reglas');
});

test('nutrición: días, adherencia ±10 %, proteína, macros y día con más kcal con su nota', () => {
  let datos = base({ dias: { [sumarDias(L2, 5)]: { nota: 'Cumpleaños' } } });
  for (let i = 0; i < 4; i++) ({ datos } = apuntar(datos, { fecha: sumarDias(L2, i), momento: 'comida', minuto: 800, items: [{ nombre: 'Día', kcal: 1900, proteina: 200, hidratos: 180, grasa: 60, fibra: 25 }] }));
  ({ datos } = apuntar(datos, { fecha: sumarDias(L2, 5), momento: 'cena', minuto: 1260, items: [{ nombre: 'Tarta', kcal: 3500, proteina: 60, hidratos: 400, grasa: 150 }] }));
  const n = metricasSemana(datos, L2).nutricion;
  assert.equal(n.dias, 5);
  assert.equal(n.completo, true);
  assert.ok(n.kcal.objetivo > 1500 && n.kcal.objetivo < 2600);
  assert.equal(n.proteina.dias, 4);
  assert.deepEqual(n.maximo, { fecha: sumarDias(L2, 5), kcal: 3500, nota: 'Cumpleaños' });
  assert.ok(n.adherencia.dias <= 4);
  // Con 4 días apuntados el bloque está incompleto.
  const pocos = metricasSemana(base({ registros: datos.registros.filter((x) => x.fecha < sumarDias(L2, 3)) }), L2).nutricion;
  assert.equal(pocos.completo, false);
});

test('entreno: hechas frente a planificadas (los días de Ajustes), récords, cardio y pasos', () => {
  const serie = (eid, kg, reps) => ({ ejercicioId: eid, kg, reps, tipo: 'efectiva' });
  const datos = base({
    ajustes: { diasEntrenoSemana: [1, 2, 4, 6] },
    sesiones: [
      { id: 's0', fecha: sumarDias(L1, 0), nombre: 'Pecho', series: [serie('x-press-banca', 70, 8)] },
      { id: 's1', fecha: sumarDias(L2, 0), nombre: 'Pecho', series: [serie('x-press-banca', 75, 8)], cardio: [{ tipo: 'cinta', minutos: 20, kcal: 200 }] },
      // Movida al miércoles: cuenta igual.
      { id: 's2', fecha: sumarDias(L2, 2), nombre: 'Pierna', series: [serie('x-sentadilla', 100, 5)] },
    ],
    dias: { [sumarDias(L2, 0)]: { pasos: 10000 }, [sumarDias(L2, 1)]: { pasos: 8000 } },
  });
  const e = metricasSemana(datos, L2).entreno;
  assert.equal(e.planificadas, 4);
  assert.equal(e.hechas, 2);
  assert.equal(e.cardioMin, 20);
  assert.deepEqual(e.pasos, { media: 9000, dias: 2 });
  assert.ok(e.records.some((x) => x.ejercicioId === 'x-press-banca' && x.anterior !== null));
  assert.equal(e.grupos.find((g) => g.grupo === 'Pecho').anterior, 560);
  assert.match(recomendaciones(metricasSemana(datos, L2)).join(' '), /faltaron 2 sesiones/);
});

test('proyección: recta de las 3 últimas semanas (mínimo 10 pesajes)', () => {
  assert.deepEqual(regresion([{ x: 0, y: 80 }, { x: 10, y: 79 }]), { pendiente: -0.1, ordenada: 80 });
  // Bajando 0,1 kg/día desde 80: el domingo de L3 va por ~78; 76 en ~20 días.
  const pesos = [];
  for (let i = 0; i < 21; i++) pesos.push({ id: `p${i}`, fecha: sumarDias(L1, i), kg: Math.round((80 - 0.1 * i) * 100) / 100 });
  const datos = base({ pesos, hitos: [{ id: 'h', tipo: 'peso', comparador: '<', valor: 76 }] });
  const p = metricasSemana(datos, L3).proyeccion;
  assert.equal(p.kgSemana, -0.7);
  assert.equal(p.hito.fecha, sumarDias(sumarDias(L3, 6), 20));
  assert.ok(p.objetivo.fecha > p.hito.fecha);
  // Con menos de 10 pesajes, sin fechas.
  assert.equal(metricasSemana(base({ pesos: pesos.slice(0, 9) }), L3).proyeccion, null);
});

test('cuándo se genera: domingo 23:30 en tu zona, también con el cambio de hora', () => {
  // 25 oct 2026: fin del horario de verano en Madrid (pasa a UTC+1).
  assert.equal(new Date(momentoGeneracion('2026-10-19', { resumenDia: 7, resumenHora: '23:30' })).toISOString(), '2026-10-25T22:30:00.000Z');
  // 29 mar 2026: empieza el horario de verano (UTC+2).
  assert.equal(new Date(momentoGeneracion('2026-03-23', { resumenDia: 7, resumenHora: '23:30' })).toISOString(), '2026-03-29T21:30:00.000Z');
  // Lunes a las 8:00 de la semana siguiente.
  assert.equal(new Date(momentoGeneracion('2026-10-19', { resumenDia: 1, resumenHora: '08:00' })).toISOString(), '2026-10-26T07:00:00.000Z');
  // La semana del cambio sigue teniendo sus 7 días.
  assert.equal(lunesDe('2026-10-25'), '2026-10-19');
  assert.equal(lunesDe('2026-10-26'), '2026-10-26');
  // Pendientes: solo semanas cerradas, con datos y sin resumen.
  const datos = base({ pesos: [...semana(L1, [80]), ...semana(L2, [79.5]), ...semana(L3, [79])] });
  const antes = Date.parse('2026-11-22T22:29:00Z'); // domingo 23:29 en Madrid
  const despues = Date.parse('2026-11-22T22:31:00Z');
  assert.deepEqual(semanasPendientes(datos, antes), [L1, L2]);
  assert.deepEqual(semanasPendientes(datos, despues), [L1, L2, L3]);
  const hecho = normalizarForma(generarResumen(datos, L2).datos);
  assert.deepEqual(semanasPendientes(hecho, despues), [L1, L3]);
});

test('texto: reglas con 1–2 recomendaciones y la IA solo recibe métricas', () => {
  let datos = base({ pesos: [...semana(L2, Array(7).fill(80)), ...semana(L3, Array(7).fill(78.8))] });
  ({ datos } = apuntar(datos, { fecha: L3, momento: 'cena', minuto: 1260, items: [{ nombre: 'Pizza secreta', kcal: 2500, proteina: 40, hidratos: 300, grasa: 100 }] }));
  const m = metricasSemana(datos, L3);
  const recs = recomendaciones(m);
  assert.ok(recs.length >= 1 && recs.length <= 2);
  assert.match(recs[0], /más rápido de lo recomendado/);
  const t = textoReglas(m);
  assert.match(t, /Media de peso de 78,8 kg/);
  const pet = peticionResumenIA(m);
  assert.doesNotMatch(pet.usuario, /Pizza secreta/);
  assert.match(pet.usuario, /"ritmo":"rojo"/);
  assert.equal(leerTextoIA('**Hola**'), null);
  assert.equal(leerTextoIA('**Buena semana**: has bajado 0,6 kg y cumplido la proteína casi todos los días.'), 'Buena semana: has bajado 0,6 kg y cumplido la proteína casi todos los días.');
});

// ---------- Ajuste automático del objetivo ----------
import { aplicarPropuesta, descartarPropuesta, quitarAjuste, propuestaAjuste } from '../src/compartido/forma/semanas.js';
import { calcularPlan } from '../src/compartido/forma/calculos.js';
import { objetivoDelDia, planActual } from '../src/compartido/forma/diario.js';

// Tres semanas con peso fijo por semana y la semana L3 comiendo «cumplidos» días en objetivo.
function conRitmo(s1, s2, s3, { cumplidos = 7, objetivo = 'perder', apuntados = 7 } = {}) {
  let datos = base({ perfil: { ...PERFIL, objetivo }, pesos: [...semana(L1, Array(7).fill(s1)), ...semana(L2, Array(7).fill(s2)), ...semana(L3, Array(7).fill(s3))] });
  for (let i = 0; i < apuntados; i++) {
    const f = sumarDias(L3, i);
    const kcal = objetivoDelDia(datos, f, planActual(datos, f), sumarDias(L3, 7)).kcal * (i < cumplidos ? 1 : 1.3);
    ({ datos } = apuntar(datos, { fecha: f, momento: 'comida', minuto: 800, items: [{ nombre: 'Día', kcal, proteina: 160, hidratos: 200, grasa: 60 }] }));
  }
  return datos;
}

test('ajuste: propone −120 si va lento dos semanas cumpliendo, +150 si va demasiado rápido', () => {
  const lento = metricasSemana(conRitmo(80, 79.9, 79.8), L3);
  assert.equal(lento.peso.ritmo.estado, 'amarillo');
  assert.equal(lento.propuesta.delta, -120);
  assert.match(lento.propuesta.texto, /bajar 120 kcal/);
  assert.equal(recomendaciones(lento)[0], lento.propuesta.texto);
  assert.equal(metricasSemana(conRitmo(80, 80, 78.8), L3).propuesta.delta, 150);
  // Ganar músculo: al revés.
  assert.equal(metricasSemana(conRitmo(80, 80, 81, { objetivo: 'volumen' }), L3).propuesta.delta, -150);
  // Ritmo ideal o datos poco fiables: sin propuesta.
  assert.equal(metricasSemana(conRitmo(80, 80, 79.4), L3).propuesta, null);
  assert.equal(metricasSemana(conRitmo(80, 79.9, 79.8, { cumplidos: 3 }), L3).propuesta, null); // solo 3 días en objetivo
  assert.equal(metricasSemana(conRitmo(80, 79.9, 79.8, { apuntados: 4, cumplidos: 4 }), L3).propuesta, null); // datos incompletos
  // La semana en curso nunca propone.
  assert.equal(metricasSemana(conRitmo(80, 79.9, 79.8), L3, { parcial: true }).propuesta, null);
});

test('ajuste: aplicar baja el objetivo, regenerar no lo deshace, espera 2 semanas y se puede quitar', () => {
  let datos = normalizarForma(generarResumen(conRitmo(80, 79.9, 79.8), L3).datos);
  const antes = calcularPlan(datos.perfil, { hoy: L3 }).descanso.kcal;
  datos = normalizarForma(aplicarPropuesta(datos, L3, '2026-11-23'));
  assert.equal(datos.perfil.ajusteKcal, -120);
  assert.equal(calcularPlan(datos.perfil, { hoy: L3 }).descanso.kcal, antes - 120);
  assert.deepEqual(datos.historialKcal.map((x) => x.delta), [-120]);
  assert.equal(datos.resumenes.at(-1).decision, 'aplicada');
  // Aplicar dos veces no suma dos veces.
  assert.equal(normalizarForma(aplicarPropuesta(datos, L3, '2026-11-23')).perfil.ajusteKcal, -120);
  // Regenerar conserva la decisión y la propuesta.
  const regenerado = normalizarForma(generarResumen(datos, L3).datos).resumenes.at(-1);
  assert.equal(regenerado.decision, 'aplicada');
  assert.equal(regenerado.datos.propuesta.delta, -120);
  // La semana siguiente, aunque siga lenta, espera a que el peso responda.
  const siguiente = metricasSemana(datos, L3);
  assert.equal(propuestaAjuste({ ...datos, historialKcal: [{ fecha: sumarDias(L3, 6), delta: -120 }] }, siguiente), null);
  // Quitar el ajuste.
  const sin = normalizarForma(quitarAjuste(datos, '2026-11-30'));
  assert.equal(sin.perfil.ajusteKcal, undefined);
  assert.equal(sin.historialKcal.at(-1).delta, 120);
  // Descartar no cambia el objetivo.
  const desc = normalizarForma(descartarPropuesta(normalizarForma(generarResumen(conRitmo(80, 79.9, 79.8), L3).datos), L3));
  assert.equal(desc.resumenes.at(-1).decision, 'descartada');
  assert.equal(desc.perfil.ajusteKcal, undefined);
});

test('ajuste: nunca propone bajar del metabolismo basal', () => {
  const datos = conRitmo(80, 79.9, 79.8);
  const enElLimite = { ...datos, perfil: { ...datos.perfil, ajusteKcal: -790 } };
  assert.equal(propuestaAjuste(enElLimite, metricasSemana(datos, L3)), null);
});
