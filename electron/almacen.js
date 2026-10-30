import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const MODELOS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

export const AJUSTES_POR_DEFECTO = {
  atajo: 'Control+Alt+K',
  paleta: 'carmesi',
  tamano: 'mediano',
  posicion: 'izquierda',
  calidadPelo: 'media',
  fuegos: true,
  seguirCursor: true,
  iniciarConWindows: false,
  dormirTrasMin: 5,
  voz: false,
  modelo: 'claude-opus-5-5',
  personalidad: '',
  correoCadaMin: 5,
  avisarCorreo: true,
  googleClientId: '',
};

// Valores permitidos: cualquier ajuste que llegue del renderer se valida aquí.
const OPCIONES = {
  paleta: ['carmesi', 'sombra', 'nieve'],
  tamano: ['pequeno', 'mediano', 'grande'],
  posicion: ['izquierda', 'derecha'],
  calidadPelo: ['baja', 'media', 'alta'],
  modelo: MODELOS,
};
const RANGOS = { dormirTrasMin: [0, 120], correoCadaMin: [1, 120] };
const LARGOS = { atajo: 60, personalidad: 2000, googleClientId: 200 };

const carpeta = () => app.getPath('userData');
const rutaAjustes = () => path.join(carpeta(), 'ajustes.json');
const rutaSecretos = () => path.join(carpeta(), 'secretos.json');

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return {};
  }
}

function escribirJson(ruta, datos) {
  mkdirSync(path.dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(datos, null, 2), { mode: 0o600 });
}

function valorValido(clave, valor) {
  const defecto = AJUSTES_POR_DEFECTO[clave];
  if (defecto === undefined || typeof valor !== typeof defecto) return false;
  if (OPCIONES[clave] && !OPCIONES[clave].includes(valor)) return false;
  if (RANGOS[clave] && (!Number.isInteger(valor) || valor < RANGOS[clave][0] || valor > RANGOS[clave][1])) return false;
  if (LARGOS[clave] && valor.length > LARGOS[clave]) return false;
  return true;
}

export function obtenerAjustes() {
  const guardados = leerJson(rutaAjustes());
  const ajustes = { ...AJUSTES_POR_DEFECTO };
  for (const [clave, valor] of Object.entries(guardados)) {
    if (valorValido(clave, valor)) ajustes[clave] = valor;
  }
  return ajustes;
}

export function guardarAjustes(cambios) {
  const ajustes = obtenerAjustes();
  for (const [clave, valor] of Object.entries(cambios ?? {})) {
    if (!valorValido(clave, valor)) throw new Error(`Valor no válido para el ajuste "${clave}".`);
    ajustes[clave] = valor;
  }
  escribirJson(rutaAjustes(), ajustes);
  return ajustes;
}

// Secretos (clave de Claude, tokens de Google): cifrados con la API del
// sistema (DPAPI en Windows) y nunca enviados al renderer.
export function leerSecreto(nombre) {
  const cifrado = leerJson(rutaSecretos())[nombre];
  if (!cifrado) return null;
  try {
    return safeStorage.decryptString(Buffer.from(cifrado, 'base64'));
  } catch {
    return null;
  }
}

export function guardarSecreto(nombre, valor) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El sistema no permite cifrar datos: no se puede guardar la clave de forma segura.');
  }
  const secretos = leerJson(rutaSecretos());
  secretos[nombre] = safeStorage.encryptString(valor).toString('base64');
  escribirJson(rutaSecretos(), secretos);
}

export function borrarSecreto(nombre) {
  const secretos = leerJson(rutaSecretos());
  delete secretos[nombre];
  escribirJson(rutaSecretos(), secretos);
}
