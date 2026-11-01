// Alertas de empleo: cada mañana, a la hora elegida, el servidor busca ofertas
// nuevas en los portales de ai-job-search (LinkedIn y freehire), las puntúa con
// su marco de evaluación (si hay clave de Groq en el servidor) y avisa al
// móvil solo de las que encajan. Las ya vistas no se repiten.
import { buscarEnPortales, detalleOferta } from '../../src/compartido/portales.js';
import { evaluarEncaje, normalizarOferta, normalizarPerfil, normalizarPreferencias, adaptarCV } from '../../src/compartido/empleo.js';
import { mesDe } from '../../src/compartido/consumo.js';
import { tareaGroq } from '../../src/compartido/groq.js';
import { tareaOpenAI } from '../../src/compartido/openai.js';
import { aviso } from '../../src/compartido/notificaciones.js';
import { cifrarTexto, descifrarTexto } from './cifrado.js';
import { aMinutos } from './tiempo.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NUEVAS = 12;
const MAX_PREPARADAS = 10;
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
    // Candidaturas que se dejan preparadas cada mañana (CV y carta), y con qué límite.
    preparar: Math.min(5, Math.max(0, Math.round(Number(d.preparar ?? 2)) || 0)),
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

// La IA del servidor como función de tareas (la que esperan los pasos de empleo.js).
const iaDe = (motor, hacerFetch, usos) =>
  motor.proveedor === 'openai'
    ? (p) => tareaOpenAI({ apiKey: motor.clave, modelo: 'gpt-6-luna', fetch: hacerFetch, alUso: (m, u) => usos.push([m, u]), ...p })
    : (p) => tareaGroq({ apiKey: motor.clave, modelo: 'openai/gpt-oss-20b', fetch: hacerFetch, ...p });

export async function alertaEmpleo(n, { avisar = true, hacerFetch = fetch } = {}) {
  const alerta = (await n.ajustes()).empleoAlerta;
  if (!alerta?.puestos) throw new Error('No hay alerta de empleo configurada.');
  const r = await buscarEnPortales(
    { puestos: alerta.puestos, ubicacion: alerta.ubicacion, zonas: alerta.zonas ?? [], distancia: alerta.distancia ?? 0, modalidad: alerta.modalidad, dias: 2 },
    hacerFetch,
  );
  let ofertas = r.ofertas.map(normalizarOferta);
  const vistas = await n.avisados(ofertas.map((o) => `oferta:${o.id}`));
  ofertas = ofertas.filter((o) => !vistas.has(`oferta:${o.id}`)).slice(0, MAX_NUEVAS);
  await n.marcar(ofertas.map((o) => `oferta:${o.id}`));

  let evaluadas = false;
  const usos = [];
  // Con OpenAI (GPT-6 Luna) si su clave está en el servidor; si no, con Groq.
  const motor = await n.iaServidor();
  if (motor && alerta.perfil && ofertas.length) {
    try {
      const perfil = normalizarPerfil(JSON.parse(await descifrarTexto(alerta.perfil, n.env.CLAVE_CIFRADO)));
      const ia = iaDe(motor, hacerFetch, usos);
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
  const cola = avisar && evaluadas && alerta.preparar ? buenas.filter((o) => o.puerta !== 'no').slice(0, alerta.preparar) : [];
  if (cola.length) await n.poner('empleoCola', cola.map((o) => ({ ...o, descripcion: o.descripcion.slice(0, 9000) })));

  if (avisar && buenas.length) {
    const [primera, segunda] = buenas;
    const linea = (o) => `${o.puesto}${o.empresa ? ` · ${o.empresa}` : ''}${o.encaje != null ? ` (${o.encaje})` : ''}`;
    await n.notificar({
      ...aviso(buenas.length === 1 ? `oferta nueva: ${primera.puesto}` : `${buenas.length} ofertas nuevas para ti`, [primera, segunda].filter(Boolean).map(linea).join(' · ')),
      url: './?empleo',
      etiqueta: 'empleo',
    });
  }
  await n.registrar('automatizacion', `Alertas de empleo: ${ofertas.length} nuevas, ${buenas.length} ${evaluadas ? `con encaje de ${alerta.minEncaje} o más` : 'sin puntuar (sin IA en el servidor)'}.`);
  return ultimas;
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
  const motor = await n.iaServidor();
  if (!alerta?.perfil || !motor) return null;
  if (motor.proveedor === 'openai') {
    const gastado = a.consumoOpenAI?.[mesDe(n.ahora)]?.usd ?? 0;
    if (gastado >= (alerta.presupuesto ?? 1.5)) {
      await n.poner('empleoCola', []);
      await n.registrar('automatizacion', `Candidaturas: ya se ha gastado ${gastado.toFixed(2)} $ este mes (límite ${alerta.presupuesto} $); no preparo más hasta el mes que viene.`);
      return null;
    }
  }
  let completa = oferta;
  if (!oferta.descripcion && oferta.url) {
    try {
      const d = await detalleOferta(oferta.url, hacerFetch);
      if (d?.descripcion) completa = { ...oferta, descripcion: d.descripcion.slice(0, 9000) };
    } catch {
      // Con el resumen de la búsqueda también vale.
    }
  }
  const perfil = normalizarPerfil(JSON.parse(await descifrarTexto(alerta.perfil, n.env.CLAVE_CIFRADO)));
  const usos = [];
  try {
    const resultado = await adaptarCV(iaDe(motor, hacerFetch, usos), perfil, completa, { investigar: alerta.investigar !== false });
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
