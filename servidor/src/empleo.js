// Alertas de empleo: cada mañana, a la hora elegida, el servidor busca ofertas
// nuevas en los portales de ai-job-search (LinkedIn y freehire), las puntúa con
// su marco de evaluación (si hay clave de Groq en el servidor) y avisa al
// móvil solo de las que encajan. Las ya vistas no se repiten.
import { buscarEnPortales, detalleOferta } from '../../src/compartido/portales.js';
import { evaluarEncaje, normalizarOferta, normalizarPerfil, normalizarPreferencias, adaptarCV } from '../../src/compartido/empleo.js';
import { mesDe } from '../../src/compartido/consumo.js';
import { rutaIA, conRespaldo, normalizarModo, MAX_PREPARAR } from '../../src/compartido/modos.js';
import { tareaGroq } from '../../src/compartido/groq.js';
import { tareaOpenAI } from '../../src/compartido/openai.js';
import { aviso } from '../../src/compartido/notificaciones.js';
import { cifrarTexto, descifrarTexto } from './cifrado.js';
import { aMinutos } from './tiempo.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NUEVAS = 12;
const MAX_PREPARADAS = 15;
const PRESUPUESTOS = [0.5, 1, 1.5, 2, 3, 5];

export function validarAlerta(d = {}) {
  const pref = normalizarPreferencias(d);
  const alerta = {
    activa: d.activa === true,
    puestos: pref.puestos,
    ubicacion: pref.ubicacion,
    zonas: pref.zonas,
    distancia: pref.distancia,
    modalidad: pref.modalidad,
    hora: HORA.test(d.hora ?? '') ? d.hora : '08:30',
    minEncaje: Math.min(100, Math.max(0, Math.round(Number(d.minEncaje ?? 60)) || 0)),
    // Modo de IA de la app: decide qué hace Groq y qué GPT-6 Luna (ver modos.js).
    modo: normalizarModo(d.modo),
    // Candidaturas que se dejan preparadas cada mañana (CV y carta), y con qué límite.
    preparar: Math.min(MAX_PREPARAR[normalizarModo(d.modo)], Math.max(0, Math.round(Number(d.preparar ?? 2)) || 0)),
    investigar: d.investigar !== false,
    presupuesto: PRESUPUESTOS.includes(Number(d.presupuesto)) ? Number(d.presupuesto) : 1.5,
  };
  if (alerta.activa && !alerta.puestos) throw new Error('Di qué puesto buscar para las alertas.');
  return alerta;
}

// Lo que ve la app (sin el perfil cifrado).
export const alertaPublica = (a) => (a ? { ...a, perfil: undefined, conPerfil: Boolean(a.perfil) } : null);

export async function guardarAlerta(n, datos) {
  const anterior = (await n.ajustes()).empleoAlerta;
  const alerta = validarAlerta(datos);
  // El resumen del CV, para puntuar las ofertas: cifrado, como las demás claves.
  // El modo vale también para el resto del servidor (citas desde el correo).
  if (datos.modo) await n.poner('modoIA', alerta.modo);
  if (datos.perfil) alerta.perfil = await cifrarTexto(JSON.stringify(normalizarPerfil(datos.perfil)), n.env.CLAVE_CIFRADO);
  else if (anterior?.perfil) alerta.perfil = anterior.perfil;
  await n.poner('empleoAlerta', alerta);
  return alertaPublica(alerta);
}

// ¿Toca hoy? (a la hora elegida o en la media hora siguiente, una vez al día).
export async function tocaAlerta(n, local) {
  const alerta = (await n.ajustes()).empleoAlerta;
  if (!alerta?.activa) return false;
  const objetivo = aMinutos(alerta.hora);
  if (local.minutos < objetivo || local.minutos - objetivo > 30) return false;
  const clave = `empleo:${local.fecha}`;
  if ((await n.avisados([clave])).has(clave)) return false;
  await n.marcar([clave]);
  return true;
}

// La IA del servidor como función de tareas (la que esperan los pasos de empleo.js):
// cada paso va por Groq o por GPT-6 Luna según el modo, y si una falla, lo hace la otra.
// sinLuna: el gasto del mes ya llegó al máximo; solo Groq (gratis).
async function iaModo(n, { hacerFetch, usos, sinLuna = false }) {
  const m = await n.motoresIA();
  const hay = { groq: Boolean(m.groq), openai: Boolean(m.openai) && !sinLuna };
  if (!hay.groq && !hay.openai) return null;
  const llamar = (ia, p) =>
    ia === 'openai'
      ? tareaOpenAI({ apiKey: m.openai, modelo: 'gpt-6-luna', fetch: hacerFetch, alUso: (modelo, u) => usos.push([modelo, u]), ...p })
      : tareaGroq({ apiKey: m.groq, modelo: 'openai/gpt-oss-20b', fetch: hacerFetch, ...p });
  return ({ nivel, ...p }) => conRespaldo(rutaIA(m.modo, p.web ? 'web' : nivel === 'final' ? 'final' : 'fondo', hay), (ia) => llamar(ia, p));
}

const gastadoEsteMes = (a, ahora) => a.consumoOpenAI?.[mesDe(ahora)]?.usd ?? 0;

// manual: el botón «Buscar y preparar ahora» de la app → { preparar, excluir }.
// Busca en la última semana, también entre las ofertas que ya viste (menos
// aquellas a las que ya tienes candidatura, que la app manda en excluir), y
// deja en cola las mejores para preparar al momento, sin esperar a mañana.
export async function alertaEmpleo(n, { avisar = true, hacerFetch = fetch, manual = null } = {}) {
  const ajustes = await n.ajustes();
  const alerta = ajustes.empleoAlerta;
  if (!alerta?.puestos) throw new Error('No hay alerta de empleo configurada.');
  const r = await buscarEnPortales(
    { puestos: alerta.puestos, ubicacion: alerta.ubicacion, zonas: alerta.zonas ?? [], distancia: alerta.distancia ?? 0, modalidad: alerta.modalidad, dias: manual ? 7 : 2 },
    hacerFetch,
  );
  let ofertas = r.ofertas.map(normalizarOferta);
  if (manual) {
    // Fuera las que ya tienen candidatura (en la app, en cola o preparadas en el servidor).
    const yaHechas = new Set([
      ...(manual.excluir ?? []).map(String),
      ...(ajustes.empleoCola ?? []).flatMap((o) => [o.id, o.url]),
      ...(await leerPreparadas(n)).flatMap((p) => [p.oferta?.id, p.oferta?.url]),
    ].filter(Boolean));
    ofertas = ofertas.filter((o) => !yaHechas.has(o.id) && !yaHechas.has(o.url)).slice(0, MAX_NUEVAS);
  } else {
    const vistas = await n.avisados(ofertas.map((o) => `oferta:${o.id}`));
    ofertas = ofertas.filter((o) => !vistas.has(`oferta:${o.id}`)).slice(0, MAX_NUEVAS);
  }
  await n.marcar(ofertas.map((o) => `oferta:${o.id}`));

  let evaluadas = false;
  const usos = [];
  // Puntuar es tarea de fondo: Groq en Ahorro y Eficiente, GPT-6 Luna en Calidad.
  const ia = await iaModo(n, { hacerFetch, usos, sinLuna: gastadoEsteMes(await n.ajustes(), n.ahora) >= (alerta.presupuesto ?? 1.5) });
  if (ia && alerta.perfil && ofertas.length) {
    try {
      const perfil = normalizarPerfil(JSON.parse(await descifrarTexto(alerta.perfil, n.env.CLAVE_CIFRADO)));
      ofertas = await evaluarEncaje(ia, perfil, ofertas, { preferencias: alerta });
      evaluadas = true;
    } catch (error) {
      await n.registrar('error', `Alertas de empleo: no se han podido puntuar (${error.message}).`);
    }
  }
  const buenas = evaluadas ? ofertas.filter((o) => o.puerta !== 'no' && (o.encaje ?? 0) >= alerta.minEncaje) : ofertas;
  const ultimas = { fecha: n.ahora, evaluadas, errores: r.errores, ofertas: buenas.slice(0, 15).map((o) => ({ ...o, descripcion: o.descripcion.slice(0, 3000) })) };
  await n.poner('empleoUltimas', ultimas);
  await n.anotarConsumo(usos).catch(() => {});

  // Las mejores se dejan en cola para preparar su candidatura, una por minuto (ver prepararSiguiente).
  const cuantas = manual ? Math.min(MAX_PREPARAR[normalizarModo(alerta.modo)], Math.max(1, Math.round(Number(manual.preparar)) || 2)) : alerta.preparar;
  const cola = (avisar || manual) && evaluadas && cuantas ? buenas.filter((o) => o.puerta !== 'no').slice(0, cuantas) : [];
  // Se añaden a lo que ya hubiera en cola (sin repetir), nunca lo pisan.
  const nuevasIds = new Set(cola.map((o) => o.id));
  const enCola = [...(ajustes.empleoCola ?? []).filter((o) => !nuevasIds.has(o.id)), ...cola.map((o) => ({ ...o, descripcion: o.descripcion.slice(0, 9000) }))];
  if (cola.length) await n.poner('empleoCola', enCola);

  if (avisar && buenas.length) {
    const [primera, segunda] = buenas;
    const linea = (o) => `${o.puesto}${o.empresa ? ` · ${o.empresa}` : ''}${o.encaje != null ? ` (${o.encaje})` : ''}`;
    await n.notificar({
      ...aviso(buenas.length === 1 ? `oferta nueva: ${primera.puesto}` : `${buenas.length} ofertas nuevas para ti`, [primera, segunda].filter(Boolean).map(linea).join(' · ')),
      url: './?empleo',
      etiqueta: 'empleo',
    });
  }
  await n.registrar(
    'automatizacion',
    `${manual ? 'Búsqueda a mano' : 'Alertas de empleo'}: ${ofertas.length} ${manual ? 'ofertas' : 'nuevas'}, ${buenas.length} ${
      evaluadas ? `con encaje de ${alerta.minEncaje} o más` : 'sin puntuar (sin IA en el servidor)'
    }${cola.length ? `; ${cola.length} en cola para preparar` : ''}.`,
  );
  return manual ? { ...ultimas, enCola: cola.length ? enCola.length : (ajustes.empleoCola ?? []).length, preparando: cola.length } : ultimas;
}

// ---------- Candidaturas preparadas cada mañana ----------
// Tras la alerta, el servidor prepara el CV adaptado y la carta de las mejores
// ofertas: una por minuto (cada una son 3-4 llamadas a la IA), con el CV
// cifrado y sin pasar del gasto máximo del mes. La app las recoge al abrir
// Empleo; nada se envía a ninguna empresa sin que lo confirmes.

async function leerPreparadas(n) {
  const cifradas = (await n.ajustes()).empleoPreparadas;
  if (!cifradas) return [];
  try {
    return JSON.parse(await descifrarTexto(cifradas, n.env.CLAVE_CIFRADO));
  } catch {
    return [];
  }
}

async function guardarPreparadas(n, lista) {
  if (!lista.length) return n.quitar('empleoPreparadas');
  await n.poner('empleoPreparadas', await cifrarTexto(JSON.stringify(lista.slice(0, MAX_PREPARADAS)), n.env.CLAVE_CIFRADO));
}

export const hayCola = async (n) => Boolean((await n.ajustes()).empleoCola?.length);

export async function prepararSiguiente(n, { hacerFetch = fetch } = {}) {
  const a = await n.ajustes();
  const [oferta, ...resto] = a.empleoCola ?? [];
  if (!oferta) return null;
  // Se saca de la cola antes de empezar: si algo falla, no se repite en bucle.
  await n.poner('empleoCola', resto);
  const alerta = a.empleoAlerta;
  if (!alerta?.perfil) return null;
  // Con el gasto del mes ya en el máximo, sigue solo con Groq (gratis); sin Groq, se para.
  const gastado = gastadoEsteMes(a, n.ahora);
  const agotado = gastado >= (alerta.presupuesto ?? 1.5);
  const usos = [];
  const ia = await iaModo(n, { hacerFetch, usos, sinLuna: agotado });
  if (!ia) {
    if (agotado) {
      await n.poner('empleoCola', []);
      await n.registrar('automatizacion', `Candidaturas: ya se ha gastado ${gastado.toFixed(2)} $ este mes (límite ${alerta.presupuesto} $); no preparo más hasta el mes que viene.`);
    }
    return null;
  }
  let completa = normalizarOferta(oferta);
  if (!completa.descripcion && completa.url) {
    try {
      const d = await detalleOferta(completa.url, hacerFetch);
      if (d?.descripcion) completa = { ...completa, descripcion: d.descripcion.slice(0, 9000) };
    } catch {
      // Con el resumen de la búsqueda también vale.
    }
  }
  const perfil = normalizarPerfil(JSON.parse(await descifrarTexto(alerta.perfil, n.env.CLAVE_CIFRADO)));
  try {
    const resultado = await adaptarCV(ia, perfil, completa, { investigar: alerta.investigar !== false });
    const preparada = {
      id: `p${n.ahora.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      fecha: n.ahora,
      oferta: { ...completa, encaje: resultado.encaje ?? completa.encaje },
      ...resultado,
    };
    await guardarPreparadas(n, [preparada, ...(await leerPreparadas(n)).filter((p) => p.oferta?.id !== completa.id)]);
    await n.registrar('automatizacion', `Candidatura preparada: ${completa.puesto}${completa.empresa ? ` · ${completa.empresa}` : ''}.`);
    // Al terminar la tanda, un solo aviso con todas.
    if (!resto.length) {
      const listas = (await leerPreparadas(n)).filter((p) => n.ahora - p.fecha < 3 * 3_600_000);
      await n.notificar({
        ...aviso(
          listas.length === 1 ? 'candidatura lista para revisar' : `${listas.length} candidaturas listas para revisar`,
          listas.slice(0, 2).map((p) => `${p.oferta.puesto}${p.oferta.empresa ? ` · ${p.oferta.empresa}` : ''}`).join(' · '),
        ),
        url: './?empleo',
        etiqueta: 'empleo-listas',
      });
    }
    return preparada;
  } finally {
    await n.anotarConsumo(usos).catch(() => {});
  }
}

// Para la app: las preparadas (descifradas) y quitarlas cuando ya las tiene.
export const preparadas = (n) => leerPreparadas(n);
export async function recogerPreparadas(n, ids) {
  const quitar = new Set((Array.isArray(ids) ? ids : []).map(String));
  await guardarPreparadas(n, (await leerPreparadas(n)).filter((p) => !quitar.has(p.id)));
}
