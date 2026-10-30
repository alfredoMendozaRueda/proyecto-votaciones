// Ajustes por defecto y validación, compartidos por Electron y la web.
import { MODELOS_GROQ } from './groq.js';

export const PROVEEDORES = ['groq', 'claude'];
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
  ofrecerPortapapeles: true,
  // La IA gratuita por defecto; Claude, para quien tenga clave de pago.
  proveedor: 'groq',
  modeloGroq: MODELOS_GROQ[0],
  modelo: 'claude-opus-5-5',
  personalidad: '',
  correoCadaMin: 5,
  avisarCorreo: true,
  googleClientId: '',
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
};
const RANGOS = { dormirTrasMin: [0, 120], correoCadaMin: [1, 120] };
const LARGOS = { atajo: 60, personalidad: 2000, googleClientId: 200 };

export function valorValido(clave, valor) {
  const defecto = AJUSTES_POR_DEFECTO[clave];
  if (defecto === undefined || typeof valor !== typeof defecto) return false;
  if (OPCIONES[clave] && !OPCIONES[clave].includes(valor)) return false;
  if (RANGOS[clave] && (!Number.isInteger(valor) || valor < RANGOS[clave][0] || valor > RANGOS[clave][1])) return false;
  if (LARGOS[clave] && valor.length > LARGOS[clave]) return false;
  return true;
}

// Mezcla lo guardado con los valores por defecto, ignorando lo que no sea válido.
export function normalizarAjustes(guardados = {}) {
  const ajustes = { ...AJUSTES_POR_DEFECTO };
  for (const [clave, valor] of Object.entries(guardados)) {
    if (valorValido(clave, valor)) ajustes[clave] = valor;
  }
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
