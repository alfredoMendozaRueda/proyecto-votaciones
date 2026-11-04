import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIBROS,
  TOTAL_CAPITULOS,
  libro,
  capitulosDe,
  tramos,
  textoLectura,
  enlaceCapitulo,
  enlaceCita,
  nombreCita,
  repartir,
  versiculosDe,
  diasDeLectura,
  diaSemana,
  PLANTILLAS,
  previaPlantilla,
  previaPropia,
  nombreDeLibros,
  normalizarBiblia,
  crearPlanDePlantilla,
  crearPlanPropio,
  marcarLectura,
  marcarLeido,
  marcarOrado,
  marcarCasilla,
  anadirCasilla,
  sumarMinutos,
  lecturasDelDia,
  estadoPlan,
  ponerseAlDia,
  racha,
  resumenMes,
  VERSICULOS,
  versiculoDelDia,
  avisosBiblia,
  crearAlmacenBiblia,
  resumenParaIA,
  sumarDias,
} from '../src/compartido/biblia.js';

const HOY = '2026-11-14'; // sábado

test('biblia: los 66 libros con sus capítulos, y cómo se dice cada lectura', () => {
  assert.equal(LIBROS.length, 66);
  assert.equal(TOTAL_CAPITULOS, 1189);
  assert.equal(LIBROS.filter((l) => l.at).length, 39);
  assert.equal(libro('PSA').capitulos, 150);
  assert.equal(libro('MAL').capitulos, 4);
  assert.equal(libro('JHN').versos[2], 36, 'Juan 3 tiene 36 versículos');
  assert.deepEqual(tramos(['JHN.3', 'JHN.4', 'ACT.1']), [{ libro: 'JHN', desde: 3, hasta: 4 }, { libro: 'ACT', desde: 1, hasta: 1 }]);
  assert.equal(textoLectura(['JHN.3', 'JHN.4', 'ACT.1']), 'Juan 3–4 · Hechos 1');
  assert.equal(textoLectura(['OBA.1']), 'Abdías');
  assert.equal(textoLectura(capitulosDe('RUT')), 'Rut (entero)');
  assert.equal(textoLectura(['1CO.13'], { corto: true }), '1 Co 13');
  assert.equal(enlaceCapitulo('JHN.3'), 'https://www.bible.com/bible/149/JHN.3.RVR1960');
  assert.equal(enlaceCita('PRO.3.5-6'), 'https://www.bible.com/bible/149/PRO.3.5-6.RVR1960');
  assert.equal(nombreCita('PRO.3.5-6'), 'Proverbios 3:5–6');
  assert.equal(nombreCita('JUD.1.24'), 'Judas 24');
  assert.deepEqual(capitulosDe(['GEN', 49, 50], ['PSA', 90, 90]), ['GEN.49', 'GEN.50', 'PSA.90']);
});

test('biblia: cada versículo del día existe (libro, capítulo y versículos)', () => {
  const vistos = new Set();
  for (const [cita, tema] of VERSICULOS) {
    const [id, cap, versos] = cita.split('.');
    const l = libro(id);
    assert.ok(l, cita);
    assert.ok(Number(cap) >= 1 && Number(cap) <= l.capitulos, cita);
    const [a, b = a] = versos.split('-').map(Number);
    assert.ok(a >= 1 && b >= a && b <= l.versos[Number(cap) - 1], `${cita}: el capítulo tiene ${l.versos[Number(cap) - 1]} versículos`);
    assert.ok(tema && !vistos.has(cita), cita);
    vistos.add(cita);
  }
  assert.ok(VERSICULOS.length >= 100);
  const v = versiculoDelDia(HOY);
  assert.match(v.enlace, /^https:\/\/www\.bible\.com\/bible\/149\/[1-3A-Z]{3}\.\d+\.\d+(-\d+)?\.RVR1960$/);
  assert.notEqual(versiculoDelDia(HOY).cita, versiculoDelDia(sumarDias(HOY, 1)).cita, 'cambia cada día');
});

test('biblia: repartir deja días seguidos, sin saltarse nada y parecidos en lectura', () => {
  const caps = capitulosDe(...LIBROS.map((l) => l.id));
  const dias = repartir(caps, 365);
  assert.equal(dias.length, 365);
  assert.deepEqual(dias.flat(), caps, 'en orden y completos');
  const pesos = dias.map(versiculosDe);
  const media = versiculosDe(caps) / 365;
  // Ningún día se va mucho de la media, salvo capítulos enormes (el Salmo 119 tiene 176 versículos).
  assert.ok(pesos.filter((p) => p > media * 1.8).every((p, i) => dias[pesos.indexOf(p)].includes('PSA.119') || p < 200), JSON.stringify(Math.max(...pesos)));
  assert.ok(Math.min(...pesos) > media * 0.3);
  // Menos capítulos que días: un capítulo por día y acaba antes.
  assert.equal(repartir(capitulosDe('RUT'), 10).length, 4);
});

test('biblia: los planes listos cubren lo suyo, también la cronológica, y saben los días de lectura', () => {
  for (const p of PLANTILLAS) {
    const caps = p.pistas().flat();
    assert.equal(new Set(caps).size, caps.length, `${p.id} sin repetidos`);
    const previa = previaPlantilla({ plantilla: p.id, inicio: HOY });
    assert.equal(previa.dias, p.dias, p.id);
    assert.equal(previa.capitulos, caps.length);
  }
  const crono = PLANTILLAS.find((p) => p.id === 'anio-cronologica').pistas()[0];
  assert.equal(crono.length, 1189);
  assert.ok(crono.indexOf('JOB.1') < crono.indexOf('GEN.12'), 'Job va tras Génesis 11');
  assert.ok(crono.indexOf('GAL.1') < crono.indexOf('ACT.15'));
  // Un año en orden: unos 14 minutos al día.
  assert.ok(previaPlantilla({ plantilla: 'anio-orden', inicio: HOY }).minutosMedia >= 12 && previaPlantilla({ plantilla: 'anio-orden', inicio: HOY }).minutosMedia <= 16);
  // De lunes a viernes: el NT en 90 días de lectura tarda 18 semanas.
  const lv = diasDeLectura('2026-11-16', { n: 90, dias: [1, 2, 3, 4, 5] });
  assert.ok(lv.every((f) => diaSemana(f) <= 5));
  assert.equal(previaPlantilla({ plantilla: 'nt-90', inicio: '2026-11-16', dias: [1, 2, 3, 4, 5] }).hasta, lv.at(-1));
  // Con fecha final, los días son los que quepan.
  assert.equal(previaPlantilla({ plantilla: 'evangelios-40', inicio: '2026-11-16', fin: '2026-11-29' }).dias, 14);
});

test('biblia: crear planes, marcar lo leído y «He leído» marca el plan', () => {
  let d = normalizarBiblia({});
  const r = crearPlanDePlantilla(d, { plantilla: 'anio-mixta', inicio: HOY });
  d = r.datos;
  assert.equal(r.plan.lecturas.length, 365);
  const primera = r.plan.lecturas[0];
  assert.ok(primera.caps.some((c) => c.startsWith('GEN')) && primera.caps.some((c) => c.startsWith('MAT')), 'AT y NT cada día');
  // Tu plan: Romanos y Hebreos en 6 semanas, de lunes a viernes.
  const propio = crearPlanPropio(d, { libros: ['HEB', 'ROM'], inicio: '2026-11-16', fin: '2026-12-25', dias: [1, 2, 3, 4, 5] });
  d = propio.datos;
  assert.equal(propio.plan.nombre, 'Romanos y Hebreos');
  assert.equal(propio.plan.lecturas[0].caps[0], 'ROM.1', 'en el orden de la Biblia');
  assert.ok(propio.plan.lecturas.every((l) => diaSemana(l.fecha) <= 5));
  assert.deepEqual(previaPropia({ libros: ['HEB', 'ROM'], inicio: '2026-11-16', fin: '2026-12-25', dias: [1, 2, 3, 4, 5] }).dias, propio.plan.lecturas.length);
  assert.equal(nombreDeLibros(['MAT', 'MRK', 'LUK', 'JHN', 'ACT']), 'Evangelios y Hechos');
  assert.equal(nombreDeLibros(LIBROS.filter((l) => !l.at).map((l) => l.id)), 'Nuevo Testamento');
  assert.equal(nombreDeLibros(['GEN', 'ROM', 'HEB', 'REV']), '4 libros');
  assert.throws(() => crearPlanPropio(d, { libros: [], inicio: HOY, fin: HOY }), /al menos un libro/);
  assert.throws(() => crearPlanPropio(d, { libros: ['ROM'], inicio: '2026-11-21', fin: '2026-11-22', dias: [1] }), /ningún día/);

  assert.equal(lecturasDelDia(d, HOY).length, 1);
  d = marcarLeido(d, HOY, true);
  assert.equal(d.dias[HOY].leido, true);
  assert.equal(d.planes[0].hechas[HOY], HOY, 'marca la lectura de hoy');
  d = marcarLeido(d, HOY, false);
  assert.equal(d.planes[0].hechas[HOY], undefined);
  // Marcar una lectura atrasada hoy: «He leído» hoy, y la lectura queda hecha.
  d = marcarLectura(d, d.planes[0].id, sumarDias(HOY, 1), true, HOY);
  assert.equal(d.dias[HOY].leido, true);
  d = marcarOrado(d, HOY);
  const c = anadirCasilla(d, 'Ayuno');
  d = marcarCasilla(c.datos, HOY, c.casilla.id, true);
  assert.deepEqual(d.dias[HOY].extra, { [c.casilla.id]: true });
  d = sumarMinutos(sumarMinutos(d, HOY, 'lectura', 15), HOY, 'lectura', 5);
  d = sumarMinutos(d, HOY, 'oracion', 10);
  assert.equal(d.dias[HOY].minLectura, 20);
  assert.equal(d.dias[HOY].minOracion, 10);
});

test('biblia: ponerse al día repartiendo, corriendo la fecha o saltando', () => {
  const inicio = sumarDias(HOY, -5);
  const base = crearPlanDePlantilla(normalizarBiblia({}), { plantilla: 'evangelios-40', inicio }).datos;
  const id = base.planes[0].id;
  // Leíste los dos primeros días; vas tres atrasado.
  let d = marcarLectura(marcarLectura(base, id, inicio, true, inicio), id, sumarDias(inicio, 1), true, sumarDias(inicio, 1));
  const e = estadoPlan(d.planes[0], HOY);
  assert.equal(e.atrasadas.length, 3);
  const fin = e.fin;

  const repartido = ponerseAlDia(d, id, 'repartir', HOY).planes[0];
  const er = estadoPlan(repartido, HOY);
  assert.equal(er.atrasadas.length, 0);
  assert.equal(er.fin, fin, 'acaba el mismo día');
  assert.equal(er.total, e.total, 'no se pierde nada');
  assert.deepEqual(repartido.lecturas.flatMap((l) => l.caps), base.planes[0].lecturas.flatMap((l) => l.caps), 'en el mismo orden');

  const movido = ponerseAlDia(d, id, 'mover', HOY).planes[0];
  const em = estadoPlan(movido, HOY);
  assert.equal(em.atrasadas.length, 0);
  assert.equal(em.fin, sumarDias(fin, 3), 'acaba tres días más tarde');
  assert.equal(movido.lecturas.find((l) => l.fecha === HOY).caps[0], base.planes[0].lecturas[2].caps[0], 'hoy toca lo que dejaste');

  const saltado = ponerseAlDia(d, id, 'saltar', HOY).planes[0];
  const es = estadoPlan(saltado, HOY);
  assert.equal(es.atrasadas.length, 0);
  assert.equal(saltado.saltadas.length, 3);
  assert.equal(es.leidos, e.leidos, 'lo saltado no cuenta como leído');

  // En un plan de AT y NT, al repartir cada día sigue trayendo de los dos.
  let mixto = crearPlanDePlantilla(normalizarBiblia({}), { plantilla: 'anio-mixta', inicio: sumarDias(HOY, -10) }).datos;
  mixto = ponerseAlDia(mixto, mixto.planes[0].id, 'repartir', HOY);
  const deHoy = mixto.planes[0].lecturas.find((l) => l.fecha === HOY).caps;
  assert.ok(deHoy.some((c) => libro(c.split('.')[0]).at) && deHoy.some((c) => !libro(c.split('.')[0]).at));
});

test('biblia: racha amable, resumen del mes y avisos', () => {
  let d = crearPlanDePlantilla(normalizarBiblia({}), { plantilla: 'nt-90', inicio: '2026-11-01' }).datos;
  for (const f of ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) d = marcarOrado(d, f);
  assert.equal(racha(d, HOY), 4, 'hoy aún no ha acabado: cuenta hasta ayer');
  d = marcarLeido(d, HOY);
  assert.equal(racha(d, HOY), 5);
  d = sumarMinutos(d, HOY, 'lectura', 12);
  const m = resumenMes(d, '2026-11', HOY);
  assert.equal(m.dias.length, 30);
  assert.equal(m.diasHechos, 5);
  assert.equal(m.diasHastaHoy, 14);
  assert.equal(m.diasOrados, 4);
  assert.equal(m.diasLeidos, 1);
  assert.equal(m.minLectura, 12);
  assert.ok(m.capitulos >= 2);
  assert.ok(m.dias.find((x) => x.fecha === HOY).tocaba);

  // Avisos: mañana y noche de los próximos días; lo hecho ya no avisa.
  const ahora = new Date(2026, 10, 14, 7, 0).getTime();
  const avisos = avisosBiblia(d, ahora, 3);
  assert.deepEqual(avisos.map((a) => a.id), ['b20261114n', 'b20261115m', 'b20261115n', 'b20261116m', 'b20261116n']);
  assert.equal(avisos[0].texto, '¿Has orado hoy?', 'ya leíste; falta orar');
  assert.match(avisos[1].texto, /^Hoy toca leer Marcos \d/);
  assert.match(avisos[2].texto, /^Te queda leer Marcos .* y orar$/);
  assert.equal(new Date(avisos[1].cuando).getHours(), 8);
  assert.deepEqual(avisosBiblia({ ...d, ajustes: { ...d.ajustes, avisos: false } }, ahora), []);
  assert.deepEqual(avisosBiblia(normalizarBiblia({}), ahora), [], 'sin usar el apartado, nada');
});

test('biblia: datos raros se limpian', () => {
  const d = normalizarBiblia({
    planes: [{ nombre: 'x', lecturas: [{ fecha: '2026-02-30', caps: ['JHN.3'] }] }, { id: 'pbueno1', lecturas: [{ fecha: HOY, caps: ['JHN.99', 'XXX.1', 'JHN.3'] }], hechas: { [HOY]: HOY, '2026-01-01': HOY } }],
    dias: { [HOY]: { leido: true, minLectura: -4, extra: { cmal: 'si' } }, '2026-13-01': { leido: true }, '2026-11-01': {} },
    casillas: [{ id: 'cayuno', nombre: ' Ayuno ' }, { id: 'malo', nombre: 'x' }],
    ajustes: { avisoManana: '25:00', avisoNoche: '' },
  });
  assert.equal(d.planes.length, 1);
  assert.deepEqual(d.planes[0].lecturas[0].caps, ['JHN.3']);
  assert.deepEqual(d.planes[0].hechas, { [HOY]: HOY });
  assert.deepEqual(Object.keys(d.dias), [HOY]);
  assert.equal(d.dias[HOY].minLectura, 0);
  assert.deepEqual(d.dias[HOY].extra, {});
  assert.deepEqual(d.casillas, [{ id: 'cayuno', nombre: 'Ayuno' }]);
  assert.equal(d.ajustes.avisoManana, '08:00');
  assert.equal(d.ajustes.avisoNoche, '', 'apagado se respeta');
});

test('biblia desde el chat: marcar «he leído y orado» y ver cómo vas', async () => {
  let guardado = crearPlanDePlantilla(normalizarBiblia({}), { plantilla: 'evangelios-40', inicio: HOY }).datos;
  const b = crearAlmacenBiblia({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)) });
  const r = await b.marcar({ que: ['leido', 'orado'], minutos_oracion: 10 }, HOY);
  assert.deepEqual(r.marcado, ['leído', 'orado']);
  assert.match(r.lectura, /^Mateo 1/);
  assert.equal(guardado.planes[0].hechas[HOY], HOY);
  assert.equal(guardado.dias[HOY].minOracion, 10);
  await assert.rejects(b.marcar({ que: ['ayuno'] }, HOY), /No tienes una casilla «ayuno»/);
  const ia = resumenParaIA(guardado, HOY);
  assert.match(ia.lectura_de_hoy[0], /\(hecha\)$/);
  assert.equal(ia.racha, '1 día seguido');
  assert.match(ia.planes[0], /^Los cuatro Evangelios en 40 días: \d+ %/);
  assert.match(ia.version, /1960/);
});

test('biblia en el chat: «ya he leído y orado» llama a marcar_biblia y avisa a la app', async () => {
  const { ConversacionClaude, gruposParaGroq } = await import('../src/compartido/claude.js');
  const sse = (trozos) => new Response(trozos.map((t) => `data: ${JSON.stringify(t)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  const delta = (d, fin = null) => ({ choices: [{ index: 0, delta: d, finish_reason: fin }] });
  const peticiones = [];
  const eventos = [];
  let guardado = crearPlanDePlantilla(normalizarBiblia({}), { plantilla: 'evangelios-40', inicio: HOY }).datos;
  const almacen = crearAlmacenBiblia({ leer: async () => guardado, guardar: async (d) => (guardado = structuredClone(d)) });
  const c = new ConversacionClaude({
    obtenerClave: async (p) => (p === 'openai' ? 'sk-prueba' : null),
    obtenerAjustes: () => ({ proveedor: 'openai', modeloOpenAI: 'gpt-6-luna', busquedaWeb: false, usarMemoria: false, personalidad: '' }),
    gmail: { estado: async () => ({ conectado: false }) },
    biblia: { marcar: (e) => almacen.marcar(e, HOY), resumen: () => almacen.resumen(HOY) },
    emitir: (e) => eventos.push(e),
    opcionesCliente: {
      fetch: async (url, init) => {
        const cuerpo = JSON.parse(init.body);
        peticiones.push(cuerpo);
        if (cuerpo.messages.at(-1).role === 'tool') return sse([delta({ content: 'Marcado: has leído Mateo 1–2 y has orado.' }), delta({}, 'stop')]);
        return sse([delta({ tool_calls: [{ index: 0, id: 'call_b', type: 'function', function: { name: 'marcar_biblia', arguments: '{"que":["Leído","oración"],"minutos_oracion":10}' } }] }), delta({}, 'tool_calls')]);
      },
    },
  });
  await c.enviar('ya he leído y orado 10 minutos');
  const nombres = peticiones[0].tools.map((t) => t.function.name);
  assert.ok(nombres.includes('marcar_biblia') && nombres.includes('ver_biblia'));
  assert.match(peticiones[0].messages[0].content, /lectura bíblica.*Reina-Valera 1960.*marcar_biblia/s);
  assert.equal(guardado.dias[HOY].leido, true);
  assert.equal(guardado.dias[HOY].orado, true);
  assert.equal(guardado.dias[HOY].minOracion, 10);
  assert.equal(guardado.planes[0].hechas[HOY], HOY, 'y la lectura del plan, hecha');
  const ev = eventos.find((e) => e.tipo === 'biblia');
  assert.deepEqual(ev.marcado.ids, ['leido', 'orado']);
  assert.ok(gruposParaGroq(['ya he leído y orado']).has('biblia'));
  assert.ok(gruposParaGroq(['¿qué me toca leer hoy?']).has('biblia'));
  assert.ok(!gruposParaGroq(['¿qué tiempo hace mañana?']).has('biblia'));
});
