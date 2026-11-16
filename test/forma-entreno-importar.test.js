import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerImportacion, resolverPlan, aplicarImportacion, textoError, ErrorImportacion, formatoParaIA, extraerObjeto, validarImportacion } from '../src/compartido/forma/importar.js';
import { validarSesion, validarRutina, validarEjercicio, detallesSesion, claveRef } from '../src/compartido/forma/importar-entreno.js';
import { normalizarForma } from '../src/compartido/forma/datos.js';
import { volumenSesion, metCardio, kcalDeCardio, kcalNetasCardio, esEfectiva, cuentaVolumen, carga } from '../src/compartido/forma/entreno.js';
import { mejorMarca, mejorPeso } from '../src/compartido/forma/progreso.js';
import { objetivoDelDia, cardioExtraDelDia, esDiaEntreno } from '../src/compartido/forma/diario.js';
import { epley } from '../src/compartido/forma/calculos.js';

const HOY = '2026-11-16';
const OPC = { hoy: HOY, ahoraMin: 21 * 60 };
const DEL_USUARIO = readFileSync(new URL('./datos/entreno-usuario.json', import.meta.url), 'utf8');
const PERFIL = { sexo: 'hombre', nacimiento: '1996-03-10', altura: 180, peso: 80, trabajo: 'sentado', pasos: '5-8', diasEntreno: 4, minutosSesion: 60, tipoEntreno: 'pesas', cardioSemana: 0, objetivo: 'perder', ritmo: 'moderado', modoKcal: 'fijas', creado: '2026-10-01' };
const base = (extra = {}) => normalizarForma({ perfil: PERFIL, pesos: [{ id: 'w1', fecha: '2026-11-10', kg: 80 }], ...extra });
const errores = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ErrorImportacion, String(e));
    return e.errores.map(textoError);
  }
  assert.fail('no ha lanzado');
};
const sesion = (s) => ({ forma_import: 1, sesiones: [{ fecha: HOY, ...s }] });

// ---------- El JSON real del usuario ----------

test('entrenos: el JSON del usuario se importa entero (6 ejercicios nuevos, 1 sesión, cardio)', () => {
  const d = base();
  const plan = leerImportacion(d, DEL_USUARIO, OPC);
  assert.equal(plan.ejercicios.length, 6);
  assert.equal(plan.sesiones.length, 1);
  const r = resolverPlan(d, plan, OPC);
  assert.deepEqual(r.errores.map(textoError), []);
  assert.equal(r.entreno.pendientes.length, 0, 'todas las referencias van a ejercicios del propio JSON');
  const { datos, resumen } = aplicarImportacion(d, plan, { ...OPC, ahora: 1_800_000_000_000 });
  assert.equal(resumen.ejerciciosCreados, 6);
  assert.equal(resumen.sesiones, 1);
  assert.equal(resumen.series, 20);
  assert.deepEqual(resumen.fechasEntreno, [HOY]);
  const n = normalizarForma(datos);
  const s = n.sesiones.at(-1);
  assert.equal(s.origen, 'importado');
  assert.equal(s.nombre, 'Entreno importado');
  assert.equal(s.notas, 'Pecho, hombro y tríceps. Molestia lumbar en el press militar.');
  assert.equal(s.ejercicios.length, 6);
  assert.equal((s.fin - s.inicio) / 60000, 95);
  assert.equal(new Date(s.inicio).getHours(), 20);
  assert.equal(new Date(s.inicio).getMinutes(), 5);
  const lat = n.ejercicios.find((e) => e.nombre === 'Elevaciones laterales en polea');
  assert.equal(lat.unilateral, true);
  assert.equal(lat.origen, 'importado');
  assert.equal(lat.propio, true);
  assert.equal(s.ejercicios.find((e) => e.ejercicioId === lat.id).notas, 'Cable por detrás del cuerpo. Última serie: derecha 8, izquierda 7.');
  const pec = n.ejercicios.find((e) => e.nombre === 'Pec fly en máquina');
  assert.deepEqual(pec.alias, ['Pec deck', 'Contractora']);
  const inclinado = n.ejercicios.find((e) => e.nombre === 'Press inclinado en máquina');
  assert.deepEqual([inclinado.grupo, inclinado.secundarios, inclinado.equipo, inclinado.principal], ['Pecho', ['Hombro', 'Tríceps'], 'maquina', true]);
  // Tipos de serie y fallo.
  const tras = n.ejercicios.find((e) => e.nombre === 'Extensión de tríceps tras nuca en polea');
  const deTras = s.series.filter((x) => x.ejercicioId === tras.id);
  assert.deepEqual(deTras.map((x) => x.tipo), ['efectiva', 'dropset', 'efectiva']);
  const alFallo = s.series.filter((x) => x.fallo);
  assert.equal(alFallo.length, 2);
  assert.ok(alFallo.every((x) => x.rir === 0), 'al fallo implica RIR 0');
  assert.equal(s.series.filter((x) => x.calentamiento).length, 3);
  // Cardio con METs (ACSM): 3,5 km/h al 10 % → 5,67 MET; 80 kg; 15 min → 113 kcal.
  assert.equal(s.cardio[0].tipo, 'cinta');
  assert.equal(s.cardio[0].kcal, 113);
  // Volumen: efectivas + dropset, × 2 en el unilateral; sin calentamiento.
  const esperado = 17.5 * 11 + 20 * 9 + 20 * 8 + 17.5 * 11 + 40 * 7 + 35 * 7 + 30 * 11 + 2 * (10 * 8 + 10 * 7 + 10 * 7) + 15 * 10 + 17.5 * 5 + 30 * 11 + 30 * 10 + 30 * 5 + 25 * 4 + 25 * 10;
  assert.equal(volumenSesion(n, s), Math.round(esperado));
  // Día de entreno y kcal del cardio en el objetivo.
  assert.ok(esDiaEntreno(n, HOY));
  assert.equal(cardioExtraDelDia(n, HOY), 113 - 20);
});

test('entrenos: importar dos veces el mismo JSON → la sesión sale como duplicada y desmarcada', () => {
  const d = normalizarForma(aplicarImportacion(base(), leerImportacion(base(), DEL_USUARIO, OPC), OPC).datos);
  const plan = leerImportacion(d, DEL_USUARIO, OPC);
  assert.ok(plan.ejercicios.every((e) => e.nivel === 'nombre' && e.decision === 'usar'), 'los 6 ejercicios ya existen');
  assert.equal(plan.sesiones[0].incluir, false);
  assert.ok(plan.sesiones[0].duplicadoId);
  assert.equal(plan.sesiones[0].decision, 'fusionar');
  // Tal cual: no cambia nada de entrenos (solo alias si los hubiera).
  const r = aplicarImportacion(d, plan, OPC);
  assert.equal(r.datos.sesiones.length, d.sesiones.length);
  assert.equal(r.datos.ejercicios.length, d.ejercicios.length);
  // Fusionar: no duplica series.
  plan.sesiones[0].incluir = true;
  const f = aplicarImportacion(d, plan, OPC);
  assert.equal(f.datos.sesiones.length, d.sesiones.length);
  assert.equal(f.resumen.series, 0);
  assert.equal(f.resumen.sesionesFusionadas, 1);
  // Sustituir: la reemplaza (mismo id).
  plan.sesiones[0].decision = 'sustituir';
  const sus = aplicarImportacion(d, plan, OPC);
  assert.equal(sus.datos.sesiones.length, d.sesiones.length);
  assert.equal(sus.datos.sesiones.find((x) => x.id === plan.sesiones[0].duplicadoId).series.length, 20);
  // Crear otra: dobles sesiones el mismo día.
  plan.sesiones[0].decision = 'crear';
  assert.equal(aplicarImportacion(d, plan, OPC).datos.sesiones.length, d.sesiones.length + 1);
});

test('entrenos: fusionar añade solo las series que faltan', () => {
  const d = base({
    sesiones: [{ id: 's1', fecha: HOY, series: [{ id: 'k1', ejercicioId: 'x-press-banca', kg: 60, reps: 10 }], cardio: [] }],
  });
  const plan = leerImportacion(d, JSON.stringify(sesion({ ejercicios: [{ ejercicio: 'Press banca', series: [{ peso_kg: 60, reps: 10 }, { peso_kg: 65, reps: 8 }] }] })), OPC);
  assert.equal(plan.sesiones[0].duplicadoId, 's1');
  plan.sesiones[0].incluir = true;
  const { datos, resumen } = aplicarImportacion(d, plan, OPC);
  assert.equal(resumen.series, 1);
  assert.deepEqual(datos.sesiones[0].series.map((x) => [x.kg, x.reps]), [[60, 10], [65, 8]]);
});

// ---------- Validación ----------

test('entrenos: errores con sesión, ejercicio y número de serie', () => {
  const v = validarSesion(
    {
      fecha: '2026-11-15',
      ejercicios: [
        { ejercicio: 'Dominadas', series: [{ peso_kg: 0, reps: 6 }, { peso_kg: 10 }, { tipo: 'al fallo', peso_kg: 10, reps: 5 }, { peso_kg: 600, reps: 5.5 }] },
        { series: [{ peso_kg: 1, reps: 1 }] },
        { ejercicio: 'Plancha', series: [] },
      ],
      cardio: [{ tipo: 'patinar', duracion_min: 0 }],
    },
    0,
    OPC,
  );
  const t = v.errores.map(textoError);
  assert.ok(t.includes('Sesión 1 (15 nov) › «Dominadas» › serie 2 › reps: es obligatorio (o duracion_s en isométricos)'), t.join('\n'));
  assert.ok(t.some((x) => x.startsWith('Sesión 1 (15 nov) › «Dominadas» › serie 3 › tipo: «al fallo» no vale')));
  assert.ok(t.includes('Sesión 1 (15 nov) › «Dominadas» › serie 4 › peso_kg: debe estar entre 0 y 500'));
  assert.ok(t.includes('Sesión 1 (15 nov) › «Dominadas» › serie 4 › reps: debe ser un número entero'));
  assert.ok(t.includes('Sesión 1 (15 nov) › ejercicio 2 › ejercicio: falta «ejercicio» (el nombre) o «ejercicio_id»'));
  assert.ok(t.includes('Sesión 1 (15 nov) › «Plancha» › series: hace falta al menos una serie'));
  assert.ok(t.some((x) => x.startsWith('Sesión 1 (15 nov) › cardio 1 › tipo: «patinar» no vale')));
  assert.ok(t.includes('Sesión 1 (15 nov) › cardio 1 › duracion_min: debe estar entre 1 y 300'));
});

test('entrenos: reglas de sesión (fecha futura, ejercicios o cardio, avisos)', () => {
  assert.match(textoError(validarSesion({ fecha: '2026-11-17', cardio: [{ tipo: 'bici', duracion_min: 20 }] }, 0, OPC).errores[0]), /fecha: es del futuro/);
  assert.match(textoError(validarSesion({ notas: 'nada' }, 0, OPC).errores[0]), /hace falta al menos «ejercicios» o «cardio»/);
  const sinFecha = validarSesion({ cardio: [{ tipo: 'bici', duracion_min: 20 }] }, 0, OPC);
  assert.equal(sinFecha.valor.fecha, HOY);
  const avisos = validarSesion({ fecha: '2026-09-01', duracion_min: 260, ejercicios: [{ ejercicio: 'Flexiones', series: [{ peso_kg: 0, reps: 60 }] }] }, 0, OPC).avisos.map(textoError);
  assert.ok(avisos.some((a) => /es de hace 76 días/.test(a)));
  assert.ok(avisos.some((a) => /más de 4 horas/.test(a)));
  assert.ok(avisos.some((a) => /serie 1 › reps: 60 repeticiones/.test(a)));
});

test('entrenos: series con lastre, libras, isométricos, RIR y fallo', () => {
  const v = validarSesion({ ejercicios: [{ ejercicio: 'Dominadas', series: [{ peso_kg: 0, lastre_kg: 5, reps: 6 }, { peso_lb: 100, reps: 5, rir: 2 }, { duracion_s: 45 }, { peso_kg: 50, reps: 5, rir: 3, fallo: true }] }] }, 0, OPC);
  assert.deepEqual(v.errores, []);
  const [a, b, c, d] = v.valor.ejercicios[0].series;
  assert.deepEqual(a, { tipo: 'efectiva', kg: 0, lastre: 5, reps: 6, fallo: false });
  assert.equal(b.kg, 45.25, '100 lb × 0,4536 = 45,36 → 45,25 (a 0,25)');
  assert.equal(b.rir, 2);
  assert.deepEqual(c, { tipo: 'efectiva', kg: 0, reps: 0, segundos: 45, fallo: false });
  assert.equal(d.rir, 0, 'fallo implica RIR 0');
  assert.match(textoError(validarSesion({ ejercicios: [{ ejercicio: 'X', series: [{ peso_kg: 5, reps: 5, rir: 7 }] }] }, 0, OPC).errores[0]), /rir: debe estar entre 0 y 5/);
});

test('entrenos: rutinas (series 1-10, reps_min ≤ reps_max, superserie) y ejercicios (grupo, equipo)', () => {
  const r = validarRutina({ nombre: 'Torso', ejercicios: [{ ejercicio: 'Press banca', series: 11, reps_min: 10, reps_max: 6, superserie: 'AB' }] }, 0);
  const t = r.errores.map(textoError);
  assert.ok(t.some((x) => /series: debe estar entre 1 y 10/.test(x)));
  assert.ok(t.some((x) => /reps_min: \(10\) no puede ser mayor que reps_max \(6\)/.test(x)));
  assert.ok(t.some((x) => /superserie: tiene que ser una letra/.test(x)));
  assert.match(textoError(validarRutina({ nombre: 'Vacía', ejercicios: [] }, 0).errores[0]), /hace falta al menos un ejercicio/);
  const ok = validarRutina({ nombre: 'Torso', ejercicios: [{ ejercicio_id: 'x-press-banca', series: 4, reps_min: 6, reps_max: 10, descanso_s: 150, superserie: 'a', notas: 'Agarre prono' }] }, 0);
  assert.deepEqual(ok.valor.ejercicios[0], { ref: { nombre: '', id: 'x-press-banca' }, series: 4, repMin: 6, repMax: 10, descanso: 150, superserie: 'A', notas: 'Agarre prono' });
  const e = validarEjercicio({ nombre: 'Curl araña', grupo: 'BÍCEPS', grupos_secundarios: ['antebrazo'], equipo: 'Peso corporal' }, 0);
  assert.deepEqual([e.valor.grupo, e.valor.secundarios, e.valor.equipo], ['Bíceps', ['Antebrazo'], 'peso_corporal']);
  assert.match(textoError(validarEjercicio({ nombre: 'X', grupo: 'cuello' }, 0).errores[0]), /grupo: «cuello» no vale: usa pecho, espalda/);
  assert.equal(validarEjercicio({ nombre: 'Sin grupo' }, 0).valor.grupo, 'Otro');
});

// ---------- Referencias a ejercicios ----------

test('entrenos: referencias por id, nombre normalizado, alias; si no, pendiente con 3 sugerencias', () => {
  const d = base({ ejercicios: [{ id: 'x-jalon-al-pecho', alias: ['Lat pulldown'] }] });
  const plan = leerImportacion(
    d,
    JSON.stringify(
      sesion({
        ejercicios: [
          { ejercicio_id: 'x-press-banca', series: [{ peso_kg: 60, reps: 8 }] },
          { ejercicio: 'JALON pecho', series: [{ peso_kg: 50, reps: 10 }] },
          { ejercicio: 'lat pulldown', series: [{ peso_kg: 50, reps: 10 }] },
          { ejercicio: 'Press banca inclinado con barra', series: [{ peso_kg: 50, reps: 8 }] },
        ],
      }),
    ),
    OPC,
  );
  const r = resolverPlan(d, plan, OPC);
  const destinos = r.entreno.sesiones[0].ejercicios.map((e) => e.destino?.ejercicio?.id ?? null);
  assert.deepEqual(destinos, ['x-press-banca', 'x-jalon-al-pecho', 'x-jalon-al-pecho', null]);
  assert.equal(r.entreno.pendientes.length, 1);
  assert.equal(r.entreno.pendientes[0].sugerencias.length, 3);
  // Nunca se crea en silencio.
  assert.match(errores(() => aplicarImportacion(d, plan, OPC))[0], /«Press banca inclinado con barra»: elige a qué ejercicio tuyo corresponde o créalo nuevo/);
  // Asociar: guarda el alias.
  const k = r.entreno.pendientes[0].clave;
  plan.resoluciones[k] = { tipo: 'asociar', ejercicioId: 'x-press-banca' };
  const a = aplicarImportacion(d, plan, OPC).datos;
  assert.ok(a.ejercicios.find((e) => e.id === 'x-press-banca').alias.includes('Press banca inclinado con barra'));
  // Crear: con grupo y equipo.
  plan.resoluciones[k] = { tipo: 'crear', grupo: 'Pecho', equipo: 'barra' };
  const c = normalizarForma(aplicarImportacion(d, plan, OPC).datos);
  const nuevo = c.ejercicios.find((e) => e.nombre === 'Press banca inclinado con barra');
  assert.deepEqual([nuevo.grupo, nuevo.equipo, nuevo.propio, nuevo.origen], ['Pecho', 'barra', true, 'importado']);
});

test('entrenos: un ejercicio_id que no existe avisa y busca por nombre', () => {
  const d = base();
  const plan = leerImportacion(d, JSON.stringify(sesion({ ejercicios: [{ ejercicio_id: 'x-borrado', ejercicio: 'Dominadas', series: [{ peso_kg: 0, reps: 8 }] }] })), OPC);
  const r = resolverPlan(d, plan, OPC);
  assert.equal(r.entreno.sesiones[0].ejercicios[0].destino.ejercicio.id, 'x-dominadas');
  assert.ok(r.entreno.avisos.some((a) => /x-borrado» no existe; lo busco por nombre/.test(a.mensaje)));
});

test('entrenos: un ejercicio del JSON que ya tienes (por nombre o por uno de sus alias) se usa y suma alias', () => {
  const d = base();
  const plan = leerImportacion(d, JSON.stringify({ forma_import: 1, ejercicios: [{ nombre: 'Lat pulldown', alias: ['Jalón al pecho'], grupo: 'espalda' }, { nombre: 'Jalón pecho con agarre neutro', grupo: 'espalda' }] }), OPC);
  assert.equal(plan.ejercicios[0].nivel, 'alias');
  assert.equal(plan.ejercicios[0].decision, 'usar');
  assert.equal(plan.ejercicios[1].decision, 'crear');
  assert.ok(plan.ejercicios[1].sugerencias.some((s) => s.id === 'x-jalon-al-pecho'), 'sugiere el parecido');
  const { datos } = aplicarImportacion(d, plan, OPC);
  assert.ok(datos.ejercicios.find((e) => e.id === 'x-jalon-al-pecho').alias.includes('Lat pulldown'));
});

// ---------- Rutinas ----------

test('entrenos: rutina nueva, rutina que ya existe (se actualiza) y rutina de la sesión', () => {
  const d = base({ rutinas: [{ id: 'q1', nombre: 'Espalda y bíceps', ejercicios: [{ ejercicioId: 'x-remo-con-barra', series: 3 }] }] });
  const json = {
    forma_import: 1,
    rutinas: [
      { nombre: 'espalda y biceps', ejercicios: [{ ejercicio_id: 'x-jalon-al-pecho', series: 4, reps_min: 6, reps_max: 10, descanso_s: 150 }, { ejercicio: 'Remo con barra', series: 4, reps_min: 6, reps_max: 8, notas: 'Agarre prono' }] },
      { nombre: 'Pierna', ejercicios: [{ ejercicio: 'Sentadilla', series: 5 }] },
    ],
    sesiones: [{ fecha: HOY, rutina: 'Espalda y bíceps', ejercicios: [{ ejercicio: 'Remo con barra', series: [{ peso_kg: 60, reps: 8 }] }] }],
  };
  const plan = leerImportacion(d, JSON.stringify(json), OPC);
  assert.equal(plan.rutinas[0].decision, 'actualizar');
  assert.equal(plan.rutinas[0].existenteId, 'q1');
  assert.equal(plan.rutinas[1].decision, 'crear');
  const { datos, resumen } = aplicarImportacion(d, plan, OPC);
  assert.equal(resumen.rutinasActualizadas, 1);
  assert.equal(resumen.rutinasCreadas, 1);
  const q1 = normalizarForma(datos).rutinas.find((r) => r.id === 'q1');
  assert.deepEqual(q1.ejercicios.map((e) => [e.ejercicioId, e.series, e.descanso, e.notas]), [['x-jalon-al-pecho', 4, 150, undefined], ['x-remo-con-barra', 4, undefined, 'Agarre prono']]);
  assert.equal(datos.sesiones.at(-1).rutinaId, 'q1');
  assert.equal(datos.sesiones.at(-1).nombre, 'Espalda y bíceps');
});

test('entrenos: una sesión con una rutina que no existe: crearla con sus ejercicios o sin rutina', () => {
  const d = base();
  const plan = leerImportacion(d, JSON.stringify(sesion({ rutina: 'Hombro', ejercicios: [{ ejercicio: 'Press militar', series: [{ peso_kg: 40, reps: 8 }, { peso_kg: 40, reps: 6 }] }] })), OPC);
  assert.match(errores(() => aplicarImportacion(d, plan, OPC))[0], /Rutina «Hombro»: no existe/);
  plan.sesiones[0].rutinaResolucion = 'crear';
  const c = aplicarImportacion(d, plan, OPC).datos;
  const q = c.rutinas.at(-1);
  assert.deepEqual([q.nombre, q.ejercicios[0].series, q.ejercicios[0].repMin, q.ejercicios[0].repMax], ['Hombro', 2, 6, 8]);
  assert.equal(c.sesiones.at(-1).rutinaId, q.id);
  plan.sesiones[0].rutinaResolucion = 'ninguna';
  const n = aplicarImportacion(d, plan, OPC).datos;
  assert.equal(n.rutinas.length, 0);
  assert.equal(n.sesiones.at(-1).rutinaId, undefined);
});

// ---------- Volumen, récords, 1RM ----------

test('tipos de serie: calentamiento no cuenta; dropset solo para el volumen; efectiva para todo', () => {
  const cal = { tipo: 'calentamiento', calentamiento: true, kg: 100, reps: 10 };
  const ef = { tipo: 'efectiva', kg: 80, reps: 5 };
  const drop = { tipo: 'dropset', kg: 200, reps: 5 };
  assert.deepEqual([esEfectiva(cal), esEfectiva(ef), esEfectiva(drop)], [false, true, false]);
  assert.deepEqual([cuentaVolumen(cal), cuentaVolumen(ef), cuentaVolumen(drop)], [false, true, true]);
  const d = base({ sesiones: [{ id: 's1', fecha: '2026-11-10', series: [{ ejercicioId: 'x-sentadilla', ...cal }, { ejercicioId: 'x-sentadilla', ...ef }, { ejercicioId: 'x-sentadilla', ...drop }], cardio: [] }] });
  assert.equal(mejorPeso(d, 'x-sentadilla'), 80, 'ni el calentamiento ni el dropset son récord');
  assert.equal(Math.round(mejorMarca(d, 'x-sentadilla').e1rm * 10) / 10, Math.round(epley(80, 5) * 10) / 10);
  assert.equal(volumenSesion(d, d.sesiones[0]), 80 * 5 + 200 * 5);
});

test('lastre: la carga es peso + lastre (volumen y 1RM); el unilateral cuenta ×2 en el volumen', () => {
  assert.equal(carga({ kg: 0, lastre: 10 }), 10);
  const d = base({ sesiones: [{ id: 's1', fecha: '2026-11-10', series: [{ ejercicioId: 'x-dominadas', kg: 0, lastre: 10, reps: 6 }, { ejercicioId: 'x-remo-con-mancuerna', kg: 30, reps: 10 }], cardio: [] }] });
  assert.equal(mejorPeso(d, 'x-dominadas'), 10);
  assert.equal(volumenSesion(d, d.sesiones[0]), 10 * 6 + 2 * 30 * 10);
});

test('vista previa: última vez, récords y volumen frente a la última de la misma rutina', () => {
  const d = base({
    rutinas: [{ id: 'q1', nombre: 'Pierna', ejercicios: [{ ejercicioId: 'x-sentadilla', series: 3 }] }],
    sesiones: [{ id: 's0', fecha: '2026-11-12', rutinaId: 'q1', series: [{ ejercicioId: 'x-sentadilla', kg: 100, reps: 5 }, { ejercicioId: 'x-sentadilla', kg: 100, reps: 5 }], cardio: [] }],
  });
  const plan = leerImportacion(d, JSON.stringify(sesion({ rutina: 'Pierna', ejercicios: [{ ejercicio: 'Sentadilla', series: [{ tipo: 'calentamiento', peso_kg: 60, reps: 8 }, { peso_kg: 105, reps: 5 }, { peso_kg: 250, reps: 1 }] }] })), OPC);
  const r = resolverPlan(d, plan, OPC);
  const det = detallesSesion(d, r.entreno, r.entreno.sesiones[0]);
  assert.equal(det.ejercicios[0].ultima.fecha, '2026-11-12');
  assert.ok(det.ejercicios[0].record.peso);
  assert.ok(det.ejercicios[0].record.e1rm);
  assert.equal(det.volumen, 105 * 5 + 250);
  assert.deepEqual(det.anterior, { fecha: '2026-11-12', volumen: 1000 });
  assert.ok(det.avisos.some((a) => /250 kg es más del doble de lo habitual \(100 kg\)/.test(a.mensaje)));
});

// ---------- Cardio ----------

test('cardio: METs con ACSM en cinta (velocidad e inclinación) y por tipo e intensidad', () => {
  assert.equal(metCardio({ tipo: 'cinta', velocidad: 3.5, inclinacion: 10 }), 5.67);
  assert.equal(metCardio({ tipo: 'cinta', velocidad: 5, inclinacion: 0 }), 3.38);
  assert.equal(metCardio({ tipo: 'correr', velocidad: 10 }), 10.52);
  assert.equal(metCardio({ tipo: 'cinta', velocidad: 9 }), 9.57, 'a partir de 8 km/h se cuenta como correr');
  assert.equal(metCardio({ tipo: 'bici', intensidad: 'alta' }), 9);
  assert.equal(kcalDeCardio({ tipo: 'cinta', minutos: 15, velocidad: 3.5, inclinacion: 10 }, 80), 113);
  assert.equal(kcalNetasCardio({ kcal: 113, minutos: 15 }, 80), 93);
  // Si el JSON trae las kcal, se respetan.
  const d = base();
  const plan = leerImportacion(d, JSON.stringify(sesion({ cardio: [{ tipo: 'remo', duracion_min: 20, kcal: 250 }] })), OPC);
  assert.equal(aplicarImportacion(d, plan, OPC).datos.sesiones.at(-1).cardio[0].kcal, 250);
});

test('cardio en el objetivo del día: suma las kcal netas menos lo que el plan ya incluye', () => {
  const sin = base();
  const conCardio = base({ sesiones: [{ id: 's1', fecha: HOY, series: [], cardio: [{ tipo: 'cinta', minutos: 15, kcal: 113 }] }] });
  const o0 = objetivoDelDia(sin, HOY);
  const o1 = objetivoDelDia(conCardio, HOY);
  assert.equal(o1.cardioExtra, 93);
  // El día con cardio es de entreno; comparo con un día de entreno sin cardio.
  const soloPesas = base({ sesiones: [{ id: 's1', fecha: HOY, series: [{ ejercicioId: 'x-press-banca', kg: 60, reps: 8 }], cardio: [] }] });
  assert.equal(o1.kcal - objetivoDelDia(soloPesas, HOY).kcal, 93);
  assert.ok(o0);
  // Con «cardio a la semana» en el perfil, se descuenta la media diaria incluida: 6 MET × 80 kg × (140/7 min) = 160 kcal.
  const declarado = normalizarForma({ ...conCardio, perfil: { ...PERFIL, cardioSemana: 140 } });
  assert.equal(cardioExtraDelDia(declarado, HOY), 0);
});

// ---------- Todo o nada y formato ----------

test('entrenos: todo o nada (un error en una serie no guarda nada de nada)', () => {
  const d = base();
  const plan = leerImportacion(d, DEL_USUARIO, OPC);
  plan.sesiones[0].fuente.ejercicios[0].series[2].reps = -1;
  const copia = JSON.stringify(d);
  assert.match(errores(() => aplicarImportacion(d, plan, OPC)).join('\n'), /«Press inclinado en máquina» › serie 3 › reps: debe estar entre 1 y 100/);
  assert.equal(JSON.stringify(d), copia);
});

test('entrenos: la referencia de una sesión se agrupa por nombre normalizado', () => {
  assert.equal(claveRef({ nombre: 'Jalón al pecho' }), claveRef({ nombre: 'jalon PECHO' }));
  assert.notEqual(claveRef({ id: 'x1', nombre: 'A' }), claveRef({ nombre: 'A' }));
});

test('formato para la IA: incluye entrenos y su ejemplo es válido', () => {
  const texto = formatoParaIA(base().momentos);
  assert.match(texto, /"sesiones"/);
  assert.match(texto, /calentamiento, efectiva o dropset/);
  const o = extraerObjeto(texto.replaceAll('AAAA-MM-DD', HOY));
  assert.deepEqual(validarImportacion(o, OPC).errores, []);
  const plan = leerImportacion(base(), JSON.stringify(o), OPC);
  const r = resolverPlan(base(), plan, OPC);
  assert.deepEqual(r.errores.map(textoError), []);
});
