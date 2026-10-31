// Servidor de avisos desde Windows: el ordenador no recibe push (ya avisa
// él mismo), pero se vincula con un código del móvil para mandar sus
// recordatorios al servidor y gestionar las automatizaciones.
import os from 'node:os';
import { ClienteServidor, URL_VALIDA, recordatoriosParaServidor } from '../src/compartido/servidor.js';
import { URL_SERVIDOR } from '../src/compartido/nube.js';
import { leerSecreto, guardarSecreto, borrarSecreto, obtenerAjustes, leerDatos } from './almacen.js';

const zona = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const url = () => (URL_VALIDA.test(obtenerAjustes().servidorUrl) ? obtenerAjustes().servidorUrl : URL_SERVIDOR);

async function usar(funcion) {
  if (!url()) throw new Error('El servidor de avisos no está configurado.');
  const token = leerSecreto('servidorToken');
  if (!token) throw new Error('Vincula primero este ordenador en Ajustes → Avisos en el móvil.');
  try {
    return await funcion(new ClienteServidor({ url: url(), token }));
  } catch (error) {
    if (error.desvinculado) borrarSecreto('servidorToken');
    throw error;
  }
}

let temporizador = null;
export function sincronizarRecordatorios() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (!url() || !leerSecreto('servidorToken')) return;
    usar((c) => c.recordatorios(recordatoriosParaServidor(leerDatos('recordatorios')))).catch(() => {});
  }, 400);
}

export const servidor = {
  async estado() {
    const base = { configurado: Boolean(url()), url: url(), integrado: Boolean(URL_SERVIDOR), soportaPush: false, puedeVincularConGoogle: false };
    if (!base.configurado || !leerSecreto('servidorToken')) return { ...base, vinculado: false };
    try {
      return { ...base, vinculado: true, ...(await usar((c) => c.estado())), pushAqui: false };
    } catch (error) {
      return error.desvinculado ? { ...base, vinculado: false } : { ...base, vinculado: true, error: error.message };
    }
  },
  async canjear(codigo) {
    if (!url()) throw new Error('El servidor de avisos no está configurado.');
    const r = await new ClienteServidor({ url: url() }).canjear(String(codigo ?? '').trim(), `Windows (${os.hostname()})`.slice(0, 60));
    guardarSecreto('servidorToken', r.token);
    await usar((c) => c.zona(zona())).catch(() => {});
    sincronizarRecordatorios();
    return servidor.estado();
  },
  probar: () => usar((c) => c.probar()),
  voz: (texto, voz) => usar((c) => c.voz(String(texto ?? ''), String(voz ?? ''))),
  empleo: {
    buscar: (datos) => usar((c) => c.empleoBuscar(datos)),
    detalle: (url) => usar((c) => c.empleoDetalle(String(url ?? ''))),
  },
  resumen: () => usar((c) => c.resumen()),
  crearCodigo: () => usar((c) => c.crearCodigo()),
  avisos: (avisos) => usar((c) => c.avisos(avisos)),
  groq(activar) {
    if (!activar) return usar((c) => c.groq(null));
    const clave = leerSecreto('claveGroq');
    if (!clave) throw new Error('Añade primero tu clave de Groq en Ajustes → Inteligencia artificial.');
    return usar((c) => c.groq(clave));
  },
  automatizaciones: {
    listar: () => usar((c) => c.automatizaciones()),
    crear: (datos) => usar((c) => c.crearAutomatizacion(datos)),
    actualizar: (id, datos) => usar((c) => c.actualizarAutomatizacion(id, datos)),
    borrar: (id) => usar((c) => c.borrarAutomatizacion(id)),
  },
  registro: () => usar((c) => c.registro()),
  quitarDispositivo: (id) => usar((c) => c.quitarDispositivo(String(id))),
  // Desde el ordenador solo se quita este dispositivo; borrar todo se hace desde el móvil.
  async desvincular() {
    await usar(async (c) => c.quitarDispositivo((await c.estado()).yo)).catch(() => {});
    borrarSecreto('servidorToken');
    return servidor.estado();
  },
};

// Para el chat: solo con el servidor vinculado.
export const automatizacionesChat = {
  disponible: async () => Boolean(url() && leerSecreto('servidorToken')),
  listar: servidor.automatizaciones.listar,
  crear: servidor.automatizaciones.crear,
};
