// Ajustes por defecto y validación, compartidos por Electron y la web.
import { MODELOS_GROQ } from './groq.js';
import { MODELOS_OPENAI } from './openai.js';
import { permisosPorDefecto, opcionesPermisos } from './permisos.js';
import { IDS_VOCES } from './voz.js';
import { MODOS_IA, MODO_POR_DEFECTO } from './modos.js';

export const PROVEEDORES = ['groq', 'openai', 'claude'];
export const MODELOS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

export const AJUSTES_POR_DEFECTO = {
  atajo: 'Control+Alt+K',
  paleta: 'carmesi',
  estilo: 'ilustracion',
  tamano: 'mediano',
  posicion: 'izquierda',
  calidadPelo: 'auto',
  fuegos: true,
  seguirCursor: true,
  iniciarConWindows: false,
  dormirTrasMin: 5,
  voz: false,
  pulsoDiario: true,
  usarMemoria: true,
  busquedaWeb: true,
  avisarCitas: true,
  // Voz: natural (servidor propio, Workers AI) o la del dispositivo.
  vozTipo: 'natural',
  vozNombre: 'diana',
  // VoiceStudio en el mismo ordenador (solo Windows/escritorio).
  voicestudioUrl: 'http://127.0.0.1:3900',
  voicestudioVoz: 'default',
  ofrecerPortapapeles: true,
  // La IA gratuita por defecto; Claude, para quien tenga clave de pago.
  proveedor: 'groq',
  modeloGroq: MODELOS_GROQ[0],
  modeloOpenAI: MODELOS_OPENAI[0],
  // Con claves de Groq y OpenAI a la vez: qué IA hace cada cosa (ver modos.js).
  modoIA: MODO_POR_DEFECTO,
  modelo: 'claude-opus-5-5',
  personalidad: '',
  correoCadaMin: 5,
  avisarCorreo: true,
  // Logos de empresas (Google) y fotos de Gravatar en la bandeja.
  fotosRemitentes: true,
  googleClientId: '',
  // Servidor de avisos propio, si no se usa el que trae la app (ver servidor/).
  servidorUrl: '',
  // Qué puede hacer Kitsune por su cuenta (ver permisos.js).
  ...permisosPorDefecto(),
  // Sube cuando un cambio de la app tiene que corregir ajustes guardados antes.
  revision: 2,
};

const OPCIONES = {
  paleta: ['carmesi', 'sombra', 'nieve'],
  estilo: ['ilustracion', 'realista', 'anime', 'kawaii', 'tinta'],
  tamano: ['pequeno', 'mediano', 'grande'],
  posicion: ['izquierda', 'derecha'],
  calidadPelo: ['auto', 'alta', 'media', 'baja'],
  modelo: MODELOS,
  proveedor: PROVEEDORES,
  modeloGroq: MODELOS_GROQ,
  modeloOpenAI: MODELOS_OPENAI,
  modoIA: MODOS_IA,
  vozTipo: ['natural', 'dispositivo', 'voicestudio'],
  vozNombre: IDS_VOCES,
  ...opcionesPermisos(),
};
const RANGOS = { dormirTrasMin: [0, 120], correoCadaMin: [1, 120] };
const LARGOS = { atajo: 60, personalidad: 2000, googleClientId: 200, servidorUrl: 200, voicestudioUrl: 40, voicestudioVoz: 120 };

export function valorValido(clave, valor) {
  const defecto = AJUSTES_POR_DEFECTO[clave];
  if (defecto === undefined || typeof valor !== typeof defecto) return false;
  if (OPCIONES[clave] && !OPCIONES[clave].includes(valor)) return false;
  if (RANGOS[clave] && (!Number.isInteger(valor) || valor < RANGOS[clave][0] || valor > RANGOS[clave][1])) return false;
  if (LARGOS[clave] && valor.length > LARGOS[clave]) return false;
  // VoiceStudio solo en este ordenador: el texto no sale de él.
  if (clave === 'voicestudioUrl' && !/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(valor)) return false;
  return true;
}

// Mezcla lo guardado con los valores por defecto, ignorando lo que no sea válido.
export function normalizarAjustes(guardados = {}) {
  const ajustes = { ...AJUSTES_POR_DEFECTO };
  for (const [clave, valor] of Object.entries(guardados)) {
    if (valorValido(clave, valor)) ajustes[clave] = valor;
  }
  // Revisión 2: el estilo por defecto pasó a ser la ilustración, pero los
  // ajustes guardados antes conservaban «realista» sin haberlo elegido nadie.
  if (!(guardados.revision >= 2)) ajustes.estilo = AJUSTES_POR_DEFECTO.estilo;
  ajustes.revision = AJUSTES_POR_DEFECTO.revision;
  return ajustes;
}

export function aplicarCambios(actuales, cambios = {}) {
  const ajustes = { ...actuales };
  for (const [clave, valor] of Object.entries(cambios)) {
    if (!valorValido(clave, valor)) throw new Error(`Valor no válido para el ajuste "${clave}".`);
    ajustes[clave] = valor;
  }
  return ajustes;
}
