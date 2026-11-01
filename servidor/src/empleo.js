// Alertas de empleo: cada mañana, a la hora elegida, el servidor busca ofertas
// nuevas en los portales de ai-job-search (LinkedIn y freehire), las puntúa con
// su marco de evaluación (si hay clave de Groq en el servidor) y avisa al
// móvil solo de las que encajan. Las ya vistas no se repiten.
import { buscarEnPortales } from '../../src/compartido/portales.js';
import { evaluarEncaje, normalizarOferta, normalizarPerfil, normalizarPreferencias } from '../../src/compartido/empleo.js';
import { tareaGroq } from '../../src/compartido/groq.js';
import { tareaOpenAI } from '../../src/compartido/openai.js';
import { aviso } from '../../src/compartido/notificaciones.js';
import { cifrarTexto, descifrarTexto } from './cifrado.js';
import { aMinutos } from './tiempo.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NUEVAS = 12;

export function validarAlerta(d = {}) {
  const pref = normalizarPreferencias(d);
  const alerta = {
    activa: d.activa === true,
    puestos: pref.puestos,
    ubicacion: pref.ubicacion,
    modalidad: pref.modalidad,
    hora: HORA.test(d.hora ?? '') ? d.hora : '08:30',
    minEncaje: Math.min(100, Math.max(0, Math.round(Number(d.minEncaje ?? 60)) || 0)),
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

export async function alertaEmpleo(n, { avisar = true, hacerFetch = fetch } = {}) {
  const alerta = (await n.ajustes()).empleoAlerta;
  if (!alerta?.puestos) throw new Error('No hay alerta de empleo configurada.');
  const r = await buscarEnPortales({ puestos: alerta.puestos, ubicacion: alerta.ubicacion, modalidad: alerta.modalidad, dias: 2 }, hacerFetch);
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
      const ia =
        motor.proveedor === 'openai'
          ? (p) => tareaOpenAI({ apiKey: motor.clave, modelo: 'gpt-6-luna', fetch: hacerFetch, alUso: (m, u) => usos.push([m, u]), ...p })
          : (p) => tareaGroq({ apiKey: motor.clave, modelo: 'openai/gpt-oss-20b', fetch: hacerFetch, ...p });
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
