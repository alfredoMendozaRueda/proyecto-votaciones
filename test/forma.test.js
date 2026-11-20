import test from 'node:test';
import assert from 'node:assert/strict';
import { metabolismoBasal, gastoDiario, calcularPlan, macrosPara, aguaPara, fechaEstimada, epley, discosPorLado, ajusteObjetivo, deKg, aKg } from '../src/compartido/forma/calculos.js';
import { normalizarForma, EJERCICIOS_POR_DEFECTO } from '../src/compartido/forma/datos.js';
import { sumarDias, lunesDe, edadEn, diasEntre } from '../src/compartido/forma/fechas.js';
import { totales, resumenDia, comidasHabituales, quePuedoComer, esDiaEntreno, momentoPorHora, nutrientesDe, avisosDelDia, objetivoDelDia } from '../src/compartido/forma/diario.js';
import { media7, serieMedia, pesoDeReferencia, ritmoReal, estadoHito, hitosSugeridos, resumenSemanal, tdeeAdaptativo, avisosProgreso } from '../src/compartido/forma/progreso.js';
import { ultimaVez, sugerenciaSubida, asesorDescarga, avisoFuerzaEnDeficit, historialEjercicio, kcalCardio } from '../src/compartido/forma/entreno.js';
import { leerEstimacion, leerIdeas, validarItem, macrosDeKcal, extraerJSON } from '../src/compartido/forma/ia.js';
import { deOpenFoodFacts, buscarLocal, guardarAlimento } from '../src/compartido/forma/alimentos.js';
import { apuntar, apuntarPeso, copiarDia, empezarSesion, actualizarActiva, terminarSesion, anadirHito, sumarAgua, guardarPerfil } from '../src/compartido/forma/acciones.js';
import { coleccionForma } from '../src/compartido/sincro.js';

const cerca = (a, b, margen = 1) => assert.ok(Math.abs(a - b) <= margen, `${a} no está cerca de ${b}`);

const PERFIL = {
  sexo: 'hombre',
  nacimiento: '1996-03-10',
  altura: 180,
  peso: 80,
  trabajo: 'sentado',
  pasos: '5-8',
  diasEntreno: 4,
  minutosSesion: 60,
  tipoEntreno: 'pesas',
  cardioSemana: 0,
  objetivo: 'perder',
  pesoObjetivo: 74,
  ritmo: 'moderado',
  modoKcal: 'fijas',
};
const HOY = '2026-11-14';

const datosCon = (extra = {}) => normalizarForma({ perfil: PERFIL, ...extra });

test('Fechas: días, lunes de la semana y edad', () => {
  assert.equal(sumarDias('2026-02-28', 1), '2026-03-01');
  assert.equal(lunesDe('2026-11-14'), '2026-11-09');
  assert.equal(lunesDe('2026-11-09'), '2026-11-09');
  assert.equal(lunesDe('2026-11-15'), '2026-11-09');
  assert.equal(edadEn('1996-03-10', '2026-03-09'), 29);
  assert.equal(edadEn('1996-03-10', '2026-03-10'), 30);
  assert.equal(diasEntre('2026-10-25', '2026-10-26'), 1);
});

test('BMR: Mifflin-St Jeor (hombre y mujer) y Katch-McArdle con % de grasa', () => {
  // 10·80 + 6,25·180 − 5·30 + 5 = 800 + 1125 − 150 + 5 = 1780
  assert.equal(metabolismoBasal({ sexo: 'hombre', peso: 80, altura: 180, edad: 30 }).kcal, 1780);
  // 10·60 + 6,25·165 − 5·25 − 161 = 600 + 1031,25 − 125 − 161 = 1345,25
  assert.equal(metabolismoBasal({ sexo: 'mujer', peso: 60, altura: 165, edad: 25 }).kcal, 1345.25);
  // Magra = 80 · 0,8 = 64 kg → 370 + 21,6 · 64 = 1752,4
  const k = metabolismoBasal({ sexo: 'hombre', peso: 80, altura: 180, edad: 30, grasa: 20 });
  assert.equal(k.formula, 'Katch-McArdle');
  cerca(k.kcal, 1752.4, 0.01);
});

test('TDEE: descanso, entreno y media semanal', () => {
  const g = gastoDiario(PERFIL, HOY);
  assert.equal(g.edad, 30);
  // Basal 1780 · 1,2 = 2136; pasos (6500 − 3000) · 80 · 0,0005 = 140 → 2276
  cerca(g.descanso, 2276);
  // Sesión de pesas 60 min: (5 − 1) · 80 · 1 = 320
  cerca(g.sesion, 320);
  cerca(g.entreno, 2596);
  // Media: (4·2596 + 3·2276) / 7 ≈ 2458,9
  cerca(g.media, 2458.86);
});

test('Objetivo de kcal según objetivo y ritmo (tabla)', () => {
  assert.equal(ajusteObjetivo('perder', 'suave'), -0.1);
  assert.equal(ajusteObjetivo('perder', 'moderado'), -0.2);
  assert.equal(ajusteObjetivo('perder', 'agresivo'), -0.25);
  assert.equal(ajusteObjetivo('recomposicion', 'agresivo'), -0.075);
  assert.equal(ajusteObjetivo('mantener', 'agresivo'), 0);
  assert.equal(ajusteObjetivo('volumen', 'suave'), 0.05);
  assert.equal(ajusteObjetivo('volumen', 'agresivo'), 0.15);
  const plan = calcularPlan(PERFIL, { hoy: HOY });
  // Fijas: la media (2458,86) · 0,8 = 1967 → redondeado a 5
  assert.equal(plan.entreno.kcal, 1965);
  assert.equal(plan.descanso.kcal, 1965);
  assert.deepEqual(plan.avisos, []);
});

test('Modo entreno/descanso: más kcal los días de entreno con el mismo total semanal', () => {
  const plan = calcularPlan({ ...PERFIL, modoKcal: 'ciclo' }, { hoy: HOY });
  assert.ok(plan.entreno.kcal > plan.descanso.kcal);
  const fijas = calcularPlan(PERFIL, { hoy: HOY });
  cerca(plan.kcalMedia * 7, fijas.kcalMedia * 7, 25);
});

test('Aviso si el objetivo queda por debajo del metabolismo basal', () => {
  const plan = calcularPlan({ ...PERFIL, ritmo: 'agresivo', trabajo: 'sentado', pasos: 'menos-5', diasEntreno: 0 }, { hoy: HOY });
  assert.ok(plan.descanso.kcal < plan.basal);
  assert.match(plan.avisos[0], /metabolismo basal/);
});

test('Macros: proteína 2 g/kg, grasa 25 % (mínimo 0,7 g/kg), hidratos el resto, fibra 14 g/1000 kcal', () => {
  const m = macrosPara(2000, { peso: 80 });
  assert.equal(m.proteina, 160);
  // 25 % de 2000 = 500 kcal → 55,6 g → 56 (mínimo 0,7·80 = 56)
  assert.equal(m.grasa, 56);
  assert.equal(m.hidratos, Math.round((2000 - 160 * 4 - 56 * 9) / 4));
  assert.equal(m.fibra, 28);
  // Con pocas kcal, la grasa no baja del mínimo.
  assert.equal(macrosPara(1200, { peso: 80 }).grasa, 56);
  // Valores bloqueados a mano.
  assert.equal(macrosPara(2000, { peso: 80 }, { proteina: 140 }).proteina, 140);
});

test('Agua: 35 ml/kg y 500 ml más los días de entreno', () => {
  assert.equal(aguaPara({ peso: 80 }, false), 2800);
  assert.equal(aguaPara({ peso: 80 }, true), 3300);
});

test('Fecha estimada con 7.700 kcal por kg de grasa', () => {
  // 6 kg · 7700 / 500 kcal al día = 92,4 → 93 días
  const e = fechaEstimada({ pesoObjetivo: 74 }, 500, HOY, 80);
  assert.equal(e.dias, 93);
  assert.equal(e.fecha, sumarDias(HOY, 93));
  // Sin déficit no se llega bajando.
  assert.equal(fechaEstimada({ pesoObjetivo: 74 }, -200, HOY, 80), null);
  // Volumen: superávit para subir.
  assert.ok(fechaEstimada({ pesoObjetivo: 85 }, -300, HOY, 80).dias > 0);
});

test('Epley y calculadora de discos', () => {
  assert.equal(epley(100, 1), 100);
  cerca(epley(100, 5), 116.67, 0.01);
  const d = discosPorLado(100);
  assert.deepEqual(d.lado, [25, 15]);
  assert.ok(d.exacto);
  const raro = discosPorLado(101, { barra: 20, discos: [20, 10, 5, 2.5] });
  assert.equal(raro.exacto, false);
  assert.equal(raro.total, 100);
  assert.deepEqual(discosPorLado(62.5).lado, [20, 1.25]);
});

test('Unidades: kg ↔ lb', () => {
  cerca(deKg(100, 'imperial'), 220.46, 0.01);
  cerca(aKg(220.462, 'imperial'), 100, 0.01);
  assert.equal(deKg(80, 'metrico'), 80);
});

test('Media móvil de 7 días ignorando días sin dato', () => {
  const pesos = [
    { fecha: '2026-11-01', kg: 80 },
    { fecha: '2026-11-03', kg: 79 },
    { fecha: '2026-11-07', kg: 78 },
    { fecha: '2026-11-08', kg: 77 },
  ];
  // Del 2 al 8: 79, 78, 77 → 78
  assert.equal(media7(pesos, '2026-11-08'), 78);
  assert.equal(media7(pesos, '2026-11-01'), 80);
  const datos = datosCon({ pesos: pesos.map((p, i) => ({ ...p, id: `w${i}` })) });
  assert.equal(serieMedia(datos).at(-1).media, 78);
  assert.equal(pesoDeReferencia(datos, '2026-11-08'), 78);
});

function datosConPesos(desde, dias, inicial, porDia, extra = {}) {
  const pesos = Array.from({ length: dias }, (_, i) => ({ id: `w${i}`, fecha: sumarDias(desde, i), kg: Math.round((inicial + porDia * i) * 100) / 100 }));
  return datosCon({ pesos, ...extra });
}

test('Ritmo real y avisos: bajar demasiado rápido o estancarse', () => {
  const rapido = datosConPesos('2026-10-01', 40, 90, -0.2);
  const r = ritmoReal(rapido, '2026-11-09');
  cerca(r, -1.4, 0.05);
  assert.ok(avisosProgreso(rapido, '2026-11-09').some((a) => a.tipo === 'rapido'));
  const quieto = datosConPesos('2026-10-01', 40, 80, 0);
  assert.ok(avisosProgreso(quieto, '2026-11-09').some((a) => a.tipo === 'estancado'));
  const bien = datosConPesos('2026-10-01', 40, 80, -0.07);
  assert.deepEqual(avisosProgreso(bien, '2026-11-09'), []);
});

test('Hitos: el de peso se cumple con la media de una semana cerrada, no con un día suelto', () => {
  let datos = datosCon({
    pesos: [
      { id: 'a', fecha: '2026-11-08', kg: 75 },
      { id: 'b', fecha: '2026-11-09', kg: 75 },
      { id: 'c', fecha: '2026-11-10', kg: 73.5 },
    ],
  });
  const hito = { id: 'h1', tipo: 'peso', comparador: '<', valor: 74, recompensa: 'Zapatillas nuevas', cumplido: null };
  assert.equal(estadoHito(datos, hito, '2026-11-10').cumple, false);
  datos = apuntarPeso(datos, '2026-11-11', 73);
  datos = apuntarPeso(datos, '2026-11-12', 73);
  datos = apuntarPeso(datos, '2026-11-13', 73);
  // La semana del 9 al 15 aún no ha terminado: no cuenta aunque su media ya baje de 74.
  assert.equal(estadoHito(datos, hito, '2026-11-13').cumple, false);
  const lunes = estadoHito(datos, hito, '2026-11-16');
  assert.equal(lunes.cumple, true);
  assert.equal(lunes.semana, '2026-11-09');
  // Un solo pesaje bajo (73) en una semana con media de 75 no lo consigue.
  const suelto = datosCon({ pesos: [{ id: 'a', fecha: '2026-11-02', kg: 76 }, { id: 'b', fecha: '2026-11-03', kg: 73 }, { id: 'c', fecha: '2026-11-04', kg: 76 }] });
  assert.equal(estadoHito(suelto, hito, '2026-11-16').cumple, false);
  // Sugerencias automáticas cada 2,5 % del peso inicial hasta el objetivo.
  const sug = hitosSugeridos(datosCon({ pesos: [{ id: 'x', fecha: '2026-11-01', kg: 80 }] }));
  assert.deepEqual(
    sug.map((s) => s.valor),
    [78, 76, 74],
  );
});

test('Hito de fuerza: se cumple con una serie efectiva (no de calentamiento)', () => {
  let datos = datosCon();
  datos = anadirHito(datos, { tipo: 'fuerza', comparador: '>', valor: 80, ejercicioId: 'x-press-banca', recompensa: 'Cena' });
  datos = empezarSesion(datos, { fecha: HOY });
  datos = actualizarActiva(datos, () => ({ series: [{ id: 'k1', ejercicioId: 'x-press-banca', kg: 85, reps: 3, calentamiento: true, hecha: true }] }));
  datos = terminarSesion(datos);
  assert.equal(datos.hitos[0].cumplido, null);
  datos = empezarSesion(datos, { fecha: HOY });
  datos = actualizarActiva(datos, () => ({ series: [{ id: 'k2', ejercicioId: 'x-press-banca', kg: 80, reps: 2, calentamiento: false, hecha: true }] }));
  datos = terminarSesion(datos);
  assert.ok(datos.hitos[0].cumplido);
});

const pollo = { id: 'a-pollo', nombre: 'Pechuga de pollo', marca: '', racion: 150, por100: { kcal: 110, proteina: 23, hidratos: 0, grasa: 2, fibra: 0 }, veces: 10, usado: 1, favorito: false };
const arroz = { id: 'a-arroz', nombre: 'Arroz cocido', marca: '', racion: 150, por100: { kcal: 130, proteina: 2.7, hidratos: 28, grasa: 0.3, fibra: 0.4 }, veces: 8, usado: 1, favorito: false };
const cafe = { id: 'a-cafe', nombre: 'Café con leche', marca: '', racion: 250, por100: { kcal: 40, proteina: 2, hidratos: 3, grasa: 2, fibra: 0 }, veces: 5, usado: 1, favorito: false };
const tostada = { id: 'a-tost', nombre: 'Tostada', marca: '', racion: 60, por100: { kcal: 260, proteina: 9, hidratos: 49, grasa: 3, fibra: 3 }, veces: 5, usado: 1, favorito: false };

test('Diario: nutrientes por gramos, totales, objetivo del día y lo que queda', () => {
  assert.deepEqual(nutrientesDe(pollo, 200), { kcal: 220, proteina: 46, hidratos: 0, grasa: 4, fibra: 0 });
  let datos = datosCon({ alimentos: [pollo, arroz] });
  ({ datos } = apuntar(datos, { fecha: HOY, momento: 'comida', minuto: 14 * 60, items: [{ ...nutrientesDe(pollo, 200), nombre: pollo.nombre, alimentoId: pollo.id, gramos: 200 }, { ...nutrientesDe(arroz, 150), nombre: arroz.nombre, alimentoId: arroz.id, gramos: 150 }] }));
  const r = resumenDia(datos, HOY);
  assert.equal(r.comido.kcal, 220 + 195);
  assert.equal(r.quedan.kcal, r.objetivo.kcal - 415);
  assert.equal(totales(r.registros).proteina, 46 + 4.1);
  // Usar un alimento suma a «veces» y «usado» (para recientes y frecuentes).
  assert.equal(datos.alimentos.find((a) => a.id === pollo.id).veces, 11);
});

test('Día de entreno: lo marcas tú o se detecta con un entreno apuntado', () => {
  let datos = datosCon({ perfil: { ...PERFIL, modoKcal: 'ciclo' } });
  assert.equal(esDiaEntreno(datos, HOY), false);
  datos = empezarSesion(datos, { fecha: HOY });
  datos = actualizarActiva(datos, () => ({ series: [{ id: 'k', ejercicioId: 'x-sentadilla', kg: 100, reps: 5, hecha: true }] }));
  datos = terminarSesion(datos);
  assert.equal(esDiaEntreno(datos, HOY), true);
  const conEntreno = objetivoDelDia(datos, HOY);
  datos = { ...datos, dias: { [HOY]: { agua: 0, suplementos: [], entreno: false } } };
  assert.ok(objetivoDelDia(datos, HOY).kcal < conEntreno.kcal);
});

test('Quick Meals: 3 o más veces en 14 días en la misma franja (± 1,5 h)', () => {
  let datos = datosCon({ alimentos: [cafe, tostada] });
  const desayuno = (fecha, minuto) =>
    apuntar(datos, {
      fecha,
      momento: 'desayuno',
      minuto,
      items: [
        { ...nutrientesDe(cafe, 250), nombre: cafe.nombre, alimentoId: cafe.id, gramos: 250 },
        { ...nutrientesDe(tostada, 60), nombre: tostada.nombre, alimentoId: tostada.id, gramos: 60 },
      ],
    }).datos;
  datos = desayuno('2026-11-10', 8 * 60);
  datos = desayuno('2026-11-11', 8 * 60 + 30);
  assert.equal(comidasHabituales(datos, HOY, 8 * 60).length, 0);
  datos = desayuno('2026-11-12', 7 * 60 + 45);
  const s = comidasHabituales(datos, HOY, 8 * 60 + 10);
  assert.equal(s.length, 1);
  assert.equal(s[0].nombre, 'Café con leche y tostada');
  assert.equal(s[0].veces, 3);
  // Lejos de esa hora (a las 21:00) no se sugiere.
  assert.equal(comidasHabituales(datos, HOY, 21 * 60).length, 0);
  // Más de 14 días atrás no cuenta.
  assert.equal(comidasHabituales(datos, sumarDias(HOY, 20), 8 * 60).length, 0);
  // Descartada: no vuelve a salir.
  datos = { ...datos, descartadas: [s[0].firma] };
  assert.equal(comidasHabituales(datos, HOY, 8 * 60).length, 0);
});

test('Qué puedo comer (sin IA): prioriza la proteína sin pasarse de kcal ni de grasa', () => {
  const datos = datosCon({ alimentos: [pollo, arroz, tostada] });
  const opciones = quePuedoComer(datos, { kcal: 600, proteina: 45, hidratos: 70, grasa: 15 });
  assert.ok(opciones.length >= 1 && opciones.length <= 3);
  const mejor = opciones[0];
  assert.ok(mejor.items.some((x) => x.alimento.id === 'a-pollo'));
  assert.ok(mejor.total.kcal <= 600 * 1.08);
  assert.ok(mejor.total.proteina >= 30);
  assert.deepEqual(quePuedoComer(datos, { kcal: 40, proteina: 5, hidratos: 5, grasa: 1 }), []);
});

test('Momento por hora y avisos del día (proteína baja, grasa y kcal pasadas)', () => {
  const datos = datosCon();
  assert.equal(momentoPorHora(datos.momentos, 8 * 60 + 20), 'desayuno');
  assert.equal(momentoPorHora(datos.momentos, 21 * 60), 'cena');
  const resumen = { fecha: HOY, objetivo: { kcal: 2000, proteina: 160, grasa: 60 }, comido: { kcal: 2400, proteina: 50, grasa: 80 }, quedan: { proteina: 110 } };
  const avisos = avisosDelDia(datos, resumen, new Date(`${HOY}T19:00:00`));
  assert.deepEqual(avisos.map((a) => a.tipo).sort(), ['grasa', 'kcal', 'proteina']);
  assert.equal(avisosDelDia(datos, resumen, new Date(`${HOY}T10:00:00`)).some((a) => a.tipo === 'proteina'), false);
});

test('Copiar comidas de otro día y sumar agua', () => {
  let datos = datosCon();
  ({ datos } = apuntar(datos, { fecha: '2026-11-13', momento: 'comida', minuto: 840, items: [{ nombre: 'Lentejas', kcal: 400, proteina: 20, hidratos: 50, grasa: 10 }] }));
  datos = copiarDia(datos, '2026-11-13', HOY);
  assert.equal(resumenDia(datos, HOY).comido.kcal, 400);
  datos = sumarAgua(sumarAgua(datos, HOY, 250), HOY, 250);
  assert.equal(datos.dias[HOY].agua, 500);
});

function sesion(fecha, ejercicioId, kg, reps, n = 3, extra = {}) {
  return { id: `s-${fecha}-${ejercicioId}`, fecha, inicio: 1, series: Array.from({ length: n }, (_, i) => ({ id: `k${i}`, ejercicioId, kg, reps, calentamiento: false, hecha: true })), cardio: [], ...extra };
}

test('Entreno: última vez (sin calentamientos) y sugerencia de subir peso', () => {
  const s1 = sesion('2026-11-02', 'x-press-banca', 70, 10);
  s1.series.unshift({ id: 'c', ejercicioId: 'x-press-banca', kg: 40, reps: 12, calentamiento: true, hecha: true });
  const datos = datosCon({ sesiones: [s1, sesion('2026-11-09', 'x-press-banca', 72.5, 12)] });
  const u = ultimaVez(datos, 'x-press-banca');
  assert.equal(u.fecha, '2026-11-09');
  assert.equal(u.series.length, 3);
  assert.ok(ultimaVez(datos, 'x-press-banca', '2026-11-05').series.every((x) => x.kg === 70));
  const s = sugerenciaSubida(datos, 'x-press-banca', 12);
  assert.equal(s.a, 75);
  assert.equal(sugerenciaSubida(datos, 'x-press-banca', 12, { antesDe: '2026-11-05' }), null);
  assert.equal(historialEjercicio(datos, 'x-press-banca').length, 2);
});

test('Deload Advisor: 1RM baja > 5 % en 2 principales durante 2 semanas', () => {
  const semanas = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
  const sesiones = [];
  semanas.forEach((f, i) => {
    const caida = i >= 2 ? 0.9 : 1;
    sesiones.push(sesion(f, 'x-press-banca', 80 * caida, 5, 3, { id: `b${i}` }), sesion(f, 'x-sentadilla', 120 * caida, 5, 3, { id: `q${i}` }));
  });
  const datos = datosCon({ sesiones });
  const a = asesorDescarga(datos, '2026-11-03');
  assert.equal(a.motivo, 'fuerza');
  assert.equal(a.ejercicios.length, 2);
  // Solo uno baja: no basta.
  const uno = datosCon({ sesiones: sesiones.filter((s) => !s.id.startsWith('q') || s.id === 'q0' || s.id === 'q1').concat(sesion('2026-10-19', 'x-sentadilla', 120, 5, 3, { id: 'q2' }), sesion('2026-10-26', 'x-sentadilla', 120, 5, 3, { id: 'q3' })) });
  assert.equal(asesorDescarga(uno, '2026-11-03'), null);
  // Descartada hace poco: no vuelve a salir.
  assert.equal(asesorDescarga({ ...datos, descargaDescartada: '2026-11-01' }, '2026-11-03'), null);
  // Fuerza bajando dos semanas en déficit.
  assert.ok(avisoFuerzaEnDeficit(datos, '2026-11-03') === null || avisoFuerzaEnDeficit(datos, '2026-11-03').texto);
});

test('Deload Advisor: 6 semanas seguidas subiendo la carga', () => {
  const sesiones = Array.from({ length: 8 }, (_, i) => sesion(sumarDias('2026-09-07', 7 * i), 'x-sentadilla', 100 + i * 2.5, 5, 3, { id: `v${i}` }));
  const datos = datosCon({ sesiones });
  const a = asesorDescarga(datos, '2026-11-03');
  assert.equal(a.motivo, 'acumulado');
  assert.ok(a.semanas >= 6);
  // Tras aceptar una descarga, se vuelve a contar desde ahí.
  assert.equal(asesorDescarga({ ...datos, descargas: ['2026-10-26'] }, '2026-11-03'), null);
});

test('Resumen semanal: cumplimiento, cambio de la media y récords', () => {
  let datos = datosConPesos('2026-10-26', 14, 80, -0.1, { sesiones: [sesion('2026-10-28', 'x-press-banca', 70, 8, 3, { id: 'p1' }), sesion('2026-11-05', 'x-press-banca', 72.5, 8, 3, { id: 'p2' })] });
  for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) ({ datos } = apuntar(datos, { fecha: f, momento: 'comida', minuto: 800, items: [{ nombre: 'Día', kcal: 2000, proteina: 160, hidratos: 200, grasa: 60 }] }));
  ({ datos } = apuntar(datos, { fecha: '2026-11-05', momento: 'comida', minuto: 800, items: [{ nombre: 'Atracón', kcal: 3000, proteina: 90, hidratos: 300, grasa: 120 }] }));
  const r = resumenSemanal(datos, '2026-11-02', { objetivo: () => ({ kcal: 2000, proteina: 160 }) });
  assert.equal(r.diasRegistrados, 4);
  assert.equal(r.cumplimientoKcal, 75);
  assert.equal(r.cumplimientoProteina, 75);
  assert.ok(r.cambio < 0);
  assert.equal(r.records.length, 1);
  assert.equal(r.entrenos, 1);
});

test('TDEE adaptativo: kcal apuntadas frente a la tendencia real del peso', () => {
  // 21 días comiendo 2.200 kcal y bajando 0,05 kg/día → mantenimiento ≈ 2200 + 0,05·7700 = 2585
  let datos = datosConPesos('2026-10-20', 26, 82, -0.05);
  for (let i = 0; i < 26; i++) ({ datos } = apuntar(datos, { fecha: sumarDias('2026-10-20', i), momento: 'comida', minuto: 800, items: [{ nombre: 'Día', kcal: 2200, proteina: 150, hidratos: 220, grasa: 70 }] }));
  const t = tdeeAdaptativo(datos, '2026-11-14');
  cerca(t.mantenimiento, 2585, 20);
  // Con pocos días apuntados, no se propone nada.
  assert.equal(tdeeAdaptativo(datosConPesos('2026-10-20', 26, 82, -0.05), '2026-11-14'), null);
  // Aceptarlo cambia el plan.
  const corregido = calcularPlan({ ...PERFIL, mantenimientoReal: t.mantenimiento }, { hoy: HOY });
  cerca(corregido.mantenimiento, t.mantenimiento, 1);
});

test('IA: JSON validado, kcal que no cuadran se recalculan y errores claros', () => {
  const items = leerEstimacion('```json\n{"items":[{"nombre":"Bocadillo de jamón","cantidad_g":220,"kcal":540,"proteina_g":28,"hidratos_g":62,"grasa_g":18,"fibra_g":3,"confianza":0.7},{"nombre":"Mal","cantidad_g":"x"}]}\n```');
  assert.equal(items.length, 1);
  assert.equal(items[0].gramos, 220);
  // 10·4 + 10·4 + 10·9 = 170 kcal; dice 900 → se corrige.
  assert.equal(validarItem({ nombre: 'X', cantidad_g: 100, kcal: 900, proteina_g: 10, hidratos_g: 10, grasa_g: 10 }).kcal, 170);
  assert.throws(() => leerEstimacion('{"items": []}'), /estimación/);
  const ideas = leerIdeas('{"ideas":[{"nombre":"Tortilla","items":[{"nombre":"Huevo","cantidad_g":120,"kcal":170,"proteina_g":15,"hidratos_g":1,"grasa_g":12}]}]}');
  assert.equal(ideas[0].items[0].nombre, 'Huevo');
  assert.deepEqual(extraerJSON('Aquí va: {"a":1} y ya'), { a: 1 });
  const libre = macrosDeKcal(1000);
  cerca(libre.proteina * 4 + libre.hidratos * 4 + libre.grasa * 9, 1000, 15);
});

test('Open Food Facts: producto con datos incompletos y catálogo propio', () => {
  const a = deOpenFoodFacts({ code: '8480000213587', product_name: 'Griego ligero', brands: 'Hacendado, Mercadona', serving_quantity: 125, serving_size: '125 g', nutriments: { 'energy-kcal_100g': 68, proteins_100g: 4.1, fat_100g: 2.6 } });
  assert.equal(a.marca, 'Hacendado');
  assert.equal(a.racion, 125);
  assert.deepEqual(a.faltan, ['hidratos']);
  // Solo kJ: se pasa a kcal.
  assert.equal(deOpenFoodFacts({ product_name: 'X', nutriments: { energy_100g: 418.4 } }).por100.kcal, 100);
  assert.equal(deOpenFoodFacts({ nutriments: {} }), null);
  let datos = datosCon();
  ({ datos } = guardarAlimento(datos, a));
  ({ datos } = guardarAlimento(datos, { ...a, nombre: 'Griego ligero natural' }));
  assert.equal(datos.alimentos.length, 1);
  assert.equal(buscarLocal(datos, 'griego hacendado').length, 1);
  assert.equal(buscarLocal(datos, 'pollo').length, 0);
});

test('Perfil: al guardarlo por primera vez apunta el peso inicial', () => {
  let datos = normalizarForma({});
  assert.equal(datos.perfil, null);
  assert.ok(EJERCICIOS_POR_DEFECTO.length > 30);
  datos = guardarPerfil(datos, PERFIL, HOY);
  assert.equal(datos.pesos.length, 1);
  assert.equal(datos.perfil.creado, HOY);
  assert.equal(normalizarForma(datos).perfil.peso, 80);
});

test('Cardio: kcal estimadas por intensidad', () => {
  assert.equal(kcalCardio(30, 'media', 80), 280);
  assert.equal(kcalCardio(60, 'suave', 70), 280);
});

test('Sincronización: cada comida, peso y entreno viaja por separado', async () => {
  let guardado = datosCon({ alimentos: [pollo] });
  ({ datos: guardado } = apuntar(guardado, { fecha: HOY, momento: 'comida', minuto: 800, items: [{ nombre: 'Pollo', kcal: 200, proteina: 40 }] }));
  guardado = apuntarPeso(guardado, HOY, 79.5);
  const col = coleccionForma({ leer: async () => guardado, guardar: async (d) => (guardado = d), normalizar: normalizarForma });
  const mapa = await col.leer();
  assert.ok(mapa.has('base'));
  assert.ok([...mapa.keys()].some((k) => k.startsWith('registros:')));
  assert.ok([...mapa.keys()].some((k) => k.startsWith('pesos:')));
  assert.ok([...mapa.keys()].some((k) => k.startsWith('alimentos:')));
  // Llega un peso nuevo de otro dispositivo y se borra una comida.
  const comida = [...mapa.keys()].find((k) => k.startsWith('registros:'));
  await col.aplicar([
    { id: 'pesos:w-otro', valor: JSON.stringify({ id: 'w-otro', fecha: '2026-11-13', kg: 80 }) },
    { id: comida, valor: null },
  ]);
  assert.equal(guardado.registros.length, 0);
  assert.equal(guardado.pesos.length, 2);
  assert.ok(guardado.perfil);
});

test('Open Food Facts: reintenta si va saturado y explica el fallo', async () => {
  const { buscarEnOpenFoodFacts } = await import('../src/compartido/forma/alimentos.js');
  let llamadas = 0;
  const saturado = async () => {
    llamadas++;
    if (llamadas < 3) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => ({ products: [{ code: '1', product_name: 'Avena', nutriments: { 'energy-kcal_100g': 370, proteins_100g: 13 } }] }) };
  };
  const r = await buscarEnOpenFoodFacts('avena', { fetch: saturado, espera: 1 });
  assert.equal(r.length, 1);
  assert.equal(llamadas, 3);
  await assert.rejects(() => buscarEnOpenFoodFacts('avena', { fetch: async () => { throw new TypeError('Failed to fetch'); }, espera: 1 }), /conectar con Open Food Facts/);
});
